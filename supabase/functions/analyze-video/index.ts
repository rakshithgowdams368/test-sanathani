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

const VIDEO_DNA_SYSTEM = `You are a Film Forensics Analyst + reverse-prompt engineer. You are given SAMPLED FRAMES (in time order) from a single short video, the MEASURED dominant colour hex values per frame, the video metadata (duration, resolution, aspect, fps), and an audio TRANSCRIPT (or "music_only"). Reconstruct exactly how this video was made, so it can be re-created in the same style.

ANALYSE FRAME BY FRAME:
- Segment into SHOTS with start/end timestamps (use visible cuts / big changes between frames). Number them SC01-SH01 style.
- For EACH shot describe: subject(s) + what they are (if a deity/being, name the likely identity + iconography); framing (ECU/CU/MS/WS/EWS); camera angle; ESTIMATED lens (from compression/DOF: wide/35/50/85/macro); camera MOVEMENT (static / push / pull / pan / tilt / orbit / handheld / parallax) inferred from how the frame changes; lighting setup (key/rim/fill, practicals, time of day); the 30-60-10 colour palette USING THE PROVIDED MEASURED HEX VALUES (do not guess colours — assign the measured ones to p60/p30/p10); VFX/particles; composition; any on-screen text/watermark (note watermark but never reproduce another creator's identity as the subject).
- Overall: style (photoreal? stylised?), grade, pacing/energy arc, transition types, aspect ratio, and the AUDIO character (dialogue lines from transcript + who speaks; or music mood/tempo/instrumentation if music_only).
- CHARACTERS: for each recurring subject, a locked appearance block (skin, face, hair/crown, ornaments, garments, attributes) precise enough to reproduce consistently.

STYLE RULE: describe everything as PHOTOGRAPHY of a real scene. Never use render/CGI/3D/cartoon. This is for recreating an ORIGINAL video in the same technique — capture the recipe, not a watermark or a specific person's identity.

OUTPUT strict JSON:
{
 "meta": { "duration_sec": n, "aspect_ratio": "9:16", "fps": n, "style": "", "grade": "", "pacing": "", "energy_arc": "" },
 "audio": { "has_speech": bool, "music_only": bool, "dialogue": [{ "t": n, "speaker": "", "line": "" }],
            "music": { "mood": "", "tempo": "", "instrumentation": "" } },
 "characters": [ { "name":"", "identity_guess":"", "skin":"", "face":"", "hair_crown":"", "ornaments":"",
                   "garments":"", "attributes":"", "consistency_token":"" } ],
 "shots": [ { "shot_code":"SC01-SH01", "start_sec":n, "end_sec":n, "duration_sec":n,
   "subject":"", "framing":"", "angle":"", "lens_estimate":"", "camera_movement":"", "lighting":"",
   "palette": { "p60":{"hex":"","name":""}, "p30":{"hex":"","name":""}, "p10":{"hex":"","name":""} },
   "vfx":"", "composition":"", "onscreen_text":"", "transition_out":"" } ],
 "reconstruction_notes": ""
}`;

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

    const { analysis_id, frames, meta, transcript, model } = await req.json();
    if (!analysis_id || !frames || !meta) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: analysis_id, frames, meta" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("copycat_analyses")
      .update({ status: "analyzing", updated_at: new Date().toISOString() })
      .eq("id", analysis_id);

    const { data: cred } = await supabase
      .from("api_credentials")
      .select("encrypted_key")
      .eq("user_id", user.id)
      .eq("provider", "openrouter")
      .maybeSingle();

    if (!cred?.encrypted_key) {
      await supabase
        .from("copycat_analyses")
        .update({ status: "error", error: "OpenRouter API key not configured", updated_at: new Date().toISOString() })
        .eq("id", analysis_id);
      return new Response(
        JSON.stringify({ error: "OpenRouter API key not configured." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build multimodal content with frames as image_url parts
    const userContent: any[] = [];

    userContent.push({
      type: "text",
      text: `VIDEO METADATA: duration=${meta.duration}s, resolution=${meta.w}x${meta.h}, aspect=${meta.aspect}, sampled at ${meta.fps} fps.

AUDIO TRANSCRIPT: ${JSON.stringify(transcript || { music_only: true, has_speech: false })}

Below are ${frames.length} sampled frames in time order. Each frame includes its timestamp and MEASURED dominant colour hex values (pixel-sampled from the actual frame). Use these measured hex values for the palette — do not guess colours.

FRAME DATA:
${frames.map((f: any) => `t=${f.t}s palette=[${f.palette.join(", ")}]`).join("\n")}

Now analyze all the frames below and produce the Video DNA JSON.`
    });

    // Add frames as image parts (limit to 24 to stay within token limits)
    const framesToSend = frames.slice(0, 24);
    for (const frame of framesToSend) {
      userContent.push({
        type: "image_url",
        image_url: { url: frame.dataUrl },
      });
    }

    const visionModel = model || "google/gemini-2.5-flash";

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cred.encrypted_key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://purana-engine.app",
        "X-Title": "Purana Engine CopyCat",
      },
      body: JSON.stringify({
        model: visionModel,
        messages: [
          { role: "system", content: VIDEO_DNA_SYSTEM },
          { role: "user", content: userContent },
        ],
        temperature: 0.4,
        response_format: { type: "json_object" },
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      await supabase
        .from("copycat_analyses")
        .update({ status: "error", error: `Vision analysis failed: ${errText}`, updated_at: new Date().toISOString() })
        .eq("id", analysis_id);
      throw new Error(`Vision API error (${response.status}): ${errText}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const videoDna = JSON.parse(cleaned);

    await supabase
      .from("copycat_analyses")
      .update({
        video_dna: videoDna,
        frame_count: frames.length,
        status: "reconstructing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", analysis_id);

    return new Response(
      JSON.stringify({ success: true, video_dna: videoDna }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
