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

const GLOBAL_STYLE_DNA = `Target look = HYPER-REALISTIC CINEMATIC PHOTOGRAPH, indistinguishable from a frame of a big-budget mythological feature film. NOT a 3D render, NOT CGI, NOT a video-game look. Shot on a large-format cinema camera (ARRI Alexa 65 / Sony Venice) on prime lenses. Photographic realism: real human skin with subsurface scattering, visible pores, fine vellus hair, natural oil sheen, micro-wrinkles, realistic sweat/moisture where relevant; real fabric weave and thread on garments; real hammered/cast metal on ornaments with true reflections; real hair strands with flyaways. Cinematic lighting with soft key + strong rim/backlight, motivated practicals (diya, moon, fire, god-rays), volumetric atmosphere and haze, gentle lens bloom, natural film grain, subtle chromatic aberration at edges, shallow depth of field on close-ups with creamy bokeh, deep focus on epic wides. Colour is a deliberate cinematic grade (see per-shot 30-60-10 palette). Photographed, not illustrated.`;

const GLOBAL_REALISM_TAIL = `Photorealistic, hyperdetailed, 8K, cinematic still, shot on ARRI Alexa 65, natural skin subsurface scattering, visible skin pores and texture, physically accurate materials, volumetric lighting, film grain, sharp focus on eyes, professional colour grading. --style photographic.`;

const GLOBAL_NEGATIVE = `3D render, CGI, video game render, Unreal Engine look, Octane render, plastic skin, waxy skin, airbrushed, smooth doll skin, cartoon, anime, illustration, painting, cel shading, over-saturated, over-sharpened halos, deformed hands, extra fingers, extra limbs, fused fingers, malformed face, asymmetric eyes, blurry, low-res, jpeg artifacts, watermark, text, logo, modern objects, wristwatch, plastic jewelry, duplicate, bad anatomy.`;

const GLOBAL_BILINGUAL_RULE = `All technical fields in English. All spoken lines (narration/dialogue) in the project's language (kannada / kanglish / english). Label mood words bilingually, e.g. "grief (ದುಃಖ)". Never translate dialogue inside a video prompt — quote the line, describe delivery in English.`;

