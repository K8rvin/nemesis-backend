-- ==========================================
-- 🗺️ Маршрут от act1_skills к ach_lucky_bastard
-- ==========================================

INSERT INTO public.achievement_routes (
  start_node_id,
  achievement_id,
  path,
  next_choice_id,
  steps_remaining,
  reachable
) VALUES (
  'act1_skills',
  'ach_lucky_bastard',
  '[
    "ch_1_skill_luck",
    "trans_choice_ch_1_skill_luck",
    "ch_1_hub_to_lounge",
    "trans_choice_ch_1_hub_to_lounge",
    "ch_2_rec_back",
    "ch_2_corridors_to_rooms",
    "trans_choice_ch_2_corridors_to_rooms",
    "ch_2_hub_to_secret",
    "trans_choice_ch_2_hub_to_secret",
    "ch_2_secret_take_cutter",
    "trans_choice_ch_2_secret_take_cutter",
    "ch_2_secret_take_pda",
    "trans_choice_ch_2_secret_take_pda",
    "ch_2_secret_office_back",
    "ch_2_rooms_back",
    "ch_2_hub_to_hydro",
    "trans_choice_ch_2_hub_to_hydro",
    "ch_2_hydro_to_bypass",
    "ch_2_bypass_to_bridge",
    "trans_choice_ch_2_bypass_to_bridge",
    "ch_5_start_next",
    "trans_choice_ch_5_start_next",
    "ch_5_showdown_hack",
    "trans_choice_ch_5_showdown_hack",
    "ch_5_terminal_to_alt",
    "trans_choice_ch_5_terminal_to_alt",
    "ch_5_b_ending_5",
    "trans_choice_ch_5_b_ending_5"
  ]'::jsonb,
  'ch_1_skill_luck',
  28,
  true
)
ON CONFLICT (start_node_id, achievement_id) DO UPDATE SET
  path = EXCLUDED.path,
  next_choice_id = EXCLUDED.next_choice_id,
  steps_remaining = EXCLUDED.steps_remaining,
  reachable = EXCLUDED.reachable,
  created_at = now();
