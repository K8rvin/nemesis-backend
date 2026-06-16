-- Маршрут до достижения eternal_passenger (Вечный пассажир)
-- Путь: act1_start -> LUCK-профиль -> lounge -> recreation room -> hydroponics -> act4_start -> cryo vault -> ending_10_cryo_sleep

INSERT INTO public.achievement_routes (
  start_node_id,
  achievement_id,
  path,
  next_choice_id,
  steps_remaining,
  reachable
) VALUES (
  'act1_start',
  'eternal_passenger',
  '[
    "ch_1_start_to_skills",
    "trans_choice_ch_1_start_to_skills",
    "ch_1_skill_luck",
    "trans_choice_ch_1_skill_luck",
    "ch_1_hub_to_lounge",
    "trans_choice_ch_1_hub_to_lounge",
    "ch_2_rec_take_oil",
    "trans_choice_ch_2_rec_take_oil",
    "ch_2_rec_to_hydro",
    "trans_choice_ch_2_rec_to_hydro",
    "ch_2_hydro_bypass_oil",
    "trans_choice_ch_2_hydro_bypass_oil",
    "ch_4_start_to_vault",
    "ch_4_vault_to_ending"
  ]'::jsonb,
  'ch_1_start_to_skills',
  13,
  true
)
ON CONFLICT (start_node_id, achievement_id) DO UPDATE SET
  path = EXCLUDED.path,
  next_choice_id = EXCLUDED.next_choice_id,
  steps_remaining = EXCLUDED.steps_remaining,
  reachable = EXCLUDED.reachable,
  created_at = now();
