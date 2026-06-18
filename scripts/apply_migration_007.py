#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Apply migration 007_move_skip_to_act4.sql via Supabase REST."""
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


# 1. Move the shortcut choice from the workbench to the cargo lift shaft
patch('choices', 'id=eq.ch_1_skip_to_act4', {
    'node_id': 'act1_cargo_subdeck',
    'sort_order': 5,
})

# 2. Make the transition's "go back" choice return to the cargo subdeck
patch('choices', 'id=eq.ch_1_skip_to_act4_back', {
    'target_node_id': 'act1_cargo_subdeck',
    'narrative_override': 'Ты решаешь не рисковать и отходишь от ворот грузового лифта.',
    'translations': {
        'en': {
            'label': '↩️ Go back',
            'narrative_override': 'You decide not to risk it and step back from the freight elevator gates.',
        }
    },
})

# 3. Make the failure-return choice return to the cargo subdeck
patch('choices', 'id=eq.ch_1_skip_to_act4_return', {
    'target_node_id': 'act1_cargo_subdeck',
})

print('Migration 007 applied.')
