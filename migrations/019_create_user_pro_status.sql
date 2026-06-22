-- 019_create_user_pro_status.sql
-- Статус Pro версии для пользователей.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_pro_status (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_pro boolean NOT NULL DEFAULT false,
  purchased_at timestamptz,
  source text CHECK (source IN ('rustore', 'promo_code'))
);

COMMENT ON TABLE public.user_pro_status IS 'Статус Pro версии для пользователей';

-- Разрешаем сервис-роли читать/писать (backend использует service-role key)
ALTER TABLE public.user_pro_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS service_all_user_pro_status
  ON public.user_pro_status
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
