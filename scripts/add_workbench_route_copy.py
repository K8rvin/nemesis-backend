#!/usr/bin/env python3
"""Создаёт/обновляет копию маршрута через верстак под другим achievement_id."""
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


def main():
    new_ach_id = "ach_no_man_left_behind_workbench"
    title = "Своих не бросаем (верстак)"
    description = "Альтернативный маршрут: спасти Тобиаса и довести его до финала через ремонт сервопривода на верстаке."

    rows = supabase_request("GET", f"/rest/v1/achievements?id=eq.{new_ach_id}")
    if not rows:
        supabase_request(
            "POST",
            "/rest/v1/achievements",
            {
                "id": new_ach_id,
                "title": title,
                "description": description,
                "medal_tier": "GOLD",
            },
        )
        print(f"Создано достижение {new_ach_id}")
    else:
        print(f"Достижение {new_ach_id} уже существует")

    path = [
        "ch_1_start_to_skills",
        "trans_choice_ch_1_start_to_skills",
        "ch_1_skill_eng",
        "trans_choice_ch_1_skill_eng",
        "ch_1_hub_to_cargo",
        "trans_choice_ch_1_hub_to_cargo",
        "ch_1_cargo_loot_servo",
        "trans_choice_ch_1_cargo_loot_servo",
        "ch_1_cargo_to_sealed_container",
        "ch_1_cargo_sealed_container_back",
        "ch_1_cargo_back",
        "ch_1_hub_to_explore",
        "trans_choice_ch_1_hub_to_explore",
        "ch_1_explore_to_workbench",
        "trans_choice_ch_1_explore_to_workbench",
        "ch_1_repair_servo",
        "trans_choice_ch_1_repair_servo",
        "ch_1_workbench_to_hub",
        "ch_1_hub_to_lounge",
        "trans_choice_ch_1_hub_to_lounge",
        "ch_2_rec_to_corridors",
        "ch_2_hub_to_tobias",
        "trans_choice_ch_2_hub_to_tobias",
        "ch_2_tobias_save",
        "trans_choice_ch_2_tobias_save",
        "ch_2_save_to_act3",
        "trans_choice_ch_2_save_to_act3",
        "ch_3_start_to_cryo",
        "trans_choice_ch_3_start_to_cryo",
        "ch_3_cryo_proceed",
        "trans_choice_ch_3_cryo_proceed",
        "ch_3_boss_to_combat",
        "ch_3_boss_eng",
        "trans_choice_ch_3_boss_eng",
        "ch_3_hub_to_hart",
        "trans_choice_ch_3_hub_to_hart",
        "ch_3_hart_accept",
        "trans_choice_ch_3_hart_accept",
        "ch_3_nest_hck",
        "trans_choice_ch_3_nest_hck",
        "ch_3_choice_hart",
        "trans_choice_ch_3_choice_hart",
        "ch_4_start_to_climb",
        "trans_choice_ch_4_start_to_climb",
        "ch_4_climb_to_power",
        "ch_4_climb_power_hydraulics",
        "trans_choice_ch_4_climb_power_hydraulics",
        "ch_4_phase2_hydraulics_win",
        "trans_choice_ch_4_phase2_hydraulics_win",
        "ch_4_reactor_stabilize",
        "trans_choice_ch_4_reactor_stabilize",
        "ch_5_start_next",
        "trans_choice_ch_5_start_next",
        "ch_5_showdown_battery",
        "trans_choice_ch_5_showdown_battery",
        "ch_5_b_ending_3",
    ]

    row = {
        "start_node_id": "act1_start",
        "achievement_id": new_ach_id,
        "path": path,
        "next_choice_id": path[0],
        "steps_remaining": 0,
        "reachable": True,
    }
    result = supabase_request(
        "POST",
        "/rest/v1/achievement_routes",
        row,
        prefer="resolution=merge-duplicates, return=representation",
    )
    print(f"Сохранён маршрут {result[0]['achievement_id']}, {len(result[0]['path'])} шагов")


if __name__ == "__main__":
    main()
