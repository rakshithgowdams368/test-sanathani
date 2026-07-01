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

const SYSTEM_PROMPT = `You are an elite CINEMATOGRAPHY + PROSTHETICS prompt engineer. Produce a CHARACTER REFERENCE SHEET prompt that yields a hyper-realistic, film-grade result — a PHOTOGRAPH of a real costumed being, never a 3D render.

The sheet (5:4) must contain, cleanly separated with thin gutters and small labels: FRONT full body, 3/4 LEFT, 3/4 RIGHT, BACK, and one FACE close-up (neutral + serene). Neutral seamless grey studio, soft large key + subtle rim, no dramatic grade (this is a reference).

Write ONE dense paragraph, 220-360 words: subject → exact skin (tone, undertone, pores, subsurface scattering, sheen) → face geometry → eyes → hair/crown → garment (fabric weave, drape, wear) → ornaments (cast/hammered metal, gem cut, patina) → weapons/attributes → then camera+lighting+quality tail. End with a photoreal quality tail and a strong photoreal negative.

QUALITY TAIL to append: "Photorealistic, hyperdetailed, 8K, cinematic still, shot on ARRI Alexa 65, natural skin subsurface scattering, visible skin pores and texture, physically accurate materials, volumetric lighting, film grain, sharp focus on eyes, professional colour grading. --style photographic."

FORBIDDEN WORDS (never use in any prompt): render, CGI, 3D, Unreal, Octane, game, cartoon, illustration, painting, cel shading, anime.

OUTPUT FORMAT - Return ONLY a JSON object:
{
  "master_prompt": "The complete image generation prompt ready to use (220-360 words, single paragraph)",
  "character_analysis": "Brief analysis of who this character is and key visual traits from iconography",
  "recommended_negative": "3D render, CGI, video game render, Unreal Engine look, Octane render, plastic skin, waxy skin, airbrushed, smooth doll skin, cartoon, anime, illustration, painting, cel shading, over-saturated, over-sharpened halos, deformed hands, extra fingers, extra limbs, fused fingers, malformed face, asymmetric eyes, blurry, low-res, jpeg artifacts, watermark, text, logo, modern objects, wristwatch, plastic jewelry, duplicate, bad anatomy.",
  "style_notes": "Notes on the artistic direction",
  "recommended_model": "seedream-v4-5",
  "recommended_upscaler": "topaz/image-upscale"
}

PROMPT STYLE: Write the master_prompt as a single cohesive paragraph, densely packed with visual detail describing a REAL PHOTOGRAPH. Use commas to separate descriptors. Include lighting, camera, and rendering keywords at the end. The prompt should be 220-360 words and read as a cinematographer's brief for photographing a real costumed actor/creature on a physical set.`;

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

    const { character_id, project_id, aspect_ratio, llm_model } = await req.json();

    if (!character_id || !project_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: character_id, project_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LLM_MODELS: Record<string, string> = {
      "gemini": "google/gemini-2.5-flash",
      "claude": "anthropic/claude-sonnet-4",
      "openai": "openai/gpt-4o",
    };
    const selectedModel = LLM_MODELS[llm_model || "gemini"] || LLM_MODELS["gemini"];

    const { data: cred } = await supabase
      .from("api_credentials")
      .select("encrypted_key")
      .eq("user_id", user.id)
      .eq("provider", "openrouter")
      .maybeSingle();

    if (!cred?.encrypted_key) {
      return new Response(
        JSON.stringify({ error: "OpenRouter API key not configured. Go to Settings to add it." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: character } = await supabase
      .from("characters")
      .select("*")
      .eq("id", character_id)
      .maybeSingle();

    if (!character) {
      return new Response(
        JSON.stringify({ error: "Character not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dna = character.dna || {};
    const userMessage = `Generate a hyper-realistic CHARACTER REFERENCE SHEET master prompt for:

CHARACTER: ${character.name}${character.sanskrit_name ? ` (${character.sanskrit_name})` : ""}
ROLE: ${character.role}
ASPECT RATIO: ${aspect_ratio || "5:4"}

EXISTING CHARACTER DNA:
- Skin: ${dna.skin || "Not specified"}
- Face: ${dna.face || "Not specified"}
- Hair/Crown: ${dna.hair_crown || "Not specified"}
- Eyes: ${dna.eyes || "Not specified"}
- Garments: ${dna.garments || "Not specified"}
- Ornaments: ${dna.ornaments || "Not specified"}
- Weapons/Attributes: ${dna.weapons_attributes || "Not specified"}
- Signature Aura: ${dna.signature_aura || "Not specified"}
- Color Signature: ${dna.color_signature ? dna.color_signature.join(", ") : "Not specified"}
${character.consistency_token ? `- Consistency Token: ${character.consistency_token}` : ""}

IMPORTANT: This is a PHOTOGRAPH of a REAL being — describe real skin with pores and subsurface scattering, real metal with reflections and patina, real fabric with weave and draping. The reference sheet shows a real costumed actor/creature photographed in a studio, NOT a digital creation. Include all 5 views (front, 3/4 left, 3/4 right, back, face close-up) on a neutral grey seamless background with soft studio lighting.`;

    const openrouterKey = cred.encrypted_key;
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openrouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://purana-engine.app",
        "X-Title": "Purana Engine",
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.8,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter error (${response.status}): ${err}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const fixed = cleaned
        .replace(/[\x00-\x1f]/g, (ch: string) => {
          if (ch === "\n") return "\\n";
          if (ch === "\r") return "\\r";
          if (ch === "\t") return "\\t";
          return "";
        });
      try {
        parsed = JSON.parse(fixed);
      } catch {
        const promptMatch = cleaned.match(/"master_prompt"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"|\"\s*\})/);
        const analysisMatch = cleaned.match(/"character_analysis"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"|\"\s*\})/);
        const negativeMatch = cleaned.match(/"recommended_negative"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"|\"\s*\})/);

        parsed = {
          master_prompt: promptMatch ? promptMatch[1].replace(/\\n/g, " ").replace(/\\"/g, '"') : cleaned,
          character_analysis: analysisMatch ? analysisMatch[1] : "",
          recommended_negative: negativeMatch ? negativeMatch[1] : "3D render, CGI, video game render, plastic skin, cartoon, anime, illustration, painting, deformed hands, extra fingers, blurry, watermark, text, logo, modern objects.",
          style_notes: "",
          recommended_model: "seedream-v4-5",
          recommended_upscaler: "topaz/image-upscale",
        };
      }
    }

    // Save prompt to generation history
    await supabase.from("character_generation_history").insert({
      project_id,
      character_id,
      user_id: user.id,
      kind: "prompt",
      prompt: parsed.master_prompt || "",
      negative_prompt: parsed.recommended_negative || null,
      aspect_ratio: aspect_ratio || "5:4",
      model: selectedModel,
      character_analysis: parsed.character_analysis || null,
      status: "success",
    });

    return new Response(
      JSON.stringify({ success: true, data: parsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
