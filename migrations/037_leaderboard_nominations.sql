-- Миграция: номинации в глобальном рейтинге.
-- Возвращает лидера по каждой интересной метрике leaderboard.

CREATE OR REPLACE FUNCTION public.get_leaderboard_nominations()
RETURNS TABLE (
  category text,
  user_id uuid,
  username text,
  value int
) AS $$
BEGIN
  RETURN QUERY
  SELECT 'legend'::text, l.user_id, p.username, l.score
  FROM public.leaderboard l
  LEFT JOIN public.players p ON p.id = l.user_id
  ORDER BY l.score DESC, l.achievements_count DESC, l.endings_count DESC
  LIMIT 1;

  RETURN QUERY
  SELECT 'endings'::text, l.user_id, p.username, l.endings_count
  FROM public.leaderboard l
  LEFT JOIN public.players p ON p.id = l.user_id
  ORDER BY l.endings_count DESC, l.score DESC
  LIMIT 1;

  RETURN QUERY
  SELECT 'deaths'::text, l.user_id, p.username, l.deaths_count
  FROM public.leaderboard l
  LEFT JOIN public.players p ON p.id = l.user_id
  ORDER BY l.deaths_count DESC, l.score DESC
  LIMIT 1;

  RETURN QUERY
  SELECT 'victories'::text, l.user_id, p.username, l.victories_count
  FROM public.leaderboard l
  LEFT JOIN public.players p ON p.id = l.user_id
  ORDER BY l.victories_count DESC, l.score DESC
  LIMIT 1;

  RETURN QUERY
  SELECT 'achievements'::text, l.user_id, p.username, l.achievements_count
  FROM public.leaderboard l
  LEFT JOIN public.players p ON p.id = l.user_id
  ORDER BY l.achievements_count DESC, l.score DESC
  LIMIT 1;

  RETURN QUERY
  SELECT 'secrets'::text, l.user_id, p.username, l.secret_endings_count
  FROM public.leaderboard l
  LEFT JOIN public.players p ON p.id = l.user_id
  ORDER BY l.secret_endings_count DESC, l.score DESC
  LIMIT 1;

  RETURN QUERY
  SELECT 'rare'::text, l.user_id, p.username, l.rare_achievements_count
  FROM public.leaderboard l
  LEFT JOIN public.players p ON p.id = l.user_id
  ORDER BY l.rare_achievements_count DESC, l.score DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
