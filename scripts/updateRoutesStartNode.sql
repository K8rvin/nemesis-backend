-- ==========================================
-- updateRoutesStartNode.sql
-- Перевод маршрутов ачивок с act1_skills на act1_start.
-- ==========================================

BEGIN;

-- 1. Создание новых маршрутов от act1_start
INSERT INTO public.achievement_routes (start_node_id, achievement_id, path, next_choice_id, steps_remaining, reachable)
SELECT
    'act1_start',
    achievement_id,
    '["ch_1_start_to_skills","trans_choice_ch_1_start_to_skills"]'::jsonb || path,
    'ch_1_start_to_skills',
    steps_remaining + 2,
    reachable
FROM public.achievement_routes
WHERE start_node_id = 'act1_skills';

-- 2. Удаление старых маршрутов от act1_skills
DELETE FROM public.achievement_routes WHERE start_node_id = 'act1_skills';

COMMIT;
