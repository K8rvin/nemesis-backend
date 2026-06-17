-- Добавляет в act5_bridge_showdown два варианта выхода из ловушки без жертвы Тобиаса.
-- Вариант с Тяжелым ломом используется в маршруте ach_no_man_left_behind.
-- Вариант с Запасным аккумулятором — просто дополнительная опция.

-- Transition-ноды
INSERT INTO public.nodes (id, act, location_name, title, narrative, thought, image_prompt, is_start_node, is_ending)
VALUES (
  'trans_ch_5_showdown_crowbar',
  5,
  'Переход',
  'Лом в механизме турели',
  'Ты всаживаешь Тяжелый лом в зазор поворотного сервопривода ближайшей турели. Металл скрежетит, мотор глохнет, и пушка застывает, упершись стволом в соседнюю турель. Вторичный взрыв разлетается искрами, но проход к терминалу свободен.',
  'Старый добрый рычаг — лучше всякой электроники.',
  'crowbar jammed into turret mechanism, sparks, astronaut running to terminal',
  false,
  false
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.nodes (id, act, location_name, title, narrative, thought, image_prompt, is_start_node, is_ending)
VALUES (
  'trans_ch_5_showdown_battery',
  5,
  'Переход',
  'Импульс щита',
  'Ты хватаешь Запасной аккумулятор и втыкаешь его в аварийный разъём нагрудной пластины. На долю секунды кинетический щит вспыхивает, отбивая первый залп лазеров. Под прикрытием этого единственного всплеска ты бросаешься к центральной консоли.',
  'Одного заряда хватит ровно на один рывок.',
  'kinetic shield flare from spare battery, astronaut sprinting past laser turrets',
  false,
  false
)
ON CONFLICT (id) DO NOTHING;

-- Основные выборы в act5_bridge_showdown
INSERT INTO public.choices (id, node_id, target_node_id, label, conditions, effects, sort_order)
VALUES (
  'ch_5_showdown_crowbar',
  'act5_bridge_showdown',
  'trans_ch_5_showdown_crowbar',
  '🔧 [ПРЕДМЕТ] Воткнуть Тяжелый лом в сервопривод турелей',
  '{"item_required": "Тяжелый лом"}'::jsonb,
  '{}'::jsonb,
  6
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.choices (id, node_id, target_node_id, label, conditions, effects, sort_order)
VALUES (
  'ch_5_showdown_battery',
  'act5_bridge_showdown',
  'trans_ch_5_showdown_battery',
  '⚡ [ПРЕДМЕТ] Использовать Запасной аккумулятор для импульса щита',
  '{"item_required": "Запасной аккумулятор"}'::jsonb,
  '{}'::jsonb,
  7
)
ON CONFLICT (id) DO NOTHING;

-- Transition-выборы
INSERT INTO public.choices (id, node_id, target_node_id, label, conditions, effects, sort_order)
VALUES (
  'trans_choice_ch_5_showdown_crowbar',
  'trans_ch_5_showdown_crowbar',
  'act5_terminal_final',
  '➡️ Проскочить мимо обездвиженных турелей',
  '{}'::jsonb,
  '{}'::jsonb,
  1
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.choices (id, node_id, target_node_id, label, conditions, effects, sort_order)
VALUES (
  'trans_choice_ch_5_showdown_battery',
  'trans_ch_5_showdown_battery',
  'act5_terminal_final',
  '➡️ Рвануть к терминалу под прикрытием щита',
  '{}'::jsonb,
  '{}'::jsonb,
  1
)
ON CONFLICT (id) DO NOTHING;
