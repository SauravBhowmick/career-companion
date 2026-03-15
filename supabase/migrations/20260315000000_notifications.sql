-- In-app notifications table
CREATE TABLE public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  read boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- Primary fetch index: WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
CREATE INDEX idx_notifications_user_timeline
  ON public.notifications (user_id, created_at DESC);

-- Lightweight partial index for "mark all unread" queries
CREATE INDEX idx_notifications_user_unread
  ON public.notifications (user_id)
  WHERE read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Restrict authenticated users to only updating the read column
REVOKE UPDATE ON public.notifications FROM authenticated;
GRANT UPDATE (read) ON public.notifications TO authenticated;

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Service-role inserts bypass RLS; no INSERT policy needed for end users.

-- Auto-create a welcome notification when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body)
  VALUES (
    NEW.id,
    'welcome',
    'Welcome to JobFlow!',
    'Upload your CV, set your preferences, and let AI match you with relevant jobs.'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_notification
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_notification();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
