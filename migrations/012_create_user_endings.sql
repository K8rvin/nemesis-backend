-- Миграция: создаём журнал достигнутых концовок.

CREATE TABLE IF NOT EXISTS public.user_endings (
  user_id uuid NOT NULL,
  node_id text NOT NULL,
  ending_type text,
  reached_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, node_id)
);

-- Индекс для быстрого пересчёта по игроку.
CREATE INDEX IF NOT EXISTS idx_user_endings_user_id
  ON public.user_endings (user_id);

-- Комментарии
COMMENT ON TABLE public.user_endings IS 'Журнал уникальных концовок, достигнутых каждым игроком.';
