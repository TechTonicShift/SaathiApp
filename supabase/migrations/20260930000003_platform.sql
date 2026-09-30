-- Saath MVP — Supabase platform wiring (Realtime, Storage, cron, push). Runs after 20260930000002_app.sql.
-- Before running: Dashboard → Database → Extensions is not needed; this file enables pg_cron and pg_net itself.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ═════════════════════════ Realtime (chat) ═════════════════════════
-- postgres_changes respects RLS, so members only receive rows they could SELECT.
ALTER PUBLICATION supabase_realtime ADD TABLE "Message", "EventChannelMessage", "Match";

-- ═════════════════════════ Storage ═════════════════════════
-- Both buckets are private. Files live under "<userId>/..." and are read through signed URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('photos', 'photos', false, 3145728, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('verification', 'verification', false, 3145728, ARRAY['image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY saath_photos_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY saath_photos_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
-- Visible to anyone who can see the owner (active, not blocked with the viewer).
CREATE POLICY saath_photos_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'photos' AND public.is_visible_user(((storage.foldername(name))[1])::uuid));

-- Verification selfies: upload only. Moderators review them in the dashboard.
CREATE POLICY saath_verification_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'verification' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- ═════════════════════════ Push (Expo Push API, free) ═════════════════════════
-- Sends up to 100 queued notifications per call straight from Postgres via pg_net.
-- Rows are marked sent even without a token so the outbox never backs up; stale rows (>1 day) are skipped.
CREATE OR REPLACE FUNCTION public.dispatch_push() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_batch jsonb; v_n int;
BEGIN
  WITH due AS (
    SELECT n.id FROM "Notification" n WHERE n."sentAt" IS NULL
    ORDER BY n."createdAt" LIMIT 100 FOR UPDATE SKIP LOCKED),
  marked AS (
    UPDATE "Notification" x SET "sentAt" = now() FROM due WHERE x.id = due.id
    RETURNING x."userId", x.title, x.body, x.data, x."createdAt")
  SELECT jsonb_agg(jsonb_build_object('to', u."expoPushToken", 'title', m.title, 'body', m.body,
           'data', coalesce(m.data, '{}'::jsonb), 'sound', 'default'))
           FILTER (WHERE u."expoPushToken" IS NOT NULL AND m."createdAt" > now() - interval '1 day'),
         count(*)
  INTO v_batch, v_n
  FROM marked m JOIN "User" u ON u.id = m."userId";

  IF v_batch IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := v_batch,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb);
  END IF;
  RETURN coalesce(v_n, 0);
END $$;
REVOKE EXECUTE ON FUNCTION public.dispatch_push() FROM PUBLIC, anon, authenticated;

-- ═════════════════════════ Schedules ═════════════════════════
SELECT cron.schedule('saath-tick', '*/5 * * * *', $$SELECT public.saath_tick()$$);
SELECT cron.schedule('saath-push', '* * * * *', $$SELECT public.dispatch_push()$$);

