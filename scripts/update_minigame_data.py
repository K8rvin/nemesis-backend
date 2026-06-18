#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Массовое обновление данных мини-игр взлома/вскрытия в Supabase.

Что делает:
1. Задаёт effects.minigame + effects.failure_choice_id для 12 точек.
   - Терминалы/КПК используют pattern_lock с уникальной effects.pattern_sequence.
   - Механические действия — свайпы/круг.
2. Создаёт failure-ноды fail_<choice_id> с текстами провала.
3. Создаёт скрытые failure-выборы *_fail, которые ставят флаг _failed
   и ведут в failure-ноду.
4. Создаёт return-выборы *_return "Продолжить" из failure-ноды обратно
   в исходную ноду.
5. Добавляет conditions.flag_forbidden = <choice_id>_failed в оригинальные
   выборы, чтобы скрыть их после провала.
6. Создаёт два новых запертых объекта: мед-шкаф и гермоконтейнер.

Запуск:
    cd nemesis-backend
    python scripts/update_minigame_data.py
"""

import json
import os
import re
import sys
import urllib.request
import urllib.error


# Защита от UnicodeEncodeError в Windows-консолях с не-UTF-8 кодировкой.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")


def load_dev_vars(path=".dev.vars"):
    if not os.path.exists(path):
        raise FileNotFoundError(f"Файл {path} не найден.")
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
# 12 точек мини-игр: choice_id -> (gesture, pattern_sequence, original_node)
# ---------------------------------------------------------------------------
MINIGAME_POINTS = [
    {"choice_id": "ch_1_cargo_shortcut", "gesture": "swipe_right", "node_id": "act1_cargo_subdeck", "act": 1, "location": "Грузовой подъярус / Шахта лифта"},
    {"choice_id": "ch_1_skip_to_act4", "gesture": "swipe_right", "node_id": "act1_cargo_subdeck", "act": 1, "location": "Грузовой подъярус / Шахта лифта"},
    {"choice_id": "ch_1_hub_loot_crowbar", "gesture": "swipe_diagonal_up", "node_id": "act1_hub_junk", "act": 1, "location": "Палуба отходов"},
    {"choice_id": "ch_2_hub_to_secret", "gesture": "circle", "node_id": "act2_corridors_rooms", "act": 2, "location": "Коридоры кают"},
    {"choice_id": "ch_2_lounge_to_security", "gesture": "swipe_down", "node_id": "act2_recreation_room", "act": 2, "location": "Комната отдыха персонала"},
    {"choice_id": "ch_3_hub_to_ai", "gesture": "pattern_lock", "pattern_sequence": "1-4-7-8-9", "node_id": "act3_hub", "act": 3, "location": "Центральный отсек Немезида"},
    {"choice_id": "ch_3_hub_to_lore", "gesture": "pattern_lock", "pattern_sequence": "3-6-9-8-7", "node_id": "act3_hub", "act": 3, "location": "Центральный отсек Немезида"},
    {"choice_id": "ch_3_hart_exploit", "gesture": "pattern_lock", "pattern_sequence": "1-2-3-5-7", "node_id": "act3_hart_lab", "act": 3, "location": "Бункер Доктора Харт"},
    {"choice_id": "ch_4_engines_pda_win", "gesture": "pattern_lock", "pattern_sequence": "7-4-1-2-3", "node_id": "act4_engine_deck", "act": 4, "location": "Палуба Двигателей"},
    {"choice_id": "ch_2_med_to_locked_cabinet", "gesture": "swipe_right", "node_id": "act2_med_point", "act": 2, "location": "Спасательный пост"},
    {"choice_id": "ch_5_showdown_hack", "gesture": "pattern_lock", "pattern_sequence": "1-5-8-9-6", "node_id": "act5_bridge_showdown", "act": 5, "location": "Командный Мостик"},
    {"choice_id": "ch_1_cargo_to_sealed_container", "gesture": "swipe_down", "node_id": "act1_cargo_subdeck", "act": 1, "location": "Грузовой подъярус / Шахта лифта"},
]

FAILURE_NARRATIVES = {
    "ch_1_cargo_shortcut": (
        "Ты пытаешься поддеть массивный засов, но плоская пружина замка лопается. "
        "Механизм ворот грузового лифта мёртво застывает в закрытом положении. "
        "Срез через шахту больше недоступен."
    ),
    "ch_1_skip_to_act4": (
        "Ты заводишь лом в щель аварийного люка, но срываешь резьбу запора. "
        "Люк герметично запечатан — прямой путь в энергоблок теперь закрыт."
    ),
    "ch_1_hub_loot_crowbar": (
        "Обломки обшивки слишком глубоко врезались в перекрытия. "
        "Ты повреждаешь последние крепления, и завал окончательно закрывает доступ к лому."
    ),
    "ch_2_hub_to_secret": (
        "Круговой замок двери СБ не отзывается. После неудачной попытки механизм "
        "активировал внутренний блокиратор — дверь заклинена."
    ),
    "ch_2_lounge_to_security": (
        "Ты дергаешь ручку стойки администратора, но замок соскакивает с паза. "
        "Ящик заперт навсегда, путь в офисы СБ перекрыт."
    ),
    "ch_3_hub_to_ai": (
        "Ты вводишь последовательность, но терминал отбрасывает её. Сработала защита: "
        "Ядро ИИ заблокировано, и попытка взлома больше невозможна."
    ),
    "ch_3_hub_to_lore": (
        "Архивный терминал отверг графический ключ. Жёсткий диск ушёл в защитный режим, "
        "и доступ к логам утерян."
    ),
    "ch_3_hart_exploit": (
        "КПК Директора подключён, но Харт успела активировать ручную блокировку. "
        "Терминал интеркома выгорел, удалённый перехват Изолята невозможен."
    ),
    "ch_4_engines_pda_win": (
        "Мастер-код не принят повреждённым ИИ двигателей. Блокировка сервоприводов "
        "усилилась, и ручной сброс через КПК больше недоступен."
    ),
    "ch_2_med_to_locked_cabinet": (
        "Ты перегнул плоскую пружину замка, и электромеханизм мёртво зажал засов. "
        "Мед-шкаф теперь закрыт навсегда — повторный взлом бесполезен."
    ),
    "ch_5_showdown_hack": (
        "Защитный протокол мостика отразил атаку. Турели встали в боевой режим, "
        "а порт КПК расплавлен — взлом обороны невозможен."
    ),
    "ch_1_cargo_to_sealed_container": (
        "Ты сорвал резьбу запорного механизма. Контейнер герметично запечатан — "
        "без специального оборудования его уже не открыть."
    ),
}


def build_failure_node(point):
    return {
        "id": f"fail_{point['choice_id']}",
        "act": point["act"],
        "location_name": point["location"],
        "title": "ВЗЛОМ ПРОВАЛЕН",
        "narrative": FAILURE_NARRATIVES[point["choice_id"]],
        "thought": "Повторная попытка бесполезна. Нужно искать другой путь.",
        "image_prompt": "sci-fi broken lock jammed mechanism red warning lights dark corridor",
        "is_start_node": False,
        "is_ending": False,
        "ending_type": None,
        "image_url": None,
        "image_generated": False,
    }


def build_failure_choice(point):
    failed_flag = f"{point['choice_id']}_failed"
    return {
        "id": f"{point['choice_id']}_fail",
        "node_id": point["node_id"],
        "target_node_id": f"fail_{point['choice_id']}",
        "label": "⛔ Взлом не удался",
        "narrative_override": None,
        "conditions": {"flag_forbidden": failed_flag},
        "effects": {"add_flag": failed_flag},
        "sort_order": 99,
    }


def build_return_choice(point):
    return {
        "id": f"{point['choice_id']}_return",
        "node_id": f"fail_{point['choice_id']}",
        "target_node_id": point["node_id"],
        "label": "↩️ Продолжить",
        "narrative_override": None,
        "conditions": {},
        "effects": {},
        "sort_order": 1,
    }


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
    print("Загрузка текущих выборов...")
    ids = [p["choice_id"] for p in MINIGAME_POINTS]
    status, body = supabase_request("GET", f"/rest/v1/choices?id=in.({','.join(ids)})&select=id,conditions,effects")
    existing = {row["id"]: row for row in json.loads(body)}

    # 1. Обновляем оригинальные минигейм-выборы
    for point in MINIGAME_POINTS:
        choice_id = point["choice_id"]
        row = existing.get(choice_id, {"conditions": {}, "effects": {}})
        conditions = dict(row.get("conditions") or {})
        effects = dict(row.get("effects") or {})

        failed_flag = f"{choice_id}_failed"
        conditions["flag_forbidden"] = failed_flag
        effects["minigame"] = point["gesture"]
        effects["failure_choice_id"] = f"{choice_id}_fail"
        if point.get("pattern_sequence"):
            effects["pattern_sequence"] = point["pattern_sequence"]
        else:
            effects.pop("pattern_sequence", None)

        print(f"  PATCH {choice_id} -> {point['gesture']}")
        supabase_request("PATCH", f"/rest/v1/choices?id=eq.{choice_id}", {"conditions": conditions, "effects": effects})

    # 2. Создаём/обновляем failure-ноды
    failure_nodes = [build_failure_node(p) for p in MINIGAME_POINTS]
    print(f"Создание/обновление {len(failure_nodes)} failure-нод...")
    supabase_request(
        "POST",
        "/rest/v1/nodes?on_conflict=id",
        failure_nodes,
        extra_headers={"Prefer": "resolution=merge-duplicates"},
    )

    # 3. Создаём/обновляем failure- и return-выборы
    failure_choices = [build_failure_choice(p) for p in MINIGAME_POINTS]
    return_choices = [build_return_choice(p) for p in MINIGAME_POINTS]
    print(f"Создание/обновление {len(failure_choices)} failure- и {len(return_choices)} return-выборов...")
    supabase_request(
        "POST",
        "/rest/v1/choices?on_conflict=id",
        failure_choices + return_choices,
        extra_headers={"Prefer": "resolution=merge-duplicates"},
    )

    # 4. Создаём новые запертые ноды и выборы
    print(f"Создание {len(NEW_LOCKED_NODES)} новых запертых нод...")
    supabase_request(
        "POST",
        "/rest/v1/nodes?on_conflict=id",
        NEW_LOCKED_NODES,
        extra_headers={"Prefer": "resolution=merge-duplicates"},
    )
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
