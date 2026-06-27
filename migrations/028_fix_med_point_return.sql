-- Исправление возврата из аварийного мед-пункта (act2_med_point).
-- Теперь из мед-пункта два выхода:
--   1. ch_2_med_back          -> act2_corridors_rooms (Соседние отсеки)
--   2. ch_2_med_back_to_hub   -> act2_corridors       (Хаб жилого сектора)

-- 1. Перенаправляем и переименовываем существующий возврат в Соседние отсеки.
--    Effects (лечение + снятие флага кровотечения) остаются без изменений.
UPDATE public.choices
SET
  target_node_id = 'act2_corridors_rooms',
  label = '↩️ Вернуться в соседние отсеки',
  translations = jsonb_build_object(
    'ru', jsonb_build_object('label', '↩️ Вернуться в соседние отсеки'),
    'en', jsonb_build_object('label', '↩️ Return to adjacent compartments'),
    'es', jsonb_build_object('label', '↩️ Volver a los compartimentos adyacentes'),
    'pt_br', jsonb_build_object('label', '↩️ Voltar para os compartimentos adjacentes'),
    'de', jsonb_build_object('label', '↩️ Zurück zu den angrenzenden Abteilen')
  )
WHERE id = 'ch_2_med_back';

-- 2. Добавляем второй возврат — напрямую в Хаб жилого сектора.
INSERT INTO public.choices (
  id,
  node_id,
  target_node_id,
  label,
  narrative_override,
  conditions,
  effects,
  sort_order,
  translations
) VALUES (
  'ch_2_med_back_to_hub',
  'act2_med_point',
  'act2_corridors',
  '↩️ Вернуться на перекрёсток хаба',
  NULL,
  '{}',
  '{}',
  2,
  jsonb_build_object(
    'ru', jsonb_build_object('label', '↩️ Вернуться на перекрёсток хаба'),
    'en', jsonb_build_object('label', '↩️ Return to the corridor crossroad'),
    'es', jsonb_build_object('label', '↩️ Volver a la intersección del pasillo'),
    'pt_br', jsonb_build_object('label', '↩️ Voltar para o cruzamento do corredor'),
    'de', jsonb_build_object('label', '↩️ Zurück zur Korridorkreuzung')
  )
)
ON CONFLICT (id) DO UPDATE SET
  node_id = EXCLUDED.node_id,
  target_node_id = EXCLUDED.target_node_id,
  label = EXCLUDED.label,
  narrative_override = EXCLUDED.narrative_override,
  conditions = EXCLUDED.conditions,
  effects = EXCLUDED.effects,
  sort_order = EXCLUDED.sort_order,
  translations = EXCLUDED.translations;

-- 3. Убираем устаревший транзитный узел/выбор, если они остались в БД.
DELETE FROM public.choices WHERE id = 'trans_choice_ch_2_med_back';
DELETE FROM public.nodes WHERE id = 'trans_ch_2_med_back';
