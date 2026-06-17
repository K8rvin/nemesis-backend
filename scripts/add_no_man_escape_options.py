#!/usr/bin/env python3
"""Добавляет новые варианты выхода из act5_bridge_showdown без жертвы Тобиаса."""
import json
import os
import re
import sys
import urllib.request
import urllib.error

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")


def load_dev_vars(path=".dev.vars"):
    values = {}
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            m = re.match(r"^(\w+)\s*=\s*(.+)$", line)
            if m:
                values[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return values


def supabase_request(method, path, data=None, prefer=None):
    cfg = load_dev_vars()
    url = cfg["SUPABASE_URL"] + path
    headers = {
        "apikey": cfg["SUPABASE_SERVICE_ROLE_KEY"],
        "Authorization": f"Bearer {cfg['SUPABASE_SERVICE_ROLE_KEY']}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Prefer": prefer or "return=representation",
    }
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8") or "[]")
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8")
        raise RuntimeError(f"Supabase {e.code} {path}: {text}")


def upsert_node(node):
    rows = supabase_request("GET", f"/rest/v1/nodes?id=eq.{node['id']}")
    if rows:
        print(f"Нода {node['id']} уже существует")
        return
    supabase_request("POST", "/rest/v1/nodes", node)
    print(f"Создана нода {node['id']}")


def upsert_choice(choice):
    rows = supabase_request("GET", f"/rest/v1/choices?id=eq.{choice['id']}")
    if rows:
        print(f"Выбор {choice['id']} уже существует")
        return
    supabase_request("POST", "/rest/v1/choices", choice)
    print(f"Создан выбор {choice['id']}")


def main():
    # Transition nodes
    upsert_node({
        "id": "trans_ch_5_showdown_crowbar",
        "act": 5,
        "location_name": "Переход",
        "title": "Лом в механизме турели",
        "narrative": "Ты всаживаешь Тяжелый лом в зазор поворотного сервопривода ближайшей турели. Металл скрежетит, мотор глохнет, и пушка застывает, упершись стволом в соседнюю турель. Вторичный взрыв разлетается искрами, но проход к терминалу свободен.",
        "thought": "Старый добрый рычаг — лучше всякой электроники.",
        "image_prompt": "crowbar jammed into turret mechanism, sparks, astronaut running to terminal",
        "is_start_node": False,
        "is_ending": False,
    })

    upsert_node({
        "id": "trans_ch_5_showdown_battery",
        "act": 5,
        "location_name": "Переход",
        "title": "Импульс щита",
        "narrative": "Ты хватаешь Запасной аккумулятор и втыкаешь его в аварийный разъём нагрудной пластины. На долю секунды кинетический щит вспыхивает, отбивая первую залп лазеров. Под прикрытием этого единственного всплеска ты бросаешься к центральной консоли.",
        "thought": "Одного заряда хватит ровно на один рывок.",
        "image_prompt": "kinetic shield flare from spare battery, astronaut sprinting past laser turrets",
        "is_start_node": False,
        "is_ending": False,
    })

    # Choices
    upsert_choice({
        "id": "ch_5_showdown_crowbar",
        "node_id": "act5_bridge_showdown",
        "target_node_id": "trans_ch_5_showdown_crowbar",
        "label": "🔧 [ПРЕДМЕТ] Воткнуть Тяжелый лом в сервопривод турелей",
        "conditions": {"item_required": "Тяжелый лом"},
        "effects": {},
        "sort_order": 6,
    })

    upsert_choice({
        "id": "trans_choice_ch_5_showdown_crowbar",
        "node_id": "trans_ch_5_showdown_crowbar",
        "target_node_id": "act5_terminal_final",
        "label": "➡️ Проскочить мимо обездвиженных турелей",
        "conditions": {},
        "effects": {},
        "sort_order": 1,
    })

    upsert_choice({
        "id": "ch_5_showdown_battery",
        "node_id": "act5_bridge_showdown",
        "target_node_id": "trans_ch_5_showdown_battery",
        "label": "⚡ [ПРЕДМЕТ] Использовать Запасной аккумулятор для импульса щита",
        "conditions": {"item_required": "Запасной аккумулятор"},
        "effects": {},
        "sort_order": 7,
    })

    upsert_choice({
        "id": "trans_choice_ch_5_showdown_battery",
        "node_id": "trans_ch_5_showdown_battery",
        "target_node_id": "act5_terminal_final",
        "label": "➡️ Рвануть к терминалу под прикрытием щита",
        "conditions": {},
        "effects": {},
        "sort_order": 1,
    })

    print("Готово.")


if __name__ == "__main__":
    main()
