-- ============================================================
-- Пример: добавить мини-игру "trace_walls" в игру для тестирования.
-- Запускать вручную через SQL-редактор Supabase.
-- ============================================================

-- 1. Демо-нода, в которую попадаем после успешного прохождения коридора.
INSERT INTO public.nodes (
  id,
  act,
  location_name,
  title,
  narrative,
  thought,
  is_start_node,
  is_ending,
  ending_type,
  translations
) VALUES (
  'demo_trace_walls_success',
  'act1',
  'Демо',
  'Коридор пройден',
  'Вы аккуратно провели линию между энергетическими стенами и механизм разблокирован.',
  '',
  false,
  false,
  null,
  '{}'
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  narrative = EXCLUDED.narrative;

-- 2. Демо-нода провала (опционально, если хотите отдельную сцену вместо стандартной fail-ноды).
INSERT INTO public.nodes (
  id,
  act,
  location_name,
  title,
  narrative,
  thought,
  is_start_node,
  is_ending,
  ending_type,
  translations
) VALUES (
  'fail_demo_ch_trace_walls',
  'act1',
  'Демо',
  'Коридор задет',
  'Энергетическая стена вспыхнула — взлом сорван.',
  '',
  false,
  false,
  null,
  '{}'
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  narrative = EXCLUDED.narrative;

-- 3. Выбор с мини-игрой trace_walls на стартовой ноде.
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
  'demo_ch_trace_walls',
  'act1_start',
  'demo_trace_walls_success',
  '🔒 Взломать энергетический коридор (демо trace_walls)',
  '',
  '{}',
  '{"minigame":"trace_walls","apply_damage":15}',
  99,
  '{"en":{"label":"🔒 Hack the energy corridor (demo trace_walls)"},"es":{"label":"🔒 Hackear el corredor de energía (demo trace_walls)"},"pt_br":{"label":"🔒 Hackear o corredor de energia (demo trace_walls)"},"de":{"label":"🔒 Energiekorridor hacken (Demo trace_walls)"}}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  node_id = EXCLUDED.node_id,
  target_node_id = EXCLUDED.target_node_id,
  label = EXCLUDED.label,
  conditions = EXCLUDED.conditions,
  effects = EXCLUDED.effects,
  sort_order = EXCLUDED.sort_order,
  translations = EXCLUDED.translations;
