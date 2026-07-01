import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { source_url, project_id, shot_id, character_id, parent_job_id, factor, model } = await req.json();

    if (!source_url || !project_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: source_url, project_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: cred } = await supabase
      .from("api_credentials")
      .select("encrypted_key")
      .eq("user_id", user.id)
      .eq("provider", "kie")
      .maybeSingle();

    if (!cred?.encrypted_key) {
      return new Response(
        JSON.stringify({ error: "kie.ai API key not configured. Go to Settings to add it." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const kieKey = cred.encrypted_key;
    const upscaleModel = model || "topaz/image-upscale";
    const upscaleFactor = factor || 2;
    const callbackUrl = `${SUPABASE_URL}/functions/v1/kie-callback`;

    // Create job record first
    const { data: jobRecord, error: jobError } = await supabase
      .from("generation_jobs")
      .insert({
        project_id,
        shot_id: shot_id || null,
        kind: "upscale",
        provider: "kie",
        model: upscaleModel,
        status: "queuing",
        parent_id: parent_job_id || null,
        input: { source_url, factor: upscaleFactor, character_id: character_id || null },
      })
      .select("id")
      .single();

    if (jobError || !jobRecord) {
      throw new Error(`Failed to create job record: ${jobError?.message}`);
    }

    const kieResponse = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kieKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: upscaleModel,
        callBackUrl: callbackUrl,
        input: {
          image: source_url,
          upscale_factor: upscaleFactor,
        },
      }),
    });

    if (!kieResponse.ok) {
      const errText = await kieResponse.text();
      await supabase
        .from("generation_jobs")
        .update({ status: "failed", error: `kie.ai error (${kieResponse.status}): ${errText}` })
        .eq("id", jobRecord.id);
      throw new Error(`kie.ai error (${kieResponse.status}): ${errText}`);
    }

    const kieData = await kieResponse.json();
    const taskId = kieData.data?.taskId || kieData.data?.task_id || kieData.taskId || kieData.task_id || kieData.data?.id;

    if (!taskId) {
      await supabase
        .from("generation_jobs")
        .update({ status: "failed", error: `No taskId in response: ${JSON.stringify(kieData)}` })
        .eq("id", jobRecord.id);
      throw new Error("kie.ai did not return a task ID");
    }

    await supabase
      .from("generation_jobs")
      .update({ kie_task_id: taskId, status: "processing" })
      .eq("id", jobRecord.id);

    return new Response(
      JSON.stringify({ success: true, taskId, jobId: jobRecord.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
