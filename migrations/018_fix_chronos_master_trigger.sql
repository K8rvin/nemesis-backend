-- 018_fix_chronos_master_trigger.sql
-- chronos_master: переносим срабатывание с подбора Хронометра на починку на финальном терминале.
-- ach_steel_cocoon теперь выдаётся автоматически по ending_type='victory_stasis' (код бэкенда).

BEGIN;

-- 1. Убираем unlock_achievement с выбора подбора СЛОМАННОГО Хронометра.
UPDATE public.choices
SET effects = '{"add_flag":"got_chronometer","add_item":"Сломанный Хронометр"}'::jsonb
WHERE id = 'trans_choice_ch_2_loot_chronometer';

-- 2. Назначаем chronos_master на выбор починки Хронометра на финальном терминале.
-- Оставляем remove_item "Канцелярские зажимы", так как это условие/требование выбора.
UPDATE public.choices
SET effects = '{"add_flag":"время_остановлено","remove_item":"Канцелярские зажимы","unlock_achievement":"chronos_master"}'::jsonb
WHERE id = 'ch_5_terminal_chrono_fix';

-- 3. Обновляем готовый маршрут в achievement_routes.
DELETE FROM public.achievement_routes WHERE achievement_id = 'chronos_master';

INSERT INTO public.achievement_routes
  (start_node_id, achievement_id, path, next_choice_id, steps_remaining, reachable)
VALUES
  ('act5_terminal_final', 'chronos_master', '["ch_5_terminal_chrono_fix"]'::jsonb, 'ch_5_terminal_chrono_fix', 1, true);

COMMIT;
