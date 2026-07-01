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

    const { character_id, project_id, model, prompt, aspect_ratio } = await req.json();

    if (!character_id || !project_id || !prompt) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: character_id, project_id, prompt" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify project ownership
    const { data: project } = await supabase
      .from("projects")
      .select("id, user_id")
      .eq("id", project_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!project) {
      return new Response(
        JSON.stringify({ error: "Project not found or access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
    const callbackUrl = `${SUPABASE_URL}/functions/v1/kie-character-callback`;
    const imageModel = model || "nano-banana-2";

    // Insert the job record FIRST so we have the ID
    const { data: jobRecord, error: jobError } = await supabase
      .from("generation_jobs")
      .insert({
        project_id,
        kind: "image",
        provider: "kie",
        model: imageModel,
        status: "queuing",
        input: { prompt, aspect_ratio: aspect_ratio || "1:1", character_id },
      })
      .select("id")
      .single();

    if (jobError || !jobRecord) {
      throw new Error(`Failed to create job record: ${jobError?.message}`);
    }

    // Call kie.ai API
    const kieResponse = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kieKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: imageModel,
        callBackUrl: callbackUrl,
        input: {
          prompt,
          aspect_ratio: aspect_ratio || "1:1",
        },
      }),
    });

    if (!kieResponse.ok) {
      const errText = await kieResponse.text();
      // Update job as failed
      await supabase
        .from("generation_jobs")
        .update({ status: "failed", error: `kie.ai error (${kieResponse.status}): ${errText}` })
        .eq("id", jobRecord.id);
      throw new Error(`kie.ai error (${kieResponse.status}): ${errText}`);
    }

    const kieData = await kieResponse.json();
    // kie.ai returns taskId in various locations depending on version
    const taskId = kieData.data?.taskId || kieData.data?.task_id || kieData.taskId || kieData.task_id || kieData.data?.id;

    if (!taskId) {
      await supabase
        .from("generation_jobs")
        .update({ status: "failed", error: `No taskId in kie.ai response: ${JSON.stringify(kieData)}` })
        .eq("id", jobRecord.id);
      throw new Error("kie.ai did not return a task ID");
    }

    // Update job with the kie task ID
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
