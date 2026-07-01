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
    const body = await req.json();
    const taskId = body.data?.task_id || body.data?.taskId || body.task_id;

    if (!taskId) {
      return new Response(
        JSON.stringify({ error: "Missing task_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: job } = await supabase
      .from("generation_jobs")
      .select("*")
      .eq("kie_task_id", taskId)
      .maybeSingle();

    if (!job) {
      return new Response(
        JSON.stringify({ ok: true, message: "Job not found, ignoring" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isSuccess = body.code === 200 || body.code === "200" || body.data?.status === "success";
    // kie.ai image callback: data.info.resultImageUrl or data.info.originImageUrl
    // kie.ai video callback: data.resultUrls[0]
    const resultUrl =
      body.data?.info?.resultImageUrl ||
      body.data?.info?.originImageUrl ||
      body.data?.resultUrls?.[0] ||
      body.data?.result_urls?.[0] ||
      body.data?.video_url ||
      null;

    if (isSuccess && resultUrl) {
      await supabase
        .from("generation_jobs")
        .update({
          status: "success",
          result_url: resultUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    } else {
      const errorMsg = body.msg || body.data?.error || "Generation failed";
      await supabase
        .from("generation_jobs")
        .update({
          status: "failed",
          error: errorMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
