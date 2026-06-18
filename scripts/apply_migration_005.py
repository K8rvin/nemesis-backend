#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Apply migration 005_no_man_left_behind_bad_rework.sql via Supabase REST."""
import os, requests, json

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

def post(table, body):
    r = requests.post(f"{url}/rest/v1/{table}", headers=headers, json=body)
    print(f"POST {table} -> {r.status_code}")
    if r.status_code not in (201, 200, 204):
        print(r.text)
    return r

def get(table, query):
    r = requests.get(f"{url}/rest/v1/{table}?{query}&select=id", headers=headers)
    return r.status_code == 200 and len(r.json()) > 0

# 1. Update ch_5_showdown_tobias
patch('choices', 'id=eq.ch_5_showdown_tobias', {
    'conditions': {
        'flag_required': 'tobias_saved',
        'flag_not_required': 'tobias_mortally_wounded',
    },
    'effects': {
        'set_hp': 15,
        'add_flag': 'tobias_mortally_wounded',
    },
    'narrative_override': 'Тобиас, преодолевая адскую боль, сползает с твоих плеч и вскидывает захваченный пулемёт: «Беги к консоли, Маркус! Я приму эти чёртовы пушки на себя!» Он ведёт шквальный огонь по турелям, прикрывая твой прорыв. Лазерные лучи вспарывают его броню. Когда ты добираешься до терминала, Тобиас падает у входа, смертельно раненый. Ты тащишь его внутрь, оставляя кровавый след.',
})

# 2. Upsert ch_5_showdown_tobias_safe
safe_id = 'ch_5_showdown_tobias_safe'
body = {
    'id': safe_id,
    'node_id': 'act5_bridge_showdown',
    'target_node_id': 'trans_ch_5_showdown_tobias',
    'label': '[ТОБИАС] Приказать раненому напарнику прикрыть тебя и отойти к терминалу',
    'narrative_override': 'Тобиас, преодолевая боль, вскидывает пулемёт и открывает огонь по турелям, удерживая их под подавляющим огнём. Под его прикрытием ты прорываешься к терминалу. Он отступает к тебе последним, цел.',
    'conditions': {
        'flag_required': 'tobias_saved',
        'flag_not_required': 'tobias_mortally_wounded',
    },
    'effects': {},
    'sort_order': 8,
}
if get('choices', f'id=eq.{safe_id}'):
    patch('choices', f'id=eq.{safe_id}', body)
else:
    post('choices', body)

# 3. Update ch_5_b_ending_3_bad
patch('choices', 'id=eq.ch_5_b_ending_3_bad', {
    'label': '[ФИНАЛ] Запустить протокол «Альянс» с телом Тобиаса в кресле',
    'conditions': {
        'flag_required': ['tobias_saved', 'tobias_mortally_wounded'],
        'item_required_any': ['Квантовый Носитель', 'Запасной аккумулятор'],
    },
    'effects': {
        'unlock_achievement': 'ach_no_man_left_behind_bad',
    },
    'narrative_override': 'Ты вставляешь носитель в порт терминала. Системы шаттла оживают. Тобиас мёртв в кресле второго пилота. «Авангард» отрывается от станции, унося с собой данные корпорации — и последний приказ, который ты отдал другу.',
    'target_node_id': 'ending_3_bad',
})

# 4. Update ch_5_b_ending_3 to exclude mortally-wounded Tobias
patch('choices', 'id=eq.ch_5_b_ending_3', {
    'conditions': {
        'flag_required': 'tobias_saved',
        'flag_not_required': 'tobias_mortally_wounded',
        'item_required': 'Квантовый Носитель',
    }
})

# 5. Update ending_3_bad node
patch('nodes', 'id=eq.ending_3_bad', {
    'title': 'КОНЦОВКА: ПРОТОКОЛ «АЛЬЯНС» — ПОСЛЕДНИЙ ПРИКАЗ',
    'narrative': 'Невероятный исход. Ты спас Тобиаса на станции, но ценой его жизни добрался до терминала. С помощью Квантового Носителя — или последнего заряда Запасного аккумулятора — шаттл «Авангард» уходит на полной скорости к дальней колонии мятежников. Рядом с тобой в кресле второго пилота сидит Тобиас. Он мёртв. У тебя на руках все секреты корпорации, но цена оказалась слишком высока.',
    'thought': 'Мы покажем всему миру, что они здесь творили... даже если он больше не услышит этого.',
    'ending_type': 'sad',
})

print('Migration 005 applied.')
