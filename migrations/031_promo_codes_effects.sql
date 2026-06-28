-- 031_promo_codes_effects.sql
-- Добавляем эффект промокода: pro или admin.

BEGIN;

ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS effect text NOT NULL DEFAULT 'pro';

COMMENT ON COLUMN public.promo_codes.effect IS 'Эффект промокода: pro | admin';

COMMIT;
