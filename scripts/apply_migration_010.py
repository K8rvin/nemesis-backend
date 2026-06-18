#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Apply migration 010_new_achievements.sql via Supabase REST."""
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
]
post('/rest/v1/achievements?on_conflict=id', achievements)

# 2. Clean trap choices unlock Acrobat
patch('choices', 'id=in.(ch_1_trap_eng_clean,ch_1_trap_luck_clean,ch_1_trap_stl_clean)', {
    'effects': {'unlock_achievement': 'ach_trap_clean'}
})

# 3. Security archive unlocks Hart Dossier
patch('choices', 'id=eq.ch_2_security_take_items', {
    'effects': {'unlock_achievement': 'ach_hart_dossier'}
})

# 4. Act 3 archive terminal read flag
patch('choices', 'id=eq.ch_3_lore_back', {
    'effects': {'add_flag': 'visited_core_terminal'}
})

print('Migration 010 applied.')
