-- ==========================================
-- fixLoungeTransitions.sql
-- Переорганизация переходов вокруг ноды Брошенный уют (act2_recreation_room).
--
-- Логика:
-- - ch_2_rec_back теперь ведёт обратно в Свалочный хаб (act1_hub),
--   откуда игрок попадает в Брошенный уют.
-- - Новый выбор ch_2_rec_to_corridors обеспечивает прямой проход
--   из Брошенного уюта в Хаб жилого сектора (act2_corridors).
-- - Маршруты ачивок обновлены: ch_2_rec_back заменён на ch_2_rec_to_corridors
--   там, где нужен проход в Хаб жилого сектора.
-- ==========================================

BEGIN;

-- 1. Возврат из Брошенного уюта ведёт в Свалочный хаб
UPDATE public.choices
SET target_node_id = 'act1_hub',
    label = '↩️ Вернуться в Свалочный хаб'
WHERE id = 'ch_2_rec_back';

-- 2. Прямой проход из Брошенного уюта в Хаб жилого сектора
INSERT INTO public.choices (
    id,
    node_id,
    target_node_id,
    label,
    narrative_override,
    conditions,
    effects,
    sort_order
) VALUES (
    'ch_2_rec_to_corridors',
    'act2_recreation_room',
    'act2_corridors',
    '🚪 Выйти в общие коридоры кают',
    NULL,
    '{}'::jsonb,
    '{}'::jsonb,
    1
);

-- 3. Обновление маршрутов ачивок
UPDATE public.achievement_routes
SET path = (
    SELECT jsonb_agg(
        CASE
            WHEN value = '"ch_2_rec_back"' THEN '"ch_2_rec_to_corridors"'::jsonb
            ELSE value
        END
    )
    FROM jsonb_array_elements(path) AS value
)
WHERE start_node_id = 'act1_skills'
  AND achievement_id IN ('ach_lucky_bastard', 'ach_steel_cocoon');

COMMIT;
