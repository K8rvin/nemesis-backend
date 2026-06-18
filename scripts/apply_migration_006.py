#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Apply migration 006_merge_tobias_choices.sql via Supabase REST."""
import os, requests

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

# 1. Merge Tobias choice into direct sad ending
patch('choices', 'id=eq.ch_5_showdown_tobias', {
    'label': '[ТОБИАС] Приказать раненому напарнику прикрыть тебя и отойти к терминалу',
    'conditions': {
        'flag_required': 'tobias_saved',
        'item_required_any': ['Квантовый Носитель', 'Запасной аккумулятор'],
    },
    'effects': {
        'set_hp': 15,
        'add_flag': 'tobias_mortally_wounded',
        'unlock_achievement': 'ach_no_man_left_behind_bad',
    },
    'target_node_id': 'ending_3_bad',
    'narrative_override': 'Тобиас, преодолевая адскую боль, сползает с твоих плеч и вскидывает захваченный пулемёт: «Беги к консоли, Маркус! Я прикрою и сам отойду!» Он ведёт шквальный огонь по турелям, прикрывая ваш прорыв. Лазерные лучи вспарывают его броню. Ты добираешься до терминала и тащишь его за собой, но Тобиас уже смертельно ранен. Шаттл «Авангард» уходит в последний рейс — рядом с тобой в кресле второго пилота сидит мёртвый друг.',
})

# 2. Repurpose safe choice as generic retreat
patch('choices', 'id=eq.ch_5_showdown_tobias_safe', {
    'label': 'Отступить к терминалу',
    'narrative_override': 'Под огнём турелей вы отступаете к главному терминалу мостика. Тобиас цепляется за тебя, всё ещё живой.',
    'conditions': {},
    'effects': {},
    'target_node_id': 'act5_terminal_final',
})

# 3. Remove obsolete terminal choice
delete('choices', 'id=eq.ch_5_b_ending_3_bad')

print('Migration 006 applied.')
