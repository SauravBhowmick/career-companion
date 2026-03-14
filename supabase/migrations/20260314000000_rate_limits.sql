CREATE TABLE public.rate_limits (
  user_id UUID NOT NULL,
  action  TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, action)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_rate_limits_window ON public.rate_limits(window_start);

-- Atomic check-and-increment: returns TRUE when the caller is rate-limited.
-- Resets the window automatically when it expires.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id UUID,
  p_action TEXT,
  p_window_ms INTEGER DEFAULT 60000,
  p_max_requests INTEGER DEFAULT 5
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  -- Upsert: create row if absent, otherwise fetch existing
  INSERT INTO public.rate_limits (user_id, action, window_start, request_count)
  VALUES (p_user_id, p_action, now(), 0)
  ON CONFLICT (user_id, action) DO NOTHING;

  -- Lock the row for the duration of this check
  SELECT window_start, request_count
    INTO v_window_start, v_count
    FROM public.rate_limits
   WHERE user_id = p_user_id AND action = p_action
     FOR UPDATE;

  -- Window expired → reset
  IF EXTRACT(EPOCH FROM (now() - v_window_start)) * 1000 > p_window_ms THEN
    UPDATE public.rate_limits
       SET window_start = now(), request_count = 1
     WHERE user_id = p_user_id AND action = p_action;
    RETURN FALSE;
  END IF;

  -- Over the limit
  IF v_count >= p_max_requests THEN
    RETURN TRUE;
  END IF;

  -- Under the limit → increment
  UPDATE public.rate_limits
     SET request_count = request_count + 1
   WHERE user_id = p_user_id AND action = p_action;
  RETURN FALSE;
END;
$$;
