-- Маршрут до достижения ach_savior_ending
-- Требуется: ENG-профиль, КПК Директора, прохождение через Ядро ИИ (add_item Изолят Омега)
-- Важно: ch_3_ai_to_act4 должен иметь effects.add_item = "Изолят Омега", а не conditions.add_item

INSERT INTO public.achievement_routes (
  start_node_id,
  achievement_id,
  path,
  next_choice_id,
  steps_remaining,
  reachable
) VALUES (
  'act1_start',
  'ach_savior_ending',
  '[
    "ch_1_start_to_skills",
    "trans_choice_ch_1_start_to_skills",
    "ch_1_skill_eng",
    "trans_choice_ch_1_skill_eng",
    "ch_1_hub_to_lounge",
    "trans_choice_ch_1_hub_to_lounge",
    "ch_2_rec_to_corridors",
    "ch_2_corridors_to_rooms",
    "trans_choice_ch_2_corridors_to_rooms",
    "ch_2_hub_to_secret",
    "ch_2_secret_take_pda",
    "trans_choice_ch_2_secret_take_pda",
    "ch_2_secret_office_back",
    "ch_2_rooms_back",
    "ch_2_hub_to_tobias",
    "trans_choice_ch_2_hub_to_tobias",
    "ch_2_tobias_leave",
    "trans_choice_ch_2_tobias_leave",
    "ch_2_leave_to_act3",
    "trans_choice_ch_2_leave_to_act3",
    "ch_3_start_to_cryo",
    "trans_choice_ch_3_start_to_cryo",
    "ch_3_cryo_proceed",
    "trans_choice_ch_3_cryo_proceed",
    "ch_3_boss_to_combat",
    "ch_3_boss_eng",
    "trans_choice_ch_3_boss_eng",
    "ch_3_hub_to_ai",
    "ch_3_ai_to_act4",
    "ch_4_start_to_climb",
    "trans_choice_ch_4_start_to_climb",
    "ch_4_climb_solo_skip",
    "trans_choice_ch_4_climb_solo_skip",
    "ch_4_phase2_solo_clean",
    "trans_choice_ch_4_phase2_solo_clean",
    "ch_4_to_engine_deck",
    "trans_choice_ch_4_to_engine_deck",
    "ch_4_engines_isolate_exploit",
    "trans_choice_ch_4_engines_isolate_exploit"
  ]'::jsonb,
  'ch_1_start_to_skills',
  38,
  true
)
ON CONFLICT (start_node_id, achievement_id) DO UPDATE SET
  path = EXCLUDED.path,
  next_choice_id = EXCLUDED.next_choice_id,
  steps_remaining = EXCLUDED.steps_remaining,
  reachable = EXCLUDED.reachable,
  created_at = now();
