-- Миграция: добавляем логические исходы в секретный шаттл 'Цельс'.

-- 1. Убираем выдачу достижения просто за вход в шаттл.
UPDATE public.choices SET effects = '{}' WHERE id = 'ch_1_hub_to_shuttle';

-- 2. Создаём ноду победной концовки и failure-ноду.

INSERT INTO public.nodes (
  id, act, location_name, title, narrative, thought, image_prompt,
  is_start_node, is_ending, ending_type, translations
) VALUES (
  'act1_secret_shuttle_victory',
  1,
  '🚀 Скрытый Эвакуационный Док',
  'ПОБЕГ НА ШАТТЛЕ ЦЕЛЬС',
  'Тебе удалось запитать двигатели старого спасательного шаттла «Цельс». Системы жизнеобеспечения вошли в штатный режим, люк захлопнулся, и шаттл оторвался от обречённой «Немезиды». Ты улетел в открытый космос, оставив позади кошмар станции.',
  'Свобода. Пусть цена — предательство миссии, но ты жив.',
  '...',
  false,
  true,
  'victory_secret_shuttle',
  '{"en": {"title": "ESCAPE BY SHUTTLE CELUS", "narrative": "You managed to power the engines of the old Celsus rescue shuttle. The life support systems returned to normal, the hatch slammed shut, and the shuttle lifted off from the doomed Nemesis. You flew into outer space, leaving behind the nightmare of the station.", "thought": "Freedom. The price may be betrayal of the mission, but you are alive.", "location_name": "🚀 Hidden Evacuation Dock"}, "es": {"title": "ESCAPAR EN EL TRANSPORTE CELUS", "narrative": "Conseguiste alimentar los motores del viejo transbordador de rescate Celsus. Los sistemas de soporte vital volvieron a la normalidad, la escotilla se cerró de golpe y la lanzadera despegó del condenado Némesis. Volaste al espacio exterior, dejando atrás la pesadilla de la estación.", "thought": "Libertad. El precio puede ser la traición a la misión, pero estás vivo.", "location_name": "🚀 Muelle de evacuación oculto"}, "pt_br": {"title": "ESCAPE NO SHUTTLE CELUS", "narrative": "Você conseguiu acionar os motores do antigo ônibus de resgate Celsus. Os sistemas de suporte de vida voltaram ao normal, a escotilha se fechou e a nave decolou do condenado Nemesis. Você voou para o espaço sideral, deixando para trás o pesadelo da estação.", "thought": "Liberdade. O preço pode ser a traição da missão, mas você está vivo.", "location_name": "🚀 Doca de evacuação oculta"}, "de": {"title": "FLUCHT MIT DEM SHUTTLE CELUS", "narrative": "Du hast es geschafft, die Motoren des alten Celsus-Rettungsshuttles anzutreiben. Die Lebenserhaltungssysteme normalisierten sich wieder, die Luke wurde zugeschlagen und das Shuttle hob von der zum Scheitern verurteilten Nemesis ab. Du bist in den Weltraum geflogen und hast den Albtraum der Station zurückgelassen.", "thought": "Freiheit. Der Preis mag Verrat an der Mission sein, aber du lebst.", "location_name": "🚀 Verstecktes Evakuierungsdock"}}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  act = EXCLUDED.act,
  location_name = EXCLUDED.location_name,
  title = EXCLUDED.title,
  narrative = EXCLUDED.narrative,
  thought = EXCLUDED.thought,
  image_prompt = EXCLUDED.image_prompt,
  is_start_node = EXCLUDED.is_start_node,
  is_ending = EXCLUDED.is_ending,
  ending_type = EXCLUDED.ending_type,
  translations = EXCLUDED.translations;


INSERT INTO public.nodes (
  id, act, location_name, title, narrative, thought, image_prompt,
  is_start_node, is_ending, ending_type, translations
) VALUES (
  'fail_ch_1_shuttle_hack',
  1,
  '🚀 Скрытый Эвакуационный Док',
  'ОШИБКА ВЗЛОМА',
  'Схема доступа отклонена. Силовые контуры шаттла щёлкают разрядниками, и разряд бьёт тебя сквозь броню скафандра.',
  'Панель заблокирована. Нужно попробовать снова или уйти.',
  '...',
  false,
  false,
  NULL,
  '{"en": {"title": "HACK ERROR", "narrative": "Access scheme rejected. The power circuits of the shuttle click the dischargers, and the discharge hits you through the armor of the suit.", "thought": "The panel is locked. You need to try again or leave.", "location_name": "🚀 Hidden Evacuation Dock"}, "es": {"title": "ERROR DE CORTE", "narrative": "Esquema de acceso rechazado. Los circuitos de energía de la lanzadera hacen clic en los descargadores y la descarga te golpea a través de la armadura del traje.", "thought": "El panel está bloqueado. Tienes que volver a intentarlo o marcharte.", "location_name": "🚀 Muelle de evacuación oculto"}, "pt_br": {"title": "ERRO DE HACK", "narrative": "Esquema de acesso rejeitado. Os circuitos de energia da nave clicam nos descarregadores e a descarga atinge você através da armadura do traje.", "thought": "O painel está bloqueado. Você precisa tentar novamente ou sair.", "location_name": "🚀 Doca de evacuação oculta"}, "de": {"title": "HACK-FEHLER", "narrative": "Zugriffsschema abgelehnt. Die Stromkreise des Shuttles klicken auf die Entlader, und die Entladung trifft Sie durch die Panzerung des Anzugs.", "thought": "Das Panel ist gesperrt. Sie müssen es noch einmal versuchen oder gehen.", "location_name": "🚀 Verstecktes Evakuierungsdock"}}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  act = EXCLUDED.act,
  location_name = EXCLUDED.location_name,
  title = EXCLUDED.title,
  narrative = EXCLUDED.narrative,
  thought = EXCLUDED.thought,
  image_prompt = EXCLUDED.image_prompt,
  is_start_node = EXCLUDED.is_start_node,
  is_ending = EXCLUDED.is_ending,
  ending_type = EXCLUDED.ending_type,
  translations = EXCLUDED.translations;


-- 3. Создаём выборы в шаттле и failure-возврат.

INSERT INTO public.choices (
  id, node_id, target_node_id, label, narrative_override,
  conditions, effects, sort_order, translations
) VALUES (
  'ch_1_shuttle_hack',
  'act1_secret_shuttle',
  'act1_secret_shuttle_victory',
  '🔓 Взломать панель запуска',
  '',
  '{"item_required":"Запасной аккумулятор"}',
  '{"minigame":"pattern_lock","pattern_sequence":"1-4-7-8-9","apply_damage":30,"unlock_achievement":"ach_secret_shuttle"}',
  1,
  '{"en": {"label": "🔓 Hack launcher"}, "es": {"label": "🔓 Hackear lanzador"}, "pt_br": {"label": "🔓 Iniciador de hackers"}, "de": {"label": "🔓 Hack-Launcher"}}'::jsonb
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


INSERT INTO public.choices (
  id, node_id, target_node_id, label, narrative_override,
  conditions, effects, sort_order, translations
) VALUES (
  'ch_1_shuttle_back',
  'act1_secret_shuttle',
  'act1_hub',
  '↩️ Вернуться в хаб',
  '',
  '{}',
  '{}',
  2,
  '{"en": {"label": "↩️ Return to hub"}, "es": {"label": "↩️ Regresar al centro"}, "pt_br": {"label": "↩️ Retorno ao hub"}, "de": {"label": "↩️ Rückkehr zum Hub"}}'::jsonb
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


INSERT INTO public.choices (
  id, node_id, target_node_id, label, narrative_override,
  conditions, effects, sort_order, translations
) VALUES (
  'ch_1_shuttle_hack_return',
  'fail_ch_1_shuttle_hack',
  'act1_secret_shuttle',
  '🔄 Попробовать ещё раз',
  '',
  '{}',
  '{}',
  1,
  '{"en": {"label": "🔄 Try again"}, "es": {"label": "🔄 Inténtalo de nuevo"}, "pt_br": {"label": "🔄 Tente novamente"}, "de": {"label": "🔄 Versuchen Sie es noch einmal"}}'::jsonb
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


-- 4. Обновляем маршрут к ach_secret_shuttle от ноды шаттла.
DELETE FROM public.achievement_routes WHERE achievement_id = 'ach_secret_shuttle';

INSERT INTO public.achievement_routes (
  start_node_id, achievement_id, path, next_choice_id, steps_remaining, reachable
) VALUES (
  'act1_secret_shuttle',
  'ach_secret_shuttle',
  '["ch_1_shuttle_hack"]'::jsonb,
  'ch_1_shuttle_hack',
  1,
  true
);
