-- ============================================================
-- Миграция: добавляем мини-игру trace_walls в сюжетные моменты.
-- Каждая точка — узкий/опасный коридор, где логично "вести линию".
-- Форма подбирается клиентом автоматически по текущей сложности.
-- ============================================================

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
) VALUES
-- 1. Акт 2: обходной вентиляционный тоннель (введение, широкий коридор)
(
  'ch_2_bypass_trace_walls',
  'act2_bypass_tunnel',
  'trans_ch_2_bypass_to_bridge',
  '🌐 [ЛОВКОСТЬ] Пройти узкий вентиляционный коридор, не задевая аварийные трубы',
  '',
  '{}',
  '{"minigame":"trace_walls","add_flag":"тихий_обход_тоннеля"}',
  5,
  '{"en":{"label":"🌐 [AGILITY] Pass the narrow ventilation corridor without touching the emergency pipes"},"es":{"label":"🌐 [AGILIDAD] Pasar por el estrecho corredor de ventilación sin tocar las tuberías de emergencia"},"pt_br":{"label":"🌐 [AGILIDADE] Passar pelo estreito corredor de ventilação sem tocar os canos de emergência"},"de":{"label":"🌐 [BEWEGLICHKEIT] Durch den engen Lüftungskorridor gehen, ohne die Notrohre zu berühren"}}'::jsonb
),
-- 2. Акт 3: перегретый реакторный коридор (сложный, но даёт чистый выход)
(
  'ch_3_reactor_trace_walls',
  'act3_reactor_overload',
  'act5_start',
  '⚡ [РЕФЛЕКСЫ] Проскочить через плазменный коридор, не коснувшись стен',
  '',
  '{}',
  '{"minigame":"trace_walls"}',
  5,
  '{"en":{"label":"⚡ [REFLEXES] Dash through the plasma corridor without touching the walls"},"es":{"label":"⚡ [REFLEJOS] Atravesar el corredor de plasma sin tocar las paredes"},"pt_br":{"label":"⚡ [REFLEXOS] Atravessar o corredor de plasma sem tocar as paredes"},"de":{"label":"⚡ [REFLEXE] Durch den Plasmakorridor schlittern, ohne die Wände zu berühren"}}'::jsonb
),
-- 3. Акт 4: верхняя шахта лифта, обломки и тросы (альтернатива рефлекса/удаче)
(
  'ch_4_phase2_trace_walls',
  'act4_climb_phase2',
  'trans_ch_4_phase2_solo_clean',
  '🤸 [ЛОВКОСТЬ] Удержаться на вибрирующей стене шахты, уклоняясь от обломков',
  '',
  '{}',
  '{"minigame":"trace_walls"}',
  6,
  '{"en":{"label":"🤸 [AGILITY] Hold onto the vibrating shaft wall while dodging debris"},"es":{"label":"🤸 [AGILIDAD] Mantenerse en la pared vibrante del pozo, esquivando escombros"},"pt_br":{"label":"🤸 [AGILIDADE] Segurar na parede vibrante do poço, desviando de destroços"},"de":{"label":"🤸 [BEWEGLICHKEIT] An der vibrierenden Schachtwand festhalten und Trümmern ausweichen"}}'::jsonb
),
-- 4. Акт 5: лазерный коридор турелей на мостике (кульминация)
(
  'ch_5_bridge_ai_trace_walls',
  'act5_bridge_showdown_ai',
  'act5_bridge_showdown',
  '💨 [РЕФЛЕКСЫ] Прорваться сквозь лазерный коридор турелей',
  '',
  '{}',
  '{"minigame":"trace_walls","apply_damage":10}',
  5,
  '{"en":{"label":"💨 [REFLEXES] Break through the turret laser corridor"},"es":{"label":"💨 [REFLEJOS] Abrirse paso por el corredor láser de las torretas"},"pt_br":{"label":"💨 [REFLEXOS] Avançar pelo corredor de lasers das torretas"},"de":{"label":"💨 [REFLEXE] Durch den Laserkorridor der Geschütztürme brechen"}}'::jsonb
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
