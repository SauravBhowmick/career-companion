-- Create table for CV upload history
CREATE TABLE public.cv_upload_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  skills_extracted INTEGER DEFAULT 0,
  parsing_status TEXT DEFAULT 'pending'
);

-- Enable RLS
ALTER TABLE public.cv_upload_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own upload history"
ON public.cv_upload_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own upload history"
ON public.cv_upload_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own upload history"
ON public.cv_upload_history
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_cv_upload_history_user_id ON public.cv_upload_history(user_id);
CREATE INDEX idx_cv_upload_history_uploaded_at ON public.cv_upload_history(uploaded_at DESC);