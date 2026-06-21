-- Миграция: добавляем выбор использования Сломанного Хронометра
-- и маршрут к достижению ach_time_paradox.

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
  'ch_2_use_chronometer',
  'act2_recreation_room',
  'act2_death_time_paradox',
  '⏳ Попытаться отмотать время Хронометром',
  '',
  '{"item_required":"Сломанный Хронометр"}',
  '{"unlock_achievement":"ach_time_paradox","set_hp":0}',
  99,
  '{"en": {"label": "⏳ Try to rewind time using the Chronometer"}, "es": {"label": "⏳ Intenta retroceder el tiempo usando el cronómetro"}, "pt_br": {"label": "⏳ Tente voltar no tempo usando o cronômetro"}, "de": {"label": "⏳ Versuchen Sie, die Zeit mit dem Chronometer zurückzustellen"}}'::jsonb
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

-- Удаляем старые маршруты к ach_time_paradox.
DELETE FROM public.achievement_routes
WHERE achievement_id = 'ach_time_paradox';

-- Добавляем единственный маршрут от стартовой ноды.
INSERT INTO public.achievement_routes (
  start_node_id,
  achievement_id,
  path,
  next_choice_id,
  steps_remaining,
  reachable
) VALUES (
  'act1_start',
  'ach_time_paradox',
  '["ch_1_start_to_skills", "trans_choice_ch_1_start_to_skills", "ch_1_skill_eng", "trans_choice_ch_1_skill_eng", "ch_1_hub_to_lounge", "trans_choice_ch_1_hub_to_lounge", "ch_2_loot_chronometer", "trans_choice_ch_2_loot_chronometer", "ch_2_use_chronometer"]'::jsonb,
  'ch_1_start_to_skills',
  9,
  true
);
