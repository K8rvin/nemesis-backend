-- Альтернативный маршрут к финалу "Своих не бросаем" через верстак.
-- Запись ach_no_man_left_behind остаётся без изменений.
-- В финале используется Запасной аккумулятор, чтобы не жертвовать Тобиасом.

INSERT INTO public.achievements (id, title, description, medal_tier)
VALUES (
  'ach_no_man_left_behind_workbench',
  'Своих не бросаем (верстак)',
  'Альтернативный маршрут: спасти Тобиаса и довести его до финала через ремонт сервопривода на верстаке.',
  'GOLD'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.achievement_routes (
  start_node_id,
  achievement_id,
  path,
  next_choice_id,
  steps_remaining,
  reachable,
  created_at
) VALUES (
  'act1_start',
  'ach_no_man_left_behind_workbench',
  '[
    "ch_1_start_to_skills",
    "trans_choice_ch_1_start_to_skills",
    "ch_1_skill_eng",
    "trans_choice_ch_1_skill_eng",
    "ch_1_hub_to_cargo",
    "trans_choice_ch_1_hub_to_cargo",
    "ch_1_cargo_loot_servo",
    "trans_choice_ch_1_cargo_loot_servo",
    "ch_1_cargo_to_sealed_container",
    "ch_1_cargo_sealed_container_back",
    "ch_1_cargo_back",
    "ch_1_hub_to_explore",
    "trans_choice_ch_1_hub_to_explore",
    "ch_1_explore_to_workbench",
    "trans_choice_ch_1_explore_to_workbench",
    "ch_1_repair_servo",
    "trans_choice_ch_1_repair_servo",
    "ch_1_workbench_to_hub",
    "ch_1_hub_to_lounge",
    "trans_choice_ch_1_hub_to_lounge",
    "ch_2_rec_to_corridors",
    "ch_2_hub_to_tobias",
    "trans_choice_ch_2_hub_to_tobias",
    "ch_2_tobias_save",
    "trans_choice_ch_2_tobias_save",
    "ch_2_save_to_act3",
    "trans_choice_ch_2_save_to_act3",
    "ch_3_start_to_cryo",
    "trans_choice_ch_3_start_to_cryo",
    "ch_3_cryo_proceed",
    "trans_choice_ch_3_cryo_proceed",
    "ch_3_boss_to_combat",
    "ch_3_boss_eng",
    "trans_choice_ch_3_boss_eng",
    "ch_3_hub_to_hart",
    "trans_choice_ch_3_hub_to_hart",
    "ch_3_hart_accept",
    "trans_choice_ch_3_hart_accept",
    "ch_3_nest_hck",
    "trans_choice_ch_3_nest_hck",
    "ch_3_choice_hart",
    "trans_choice_ch_3_choice_hart",
    "ch_4_start_to_climb",
    "trans_choice_ch_4_start_to_climb",
    "ch_4_climb_to_power",
    "ch_4_climb_power_hydraulics",
    "trans_choice_ch_4_climb_power_hydraulics",
    "ch_4_phase2_hydraulics_win",
    "trans_choice_ch_4_phase2_hydraulics_win",
    "ch_4_reactor_stabilize",
    "trans_choice_ch_4_reactor_stabilize",
    "ch_5_start_next",
    "trans_choice_ch_5_start_next",
    "ch_5_showdown_battery",
    "trans_choice_ch_5_showdown_battery",
    "ch_5_b_ending_3_workbench"
  ]'::jsonb,
  'ch_1_start_to_skills',
  0,
  true,
  now()
)
ON CONFLICT (start_node_id, achievement_id) DO UPDATE SET
  path = EXCLUDED.path,
  next_choice_id = EXCLUDED.next_choice_id,
  steps_remaining = EXCLUDED.steps_remaining,
  reachable = EXCLUDED.reachable,
  created_at = EXCLUDED.created_at;
