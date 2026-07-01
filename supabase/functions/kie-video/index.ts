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

    const {
      shot_id,
      project_id,
      model,
      prompt,
      duration_sec,
      aspect_ratio,
      has_dialogue,
      init_image_url,
    } = await req.json();

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
    const selectedModel = model || "kling-3.0";

    // If no init_image_url provided, try to get the shot's hero frame
    let initUrl = init_image_url || null;
    if (!initUrl && shot_id) {
      const { data: imgPrompt } = await supabase
        .from("image_prompts")
        .select("final_url, base_url")
        .eq("shot_id", shot_id)
        .maybeSingle();
      if (imgPrompt) {
        initUrl = imgPrompt.final_url || imgPrompt.base_url || null;
      }
    }

    // Build kie.ai input based on model type
    const kieInput: Record<string, any> = {
      prompt,
      duration: String(Math.min(duration_sec ?? 5, 15)),
      sound: has_dialogue === true,
    };

    if (initUrl) {
      kieInput.image_urls = [initUrl];
    }

    if (aspect_ratio) {
      kieInput.aspect_ratio = aspect_ratio;
    }

    // Create job record first
    const { data: job, error: jobError } = await supabase
      .from("generation_jobs")
      .insert({
        project_id,
        shot_id,
        kind: "video",
        provider: "kie",
        model: selectedModel,
        status: "queuing",
        input: {
          prompt,
          model: selectedModel,
          duration_sec,
          has_dialogue,
          init_image_url: initUrl,
          aspect_ratio,
        },
      })
      .select("id")
      .single();

    if (jobError || !job) {
      throw new Error("Failed to create generation job");
    }

    const kieResponse = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kieKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selectedModel,
        callBackUrl: callbackUrl,
        input: kieInput,
      }),
    });

    if (!kieResponse.ok) {
      const errText = await kieResponse.text();
      await supabase
        .from("generation_jobs")
        .update({ status: "failed", error: errText })
        .eq("id", job.id);
      throw new Error(`kie.ai error (${kieResponse.status}): ${errText}`);
    }

    const kieData = await kieResponse.json();
    const taskId = kieData.data?.taskId || kieData.data?.task_id || kieData.taskId;

    await supabase
      .from("generation_jobs")
      .update({ kie_task_id: taskId, status: "processing" })
      .eq("id", job.id);

    return new Response(
      JSON.stringify({ success: true, taskId, jobId: job.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
