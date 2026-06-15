-- ==========================================
-- add_scrap_perfectionist_achievement.sql
-- Добавление ачивки "Хламовый перфекционист"
-- за полное обследование Завалов металлолома.
-- ==========================================

BEGIN;

-- 1. Добавление ачивки
INSERT INTO public.achievements (id, title, description, medal_tier, icon_url)
VALUES (
    'ach_scrap_perfectionist',
    'Хламовый перфекционист',
    'Ничего не упустить на Завалах металлолома: три предмета и планшет — в кармане.',
    'BRONZE',
    NULL
);

-- 2. Добавление выбора, который появляется после полного обследования
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
    'ch_1_junk_complete',
    'act1_hub_junk',
    'act1_hub_explore',
    '🏆 Завалы исследованы до дна',
    NULL,
    '{"flag_required":["нашел_магнитометр","нашел_лом","взял_сервопривод","visited_lore_pad"]}'::jsonb,
    '{"unlock_achievement":"ach_scrap_perfectionist"}'::jsonb,
    0
);

COMMIT;
