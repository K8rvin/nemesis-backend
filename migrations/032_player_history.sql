-- 032_player_history.sql
-- История перемещений игрока для карты сюжета и статистики.

BEGIN;

CREATE TABLE IF NOT EXISTS public.player_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  source_choice_id text,
  source_label text,
  failure boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_player_history_user_created
  ON public.player_history(user_id, created_at);

COMMENT ON TABLE public.player_history IS 'Хронология посещённых нод, включая провалы мини-игр';

COMMIT;
