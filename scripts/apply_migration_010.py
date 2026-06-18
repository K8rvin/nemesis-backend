#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Apply migration 010_new_achievements via Supabase REST."""
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


def post(path, body):
    r = requests.post(url + path, headers=headers, json=body)
    print(f"POST {path} -> {r.status_code}")
    if r.status_code not in (200, 201, 204):
        print(r.text)
    return r


def patch(table, query, body):
    r = requests.patch(f"{url}/rest/v1/{table}?{query}", headers=headers, json=body)
    print(f"PATCH {table}?{query} -> {r.status_code}")
    if r.status_code not in (200, 204):
        print(r.text)
    return r


def merge_effects(choice_id, extra):
    """Fetch current effects, merge with extra, and patch back."""
    r = requests.get(f"{url}/rest/v1/choices?id=eq.{choice_id}&select=effects", headers=headers)
    if r.status_code != 200:
        print(f"GET choices {choice_id} -> {r.status_code} {r.text}")
        return
    data = r.json()
    effects = data[0].get('effects') or {} if data else {}
    if isinstance(effects, str):
        import json
        effects = json.loads(effects)
    effects.update(extra)
    patch('choices', f'id=eq.{choice_id}', {'effects': effects})


# 1. Upsert achievements
achievements = [
    {
        'id': 'ach_trap_clean',
        'title': 'Акробат',
        'description': 'Пройти заклинивший шлюз в Акте 1 без ранений.',
        'medal_tier': 'SILVER',
        'translations': {
            'en': {'title': 'Acrobat', 'description': "Pass the jammed airlock in Act 1 without injury."}
        }
    },
    {
        'id': 'ach_lore_historian',
        'title': 'Архивариус Немезиды',
        'description': 'Найти и прочитать все три лорные записи: планшет Блейка, обрывок газеты и архивный терминал.',
        'medal_tier': 'SILVER',
        'translations': {
            'en': {'title': 'Nemesis Archivist', 'description': "Find and read all three lore entries: Blake's tablet, the newspaper scrap, and the archive terminal."}
        }
    },
    {
        'id': 'ach_clean_bill',
        'title': 'Чистый билл',
        'description': 'Снять все травмы нейро-регенератором в лабораторном мед-шкафу.',
        'medal_tier': 'BRONZE',
        'translations': {
            'en': {'title': 'Clean Bill', 'description': 'Remove all injuries with the neuro-regenerator in the lab med-bay.'}
        }
    },
    {
        'id': 'ach_hart_dossier',
        'title': 'Досье на Харт',
        'description': 'Обыскать архив Службы Безопасности и забрать документы.',
        'medal_tier': 'BRONZE',
        'translations': {
            'en': {'title': 'Hart Dossier', 'description': 'Search the Security Service archive and take the documents.'}
        }
    },
    {
        'id': 'ach_botanist',
        'title': 'Ботаник',
        'description': 'Открыть заржавевший грузовой люк в плотоядном саду с помощью масла «Крио-Шилд».',
        'medal_tier': 'BRONZE',
        'translations': {
            'en': {'title': 'Botanist', 'description': 'Open the rusted cargo hatch in the carnivorous garden using Cryo-Shield oil.'}
        }
    },
    {
        'id': 'ach_self_doctor',
        'title': 'Сам себе доктор',
        'description': 'Использовать инженерную крио-капсулу для экстренной консервации в Акте 4.',
        'medal_tier': 'BRONZE',
        'translations': {
            'en': {'title': 'Self-Doctor', 'description': 'Use the engineering cryo-pod for emergency stasis in Act 4.'}
        }
    },
    {
        'id': 'ach_reboot',
        'title': 'Перезагрузка',
        'description': 'Провести чистую программную экстракцию штамма в Гнезде Реактора.',
        'medal_tier': 'BRONZE',
        'translations': {
            'en': {'title': 'Reboot', 'description': 'Perform a clean program extraction of the strain in the Reactor Nest.'}
        }
    },
]
post('/rest/v1/achievements?on_conflict=id', achievements)

# 2. Clean trap choices unlock Acrobat
for cid in ('ch_1_trap_eng_clean', 'ch_1_trap_luck_clean', 'ch_1_trap_stl_clean'):
    merge_effects(cid, {'unlock_achievement': 'ach_trap_clean'})

# 3. Security archive unlocks Hart Dossier
merge_effects('ch_2_security_take_items', {'unlock_achievement': 'ach_hart_dossier'})

# 4. Act 3 archive terminal read flag
merge_effects('ch_3_lore_back', {'add_flag': 'visited_core_terminal'})

# 5. Botanist, Self-Doctor, Reboot
merge_effects('ch_2_hydro_bypass_oil', {'unlock_achievement': 'ach_botanist'})
merge_effects('ch_4_to_cryo_stasis', {'unlock_achievement': 'ach_self_doctor'})
merge_effects('ch_3_nest_hck', {'unlock_achievement': 'ach_reboot'})

print('Migration 010 applied.')
