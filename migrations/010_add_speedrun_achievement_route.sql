-- Обновляем выбор ach_speedrun: переносим в act1_hub_junk, требуем лом.
UPDATE public.choices
SET
  node_id = 'act1_hub_junk',
  label = '🔨 Ударить ломом по ржавой трубе',
  conditions = '{"item_required":"Тяжелый лом"}',
  translations = '{"en": {"label": "🔨 Hit a rusty pipe with a crowbar"}, "es": {"label": "🔨 Golpea una tubería oxidada con una palanca"}, "pt_br": {"label": "🔨 Acerte um cano enferrujado com um pé de cabra"}, "de": {"label": "🔨 Schlagen Sie mit einem Brecheisen auf ein rostiges Rohr"}}'::jsonb
WHERE id = 'ch_1_hub_fast_death';

-- Удаляем старые маршруты к ach_speedrun.
DELETE FROM public.achievement_routes
WHERE achievement_id = 'ach_speedrun';

-- Добавляем новые маршруты.
INSERT INTO public.achievement_routes (
  start_node_id,
  achievement_id,
  path,
  next_choice_id,
  steps_remaining,
  reachable
) VALUES
(
  'act1_start',
  'ach_speedrun',
  '["ch_1_start_to_skills", "trans_choice_ch_1_start_to_skills", "ch_1_skill_eng", "trans_choice_ch_1_skill_eng", "ch_1_hub_to_explore", "trans_choice_ch_1_hub_to_explore", "ch_1_explore_to_junk", "trans_choice_ch_1_explore_to_junk", "ch_1_hub_fast_death"]'::jsonb,
  'ch_1_start_to_skills',
  9,
  true
),
(
  'act1_hub',
  'ach_speedrun',
  '["ch_1_hub_to_explore", "trans_choice_ch_1_hub_to_explore", "ch_1_explore_to_junk", "trans_choice_ch_1_explore_to_junk", "ch_1_hub_fast_death"]'::jsonb,
  'ch_1_hub_to_explore',
  5,
  true
),
(
  'act1_hub_explore',
  'ach_speedrun',
  '["ch_1_explore_to_junk", "trans_choice_ch_1_explore_to_junk", "ch_1_hub_fast_death"]'::jsonb,
  'ch_1_explore_to_junk',
  3,
  true
),
(
  'act1_hub_junk',
  'ach_speedrun',
  '["ch_1_hub_fast_death"]'::jsonb,
  'ch_1_hub_fast_death',
  1,
  true
);
