/*
# Create Purana Engine Schema

## Description
Complete database schema for the Purana Engine mythological cinematic content production platform.

## New Tables

1. **profiles** - Extended user profile info
   - id (uuid, PK, references auth.users)
   - display_name (text)
   - brand_handle (text)
   - default_language (text, default 'kannada')
   - created_at (timestamptz)

2. **api_credentials** - Encrypted API keys for external services
   - id (uuid, PK)
   - user_id (uuid, FK to auth.users)
   - provider (text: openrouter/kie/elevenlabs/suno)
   - encrypted_key (text)
   - label (text)
   - created_at (timestamptz)

3. **projects** - Production projects
   - id (uuid, PK)
   - user_id (uuid, FK, default auth.uid())
   - title, source_story, format, language, target_duration_sec, aspect_ratio, deity_theme, status
   - created_at, updated_at (timestamptz)

4. **story_blueprints** - Agent 1 output
   - id, project_id, logline, synopsis, tone, emotional_arc, act_structure, scene_beats, deities, total_shots, raw

5. **characters** - Agent 2 output
   - id, project_id, name, sanskrit_name, role, dna, consistency_token, turnaround_prompt, ref_image_url

6. **shots** - Agent 3 output
   - id, project_id, scene_no, shot_no, shot_code, start_sec, duration_sec, description, camera, lens, movement, framing, lighting, palette, characters_present, expression, action, vfx, transition_out, sort_order

7. **image_prompts** - Agent 4 output
   - id, shot_id, first_frame_prompt, background_prompt, negative_prompt, model, aspect_ratio, params

8. **video_prompts** - Agent 5 output
   - id, shot_id, prompt, model, duration_sec, init_image_url, camera_move, effects, params

9. **audio_briefs** - Agent 6 output
   - id, project_id, suno_style, suno_lyrics, suno_bpm, voiceover_script, voiceover_lang, voice_settings, sfx_cues, music_role

10. **growth_packages** - Agent 7 output
    - id, project_id, platform, hook, titles, caption, hashtags, thumbnail_concept, best_post_time, cta, series_plan, thirty_day_calendar

11. **generation_jobs** - Async kie.ai job tracking
    - id, project_id, shot_id, kind, provider, model, kie_task_id, status, input, result_url, error, credits, created_at, updated_at

12. **prompt_templates** - Editable agent system prompts
    - id, user_id, agent_key, system_prompt, version, is_active, updated_at

## Security
- RLS enabled on ALL tables
- All tables scoped to authenticated users via auth.uid()
- Child tables (shots, image_prompts, video_prompts) scoped through parent project ownership
*/

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  brand_handle text,
  default_language text NOT NULL DEFAULT 'kannada',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- API CREDENTIALS
CREATE TABLE IF NOT EXISTS api_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('openrouter','kie','elevenlabs','suno')),
  encrypted_key text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);
ALTER TABLE api_credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_credentials" ON api_credentials;
CREATE POLICY "select_own_credentials" ON api_credentials FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_credentials" ON api_credentials;
CREATE POLICY "insert_own_credentials" ON api_credentials FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_credentials" ON api_credentials;
CREATE POLICY "update_own_credentials" ON api_credentials FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_credentials" ON api_credentials;
CREATE POLICY "delete_own_credentials" ON api_credentials FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- PROJECTS
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  source_story text,
  format text NOT NULL CHECK (format IN ('reel','longform')),
  language text NOT NULL DEFAULT 'kannada',
  target_duration_sec int NOT NULL DEFAULT 30,
  aspect_ratio text NOT NULL DEFAULT '9:16',
  deity_theme text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','planned','generating','ready','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_projects" ON projects;
CREATE POLICY "select_own_projects" ON projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_projects" ON projects;
CREATE POLICY "insert_own_projects" ON projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_projects" ON projects;
CREATE POLICY "update_own_projects" ON projects FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_projects" ON projects;
CREATE POLICY "delete_own_projects" ON projects FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- STORY BLUEPRINTS
CREATE TABLE IF NOT EXISTS story_blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  logline text,
  synopsis text,
  tone text,
  emotional_arc jsonb,
  act_structure jsonb,
  scene_beats jsonb,
  deities jsonb,
  total_shots int,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE story_blueprints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_blueprints" ON story_blueprints;
