#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Update infected_mind route to use ch_5_showdown_tobias_safe instead of ch_5_showdown_tobias."""
import os, requests

url = os.environ['SUPABASE_URL']
key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
headers = {
    'apikey': key,
    'Authorization': f'Bearer {key}',
    'Content-Type': 'application/json',
    'Accept': 'application/json',
}

r = requests.get(
    f"{url}/rest/v1/achievement_routes?achievement_id=eq.infected_mind&select=path",
    headers=headers
)
if r.status_code != 200 or not r.json():
    print('Route not found')
    exit(1)

path = r.json()[0]['path']
new_path = ['ch_5_showdown_tobias_safe' if x == 'ch_5_showdown_tobias' else x for x in path]

patch_r = requests.patch(
    f"{url}/rest/v1/achievement_routes?achievement_id=eq.infected_mind",
    headers=headers,
    json={'path': new_path}
)
print(f"PATCH infected_mind route -> {patch_r.status_code}")
if patch_r.status_code not in (200, 204):
    print(patch_r.text)
