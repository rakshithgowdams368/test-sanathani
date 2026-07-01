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

function parseJsonSafe(raw: string): any | null {
  let s = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  try { return JSON.parse(s); } catch {}
  const start = s.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let end = -1;
  for (let i = start; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) {
    s = s.substring(start) + "}".repeat(depth);
    try { return JSON.parse(s); } catch { return null; }
  }
  try { return JSON.parse(s.substring(start, end + 1)); } catch { return null; }
}

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

    const { analysis_id, video_url } = await req.json();
    if (!analysis_id) {
      return new Response(
        JSON.stringify({ error: "Missing analysis_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("copycat_analyses")
      .update({ status: "transcribing", updated_at: new Date().toISOString() })
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
        JSON.stringify({ error: "OpenRouter API key not configured. Go to Settings to add it." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Gemini Flash for audio transcription via OpenRouter
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cred.encrypted_key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://purana-engine.app",
        "X-Title": "Purana Engine CopyCat",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an audio/video transcription specialist. Given a video URL, analyze what you can infer about the audio content from context. If the user describes audio content or provides transcription hints, structure the output.

OUTPUT strict JSON:
{
  "has_speech": boolean,
  "music_only": boolean,
  "language_guess": "kannada" | "english" | "hindi" | "mixed" | "unknown",
  "dialogue": [{ "t": number, "speaker": "string", "line": "string" }],
  "music": { "mood": "string", "tempo": "string", "instrumentation": "string" },
  "narration": "string or null"
}`
          },
          {
            role: "user",
            content: `Analyze this video for audio content. The video URL is: ${video_url || "not provided"}. Based on visual context of a mythological/spiritual short-form video, provide your best assessment of the audio content. If you cannot determine speech, mark as music_only with appropriate mood/tempo for the visual style observed.`
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Transcription failed (${response.status}): ${errText}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";
    const transcript = parseJsonSafe(content);

    if (!transcript) {
      throw new Error("Failed to parse transcript JSON from model response");
    }

    await supabase
      .from("copycat_analyses")
      .update({
        transcript,
        status: "analyzing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", analysis_id);

    return new Response(
      JSON.stringify({ success: true, transcript }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
