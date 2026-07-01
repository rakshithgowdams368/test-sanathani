/*
# Video Prompts Dialogue + Cinematic Upgrade

1. Modified Tables
   - `video_prompts` — adds columns for full dialogue-driven cinematic video prompts:
     - `characters_present` (jsonb) — array of {name, consistency_token} for identity lock
     - `identity_lock` (text) — the "preserve from init frame" instruction
     - `dialogue` (jsonb) — array of {character, line_local, language, delivery_en, lip_sync}
     - `character_movement` (text) — blocking/body/hands/gesture description
     - `expression_arc` (text) — start → mid → end emotion arc
     - `camera_motion` (jsonb) — {body, lens, speed, motivation}
     - `vfx` (jsonb) — array of VFX descriptions
     - `sfx` (jsonb) — array of SFX/diegetic sound descriptions
     - `ambient_motion` (text) — ambient realism details
     - `audio` (jsonb) — {has_dialogue, language, sound}
     - `negative_prompt` (text) — photoreal negative prompt

2. Notes
   - All columns are nullable to preserve backward compatibility with existing data.
   - Existing columns (prompt, model, duration_sec, init_image_url, params) are untouched.
   - No destructive changes.
*/

ALTER TABLE video_prompts ADD COLUMN IF NOT EXISTS characters_present jsonb;
ALTER TABLE video_prompts ADD COLUMN IF NOT EXISTS identity_lock text;
ALTER TABLE video_prompts ADD COLUMN IF NOT EXISTS dialogue jsonb;
ALTER TABLE video_prompts ADD COLUMN IF NOT EXISTS character_movement text;
ALTER TABLE video_prompts ADD COLUMN IF NOT EXISTS expression_arc text;
ALTER TABLE video_prompts ADD COLUMN IF NOT EXISTS camera_motion jsonb;
ALTER TABLE video_prompts ADD COLUMN IF NOT EXISTS vfx jsonb;
ALTER TABLE video_prompts ADD COLUMN IF NOT EXISTS sfx jsonb;
ALTER TABLE video_prompts ADD COLUMN IF NOT EXISTS ambient_motion text;
ALTER TABLE video_prompts ADD COLUMN IF NOT EXISTS audio jsonb;
ALTER TABLE video_prompts ADD COLUMN IF NOT EXISTS negative_prompt text;
