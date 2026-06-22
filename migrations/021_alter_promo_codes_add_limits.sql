-- 021_alter_promo_codes_add_limits.sql
-- Добавляем ограничения на использование промокодов.

BEGIN;

ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS max_uses integer,
  ADD COLUMN IF NOT EXISTS used_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

COMMENT ON COLUMN public.promo_codes.max_uses IS 'Максимальное количество активаций (NULL — без ограничения)';
COMMENT ON COLUMN public.promo_codes.used_count IS 'Текущее количество активаций';
COMMENT ON COLUMN public.promo_codes.expires_at IS 'Срок действия промокода (NULL — без ограничения)';

COMMIT;
