#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Apply migration 008_david_vs_goliath.sql via Supabase REST."""
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


# 1. Direct annihilation choice grants the achievement
#    (item name normalized to match the real inventory item)
patch('choices', 'id=eq.ch_3_boss_annihilate', {
    'conditions': {'item_required': 'Тяжелый Плазморез'},
    'effects': {'unlock_achievement': 'ach_david_vs_goliath'},
})

# 2. Standard plasma-cutter fight choice also grants the achievement
patch('choices', 'id=eq.ch_3_boss_fight', {
    'effects': {'unlock_achievement': 'ach_david_vs_goliath'},
})

# 3. Remove the old unlock from the post-kill transition
patch('choices', 'id=eq.trans_choice_ch_3_boss_kill_to_hub', {
    'effects': {},
})

print('Migration 008 applied.')
