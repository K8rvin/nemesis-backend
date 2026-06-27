-- Таблица для баг-репортов из приложения.
CREATE TABLE IF NOT EXISTS public.bug_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  current_node_id text,
  player_state jsonb,
  comment text,
  app_version text,
  locale text,
  created_at timestamptz DEFAULT now()
);

-- Индекс для быстрой выборки по пользователю и времени.
CREATE INDEX IF NOT EXISTS idx_bug_reports_user_created
  ON public.bug_reports (user_id, created_at DESC);

-- Разрешить service-role ключу (и аутентифицированным пользователям через бэкенд)
-- вставлять записи. Чтение оставлено только для service-role / админов.
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role can manage bug reports" ON public.bug_reports;
CREATE POLICY "service role can manage bug reports"
  ON public.bug_reports
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
