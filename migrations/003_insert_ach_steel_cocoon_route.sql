-- ==========================================
-- 🗺️ Маршрут от act1_skills к ach_steel_cocoon
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
  'ach_steel_cocoon',
  '[
    "ch_1_skill_stl",
    "trans_choice_ch_1_skill_stl",
    "ch_1_hub_to_trap",
    "trans_choice_ch_1_hub_to_trap",
    "ch_1_trap_stl_clean",
    "trans_choice_ch_1_trap_stl_clean",
    "ch_2_corridors_to_search",
    "trans_choice_ch_2_corridors_to_search",
    "ch_2_get_clips",
    "trans_choice_ch_2_get_clips",
    "ch_2_search_back",
    "ch_2_corridors_to_rooms",
    "trans_choice_ch_2_corridors_to_rooms",
    "ch_2_hub_to_secret",
    "trans_choice_ch_2_hub_to_secret",
    "ch_2_secret_take_pda",
    "trans_choice_ch_2_secret_take_pda",
    "ch_2_secret_office_back",
    "ch_2_hub_to_rec",
    "trans_choice_ch_2_hub_to_rec",
    "ch_2_loot_chronometer",
    "trans_choice_ch_2_loot_chronometer",
    "ch_2_lounge_to_security",
    "trans_choice_ch_2_lounge_to_security",
    "ch_2_security_take_items",
    "trans_choice_ch_2_security_take_items",
    "ch_2_security_to_corridors",
    "ch_2_rec_back",
    "ch_2_bypass_act3_4",
    "trans_choice_ch_2_bypass_act3_4",
    "ch_5_start_next_bypass",
    "trans_choice_ch_5_start_next_bypass",
    "ch_5_showdown_hack",
    "trans_choice_ch_5_showdown_hack",
    "ch_5_terminal_chrono_fix"
  ]'::jsonb,
  'ch_1_skill_stl',
  35,
  true
)
ON CONFLICT (start_node_id, achievement_id) DO UPDATE SET
  path = EXCLUDED.path,
  next_choice_id = EXCLUDED.next_choice_id,
  steps_remaining = EXCLUDED.steps_remaining,
  reachable = EXCLUDED.reachable,
  created_at = now();
