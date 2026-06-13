-- ==========================================
-- 💡 Предвычисленные маршруты для hint engine
-- ==========================================

CREATE TABLE IF NOT EXISTS hint_routes (
  node_id TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  next_choice_id TEXT,
  steps_remaining INT,
  reachable BOOL NOT NULL DEFAULT false,
  reason TEXT,
  computed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (node_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_hint_routes_node ON hint_routes(node_id);
CREATE INDEX IF NOT EXISTS idx_hint_routes_achievement ON hint_routes(achievement_id);

COMMENT ON TABLE hint_routes IS 'Кэш маршрутов от ноды к ачивке для мгновенной выдачи подсказок';
