-- Добавляет финальный выбор для ачивки "Своих не бросаем (верстак)",
-- чтобы маршрут через верстак разблокировал именно ach_no_man_left_behind_workbench.

INSERT INTO public.choices (
  id,
  node_id,
  target_node_id,
  label,
  narrative_override,
  conditions,
  effects,
  sort_order
) VALUES (
  'ch_5_b_ending_3_workbench',
  'act5_terminal_final',
  'ending_3',
  '🎖 [ФИНАЛ] Запустить протокол блэкаута (Верстак: Живой Тобиас и Запасной аккумулятор)',
  null,
  '{"flag_required": "tobias_saved", "item_required": "Запасной аккумулятор"}'::jsonb,
  '{"unlock_achievement": "ach_no_man_left_behind_workbench"}'::jsonb,
  4
)
ON CONFLICT (id) DO UPDATE SET
  node_id = EXCLUDED.node_id,
  target_node_id = EXCLUDED.target_node_id,
  label = EXCLUDED.label,
  narrative_override = EXCLUDED.narrative_override,
  conditions = EXCLUDED.conditions,
  effects = EXCLUDED.effects,
  sort_order = EXCLUDED.sort_order;

-- Меняем финальный шаг в маршруте верстака с общего ch_5_b_ending_3
-- на специфичный ch_5_b_ending_3_workbench.
UPDATE public.achievement_routes
SET path = (path - 'ch_5_b_ending_3') || '["ch_5_b_ending_3_workbench"]'::jsonb
WHERE achievement_id = 'ach_no_man_left_behind_workbench';
