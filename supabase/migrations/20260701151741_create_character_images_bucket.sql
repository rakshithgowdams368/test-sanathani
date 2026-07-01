-- Create storage bucket for character reference images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'character-images',
  'character-images',
  true,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read their character images
CREATE POLICY "public_read_character_images" ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'character-images');

-- Allow authenticated users to upload images to their own folder
CREATE POLICY "authenticated_upload_character_images" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'character-images');

-- Service role (used by callback) can do anything - no policy needed as service role bypasses RLS
