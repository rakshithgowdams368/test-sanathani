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

    const { shot_id, project_id, model, prompt, aspect_ratio, params } = await req.json();

    if (!shot_id || !project_id || !prompt) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: shot_id, project_id, prompt" }),
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
    const callbackUrl = `${SUPABASE_URL}/functions/v1/kie-callback`;

    const kieResponse = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kieKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "nano-banana-2",
        callBackUrl: callbackUrl,
        input: {
          prompt,
          aspect_ratio: aspect_ratio || "9:16",
          ...(params || {}),
        },
      }),
    });

    if (!kieResponse.ok) {
      const errText = await kieResponse.text();
      throw new Error(`kie.ai error (${kieResponse.status}): ${errText}`);
    }

    const kieData = await kieResponse.json();
    const taskId = kieData.data?.taskId || kieData.taskId;

    await supabase.from("generation_jobs").insert({
      project_id,
      shot_id,
      kind: "image",
      provider: "kie",
      model: model || "nano-banana-2",
      kie_task_id: taskId,
      status: "queuing",
      input: { prompt, aspect_ratio, params },
    });

    return new Response(
      JSON.stringify({ success: true, taskId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