CREATE POLICY "select_own_blueprints" ON story_blueprints FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = story_blueprints.project_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_own_blueprints" ON story_blueprints;
CREATE POLICY "insert_own_blueprints" ON story_blueprints FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = story_blueprints.project_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_own_blueprints" ON story_blueprints;
CREATE POLICY "update_own_blueprints" ON story_blueprints FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = story_blueprints.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = story_blueprints.project_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_own_blueprints" ON story_blueprints;
CREATE POLICY "delete_own_blueprints" ON story_blueprints FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = story_blueprints.project_id AND projects.user_id = auth.uid()));

-- CHARACTERS
CREATE TABLE IF NOT EXISTS characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  sanskrit_name text,
  role text,
  dna jsonb,
  consistency_token text,
  turnaround_prompt text,
  ref_image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_characters" ON characters;
CREATE POLICY "select_own_characters" ON characters FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = characters.project_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_own_characters" ON characters;
CREATE POLICY "insert_own_characters" ON characters FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = characters.project_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_own_characters" ON characters;
CREATE POLICY "update_own_characters" ON characters FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = characters.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = characters.project_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_own_characters" ON characters;
CREATE POLICY "delete_own_characters" ON characters FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = characters.project_id AND projects.user_id = auth.uid()));

-- SHOTS
CREATE TABLE IF NOT EXISTS shots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_no int,
  shot_no int,
  shot_code text,
  start_sec numeric,
  duration_sec numeric,
  description text,
  camera jsonb,
  lens text,
  movement text,
  framing text,
  lighting text,
  palette jsonb,
  characters_present jsonb,
  expression text,
  action text,
  vfx text,
  transition_out text,
  sort_order int NOT NULL DEFAULT 0
);
ALTER TABLE shots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_shots" ON shots;
CREATE POLICY "select_own_shots" ON shots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = shots.project_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_own_shots" ON shots;
CREATE POLICY "insert_own_shots" ON shots FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = shots.project_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_own_shots" ON shots;
CREATE POLICY "update_own_shots" ON shots FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = shots.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = shots.project_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_own_shots" ON shots;
CREATE POLICY "delete_own_shots" ON shots FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = shots.project_id AND projects.user_id = auth.uid()));

-- IMAGE PROMPTS
CREATE TABLE IF NOT EXISTS image_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shot_id uuid NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  first_frame_prompt text,
  background_prompt text,
  negative_prompt text,
  model text DEFAULT 'nano-banana-2',
  aspect_ratio text,
  params jsonb
);
ALTER TABLE image_prompts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_image_prompts" ON image_prompts;
CREATE POLICY "select_own_image_prompts" ON image_prompts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM shots JOIN projects ON projects.id = shots.project_id WHERE shots.id = image_prompts.shot_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_own_image_prompts" ON image_prompts;
CREATE POLICY "insert_own_image_prompts" ON image_prompts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM shots JOIN projects ON projects.id = shots.project_id WHERE shots.id = image_prompts.shot_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_own_image_prompts" ON image_prompts;
CREATE POLICY "update_own_image_prompts" ON image_prompts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM shots JOIN projects ON projects.id = shots.project_id WHERE shots.id = image_prompts.shot_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM shots JOIN projects ON projects.id = shots.project_id WHERE shots.id = image_prompts.shot_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_own_image_prompts" ON image_prompts;
CREATE POLICY "delete_own_image_prompts" ON image_prompts FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM shots JOIN projects ON projects.id = shots.project_id WHERE shots.id = image_prompts.shot_id AND projects.user_id = auth.uid()));

-- VIDEO PROMPTS
CREATE TABLE IF NOT EXISTS video_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shot_id uuid NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  prompt text,
  model text DEFAULT 'kling-3.0',
  duration_sec int,
  init_image_url text,
  camera_move text,
  effects jsonb,
  params jsonb
);
ALTER TABLE video_prompts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_video_prompts" ON video_prompts;
CREATE POLICY "select_own_video_prompts" ON video_prompts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM shots JOIN projects ON projects.id = shots.project_id WHERE shots.id = video_prompts.shot_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_own_video_prompts" ON video_prompts;
CREATE POLICY "insert_own_video_prompts" ON video_prompts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM shots JOIN projects ON projects.id = shots.project_id WHERE shots.id = video_prompts.shot_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_own_video_prompts" ON video_prompts;
CREATE POLICY "update_own_video_prompts" ON video_prompts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM shots JOIN projects ON projects.id = shots.project_id WHERE shots.id = video_prompts.shot_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM shots JOIN projects ON projects.id = shots.project_id WHERE shots.id = video_prompts.shot_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_own_video_prompts" ON video_prompts;
CREATE POLICY "delete_own_video_prompts" ON video_prompts FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM shots JOIN projects ON projects.id = shots.project_id WHERE shots.id = video_prompts.shot_id AND projects.user_id = auth.uid()));

