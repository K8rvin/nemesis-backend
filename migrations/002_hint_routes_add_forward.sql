-- Добавляем колонки для разделения forward и reverse результатов
ALTER TABLE hint_routes
  ADD COLUMN IF NOT EXISTS forward_reachable BOOL,
  ADD COLUMN IF NOT EXISTS forward_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_theoretical BOOL NOT NULL DEFAULT false;

-- Комментарий для ясности
COMMENT ON COLUMN hint_routes.reachable IS 'True если цель достижима хотя бы теоретически (forward или reverse)';
COMMENT ON COLUMN hint_routes.forward_reachable IS 'True если цель достижима с учётом текущего состояния/условий (forward BFS)';
COMMENT ON COLUMN hint_routes.is_theoretical IS 'True если reachable=true только благодаря reverse BFS (игнорирует условия)';
COMMENT ON COLUMN hint_routes.reason IS 'Причина недостижимости или theoretical_reverse';
