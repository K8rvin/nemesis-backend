#!/usr/bin/env python3
"""
Восстановление unlock_achievement на финальных выборах act5
после удаления промежуточных transition-нод.
"""
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
                values[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return values


def supabase_request(method, path, data=None):
    cfg = load_dev_vars()
    url = cfg["SUPABASE_URL"] + path
    headers = {
        "apikey": cfg["SUPABASE_SERVICE_ROLE_KEY"],
        "Authorization": f"Bearer {cfg['SUPABASE_SERVICE_ROLE_KEY']}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8") or "[]")
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8")
        raise RuntimeError(f"Supabase {e.code} {path}: {text}")


ENDING_EFFECTS = {
    "ch_5_b_ending_1": {"unlock_achievement": "ach_corp_ending"},
    "ch_5_b_ending_2": {"unlock_achievement": "ach_sacrifice_ending"},
    "ch_5_b_ending_3": {"unlock_achievement": "ach_no_man_left_behind"},
    "ch_5_b_ending_4": {"unlock_achievement": "infected_mind"},
    "ch_5_b_ending_5": {"unlock_achievement": "ach_lucky_bastard"},
    "ch_5_b_ending_8": {
        "add_flag": "владыка_морфов",
        "unlock_achievement": "ach_swarm_lord",
    },
}


def main():
    for choice_id, effects in ENDING_EFFECTS.items():
        supabase_request(
            "PATCH",
            f"/rest/v1/choices?id=eq.{choice_id}",
            {"effects": effects},
        )
        print(f"[PATCH] {choice_id} -> {effects}")
    print("[OK] Готово.")


if __name__ == "__main__":
    main()
