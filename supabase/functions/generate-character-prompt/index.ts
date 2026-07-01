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

const SYSTEM_PROMPT = `You are an elite character concept artist and prompt engineer for hyper-realistic AI image generation. Your specialty is creating detailed character reference sheet prompts that produce consistent, production-quality character sheets.

When given a character (from mythology, history, or fiction), you MUST:
1. Research and understand the character's canonical appearance, iconography, cultural significance
2. Generate a comprehensive master prompt for a CHARACTER REFERENCE SHEET that includes:
   - Multiple angles: FRONT view, 3/4 LEFT view, 3/4 RIGHT view, BACK view
   - FACE close-up with expressions (neutral, fierce/divine, serene)
   - Full body head-to-toe description
   - Hyper-realistic rendering style (Unreal Engine 5 / Octane quality)
   - Exact skin color/texture description
   - Hair/crown/headgear details
   - Eye color, shape, and divine features (third eye, etc.)
   - Detailed garments with fabric texture and draping
   - Ornaments, jewelry, sacred items
   - Weapons/attributes held or nearby
   - Aura/divine glow/particle effects
   - Lighting setup for the reference sheet
   - Background (neutral studio or contextual)

OUTPUT FORMAT - Return ONLY a JSON object:
{
  "master_prompt": "The complete image generation prompt ready to use",
  "character_analysis": "Brief analysis of who this character is and key visual traits",
  "recommended_negative": "Negative prompt to avoid common issues",
  "style_notes": "Notes on the artistic direction"
}

PROMPT STYLE: Write the master_prompt as a single cohesive paragraph, densely packed with visual detail. Use commas to separate descriptors. Include lighting, camera, and rendering keywords at the end. The prompt should be 200-400 words and incredibly specific about every visual element.`;

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

    const { character_id, project_id, aspect_ratio } = await req.json();

    if (!character_id || !project_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: character_id, project_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
ASPECT RATIO: ${aspect_ratio || "1:1"}

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
${character.turnaround_prompt ? `- Existing Turnaround Prompt: ${character.turnaround_prompt}` : ""}

Generate the most detailed, production-quality character sheet prompt possible. Include ALL views (front, back, left, right) and face close-ups. Make it hyper-realistic with cinematic lighting. The prompt should be ready to paste directly into an image generation model.`;

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
        model: "google/gemini-2.5-flash",
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
      // LLM sometimes returns improperly escaped JSON - try to fix common issues
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
        // Last resort: extract the master_prompt field manually
        const promptMatch = cleaned.match(/"master_prompt"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"|\"\s*\})/);
        const analysisMatch = cleaned.match(/"character_analysis"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"|\"\s*\})/);
        const negativeMatch = cleaned.match(/"recommended_negative"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"|\"\s*\})/);

        parsed = {
          master_prompt: promptMatch ? promptMatch[1].replace(/\\n/g, " ").replace(/\\"/g, '"') : cleaned,
          character_analysis: analysisMatch ? analysisMatch[1] : "",
          recommended_negative: negativeMatch ? negativeMatch[1] : "",
          style_notes: "",
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
      aspect_ratio: aspect_ratio || "1:1",
      character_analysis: parsed.character_analysis || null,
      status: "success",
    });

    return new Response(
      JSON.stringify({ success: true, data: parsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
