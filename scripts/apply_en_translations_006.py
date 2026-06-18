#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Apply English translations for content changed in migration 006."""
import os, requests

url = os.environ['SUPABASE_URL']
key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
headers = {
    'apikey': key,
    'Authorization': f'Bearer {key}',
    'Content-Type': 'application/json',
    'Accept': 'application/json',
}

def patch_choice(choice_id, label, narrative_override):
    body = {
        'translations': {
            'en': {
                'label': label,
                'narrative_override': narrative_override,
            }
        }
    }
    r = requests.patch(f"{url}/rest/v1/choices?id=eq.{choice_id}", headers=headers, json=body)
    print(f"PATCH choices translations {choice_id} -> {r.status_code}")
    if r.status_code not in (200, 204):
        print(r.text)

patch_choice(
    'ch_5_showdown_tobias',
    '[TOBIAS] Order the wounded partner to cover you and fall back to the terminal',
    'Tobias, fighting through hellish pain, slides off your shoulders and raises the captured machine gun: "Run to the console, Marcus! I\'ll cover you and fall back!" He pours fire on the turrets, covering your breakthrough. Laser beams tear through his armor. You reach the terminal and drag him with you, but Tobias is already mortally wounded. The Vanguard shuttle leaves on its final run — next to you, in the co-pilot\'s chair, sits your dead friend.'
)

patch_choice(
    'ch_5_showdown_tobias_safe',
    'Retreat to the terminal',
    'Under the turrets\' fire, you fall back to the main terminal of the bridge. Tobias clings to you, still alive.'
)

print('EN translations for migration 006 applied.')
