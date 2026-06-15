-- ==========================================
-- addSuggestedAchievements.sql
-- Добавление 8 новых ачивок и привязка к выборам.
-- ==========================================

BEGIN;

-- 1. Добавление ачивок
INSERT INTO public.achievements (id, title, description, medal_tier, icon_url) VALUES
('ach_abandon_tobias', 'Каждый сам за себя', 'Бросить раненого Тобиаса умирать в Акте 2.', 'BRONZE', NULL),
('ach_hart_deal', 'Сделка с дьяволом', 'Заключить сомнительную сделку с доктором Харт.', 'SILVER', NULL),
('ach_hart_enemy', 'Враг науки', 'Отказать Харт и сделать его врагом.', 'SILVER', NULL),
('ach_hydro_shortcut', 'Крысиный обход', 'Срезать путь через гидропонику, минуя лаборатории.', 'BRONZE', NULL),
('ach_patriarch_sneak', 'Тень в вентиляции', 'Обмануть Слепого Патриарха и уйти незамеченным.', 'SILVER', NULL),
('ach_patriarch_blind', 'Слепой часовщик', 'Ослепить Слепого Патриарха.', 'SILVER', NULL),
('ach_full_toolkit', 'Швейцарский нож', 'Собрать полный набор инструментов: магнитометр, лом, сервопривод, зажимы, хронометр и КПК директора.', 'GOLD', NULL),
('ach_toxicosis', 'Зелёный защитник', 'Получить токсическое отравление, вырывая капсулу Изолята Омега.', 'BRONZE', NULL);

-- 2. Привязка ачивок к существующим выборам
UPDATE public.choices SET effects = effects || '{"unlock_achievement":"ach_abandon_tobias"}'::jsonb WHERE id = 'trans_choice_ch_2_leave_to_act3';
UPDATE public.choices SET effects = effects || '{"unlock_achievement":"ach_hart_deal"}'::jsonb WHERE id = 'trans_choice_ch_3_choice_hart';
UPDATE public.choices SET effects = effects || '{"unlock_achievement":"ach_hart_enemy"}'::jsonb WHERE id = 'trans_choice_ch_3_choice_self';
UPDATE public.choices SET effects = effects || '{"unlock_achievement":"ach_hydro_shortcut"}'::jsonb WHERE id = 'trans_choice_ch_2_hydro_bypass_oil';
UPDATE public.choices SET effects = effects || '{"unlock_achievement":"ach_hydro_shortcut"}'::jsonb WHERE id = 'trans_choice_ch_2_bypass_to_bridge';
UPDATE public.choices SET effects = effects || '{"unlock_achievement":"ach_patriarch_sneak"}'::jsonb WHERE id = 'trans_choice_ch_3_boss_stl';
UPDATE public.choices SET effects = effects || '{"unlock_achievement":"ach_patriarch_blind"}'::jsonb WHERE id = 'trans_choice_ch_3_boss_ref';
UPDATE public.choices SET effects = effects || '{"unlock_achievement":"ach_toxicosis"}'::jsonb WHERE id = 'trans_choice_ch_3_nest_srv';

-- 3. Выборы для получения ачивки Швейцарский нож в act3_hub
-- Вариант со сломанным сервоприводом
INSERT INTO public.choices (id, node_id, target_node_id, label, narrative_override, conditions, effects, sort_order) VALUES (
    'ch_3_hub_toolkit_broken',
    'act3_hub',
    'act3_hub',
    '🧰 Полный набор инструментов',
    NULL,
    '{"item_required":["Откалиброванный Магнитометр","Тяжелый лом","Сломанный Сервопривод","Канцелярские зажимы","Сломанный Хронометр","КПК Директора"],"flag_not_required":"ach_full_toolkit_unlocked"}'::jsonb,
    '{"unlock_achievement":"ach_full_toolkit","add_flag":"ach_full_toolkit_unlocked"}'::jsonb,
    0
);

-- Вариант с усиленным сервоприводом
INSERT INTO public.choices (id, node_id, target_node_id, label, narrative_override, conditions, effects, sort_order) VALUES (
    'ch_3_hub_toolkit_enhanced',
    'act3_hub',
    'act3_hub',
    '🧰 Полный набор инструментов',
    NULL,
    '{"item_required":["Откалиброванный Магнитометр","Тяжелый лом","Усиленный Сервопривод","Канцелярские зажимы","Сломанный Хронометр","КПК Директора"],"flag_not_required":"ach_full_toolkit_unlocked"}'::jsonb,
    '{"unlock_achievement":"ach_full_toolkit","add_flag":"ach_full_toolkit_unlocked"}'::jsonb,
    0
);

COMMIT;
