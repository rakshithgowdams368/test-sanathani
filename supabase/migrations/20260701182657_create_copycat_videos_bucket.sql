/*
# Create copycat-videos storage bucket

1. Storage
   - Creates a `copycat-videos` bucket for uploaded reference videos
   - Authenticated users can upload and read their own files
   - Files are scoped by user_id path prefix (user_id/filename)

2. Security
   - Only authenticated users can upload
   - Users can only read files in their own folder
   - Public access disabled
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('copycat-videos', 'copycat-videos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "auth_upload_copycat_videos" ON storage.objects;
CREATE POLICY "auth_upload_copycat_videos" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'copycat-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "auth_read_own_copycat_videos" ON storage.objects;
CREATE POLICY "auth_read_own_copycat_videos" ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'copycat-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "auth_delete_own_copycat_videos" ON storage.objects;
CREATE POLICY "auth_delete_own_copycat_videos" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'copycat-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
