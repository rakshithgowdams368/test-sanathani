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
      null;

    if (isSuccess && resultUrl) {
      let finalUrl = resultUrl;
      const characterId = job.input?.character_id;

      if (characterId) {
        try {
          const imageResponse = await fetch(resultUrl);
          if (imageResponse.ok) {
            const contentType = imageResponse.headers.get("content-type") || "image/png";
            const ext = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : contentType.includes("webp") ? "webp" : "png";
            const imageBuffer = await imageResponse.arrayBuffer();
            const filePath = `${job.project_id}/${characterId}.${ext}`;

            const { error: uploadError } = await supabase.storage
              .from("character-images")
              .upload(filePath, imageBuffer, {
                contentType,
                upsert: true,
              });

            if (!uploadError) {
              const { data: publicData } = supabase.storage
                .from("character-images")
                .getPublicUrl(filePath);
              finalUrl = publicData.publicUrl;
            }
          }
        } catch {
          // Fall back to original URL if upload fails
        }
      }

      await supabase
        .from("generation_jobs")
        .update({
          status: "success",
          result_url: finalUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      if (characterId) {
        await supabase
          .from("characters")
          .update({ ref_image_url: finalUrl })
          .eq("id", characterId);

        // Save to generation history
        const { data: project } = await supabase
          .from("projects")
          .select("user_id")
          .eq("id", job.project_id)
          .maybeSingle();

        if (project?.user_id) {
          await supabase.from("character_generation_history").insert({
            project_id: job.project_id,
            character_id: characterId,
            user_id: project.user_id,
            kind: "image",
            prompt: job.input?.prompt || null,
            aspect_ratio: job.input?.aspect_ratio || null,
            model: job.model || null,
            result_url: finalUrl,
            status: "success",
          });
        }
      }
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