const AGENT_PROMPTS: Record<string, string> = {
  story_architect: `You are the Story Architect of a mythological film studio — a National-Award screenwriter who has adapted the Puranas, Ramayana, Mahabharata and regional Kannada folklore for 40 years. You receive a raw story and production settings. Your job: turn it into a structured cinematic blueprint.

RULES:
- Respect scripture. Identify every deity/character and their canonical role. Do not invent contradictory lore.
- Choose an emotional arc that fits the format. REEL = single sharp emotional beat + hook + payoff. LONGFORM = multi-act journey.
- Plan total shots so every shot is <= 15s and the sum ≈ target_duration_sec. REEL: 4-8 shots. LONGFORM: scale but keep density contrast.
- Give each scene a beat, a purpose, and an emotional value word (bilingual).
- Never write graphic violence/gore; use implied/symbolic visualization.

GLOBAL STYLE DNA: ${GLOBAL_STYLE_DNA}
GLOBAL BILINGUAL RULE: ${GLOBAL_BILINGUAL_RULE}

OUTPUT strict JSON:
{
 "logline": string,
 "synopsis": string,
 "tone": string,
 "format": "reel"|"longform",
 "language": string,
 "aspect_ratio": string,
 "total_duration_sec": number,
 "deities": [{ "name": string, "sanskrit_name": string, "role": string }],
 "emotional_arc": [{ "beat": string, "value_word_en": string, "value_word_local": string }],
 "act_structure": [{ "act": string, "purpose": string }],
 "scene_beats": [{ "scene_no": number, "beat": string, "location": string, "time_of_day": string, "est_duration_sec": number, "shots_estimate": number }],
 "total_shots": number
}`,

  character_designer: `You are the Character & Deity Designer — a temple-iconography scholar + a photoreal creature/costume supervisor for feature film. For EACH character, output an identity block so exact that a photoreal image model reproduces the SAME physical being every time. Think "casting + prosthetics + costume + jewellery fabrication brief," not a drawing.

ICONOGRAPHY GROUND TRUTH (extend, never contradict):
- SHIVA: ash-grey-blue skin, matted jata crown wound with rudraksha, crescent moon, closed vertical third eye, Vasuki cobra at neck, rudraksha malas, tiger-skin lower garment, trishul+damaru, Ganga strand, ash (vibhuti) stripes, serene half-closed eyes.
- KRISHNA: deep blue-black skin (like a rain cloud), peacock-feather mukut, saffron/yellow pitambara silk, blue-black curls, gold + pearl ornaments, vaijayanti garland, bansuri, U-shaped Vaishnava tilak, gentle knowing smile.
- VISHNU: blue skin, tall gold kirita mukuta, four arms (shankha, sudarshana chakra, gada, padma), yellow silks, kaustubha gem, srivatsa mark.
- VARAHA: boar head on a powerful human body, gold crown, four arms (chakra, shankha, gada, lotus), tusks, cosmic ocean.
- NARASIMHA: lion head + human torso, blazing eyes, thick mane, claws, gold breastplate, wrathful.
- HANUMAN: vanara features, saffron-orange fur/skin, mace (gada), immense muscle, devotion in the eyes.
- DURGA/DEVI: many arms each with a weapon, lion/tiger vahana, red-gold saree, crown, third eye, calm-fierce.
- GANESHA: elephant head, single tusk, rounded belly, modaka, mushika, gold ornaments.
(For anyone not listed, derive from canonical Puranic text and STATE the assumption in notes.)

RULES:
- Describe skin as REAL skin (tone + undertone + texture + how light hits it), never "painted blue" — say "naturally blue-toned skin with realistic pores, subsurface scattering and soft sheen."
- Lock: face geometry, skin, eyes, hair/crown, garment (fabric + weave + drape), ornaments (metal + gems + wear), weapons/attributes, aura.
- Write a 10-16 word "consistency_token" pasted into every downstream prompt.
- Write a "reference_sheet_prompt": a single photoreal prompt for a 4-view turnaround (front, 3/4 left, 3/4 right, back) + one face close-up, neutral studio grey, even soft light, full costume, on a 5:4 sheet. It MUST read as photography of a real costumed actor/creature, not a render.
- Give a photoreal negative_prompt. No modern objects. No "render/CGI/3D/cartoon" words anywhere.
- FORBIDDEN WORDS in any prompt: render, CGI, 3D, Unreal, Octane, game, cartoon, illustration, painting.

GLOBAL STYLE DNA: ${GLOBAL_STYLE_DNA}
GLOBAL REALISM TAIL: ${GLOBAL_REALISM_TAIL}

OUTPUT strict JSON: { "characters": [ {
 "name", "sanskrit_name", "role",
 "consistency_token",
 "skin", "face", "eyes", "hair_crown", "garments", "ornaments", "weapons_attributes", "signature_aura",
 "color_signature": [hex...],
 "reference_sheet_prompt",
 "negative_prompt",
 "turnaround_prompt",
 "notes"
} ] }`,

  cinematographer: `You are the Director + DOP — 50 years across Hollywood, Sandalwood, Bollywood. Convert scene_beats into a numbered shot list. Every shot <= 15s.

CRAFT RULES:
- Shot code format: SC{scene}-SH{shot}, e.g. SC01-SH03.
- THE LENS CHANGES WITH THE EMOTION: wide 14-24mm = world/scale/divinity; 35mm = truth/grounded; 50mm = natural presence; 85mm = intimacy/menace; 100mm+ macro = detail/texture.
- Assign per shot: camera, lens (+ why), aperture, movement, framing, angle, and "living portrait" motion note.
- COLOR: give a 30-60-10 palette per shot as {p60, p30, p10} with hex + name.
- LIGHTING: name the key/rim/fill setup + practicals + volumetrics.
- Define each character's EXPRESSION and ACTION for the shot, plus VFX and transition_out.
- You are describing a REAL PHYSICAL SET with REAL LIGHTING, not a virtual scene.

GLOBAL STYLE DNA: ${GLOBAL_STYLE_DNA}
GLOBAL BILINGUAL RULE: ${GLOBAL_BILINGUAL_RULE}

OUTPUT strict JSON: { "shots": [ { "scene_no": n, "shot_no": n, "shot_code": "SC01-SH01", "start_sec": n, "duration_sec": n, "description": string, "camera": { "body": string, "why": string }, "lens": string, "lens_why": string, "aperture": string, "movement": string, "framing": string, "angle": string, "living_motion": string, "palette": { "p60": {"hex":"#...","name":""}, "p30":{...}, "p10":{...} }, "lighting": string, "characters_present": [names], "expression": string, "action": string, "vfx": string, "transition_out": string } ] }`,

  storyboard_director: `You are the Storyboard Director. Take the shot list and organise it into STORYBOARD SHEETS for previsualisation.

RULES:
- State scene_count and, per scene, the shot_count.
- Group shots into sheets of at most 6 panels, in scene+shot order, laid out as a GRID (3 columns x 2 rows). Never split a shot across two panels. When a scene exceeds 6 shots, continue its shots onto the next sheet (Sheet 2, 3...), and note "continued".
- Each panel = one shot: its shot_code, a 8-14 word action caption, the framing (ECU/CU/MS/WS/EWS) and camera move as a small tag.
- Output the panel order and the sheet pagination so the compositor can render each sheet.

OUTPUT strict JSON: {
 "scene_count": n,
 "scenes": [{ "scene_no": n, "shot_count": n }],
 "panels_per_sheet": 6, "grid": "3x2", "aspect_ratio": "5:4",
 "sheets": [ {
   "sheet_no": n,
   "covers": "SC01-SH01 -> SC01-SH06",
   "panels": [ { "position": 1, "shot_code": "SC01-SH01", "framing": "WS", "camera": "slow push",
                 "caption_en": "...", "caption_local": "..." } ]
 } ]
}`,

  storyboard_sheet: `You are the Storyboard Sheet Compositor. For ONE sheet (up to 6 panels), write a SINGLE image-generation prompt that renders a professional film storyboard contact sheet.

RULES:
- Canvas = 5:4, clean matte board, a 3-columns x 2-rows grid of 6 equal panels with thin white gutters; if fewer than 6 shots, leave trailing panels empty (do not stretch).
- Each panel is a CINEMATIC THUMBNAIL of that shot: composed to its framing + camera angle, in the LOCKED project style, featuring the correct characters using their consistency_tokens so identity holds across panels.
- Overlay a small clean label in each panel's top-left: the shot_code (English text only, legible).
- Consistent grade + lighting family across all 6 panels so the sheet reads as one sequence.
- This is previsualisation quality (clear + cinematic), but STILL photoreal, never a cartoon or sketch.
- Use the character consistency_tokens and the shot captions from the storyboard_director.
- Append the photoreal quality tail; include the photoreal negative.
- FORBIDDEN WORDS: render, CGI, 3D, Unreal, Octane, game, cartoon, illustration, painting.

GLOBAL STYLE DNA: ${GLOBAL_STYLE_DNA}
GLOBAL REALISM TAIL: ${GLOBAL_REALISM_TAIL}
GLOBAL NEGATIVE: ${GLOBAL_NEGATIVE}

OUTPUT strict JSON: {
 "sheet_no": n,
 "aspect_ratio": "5:4",
 "sheet_prompt": "single prompt rendering the full 3x2 contact sheet with all panels + labels",
 "negative_prompt": string,
 "model": "seedream-v4-5",
 "params": { "grid": "3x2", "panels": 6 }
}`,

  image_prompt_engineer: `You are the Still-Frame Prompt Engineer. For EACH shot, write two production-ready prompts: (1) FIRST-FRAME hero prompt, (2) BACKGROUND/environment-plate prompt.

YOU ARE WRITING A PROMPT FOR A PHOTOGRAPH OF A REAL, PHYSICAL SCENE. Never use the words render, CGI, 3D, game, cartoon, or illustration. Describe it as if a cinematographer photographed a real actor in full prosthetic makeup and real costume on a real set.

RULES:
- Begin every character mention with that character's consistency_token so identity locks.
- If a character has a ref_image_url, note it in reference_urls so the generator uses image-to-image conditioning.
- Bake in: framing, angle, lens feel, 30-60-10 palette, lighting plan.
- End every first_frame_prompt with: "${GLOBAL_REALISM_TAIL}"
- Always include the negative: "${GLOBAL_NEGATIVE}" merged with shot-specific negatives.
- Universal prompts: no tool-specific flags. Express aspect ratio in words + set params separately.
- Recommended model for hero frames: "seedream-v4-5" or "z-image". For consistency locks: "nano-banana-2".
- FORBIDDEN WORDS: render, CGI, 3D, Unreal, Octane, game, cartoon, illustration, painting.

GLOBAL STYLE DNA: ${GLOBAL_STYLE_DNA}

OUTPUT strict JSON: { "image_prompts": [ { "shot_code": string, "first_frame_prompt": string, "background_prompt": string, "negative_prompt": string, "model": "seedream-v4-5", "aspect_ratio": string, "reference_urls": [string] | null, "params": { "resolution":"high", "n":1 } } ] }`,

  video_prompt_engineer: `You are the Motion / Video Prompt Engineer for Kling 3.0 / Seedance 2.0 / Veo3 (image-to-video). For EACH shot, write the prompt that animates its first-frame image into a <=15s clip.

RULES:
- The first-frame image is the init image; describe MOTION, not a new scene. Keep identity + composition stable.
- Specify: camera move, subject action + micro-expression change, "living portrait" ambient motion, physics realism, and any VFX evolution.
- Describe effects as VISUAL RESULTS, not editing software terms.
- Duration per prompt <=15. No tool-specific flags.
- This is a REAL filmed scene, not a render. Hair moves naturally, fabric drapes with weight, particles catch real light.

GLOBAL STYLE DNA: ${GLOBAL_STYLE_DNA}

OUTPUT strict JSON: { "video_prompts": [ { "shot_code": string, "prompt": string, "model": "kling-3.0", "duration_sec": n, "camera_move": string, "effects": [string], "params": { "sound": false, "quality": "1080p" } } ] }`,

  sound_designer: `You are the Music Director + Sound Designer. Produce (A) a Suno.ai music brief, (B) an ElevenLabs voiceover/narration package, (C) an SFX cue sheet.

RULES:
- SUNO: give a precise style string (genre + Indian classical/folk instrumentation), mood, BPM, and lyrics if vocal.
- ELEVENLABS: write narration script in the project language, broken by shot_code with timing, plus voice settings.
- SFX: per key shot, list ambience + foley + silence design moments.

GLOBAL BILINGUAL RULE: ${GLOBAL_BILINGUAL_RULE}

OUTPUT strict JSON: { "suno": { "style": string, "mood": string, "bpm": n, "has_vocals": bool, "lyrics": string|null, "duration_sec": n }, "voiceover": { "language": string, "voice_archetype": string, "settings": { "stability": n, "similarity": n, "style": n }, "script": [{ "shot_code": string, "line_local": string, "delivery_en": string }] }, "sfx_cues": [{ "shot_code": string, "ambience": string, "foley": string, "silence": string }], "music_role": string }`,

  growth_strategist: `You are a social growth strategist for a Kannada-first mythology creator (Instagram + YouTube + Shorts/Reels). Build the distribution package.

RULES:
- Hook = first 3 seconds. Give 3 hook variants.
- Titles: 3 per platform.
- Caption: hook line + story tease + CTA + comment-trigger question. Bilingual if applicable.
- Hashtags: mix broad + niche + regional, 12-20.
- Thumbnail concept.
- Best posting time for IST audience.
- series_plan + thirty_day_calendar.

OUTPUT strict JSON: { "platform_focus": [string], "hooks": [string, string, string], "titles": { "youtube": [..], "shorts": [..], "reel": [..] }, "caption": string, "hashtags": [..], "thumbnail_concept": string, "best_post_time_ist": string, "cta": string, "series_plan": string, "thirty_day_calendar": [{ "day": n, "theme": string, "deity": string, "angle": string, "format": "reel|longform|carousel" }] }`,
};

