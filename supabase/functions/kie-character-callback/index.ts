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

    // kie.ai sends task_id in various locations
    const taskId =
      body.data?.task_id ||
      body.data?.taskId ||
      body.task_id ||
      body.taskId ||
      body.data?.id;

    if (!taskId) {
      console.error("No task_id in callback body:", JSON.stringify(body));
      return new Response(
        JSON.stringify({ error: "Missing task_id", received: body }),
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
      console.error("Job not found for taskId:", taskId);
      return new Response(
        JSON.stringify({ ok: true, message: "Job not found, ignoring" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine success - kie.ai uses various response formats
    const isSuccess =
      body.code === 200 ||
      body.code === "200" ||
      body.status === "success" ||
      body.data?.status === "success" ||
      body.data?.status === "completed" ||
      body.data?.state === "completed";

    // Extract result URL from various possible locations in kie.ai response
    const resultUrl =
      body.data?.output?.image_url ||
      body.data?.output?.url ||
      body.data?.output?.[0]?.url ||
      body.data?.output?.[0] ||
      body.data?.info?.resultImageUrl ||
      body.data?.info?.originImageUrl ||
      body.data?.result?.image_url ||
      body.data?.result?.url ||
      body.data?.resultUrls?.[0] ||
      body.data?.result_urls?.[0] ||
      body.data?.image_url ||
      body.data?.url ||
      body.output?.image_url ||
      body.output?.url ||
      body.result_url ||
      body.image_url ||
      null;

    console.log("Callback received:", JSON.stringify({ taskId, isSuccess, resultUrl, bodyKeys: Object.keys(body) }));

    if (isSuccess && resultUrl) {
      let finalUrl = resultUrl;
      const characterId = job.input?.character_id;

      // Download image and store in Supabase Storage
      if (characterId) {
        try {
          const imageResponse = await fetch(resultUrl);
          if (imageResponse.ok) {
            const contentType = imageResponse.headers.get("content-type") || "image/png";
            const ext = contentType.includes("jpeg") || contentType.includes("jpg")
              ? "jpg"
              : contentType.includes("webp")
                ? "webp"
                : "png";
            const imageBuffer = await imageResponse.arrayBuffer();
            const timestamp = Date.now();
            const filePath = `${job.project_id}/${characterId}_${timestamp}.${ext}`;

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
              console.log("Image uploaded to storage:", finalUrl);
            } else {
              console.error("Upload error:", uploadError.message);
            }
          } else {
            console.error("Failed to fetch image from kie.ai:", imageResponse.status);
          }
        } catch (fetchErr: any) {
          console.error("Error downloading/uploading image:", fetchErr.message);
        }
      }

      // Update job status
      await supabase
        .from("generation_jobs")
        .update({
          status: "success",
          result_url: finalUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      // Update character ref_image_url
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
    } else if (!isSuccess || !resultUrl) {
      const errorMsg =
        body.msg ||
        body.message ||
        body.data?.error ||
        body.data?.message ||
        body.error ||
        "Generation failed - no image URL in response";

      console.error("Generation failed:", errorMsg, "Body:", JSON.stringify(body));

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
  } catch (err: any) {
    console.error("Callback error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
