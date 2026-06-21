-- Миграция: удаление транзитных нод "Выход из мед-пункта".
-- Перенаправляем выборы из мед-пункта/мед-блока сразу в целевые ноды,
-- убирая лишний транзитный шаг.

BEGIN;

-- 1. Перенаправить выборы из мед-пункта (Акт 2) и мед-блока (Акт 3)
UPDATE public.choices
SET target_node_id = 'act2_corridors'
WHERE id = 'ch_2_med_back';

UPDATE public.choices
SET target_node_id = 'act3_hub'
WHERE id = 'ch_3_med_back';

-- 2. Удалить choice-записи, которые вели из транзитных нод
DELETE FROM public.choices
WHERE id IN ('trans_choice_ch_2_med_back', 'trans_choice_ch_3_med_back');

-- 3. Удалить готовые маршруты к ачивкам, использующие удалённые choice_id (если есть)
DELETE FROM public.achievement_routes
WHERE path ?| ARRAY['trans_choice_ch_2_med_back', 'trans_choice_ch_3_med_back'];

-- 4. Удалить сами транзитные ноды
DELETE FROM public.nodes
WHERE id IN ('trans_ch_2_med_back', 'trans_ch_3_med_back');

COMMIT;