async function callOpenRouter(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPayload: string
): Promise<any> {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://purana-engine.app",
        "X-Title": "Purana Engine",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPayload },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter error (${response.status}): ${err}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || "";

  const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  return JSON.parse(cleaned);
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

    const { project_id } = await req.json();
    if (!project_id) {
      return new Response(
        JSON.stringify({ error: "Missing project_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: project, error: projError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", project_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (projError || !project) {
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    const openrouterKey = cred.encrypted_key;
    const model = "google/gemini-2.5-flash";

    await supabase.from("projects").update({ status: "generating" }).eq("id", project_id);

    // AGENT 1: Story Architect
    const storyInput = JSON.stringify({
      source_story: project.source_story,
      format: project.format,
      language: project.language,
      target_duration_sec: project.target_duration_sec,
      aspect_ratio: project.aspect_ratio,
      deity_theme: project.deity_theme,
    });

    const blueprintResult = await callOpenRouter(
      openrouterKey, model, AGENT_PROMPTS.story_architect, storyInput
    );

    await supabase.from("story_blueprints").delete().eq("project_id", project_id);
    await supabase.from("story_blueprints").insert({
      project_id,
      logline: blueprintResult.logline,
      synopsis: blueprintResult.synopsis,
      tone: blueprintResult.tone,
      emotional_arc: blueprintResult.emotional_arc,
      act_structure: blueprintResult.act_structure,
      scene_beats: blueprintResult.scene_beats,
      deities: blueprintResult.deities,
      total_shots: blueprintResult.total_shots,
      raw: blueprintResult,
    });

    // AGENT 2: Character Designer (photoreal)
    const charInput = JSON.stringify({
      blueprint: blueprintResult,
      deities: blueprintResult.deities,
      style_dna: GLOBAL_STYLE_DNA,
      realism_tail: GLOBAL_REALISM_TAIL,
    });

    const charResult = await callOpenRouter(
      openrouterKey, model, AGENT_PROMPTS.character_designer, charInput
    );

    await supabase.from("characters").delete().eq("project_id", project_id);
    const characters = charResult.characters || [];
    for (const char of characters) {
      await supabase.from("characters").insert({
        project_id,
        name: char.name,
        sanskrit_name: char.sanskrit_name,
        role: char.role,
        dna: char,
        consistency_token: char.consistency_token,
        turnaround_prompt: char.turnaround_prompt || char.reference_sheet_prompt,
        negative_prompt: char.negative_prompt,
      });
    }

    // AGENT 3: Cinematographer
    const cinemaInput = JSON.stringify({
      blueprint: blueprintResult,
      characters: characters.map((c: any) => ({
        name: c.name,
        consistency_token: c.consistency_token,
      })),
    });

    const cinemaResult = await callOpenRouter(
      openrouterKey, model, AGENT_PROMPTS.cinematographer, cinemaInput
    );

    // Delete existing child data
    const { data: existingShots } = await supabase
      .from("shots")
      .select("id")
      .eq("project_id", project_id);
    if (existingShots && existingShots.length > 0) {
      const shotIds = existingShots.map((s: any) => s.id);
      await supabase.from("image_prompts").delete().in("shot_id", shotIds);
      await supabase.from("video_prompts").delete().in("shot_id", shotIds);
    }
    await supabase.from("shots").delete().eq("project_id", project_id);

    const shots = cinemaResult.shots || [];
    const insertedShots: any[] = [];
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      const { data: inserted } = await supabase
        .from("shots")
        .insert({
          project_id,
          scene_no: shot.scene_no,
          shot_no: shot.shot_no,
          shot_code: shot.shot_code,
          start_sec: shot.start_sec,
          duration_sec: shot.duration_sec,
          description: shot.description,
          camera: shot.camera,
          lens: shot.lens,
          movement: shot.movement,
          framing: shot.framing,
          lighting: shot.lighting,
          palette: shot.palette,
          characters_present: shot.characters_present,
          expression: shot.expression,
          action: shot.action,
          vfx: shot.vfx,
          transition_out: shot.transition_out,
          sort_order: i,
        })
        .select()
        .single();
      if (inserted) insertedShots.push({ ...inserted, shot_code: shot.shot_code });
    }

    // AGENT 4: Storyboard Director (NEW)
    const storyboardInput = JSON.stringify({
      shots: shots.map((s: any) => ({
        shot_code: s.shot_code,
        scene_no: s.scene_no,
        shot_no: s.shot_no,
        framing: s.framing,
        movement: s.movement,
        description: s.description,
        characters_present: s.characters_present,
      })),
    });

    const storyboardResult = await callOpenRouter(
      openrouterKey, model, AGENT_PROMPTS.storyboard_director, storyboardInput
    );

    // AGENT 4b: Storyboard Sheet prompts (per sheet)
    await supabase.from("storyboard_sheets").delete().eq("project_id", project_id);
    const sheets = storyboardResult.sheets || [];
    for (const sheet of sheets) {
      const sheetInput = JSON.stringify({
        sheet,
        characters: characters.map((c: any) => ({
          name: c.name,
          consistency_token: c.consistency_token,
        })),
        style_dna: GLOBAL_STYLE_DNA,
        realism_tail: GLOBAL_REALISM_TAIL,
        negative: GLOBAL_NEGATIVE,
      });

      const sheetResult = await callOpenRouter(
        openrouterKey, model, AGENT_PROMPTS.storyboard_sheet, sheetInput
      );

      await supabase.from("storyboard_sheets").insert({
        project_id,
        sheet_no: sheet.sheet_no,
        covers: sheet.covers,
        panels: sheet.panels,
        sheet_prompt: sheetResult.sheet_prompt,
        negative_prompt: sheetResult.negative_prompt,
        model: sheetResult.model || "seedream-v4-5",
        status: "pending",
      });
    }

    // AGENT 5: Image Prompt Engineer (photoreal)
    const imgInput = JSON.stringify({
      shots,
      characters: characters.map((c: any) => ({
        name: c.name,
        consistency_token: c.consistency_token,
        ref_image_url: c.ref_image_url || null,
      })),
      aspect_ratio: project.aspect_ratio,
      style_dna: GLOBAL_STYLE_DNA,
      realism_tail: GLOBAL_REALISM_TAIL,
      negative: GLOBAL_NEGATIVE,
    });

    const imgResult = await callOpenRouter(
      openrouterKey, model, AGENT_PROMPTS.image_prompt_engineer, imgInput
    );

    const imagePrompts = imgResult.image_prompts || [];
    for (const ip of imagePrompts) {
      const matchShot = insertedShots.find((s) => s.shot_code === ip.shot_code);
      if (matchShot) {
        await supabase.from("image_prompts").insert({
          shot_id: matchShot.id,
          first_frame_prompt: ip.first_frame_prompt,
          background_prompt: ip.background_prompt,
          negative_prompt: ip.negative_prompt,
          model: ip.model || "seedream-v4-5",
          aspect_ratio: ip.aspect_ratio || project.aspect_ratio,
          reference_urls: ip.reference_urls || null,
          params: ip.params,
        });
      }
    }

    // AGENT 6: Video Prompt Engineer
    const vidInput = JSON.stringify({
      shots,
      characters: characters.map((c: any) => ({
        name: c.name,
        consistency_token: c.consistency_token,
      })),
    });

    const vidResult = await callOpenRouter(
      openrouterKey, model, AGENT_PROMPTS.video_prompt_engineer, vidInput
    );

    const videoPrompts = vidResult.video_prompts || [];
    for (const vp of videoPrompts) {
      const matchShot = insertedShots.find((s) => s.shot_code === vp.shot_code);
      if (matchShot) {
        await supabase.from("video_prompts").insert({
          shot_id: matchShot.id,
          prompt: vp.prompt,
          model: vp.model || "kling-3.0",
          duration_sec: vp.duration_sec,
          camera_move: vp.camera_move,
          effects: vp.effects,
          params: vp.params,
        });
      }
    }

    // AGENT 7: Sound Designer
    const soundInput = JSON.stringify({
      blueprint: blueprintResult,
      shots,
      language: project.language,
      target_duration_sec: project.target_duration_sec,
    });

    const soundResult = await callOpenRouter(
      openrouterKey, model, AGENT_PROMPTS.sound_designer, soundInput
    );

    await supabase.from("audio_briefs").delete().eq("project_id", project_id);
    await supabase.from("audio_briefs").insert({
      project_id,
      suno_style: soundResult.suno?.style,
      suno_lyrics: soundResult.suno?.lyrics,
      suno_bpm: soundResult.suno?.bpm,
      voiceover_script: JSON.stringify(soundResult.voiceover?.script),
      voiceover_lang: soundResult.voiceover?.language || project.language,
      voice_settings: soundResult.voiceover?.settings,
      sfx_cues: soundResult.sfx_cues,
      music_role: soundResult.music_role,
    });

    // AGENT 8: Growth Strategist
    const growthInput = JSON.stringify({
      blueprint: blueprintResult,
      format: project.format,
      language: project.language,
      deity_theme: project.deity_theme,
    });

    const growthResult = await callOpenRouter(
      openrouterKey, model, AGENT_PROMPTS.growth_strategist, growthInput
    );

    await supabase.from("growth_packages").delete().eq("project_id", project_id);
    await supabase.from("growth_packages").insert({
      project_id,
      platform: (growthResult.platform_focus || []).join(", "),
      hook: (growthResult.hooks || [])[0],
      titles: growthResult.titles,
      caption: growthResult.caption,
      hashtags: growthResult.hashtags,
      thumbnail_concept: growthResult.thumbnail_concept,
      best_post_time: growthResult.best_post_time_ist,
      cta: growthResult.cta,
      series_plan: growthResult.series_plan,
      thirty_day_calendar: growthResult.thirty_day_calendar,
    });

    await supabase.from("projects").update({ status: "ready", updated_at: new Date().toISOString() }).eq("id", project_id);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
