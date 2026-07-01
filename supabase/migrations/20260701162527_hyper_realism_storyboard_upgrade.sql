/*
# Hyper-Realism + Storyboard Upgrade Schema

## Description
Adds support for the 2-pass quality pipeline (base + upscaled images), reference-image conditioning,
and the new storyboard sheet system.

## Modified Tables

1. **image_prompts**
   - `base_url` (text) - Base generation image URL (pass 1)
   - `final_url` (text) - Upscaled/refined image URL (pass 2)
   - `reference_urls` (jsonb) - Character reference image URLs used for conditioning

2. **characters**
   - `ref_image_final_url` (text) - Upscaled character reference sheet URL
   - `seed` (bigint) - Locked seed for cross-shot consistency
   - `negative_prompt` (text) - Character-specific negative prompt

3. **generation_jobs**
   - `parent_id` (uuid) - Links upscale job to its base generation job
   - Updated `kind` check to allow: image, video, music, voice, upscale, character, storyboard

## New Tables

4. **storyboard_sheets**
   - `id` (uuid, PK)
   - `project_id` (uuid, FK to projects)
   - `sheet_no` (int) - Sheet number in sequence
   - `covers` (text) - Range of shots covered (e.g. "SC01-SH01 → SC01-SH06")
   - `panels` (jsonb) - Panel layout data from storyboard director
   - `sheet_prompt` (text) - Image generation prompt for the sheet
   - `negative_prompt` (text) - Negative prompt
   - `model` (text) - Image model used
   - `base_url` (text) - Base generated image
   - `final_url` (text) - Upscaled final image
   - `status` (text) - Generation status
   - `created_at` (timestamptz)

## Security
- RLS enabled on storyboard_sheets
- Owner-scoped CRUD via parent project ownership
*/

-- image_prompts: add base_url, final_url, reference_urls
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='image_prompts' AND column_name='base_url') THEN
    ALTER TABLE image_prompts ADD COLUMN base_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='image_prompts' AND column_name='final_url') THEN
    ALTER TABLE image_prompts ADD COLUMN final_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='image_prompts' AND column_name='reference_urls') THEN
    ALTER TABLE image_prompts ADD COLUMN reference_urls jsonb;
  END IF;
END $$;

-- characters: add ref_image_final_url, seed, negative_prompt
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='characters' AND column_name='ref_image_final_url') THEN
    ALTER TABLE characters ADD COLUMN ref_image_final_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='characters' AND column_name='seed') THEN
    ALTER TABLE characters ADD COLUMN seed bigint;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='characters' AND column_name='negative_prompt') THEN
    ALTER TABLE characters ADD COLUMN negative_prompt text;
  END IF;
END $$;

-- generation_jobs: add parent_id, update kind check
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='generation_jobs' AND column_name='parent_id') THEN
    ALTER TABLE generation_jobs ADD COLUMN parent_id uuid REFERENCES generation_jobs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Drop old kind constraint and add expanded one
ALTER TABLE generation_jobs DROP CONSTRAINT IF EXISTS generation_jobs_kind_check;
ALTER TABLE generation_jobs ADD CONSTRAINT generation_jobs_kind_check
  CHECK (kind IN ('image','video','music','voice','upscale','character','storyboard'));

-- Create storyboard_sheets table
CREATE TABLE IF NOT EXISTS storyboard_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sheet_no int NOT NULL DEFAULT 1,
  covers text,
  panels jsonb,
  sheet_prompt text,
  negative_prompt text,
  model text,
  base_url text,
  final_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE storyboard_sheets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_storyboard_sheets" ON storyboard_sheets;
CREATE POLICY "select_own_storyboard_sheets" ON storyboard_sheets FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = storyboard_sheets.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_own_storyboard_sheets" ON storyboard_sheets;
CREATE POLICY "insert_own_storyboard_sheets" ON storyboard_sheets FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = storyboard_sheets.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_own_storyboard_sheets" ON storyboard_sheets;
CREATE POLICY "update_own_storyboard_sheets" ON storyboard_sheets FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = storyboard_sheets.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = storyboard_sheets.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_own_storyboard_sheets" ON storyboard_sheets;
CREATE POLICY "delete_own_storyboard_sheets" ON storyboard_sheets FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = storyboard_sheets.project_id AND projects.user_id = auth.uid()));

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_storyboard_sheets_project ON storyboard_sheets(project_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_parent ON generation_jobs(parent_id);
