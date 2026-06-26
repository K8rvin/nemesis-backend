-- Скрыть взлом в Брошенном уюте после забора вещей в Офисах СБ
-- Используется флаг есть_схема_вентиляции, который ставится при взятии предмета

INSERT INTO public.nodes (id, act, location_name, title, narrative, thought, image_prompt, is_start_node, is_ending, ending_type, image_url, image_generated, translations)
VALUES (
  'fail_ch_2_lounge_to_security',
  2,
  'Комната отдыха персонала',
  'ВЗЛОМ ПРОВАЛЕН',
  'Ты дергаешь ручку стойки администратора, но замок соскакивает с паза. Ящик заперт навсегда, путь в офисы СБ перекрыт.',
  'Повторная попытка бесполезна. Нужно искать другой путь.',
  'sci-fi broken lock jammed mechanism red warning lights dark corridor',
  false,
  false,
  NULL,
  NULL,
  false,
  '{}'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.choices (id, node_id, target_node_id, label, narrative_override, conditions, effects, sort_order, translations)
VALUES (
  'ch_2_lounge_to_security',
  'act2_recreation_room',
  'trans_ch_2_lounge_to_security',
  '🗝️ [ВЗЛОМ] Обыскать стойку администратора и пройти в Офисы СБ',
  NULL,
  '{"flag_not_required": "есть_схема_вентиляции", "flag_forbidden": "ch_2_lounge_to_security_failed"}',
  '{"minigame": "swipe_down"}',
  3,
  '{}'
)
ON CONFLICT (id) DO UPDATE SET
  node_id = EXCLUDED.node_id,
  target_node_id = EXCLUDED.target_node_id,
  label = EXCLUDED.label,
  narrative_override = EXCLUDED.narrative_override,
  conditions = EXCLUDED.conditions,
  effects = EXCLUDED.effects,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.choices (id, node_id, target_node_id, label, narrative_override, conditions, effects, sort_order, translations)
VALUES (
  'ch_2_lounge_to_security_return',
  'fail_ch_2_lounge_to_security',
  'act2_recreation_room',
  '↩️ Продолжить',
  NULL,
  '{}',
  '{}',
  1,
  '{}'
)
ON CONFLICT (id) DO UPDATE SET
  node_id = EXCLUDED.node_id,
  target_node_id = EXCLUDED.target_node_id,
  label = EXCLUDED.label,
  narrative_override = EXCLUDED.narrative_override,
  conditions = EXCLUDED.conditions,
  effects = EXCLUDED.effects,
  sort_order = EXCLUDED.sort_order;
