-- ============================================================
-- Миграция 048: исправляем учёт концовок/смертей в лидерборде.
--
-- Проблема: бэкенд вызывал запись user_endings и player_history
-- через fire-and-forget (.catch(() => {})). В Cloudflare Workers
-- такие задачи могут быть оборваны до завершения, поэтому
-- user_endings оставался пустым, а leaderboard имел нули.
--
-- Эта миграция:
-- 1. Восстанавливает user_endings из текущих game_state, где
--    current_node_id является концовкой (если строки ещё нет).
-- 2. Пересчитывает leaderboard для всех игроков.
-- 3. Пересоздаёт триггеры на случай, если они отсутствовали.
-- ============================================================

-- 1. Ретроспективно заполняем user_endings для тех, кто сейчас стоит на концовке.
INSERT INTO public.user_endings (
  user_id,
  node_id,
  ending_type,
  reached_at
)
SELECT
  gs.user_id,
  gs.current_node_id,
  n.ending_type,
  now()
FROM public.game_state gs
JOIN public.nodes n ON n.id = gs.current_node_id
WHERE n.is_ending = true
  AND NOT EXISTS (
    SELECT 1 FROM public.user_endings ue
    WHERE ue.user_id = gs.user_id AND ue.node_id = gs.current_node_id
  )
ON CONFLICT (user_id, node_id) DO NOTHING;

-- 2. Пересчитываем leaderboard для всех игроков.
SELECT public.recalculate_leaderboard(gs.user_id)
FROM public.game_state gs;

-- 3. Гарантируем, что триггеры пересчёта существуют.
DROP TRIGGER IF EXISTS trg_user_achievements_recalc ON public.user_achievements;
CREATE TRIGGER trg_user_achievements_recalc
AFTER INSERT OR DELETE ON public.user_achievements
FOR EACH ROW EXECUTE FUNCTION public.trigger_recalculate_leaderboard();

DROP TRIGGER IF EXISTS trg_user_endings_recalc ON public.user_endings;
CREATE TRIGGER trg_user_endings_recalc
AFTER INSERT OR DELETE ON public.user_endings
FOR EACH ROW EXECUTE FUNCTION public.trigger_recalculate_leaderboard();
