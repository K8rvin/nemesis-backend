-- 033_add_admin_to_pro_users.sql
-- Флаг администратора для пользователей, активированных через промокод.

BEGIN;

ALTER TABLE public.user_pro_status
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_pro_status.is_admin IS 'Администраторский доступ';

COMMIT;
