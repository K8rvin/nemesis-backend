-- 020_create_promo_codes.sql
-- Промокоды для бесплатной активации Pro.

BEGIN;

CREATE TABLE IF NOT EXISTS public.promo_codes (
  code text PRIMARY KEY,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.promo_codes IS 'Промокоды для бесплатной активации Pro';

-- Разрешаем сервис-роли управлять кодами
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS service_all_promo_codes
  ON public.promo_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
