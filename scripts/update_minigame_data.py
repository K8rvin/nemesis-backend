#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Массовое обновление данных мини-игр взлома/вскрытия в Supabase.

Что делает:
1. Добавляет effects.minigame + effects.failure_choice_id для 12 точек.
2. Добавляет conditions.flag_forbidden = <choice_id>_failed, чтобы скрыть
   оригинальный выбор после провала.
3. Создаёт скрытые failure-выборы, которые ставят флаг провала и остаются
   в той же ноде (игрок не видит отдельного экрана провала, выбор просто
   исчезает).
4. Удаляет устаревшие failure-ноды и return-выборы, если они есть.
5. Создаёт два новых запертых объекта: мед-шкаф (акт 2) и гермоконтейнер (акт 1).

Запуск:
    cd nemesis-backend
    python scripts/update_minigame_data.py
"""

import json
import os
import re
import urllib.request
import urllib.error


def load_dev_vars(path=".dev.vars"):
    """Читает SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY из .dev.vars."""
    if not os.path.exists(path):
        raise FileNotFoundError(f"Файл {path} не найден. Скопируй .dev.vars.example и заполни секреты.")
    values = {}
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            m = re.match(r"^(\w+)\s*=\s*(.+)$", line)
            if m:
                values[m.group(1)] = m.group(2).strip()
    return values


_dev = load_dev_vars()
SUPABASE_URL = _dev["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = _dev["SUPABASE_SERVICE_ROLE_KEY"]

HEADERS = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}


def supabase_request(method, path, payload=None, extra_headers=None):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
    headers = dict(HEADERS)
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(
        SUPABASE_URL + path,
        data=data,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read()
            return resp.status, body.decode("utf-8") if body else ""
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8") if e.readable() else ""
        raise RuntimeError(f"HTTP {e.code} {e.reason}: {body}") from e


# ---------------------------------------------------------------------------
# 12 точек мини-игр: choice_id -> тип жеста
# ---------------------------------------------------------------------------
MINIGAME_POINTS = [
    {"choice_id": "ch_1_cargo_shortcut", "gesture": "swipe_right"},
    {"choice_id": "ch_1_skip_to_act4", "gesture": "swipe_right"},
    {"choice_id": "ch_1_hub_loot_crowbar", "gesture": "swipe_diagonal"},
    {"choice_id": "ch_2_hub_to_secret", "gesture": "circle"},
    {"choice_id": "ch_2_lounge_to_security", "gesture": "swipe_down"},
    {"choice_id": "ch_3_hub_to_ai", "gesture": "two_finger_bottom"},
    {"choice_id": "ch_3_hub_to_lore", "gesture": "circle"},
    {"choice_id": "ch_3_hart_exploit", "gesture": "swipe_diagonal"},
    {"choice_id": "ch_4_engines_pda_win", "gesture": "circle"},
    {"choice_id": "ch_2_med_to_locked_cabinet", "gesture": "swipe_right"},
    {"choice_id": "ch_5_showdown_hack", "gesture": "two_finger_bottom"},
    {"choice_id": "ch_1_cargo_to_sealed_container", "gesture": "swipe_down"},
]

ORIGINAL_NODES = {
    "ch_1_cargo_shortcut": "act1_cargo_subdeck",
    "ch_1_skip_to_act4": "act1_hub_workbench",
    "ch_1_hub_loot_crowbar": "act1_hub_junk",
    "ch_2_hub_to_secret": "act2_corridors_rooms",
    "ch_2_lounge_to_security": "act2_recreation_room",
    "ch_3_hub_to_ai": "act3_hub",
    "ch_3_hub_to_lore": "act3_hub",
    "ch_3_hart_exploit": "act3_hart_lab",
    "ch_4_engines_pda_win": "act4_engine_deck",
    "ch_2_med_to_locked_cabinet": "act2_med_point",
    "ch_5_showdown_hack": "act5_bridge_showdown",
    "ch_1_cargo_to_sealed_container": "act1_cargo_subdeck",
}


def build_failure_choice(choice_id):
    """Скрытый failure-выбор: остаёмся в текущей ноде, ставим флаг провала."""
    failed_flag = f"{choice_id}_failed"
    return {
        "id": f"{choice_id}_fail",
        "node_id": ORIGINAL_NODES[choice_id],
        "target_node_id": ORIGINAL_NODES[choice_id],
        "label": "⛔ Взлом не удался",
        "narrative_override": None,
        # flag_forbidden делает выбор невидимым всегда (до и после провала).
        # Flutter вызывает его напрямую по failure_choice_id.
        "conditions": {"flag_forbidden": failed_flag},
        "effects": {"add_flag": failed_flag},
        "sort_order": 99,
    }


# ---------------------------------------------------------------------------
# Новые запертые ноды и выборы к ним
# ---------------------------------------------------------------------------
NEW_LOCKED_NODES = [
    {
        "id": "act2_med_locked_cabinet",
        "act": 2,
        "location_name": "Спасательный пост",
        "title": "ЗАПЕРТЫЙ МЕД-ШКАФ",
        "narrative": (
            "За основным аппликатором стоит узкий шкафчик с электромеханическим замком. "
            "После успешного взлома дверца открывается с гулким щелчком. Внутри — целый "
            "комплект полевых стимуляторов и бинты с кровоостанавливающим гелем."
        ),
        "thought": "Эти припасы серьёзно повысят мои шансы.",
        "image_prompt": "sci-fi medical cabinet open glowing vials bandages",
        "is_start_node": False,
        "is_ending": False,
        "ending_type": None,
        "image_url": None,
        "image_generated": False,
    },
    {
        "id": "act1_cargo_sealed_container",
        "act": 1,
        "location_name": "Грузовой подъярус / Шахта лифта",
        "title": "ГЕРМОКОНТЕЙНЕР",
        "narrative": (
            "У стены подъяруса стоит массивный герметичный контейнер с повреждённым замком. "
            "После точного вскрытия крышка откидывается, выпуская облако инертного газа. "
            "Внутри лежит исправный аккумулятор питания скафандра и упаковка радиационной пластины."
        ),
        "thought": "Полезный хлам. Может пригодиться.",
        "image_prompt": "sci-fi sealed cargo container open battery inside dark cargo bay",
        "is_start_node": False,
        "is_ending": False,
        "ending_type": None,
        "image_url": None,
        "image_generated": False,
    },
]

NEW_LOCKED_CHOICES = [
    # ---- мед-шкаф ----
    {
        "id": "ch_2_med_to_locked_cabinet",
        "node_id": "act2_med_point",
        "target_node_id": "act2_med_locked_cabinet",
        "label": "🔐 [ВЗЛОМ] Вскрыть запертый мед-шкаф",
        "narrative_override": None,
        "conditions": {
            "flag_not_required": "med_cabinet_looted",
            "flag_forbidden": "ch_2_med_to_locked_cabinet_failed",
        },
        "effects": {
            "minigame": "swipe_right",
            "failure_choice_id": "ch_2_med_to_locked_cabinet_fail",
            "add_flag": "med_cabinet_looted",
            "add_item": "Полевой стимулятор",
            "add_hp": 30,
        },
        "sort_order": 2,
    },
    {
        "id": "ch_2_med_locked_cabinet_back",
        "node_id": "act2_med_locked_cabinet",
        "target_node_id": "act2_med_point",
        "label": "↩️ Забрать всё полезное и выйти",
        "narrative_override": None,
        "conditions": {},
        "effects": {},
        "sort_order": 1,
    },
    # ---- гермоконтейнер ----
    {
        "id": "ch_1_cargo_to_sealed_container",
        "node_id": "act1_cargo_subdeck",
        "target_node_id": "act1_cargo_sealed_container",
        "label": "🔐 [ВЗЛОМ] Вскрыть герметичный контейнер",
        "narrative_override": None,
        "conditions": {
            "flag_not_required": "cargo_container_looted",
            "flag_forbidden": "ch_1_cargo_to_sealed_container_failed",
        },
        "effects": {
            "minigame": "swipe_down",
            "failure_choice_id": "ch_1_cargo_to_sealed_container_fail",
            "add_flag": "cargo_container_looted",
            "add_item": "Запасной аккумулятор",
        },
        "sort_order": 4,
    },
    {
        "id": "ch_1_cargo_sealed_container_back",
        "node_id": "act1_cargo_sealed_container",
        "target_node_id": "act1_cargo_subdeck",
        "label": "↩️ Взять аккумулятор и выйти",
        "narrative_override": None,
        "conditions": {},
        "effects": {},
        "sort_order": 1,
    },
]


def main():
    print("Очистка устаревших failure-нод и return-выборов...")
    old_failure_nodes = [f"fail_{p['choice_id']}" for p in MINIGAME_POINTS]
    old_return_choices = [f"{p['choice_id']}_return" for p in MINIGAME_POINTS]
    old_failure_choices = [f"{p['choice_id']}_fail" for p in MINIGAME_POINTS]
    supabase_request("DELETE", f"/rest/v1/choices?id=in.({','.join(old_return_choices + old_failure_choices)})")
    supabase_request("DELETE", f"/rest/v1/nodes?id=in.({','.join(old_failure_nodes)})")

    print("Загрузка текущих выборов...")
    ids = [p["choice_id"] for p in MINIGAME_POINTS]
    path = f"/rest/v1/choices?id=in.({','.join(ids)})&select=id,conditions,effects"
    status, body = supabase_request("GET", path)
    existing = {row["id"]: row for row in json.loads(body)}

    # 1. Обновляем существующие 10 + 2 новых выбора до запертых нод
    for point in MINIGAME_POINTS:
        choice_id = point["choice_id"]
        row = existing.get(choice_id, {"conditions": {}, "effects": {}})
        conditions = dict(row.get("conditions") or {})
        effects = dict(row.get("effects") or {})

        failed_flag = f"{choice_id}_failed"
        conditions["flag_forbidden"] = failed_flag
        effects["minigame"] = point["gesture"]
        effects["failure_choice_id"] = f"{choice_id}_fail"

        payload = {"conditions": conditions, "effects": effects}
        patch_path = f"/rest/v1/choices?id=eq.{choice_id}"
        print(f"  PATCH {choice_id}")
        supabase_request("PATCH", patch_path, payload)

    # 2. Создаём/обновляем скрытые failure-выборы (без failure-нод и возвратов)
    failure_choices = [build_failure_choice(p["choice_id"]) for p in MINIGAME_POINTS]
    print(f"Создание/обновление {len(failure_choices)} скрытых failure-выборов...")
    supabase_request(
        "POST",
        "/rest/v1/choices?on_conflict=id",
        failure_choices,
        extra_headers={"Prefer": "resolution=merge-duplicates"},
    )

    # 3. Создаём новые запертые ноды
    print(f"Создание {len(NEW_LOCKED_NODES)} новых запертых нод...")
    supabase_request(
        "POST",
        "/rest/v1/nodes?on_conflict=id",
        NEW_LOCKED_NODES,
        extra_headers={"Prefer": "resolution=merge-duplicates"},
    )

    # 4. Создаём выборы к новым запертым нодам
    print(f"Создание {len(NEW_LOCKED_CHOICES)} выборов к запертым нодам...")
    supabase_request(
        "POST",
        "/rest/v1/choices?on_conflict=id",
        NEW_LOCKED_CHOICES,
        extra_headers={"Prefer": "resolution=merge-duplicates"},
    )

    print("[OK] Готово.")


if __name__ == "__main__":
    main()
