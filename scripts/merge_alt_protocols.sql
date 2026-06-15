-- ==========================================
-- merge_alt_protocols.sql
-- Удаление ноды "Альтернативные протоколы" и перенос её выборов
-- в ноду "Протоколы судьбы активированы".
-- ==========================================

BEGIN;

-- 1. Перенос выборов из act5_terminal_alt в act5_terminal_final
-- (кроме выбора "Вернуться к основным протоколам", который удаляется)
UPDATE public.choices
SET node_id = 'act5_terminal_final'
WHERE id IN (
    'ch_5_b_ending_4',
    'ch_5_b_ending_5',
    'ch_5_b_ending_8'
);

-- 2. Удаление выбора "Вернуться к основным протоколам" из ноды Альтернативные протоколы
DELETE FROM public.choices WHERE id = 'ch_5_alt_back';

-- 3. Удаление выбора "Альтернативные протоколы" из основного меню
DELETE FROM public.choices WHERE id = 'ch_5_terminal_to_alt';

-- 4. Удаление переходного выбора, ведущего в удаляемую ноду
DELETE FROM public.choices WHERE id = 'trans_choice_ch_5_terminal_to_alt';

-- 5. Удаление ноды-перехода "Доступ к альтернативам"
DELETE FROM public.nodes WHERE id = 'trans_ch_5_terminal_to_alt';

-- 6. Удаление самой ноды "Альтернативные протоколы"
DELETE FROM public.nodes WHERE id = 'act5_terminal_alt';

-- 7. Обновление маршрута ach_lucky_bastard:
--    убрать ch_5_terminal_to_alt и trans_choice_ch_5_terminal_to_alt
UPDATE public.achievement_routes
SET path = '[
  "ch_1_skill_luck","trans_choice_ch_1_skill_luck",
  "ch_1_hub_to_lounge","trans_choice_ch_1_hub_to_lounge",
  "ch_2_rec_back",
  "ch_2_corridors_to_rooms","trans_choice_ch_2_corridors_to_rooms",
  "ch_2_hub_to_secret","trans_choice_ch_2_hub_to_secret",
  "ch_2_secret_take_cutter","trans_choice_ch_2_secret_take_cutter",
  "ch_2_secret_take_pda","trans_choice_ch_2_secret_take_pda",
  "ch_2_secret_office_back",
  "ch_2_rooms_back",
  "ch_2_hub_to_hydro","trans_choice_ch_2_hub_to_hydro",
  "ch_2_hydro_to_bypass",
  "ch_2_bypass_to_bridge","trans_choice_ch_2_bypass_to_bridge",
  "ch_5_start_next","trans_choice_ch_5_start_next",
  "ch_5_showdown_hack","trans_choice_ch_5_showdown_hack",
  "ch_5_b_ending_5","trans_choice_ch_5_b_ending_5"
]'::jsonb,
    steps_remaining = 26
WHERE start_node_id = 'act1_skills'
  AND achievement_id = 'ach_lucky_bastard';

COMMIT;
