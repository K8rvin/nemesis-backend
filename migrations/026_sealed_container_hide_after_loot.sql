-- Скрыть выбор взлома герметичного контейнера после получения предмета
-- Используется флаг cargo_container_looted: выбор прячется после успешного вскрытия

INSERT INTO public.nodes (id, act, location_name, title, narrative, thought, image_prompt, is_start_node, is_ending, ending_type, image_url, image_generated, translations)
VALUES (
  'act1_cargo_sealed_container',
  1,
  'Грузовой подъярус / Шахта лифта',
  'ГЕРМОКОНТЕЙНЕР',
  'У стены подъяруса стоит массивный герметичный контейнер с повреждённым замком. После точного вскрытия крышка откидывается, выпуская облако инертного газа. Внутри лежит исправный аккумулятор питания скафандра и упаковка радиационной пластины.',
  'Полезный хлам. Может пригодиться.',
  'sci-fi sealed cargo container open battery inside dark cargo bay',
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
  'ch_1_cargo_to_sealed_container',
  'act1_cargo_subdeck',
  'act1_cargo_sealed_container',
  '🔐 [ВЗЛОМ] Вскрыть герметичный контейнер',
  NULL,
  '{"flag_not_required": "cargo_container_looted", "flag_forbidden": "ch_1_cargo_to_sealed_container_failed"}',
  '{"minigame": "swipe_down", "add_flag": "cargo_container_looted", "add_item": "Запасной аккумулятор"}',
  4,
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
  'ch_1_cargo_sealed_container_back',
  'act1_cargo_sealed_container',
  'act1_cargo_subdeck',
  '↩️ Взять аккумулятор и выйти',
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
