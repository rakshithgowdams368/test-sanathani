/*
# Create Character Generation History Table

## Description
Stores all prompts and generated images for characters, enabling users to view
their generation history including past prompts and resulting images.

## New Tables
1. **character_generation_history** - Stores each generation attempt
   - id (uuid, PK)
   - project_id (uuid, FK to projects)
   - character_id (uuid, FK to characters)
   - user_id (uuid, FK to auth.users, defaults to auth.uid())
   - kind (text: 'prompt' or 'image')
   - prompt (text, the generation prompt used)
   - negative_prompt (text, optional negative prompt)
   - aspect_ratio (text, the aspect ratio used)
   - model (text, the image model used)
   - result_url (text, the generated image URL if kind='image')
   - character_analysis (text, optional analysis from prompt generation)
   - status (text: 'success', 'failed', 'pending')
   - created_at (timestamptz)

## Security
- RLS enabled, scoped to authenticated users via project ownership
*/

CREATE TABLE IF NOT EXISTS character_generation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('prompt', 'image')),
  prompt text,
  negative_prompt text,
  aspect_ratio text,
  model text,
  result_url text,
  character_analysis text,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_char_gen_history_character
  ON character_generation_history(character_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_char_gen_history_project
  ON character_generation_history(project_id);

ALTER TABLE character_generation_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_char_gen_history" ON character_generation_history;
CREATE POLICY "select_own_char_gen_history" ON character_generation_history FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_char_gen_history" ON character_generation_history;
CREATE POLICY "insert_own_char_gen_history" ON character_generation_history FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_char_gen_history" ON character_generation_history;
CREATE POLICY "update_own_char_gen_history" ON character_generation_history FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_char_gen_history" ON character_generation_history;
CREATE POLICY "delete_own_char_gen_history" ON character_generation_history FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
