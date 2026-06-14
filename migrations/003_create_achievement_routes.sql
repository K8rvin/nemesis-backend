-- ==========================================
-- 🗺️ Готовые маршруты от стартовой ноды к ачивкам
-- ==========================================

CREATE TABLE IF NOT EXISTS public.achievement_routes (
  start_node_id TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  path JSONB NOT NULL,
  next_choice_id TEXT NOT NULL,
  steps_remaining INT NOT NULL,
  reachable BOOL NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT achievement_routes_pkey PRIMARY KEY (start_node_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_achievement_routes_start
  ON public.achievement_routes(start_node_id);

CREATE INDEX IF NOT EXISTS idx_achievement_routes_achievement
  ON public.achievement_routes(achievement_id);

COMMENT ON TABLE public.achievement_routes IS
  'Готовые маршруты от стартовой ноды до каждой ачивки';

COMMENT ON COLUMN public.achievement_routes.path IS
  'Полный путь от стартовой ноды до ачивки: массив id выборов';

COMMENT ON COLUMN public.achievement_routes.next_choice_id IS
  'Первый выбор в маршруте';

COMMENT ON COLUMN public.achievement_routes.steps_remaining IS
  'Количество выборов в маршруте';
