#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Upsert the route for ach_no_man_left_behind_bad."""
import os, requests
from datetime import datetime, timezone

url = os.environ['SUPABASE_URL']
key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
headers = {
    'apikey': key,
    'Authorization': f'Bearer {key}',
    'Content-Type': 'application/json',
    'Accept': 'application/json',
}

path = [
    "ch_1_start_to_skills",
    "trans_choice_ch_1_start_to_skills",
    "ch_1_skill_eng",
    "trans_choice_ch_1_skill_eng",
    "ch_1_hub_to_explore",
    "trans_choice_ch_1_hub_to_explore",
    "ch_1_explore_to_junk",
    "trans_choice_ch_1_explore_to_junk",
    "ch_1_hub_loot_crowbar",
    "trans_choice_ch_1_hub_loot_crowbar",
    "ch_1_junk_back",
    "ch_1_explore_back",
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
    "ch_4_climb_power_magnets",
    "trans_choice_ch_4_climb_power_magnets",
    "ch_4_phase2_magboots_win",
    "trans_choice_ch_4_phase2_magboots_win",
    "ch_4_reactor_stabilize",
    "trans_choice_ch_4_reactor_stabilize",
    "ch_5_start_next",
    "trans_choice_ch_5_start_next",
    "ch_5_showdown_tobias",
    "trans_choice_ch_5_showdown_tobias",
    "ch_5_b_ending_3_bad"
]

body = {
    'start_node_id': 'act1_start',
    'achievement_id': 'ach_no_man_left_behind_bad',
    'path': path,
    'next_choice_id': 'ch_1_start_to_skills',
    'steps_remaining': 0,
    'reachable': True,
    'created_at': datetime.now(timezone.utc).isoformat(),
}

# Try upsert via POST with on_conflict
upsert_headers = {**headers, 'Prefer': 'resolution=merge-duplicates'}
r = requests.post(f"{url}/rest/v1/achievement_routes", headers=upsert_headers, json=body, params={'on_conflict': 'start_node_id,achievement_id'})
print(f"POST achievement_routes upsert -> {r.status_code}")
if r.status_code not in (201, 200, 204):
    print(r.text)
