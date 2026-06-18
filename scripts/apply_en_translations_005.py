#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Apply English translations for content changed in migration 005."""
import os, requests

url = os.environ['SUPABASE_URL']
key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
headers = {
    'apikey': key,
    'Authorization': f'Bearer {key}',
    'Content-Type': 'application/json',
    'Accept': 'application/json',
}

def patch_choice_translations(choice_id, label, narrative_override):
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

def patch_node_translations(node_id, title, narrative, thought, location_name=None):
    en = {
        'title': title,
        'narrative': narrative,
        'thought': thought,
    }
    if location_name:
        en['location_name'] = location_name
    r = requests.patch(f"{url}/rest/v1/nodes?id=eq.{node_id}", headers=headers, json={'translations': {'en': en}})
    print(f"PATCH nodes translations {node_id} -> {r.status_code}")
    if r.status_code not in (200, 204):
        print(r.text)

patch_choice_translations(
    'ch_5_showdown_tobias',
    '[TOBIAS] Order the wounded partner to cover you with an assault rifle',
    'Tobias, fighting through hellish pain, slides off your shoulders and raises the captured machine gun: "Run to the console, Marcus! I\'ll take these damn guns myself!" He pours fire on the turrets, covering your breakthrough. Laser beams tear through his armor. By the time you reach the terminal, Tobias collapses at the entrance, mortally wounded. You drag him inside, leaving a bloody trail.'
)

patch_choice_translations(
    'ch_5_showdown_tobias_safe',
    '[TOBIAS] Order the wounded partner to cover you and fall back to the terminal',
    'Tobias, fighting the pain, raises the machine gun and opens fire on the turrets, keeping them suppressed. Under his cover, you break through to the terminal. He falls back to you last, alive.'
)

patch_choice_translations(
    'ch_5_b_ending_3_bad',
    '[FINAL] Launch the Alliance Protocol with Tobias\'s body in the chair',
    'You insert the carrier into the terminal port. The shuttle systems come alive. Tobias is dead in the co-pilot\'s chair. The Vanguard breaks away from the station, carrying the corporation\'s data — and the last order you gave your friend.'
)

patch_node_translations(
    'ending_3_bad',
    'ENDING: ALLIANCE PROTOCOL — LAST ORDER',
    'An incredible outcome. You saved Tobias on the station, but reached the terminal at the cost of his life. Using the Quantum Carrier — or the last charge of the Spare Battery — the Vanguard shuttle speeds away toward a distant rebel colony. Next to you, in the co-pilot\'s chair, sits Tobias. He is dead. You hold all the corporation\'s secrets in your hands, but the price was too high.',
    'We will show the world what they did here... even if he will never hear it.',
    'Rescue Shuttle'
)

print('EN translations for migration 005 applied.')
