/*
# Create copycat_analyses table

1. New Tables
   - `copycat_analyses`
     - `id` (uuid, primary key)
     - `user_id` (uuid, FK to auth.users, defaults to auth.uid())
     - `project_id` (uuid, FK to projects, nullable — set after reconstruction)
     - `source_video_url` (text) — Supabase Storage URL of uploaded video
     - `meta` (jsonb) — duration, aspect, fps, resolution from client extraction
     - `video_dna` (jsonb) — full Video DNA JSON from vision analysis
     - `transcript` (jsonb) — audio transcript or music_only marker
     - `frame_count` (int) — number of frames sampled
     - `growth_pack` (jsonb) — IG + YouTube captions, hashtags, titles
     - `status` (text) — pipeline stage tracking
     - `error` (text) — error message if failed
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

2. Security
   - Enable RLS on `copycat_analyses`.
   - Owner-scoped CRUD: each authenticated user can only access their own analyses.

3. Notes
   - Status values: uploaded, extracting, transcribing, analyzing, reconstructing, ready, error
   - project_id is nullable because it's set after the reconstruction phase creates a project
*/

CREATE TABLE IF NOT EXISTS copycat_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  source_video_url text,
  meta jsonb,
  video_dna jsonb,
  transcript jsonb,
  frame_count int,
  growth_pack jsonb,
  status text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded','extracting','transcribing','analyzing','reconstructing','ready','error')),
  error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_copycat_analyses_user_id ON copycat_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_copycat_analyses_status ON copycat_analyses(status);

ALTER TABLE copycat_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_copycat" ON copycat_analyses;
CREATE POLICY "select_own_copycat" ON copycat_analyses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_copycat" ON copycat_analyses;
CREATE POLICY "insert_own_copycat" ON copycat_analyses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_copycat" ON copycat_analyses;
CREATE POLICY "update_own_copycat" ON copycat_analyses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_copycat" ON copycat_analyses;
CREATE POLICY "delete_own_copycat" ON copycat_analyses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