-- AUDIO BRIEFS
CREATE TABLE IF NOT EXISTS audio_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  suno_style text,
  suno_lyrics text,
  suno_bpm int,
  voiceover_script text,
  voiceover_lang text DEFAULT 'kannada',
  voice_settings jsonb,
  sfx_cues jsonb,
  music_role text
);
ALTER TABLE audio_briefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_audio_briefs" ON audio_briefs;
CREATE POLICY "select_own_audio_briefs" ON audio_briefs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = audio_briefs.project_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_own_audio_briefs" ON audio_briefs;
CREATE POLICY "insert_own_audio_briefs" ON audio_briefs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = audio_briefs.project_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_own_audio_briefs" ON audio_briefs;
CREATE POLICY "update_own_audio_briefs" ON audio_briefs FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = audio_briefs.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = audio_briefs.project_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_own_audio_briefs" ON audio_briefs;
CREATE POLICY "delete_own_audio_briefs" ON audio_briefs FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = audio_briefs.project_id AND projects.user_id = auth.uid()));

-- GROWTH PACKAGES
CREATE TABLE IF NOT EXISTS growth_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  platform text,
  hook text,
  titles jsonb,
  caption text,
  hashtags jsonb,
  thumbnail_concept text,
  best_post_time text,
  cta text,
  series_plan jsonb,
  thirty_day_calendar jsonb
);
ALTER TABLE growth_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_growth_packages" ON growth_packages;
CREATE POLICY "select_own_growth_packages" ON growth_packages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = growth_packages.project_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_own_growth_packages" ON growth_packages;
CREATE POLICY "insert_own_growth_packages" ON growth_packages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = growth_packages.project_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_own_growth_packages" ON growth_packages;
CREATE POLICY "update_own_growth_packages" ON growth_packages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = growth_packages.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = growth_packages.project_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_own_growth_packages" ON growth_packages;
CREATE POLICY "delete_own_growth_packages" ON growth_packages FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = growth_packages.project_id AND projects.user_id = auth.uid()));

-- GENERATION JOBS
CREATE TABLE IF NOT EXISTS generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  shot_id uuid REFERENCES shots(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('image','video','music','voice')),
  provider text NOT NULL DEFAULT 'kie',
  model text,
  kie_task_id text,
  status text NOT NULL DEFAULT 'queuing',
  input jsonb,
  result_url text,
  error text,
  credits int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_generation_jobs" ON generation_jobs;
CREATE POLICY "select_own_generation_jobs" ON generation_jobs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = generation_jobs.project_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_own_generation_jobs" ON generation_jobs;
CREATE POLICY "insert_own_generation_jobs" ON generation_jobs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = generation_jobs.project_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_own_generation_jobs" ON generation_jobs;
CREATE POLICY "update_own_generation_jobs" ON generation_jobs FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = generation_jobs.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = generation_jobs.project_id AND projects.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_own_generation_jobs" ON generation_jobs;
CREATE POLICY "delete_own_generation_jobs" ON generation_jobs FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = generation_jobs.project_id AND projects.user_id = auth.uid()));

-- PROMPT TEMPLATES
CREATE TABLE IF NOT EXISTS prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_key text NOT NULL,
  system_prompt text NOT NULL,
  version int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_prompt_templates" ON prompt_templates;
CREATE POLICY "select_own_prompt_templates" ON prompt_templates FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_prompt_templates" ON prompt_templates;
CREATE POLICY "insert_own_prompt_templates" ON prompt_templates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_prompt_templates" ON prompt_templates;
CREATE POLICY "update_own_prompt_templates" ON prompt_templates FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_prompt_templates" ON prompt_templates;
CREATE POLICY "delete_own_prompt_templates" ON prompt_templates FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_shots_project_id ON shots(project_id);
CREATE INDEX IF NOT EXISTS idx_shots_sort_order ON shots(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_image_prompts_shot_id ON image_prompts(shot_id);
CREATE INDEX IF NOT EXISTS idx_video_prompts_shot_id ON video_prompts(shot_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_project ON generation_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_task ON generation_jobs(kie_task_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_user_agent ON prompt_templates(user_id, agent_key);
