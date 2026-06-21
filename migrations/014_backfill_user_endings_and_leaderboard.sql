-- Миграция: заполняем user_endings из текущих концовок в game_state
-- и пересчитываем leaderboard для всех игроков.

-- 1. Ретроспективно находим игроков, чей current_node_id — концовка.
INSERT INTO public.user_endings (
  user_id,
  node_id,
  ending_type,
  reached_at
)
SELECT
  gs.user_id,
  n.id,
  n.ending_type,
  gs.updated_at
FROM public.game_state gs
JOIN public.nodes n ON n.id = gs.current_node_id
WHERE n.is_ending = true
ON CONFLICT (user_id, node_id) DO NOTHING;

-- 2. Пересчитываем leaderboard для каждого игрока из game_state.
SELECT public.recalculate_leaderboard(gs.user_id)
FROM public.game_state gs;
