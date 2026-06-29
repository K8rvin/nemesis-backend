-- Миграция: корректный маршрут chronos_master в подсказчике.
-- chronos_master выдаётся выбором ch_5_terminal_chrono_fix на терминале act5_terminal_final,
-- поэтому готовый маршрут должен вести от этой ноды, а не от самого начала игры.

DELETE FROM public.achievement_routes WHERE achievement_id = 'chronos_master';

INSERT INTO public.achievement_routes
  (start_node_id, achievement_id, path, next_choice_id, steps_remaining, reachable)
VALUES
  ('act5_terminal_final', 'chronos_master', '["ch_5_terminal_chrono_fix"]'::jsonb, 'ch_5_terminal_chrono_fix', 1, true)
ON CONFLICT (start_node_id, achievement_id) DO UPDATE SET
  path = EXCLUDED.path,
  next_choice_id = EXCLUDED.next_choice_id,
  steps_remaining = EXCLUDED.steps_remaining,
  reachable = EXCLUDED.reachable;
