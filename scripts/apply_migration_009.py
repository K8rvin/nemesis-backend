#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Apply migration 009_cleanup_act3_boss.sql via Supabase REST."""
import os
import requests

url = os.environ['SUPABASE_URL']
key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
headers = {
    'apikey': key,
    'Authorization': f'Bearer {key}',
    'Content-Type': 'application/json',
    'Accept': 'application/json',
}


def patch(table, query, body):
    r = requests.patch(f"{url}/rest/v1/{table}?{query}", headers=headers, json=body)
    print(f"PATCH {table}?{query} -> {r.status_code}")
    if r.status_code not in (200, 204):
        print(r.text)
    return r


def delete(table, query):
    r = requests.delete(f"{url}/rest/v1/{table}?{query}", headers=headers)
    print(f"DELETE {table}?{query} -> {r.status_code}")
    if r.status_code not in (200, 204):
        print(r.text)
    return r


# 1. Redirect / move choices
patch('choices', 'id=eq.ch_3_boss_distract_bar', {
    'node_id': 'act3_boss_pat',
    'target_node_id': 'act3_hub',
    'sort_order': 6,
})
patch('choices', 'id=eq.ch_3_boss_eng', {'node_id': 'act3_boss_pat', 'sort_order': 2})
patch('choices', 'id=eq.ch_3_boss_ref', {'node_id': 'act3_boss_pat', 'sort_order': 3})
patch('choices', 'id=eq.ch_3_boss_fight', {'node_id': 'act3_boss_pat', 'sort_order': 4})
patch('choices', 'id=eq.ch_3_boss_stl', {'node_id': 'act3_boss_pat', 'sort_order': 5})
patch('choices', 'id=eq.ch_3_boss_yolo', {'sort_order': 1})

patch('choices', 'id=eq.ch_3_hub_to_med', {'target_node_id': 'act3_med_bay'})
patch('choices', 'id=eq.ch_3_med_heal', {
    'target_node_id': 'act3_hub',
    'effects': {
        'add_hp': 40,
        'remove_flags': ['открытое_кровотечение', 'травма_контузия', 'травма_токсикоз'],
    },
})

# 2. Delete obsolete choices
choice_ids = [
    'ch_3_boss_annihilate',
    'trans_choice_ch_3_boss_annihilate',
    'ch_3_boss_to_stealth',
    'trans_choice_ch_3_boss_to_stealth',
    'ch_3_stealth_back',
    'ch_3_boss_to_combat',
    'ch_3_combat_back',
    'trans_choice_ch_3_hub_to_med',
    'trans_choice_ch_3_med_heal',
]
delete('choices', f"id=in.({','.join(choice_ids)})")

# 3. Delete obsolete nodes
node_ids = [
    'trans_ch_3_boss_annihilate',
    'trans_ch_3_boss_to_stealth',
    'act3_boss_stealth',
    'act3_boss_distract_result',
    'act3_boss_combat',
    'trans_ch_3_hub_to_med',
    'trans_ch_3_med_heal',
]
delete('nodes', f"id=in.({','.join(node_ids)})")

print('Migration 009 applied.')
