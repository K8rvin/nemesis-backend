-- Миграция: создаём денормализованную таблицу рейтинга,
-- функцию пересчёта и триггеры на user_achievements / user_endings.

CREATE TABLE IF NOT EXISTS public.leaderboard (
  user_id uuid PRIMARY KEY,
  endings_count int NOT NULL DEFAULT 0,
  achievements_count int NOT NULL DEFAULT 0,
  deaths_count int NOT NULL DEFAULT 0,
  victories_count int NOT NULL DEFAULT 0,
  secret_endings_count int NOT NULL DEFAULT 0,
  rare_achievements_count int NOT NULL DEFAULT 0,
  score int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.leaderboard IS 'Глобальный рейтинг игроков (денормализованный).';

-- Функция пересчёта статистики одного игрока.
CREATE OR REPLACE FUNCTION public.recalculate_leaderboard(p_user_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO public.leaderboard (
    user_id,
    endings_count,
    achievements_count,
    deaths_count,
    victories_count,
    secret_endings_count,
    rare_achievements_count,
    score,
    updated_at
  )
  SELECT
    p_user_id,
    COALESCE(e.endings_count, 0),
    COALESCE(a.achievements_count, 0),
    COALESCE(e.deaths_count, 0),
    COALESCE(e.victories_count, 0),
    COALESCE(e.secret_endings_count, 0),
    COALESCE(a.rare_achievements_count, 0),
    COALESCE(e.endings_count, 0) * 30
      + COALESCE(a.bronze_count, 0) * 10
      + COALESCE(a.silver_count, 0) * 25
      + COALESCE(a.gold_count, 0) * 50
      + COALESCE(a.platinum_count, 0) * 100,
    now()
  FROM (
    SELECT
      count(*)::int AS endings_count,
      count(*) FILTER (WHERE ending_type IN ('death', 'ABSURD_DEATH'))::int AS deaths_count,
      count(*) FILTER (WHERE ending_type LIKE 'victory%')::int AS victories_count,
      count(*) FILTER (WHERE ending_type LIKE 'SECRET%')::int AS secret_endings_count
    FROM public.user_endings
    WHERE user_id = p_user_id
  ) e
  CROSS JOIN (
    SELECT
      count(*)::int AS achievements_count,
      count(*) FILTER (WHERE medal_tier = 'BRONZE')::int AS bronze_count,
      count(*) FILTER (WHERE medal_tier = 'SILVER')::int AS silver_count,
      count(*) FILTER (WHERE medal_tier = 'GOLD')::int AS gold_count,
      count(*) FILTER (WHERE medal_tier = 'PLATINUM')::int AS platinum_count,
      count(*) FILTER (WHERE medal_tier IN ('SILVER','GOLD','PLATINUM'))::int AS rare_achievements_count
    FROM public.user_achievements ua
    JOIN public.achievements ach ON ach.id = ua.achievement_id
    WHERE ua.user_id = p_user_id
  ) a
  ON CONFLICT (user_id) DO UPDATE SET
    endings_count = EXCLUDED.endings_count,
    achievements_count = EXCLUDED.achievements_count,
    deaths_count = EXCLUDED.deaths_count,
    victories_count = EXCLUDED.victories_count,
    secret_endings_count = EXCLUDED.secret_endings_count,
    rare_achievements_count = EXCLUDED.rare_achievements_count,
    score = EXCLUDED.score,
    updated_at = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql;

-- Триггерная функция.
CREATE OR REPLACE FUNCTION public.trigger_recalculate_leaderboard()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_leaderboard(OLD.user_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalculate_leaderboard(NEW.user_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Триггеры.
DROP TRIGGER IF EXISTS trg_user_achievements_recalc ON public.user_achievements;
CREATE TRIGGER trg_user_achievements_recalc
AFTER INSERT OR DELETE ON public.user_achievements
FOR EACH ROW EXECUTE FUNCTION public.trigger_recalculate_leaderboard();

DROP TRIGGER IF EXISTS trg_user_endings_recalc ON public.user_endings;
CREATE TRIGGER trg_user_endings_recalc
AFTER INSERT OR DELETE ON public.user_endings
FOR EACH ROW EXECUTE FUNCTION public.trigger_recalculate_leaderboard();

-- RPC: постраничный рейтинг с глобальным rank.
CREATE OR REPLACE FUNCTION public.get_leaderboard(p_limit int, p_offset int, p_sort text DEFAULT 'score')
RETURNS TABLE (
  user_id uuid,
  username text,
  endings_count int,
  achievements_count int,
  deaths_count int,
  victories_count int,
  secret_endings_count int,
  rare_achievements_count int,
  score int,
  rank int
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked AS (
    SELECT
      l.user_id,
      p.username,
      l.endings_count,
      l.achievements_count,
      l.deaths_count,
      l.victories_count,
      l.secret_endings_count,
      l.rare_achievements_count,
      l.score,
      rank() OVER (
        ORDER BY l.score DESC, l.achievements_count DESC, l.endings_count DESC
      )::int AS r
    FROM public.leaderboard l
    LEFT JOIN public.players p ON p.id = l.user_id
  )
  SELECT *
  FROM ranked
  ORDER BY
    CASE
      WHEN p_sort = 'achievements_count' THEN ranked.achievements_count
      WHEN p_sort = 'endings_count' THEN ranked.endings_count
      ELSE ranked.score
    END DESC,
    ranked.achievements_count DESC,
    ranked.endings_count DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- RPC: позиция конкретного игрока.
CREATE OR REPLACE FUNCTION public.get_leaderboard_me(p_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  username text,
  endings_count int,
  achievements_count int,
  deaths_count int,
  victories_count int,
  secret_endings_count int,
  rare_achievements_count int,
  score int,
  rank int
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked AS (
    SELECT
      l.user_id,
      p.username,
      l.endings_count,
      l.achievements_count,
      l.deaths_count,
      l.victories_count,
      l.secret_endings_count,
      l.rare_achievements_count,
      l.score,
      rank() OVER (
        ORDER BY l.score DESC, l.achievements_count DESC, l.endings_count DESC
      )::int AS r
    FROM public.leaderboard l
    LEFT JOIN public.players p ON p.id = l.user_id
  )
  SELECT * FROM ranked WHERE ranked.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;
