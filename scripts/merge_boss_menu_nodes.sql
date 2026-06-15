-- ==========================================
-- merge_boss_menu_nodes.sql
-- Удаление переходных нод "Меню боя" и "Отступление от боя"
-- с прямой перелинковкой выборов.
-- ==========================================

BEGIN;

-- 1. Прямая перелинковка: выбор "Вступить в бой" сразу ведёт в ноду тактики
UPDATE public.choices
SET target_node_id = 'act3_boss_combat'
WHERE id = 'ch_3_boss_to_combat';

-- 2. Прямая перелинковка: выбор "Оценить другие варианты" из боя сразу ведёт в меню босса
UPDATE public.choices
SET target_node_id = 'act3_boss_pat'
WHERE id = 'ch_3_combat_back';

-- 3. Удаление переходных выборов внутри удаляемых нод
DELETE FROM public.choices WHERE id IN (
    'trans_choice_ch_3_boss_to_combat',
    'trans_choice_ch_3_combat_back'
);

-- 4. Удаление переходных нод
DELETE FROM public.nodes WHERE id IN (
    'trans_ch_3_boss_to_combat',
    'trans_ch_3_combat_back'
);

COMMIT;
