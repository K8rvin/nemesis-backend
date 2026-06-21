-- Миграция: добавляем достижение за нахождение секретного шаттла в act1_hub.

INSERT INTO public.achievements (
  id,
  title,
  description,
  medal_tier,
  translations
) VALUES (
  'ach_secret_shuttle',
  'Скрытный док',
  'Найти заброшенный спасательный шаттл в дальнем углу Свалочного хаба',
  'SILVER',
  '{"en": {"title": "Hidden dock", "description": "Find the abandoned rescue shuttle in the far corner of the Scrap Hub"}, "es": {"title": "Muelle escondido", "description": "Encuentra el transbordador de rescate abandonado en el rincón más alejado del centro de chatarra."}, "pt_br": {"title": "Doca escondida", "description": "Encontre o ônibus de resgate abandonado no canto mais distante do Scrap Hub"}, "de": {"title": "Verstecktes Dock", "description": "Finden Sie das verlassene Rettungsshuttle in der hinteren Ecke des Scrap Hub"}}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  medal_tier = EXCLUDED.medal_tier,
  translations = EXCLUDED.translations;

-- Выдаём достижение при выборе, ведущем в act1_secret_shuttle.
UPDATE public.choices
SET effects = '{"unlock_achievement":"ach_secret_shuttle"}'
WHERE id = 'ch_1_hub_to_shuttle';

-- Удаляем старые маршруты к ach_secret_shuttle.
DELETE FROM public.achievement_routes
WHERE achievement_id = 'ach_secret_shuttle';

-- Добавляем маршрут от стартовой ноды (через навык STL).
INSERT INTO public.achievement_routes (
  start_node_id,
  achievement_id,
  path,
  next_choice_id,
  steps_remaining,
  reachable
) VALUES (
  'act1_start',
  'ach_secret_shuttle',
  '["ch_1_start_to_skills", "trans_choice_ch_1_start_to_skills", "ch_1_skill_stl", "trans_choice_ch_1_skill_stl", "ch_1_hub_to_shuttle"]'::jsonb,
  'ch_1_start_to_skills',
  5,
  true
);
