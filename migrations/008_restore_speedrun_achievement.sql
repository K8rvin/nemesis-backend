-- Миграция: возвращаем достижение ach_speedrun.
--
-- Достижение "Скорострел" — погибнуть в первые 2 минуты игры,
-- устроив грохот в Свалочном хабе.
--
-- Добавляем в act1_hub выбор, который отправляет игрока
-- в act1_death_fast с немедленным уроном и разблокировкой ачивки.
--
-- Юмористический лейбл: "сыграть на вентиляционной трубе".

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
  'ch_1_hub_fast_death',
  'act1_hub',
  'act1_death_fast',
  '🥁 Сыграть на вентиляционной трубе сольную партию',
  '',
  '{}',
  '{"apply_damage": 100, "unlock_achievement": "ach_speedrun"}',
  99,
  '{}'
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
