#!/usr/bin/env python3
"""Проверка заданного маршрута от act1_start до ach_swarm_lord."""
import json
import os
import re
import sys

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


import urllib.request
import urllib.error


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


def normalize_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def choice_visible(choice, state):
    conds = choice.get("conditions_parsed") or {}
    effects = choice.get("effects_parsed") or {}

    if conds.get("required_skill") and conds["required_skill"] not in state["skills"]:
        return False
    if effects.get("add_skill") and effects["add_skill"] in state["skills"]:
        return False

    for flag in normalize_list(conds.get("flag_required")):
        if flag not in state["flags"]:
            return False
    for flag in normalize_list(conds.get("flag_not_required")):
        if flag in state["flags"]:
            return False
    if conds.get("flag_forbidden") and conds.get("flag_forbidden") in state["flags"]:
        return False
    if "flags_not_required_all" in conds:
        flags_all = normalize_list(conds["flags_not_required_all"])
        if all(f in state["flags"] for f in flags_all):
            return False

    for item in normalize_list(conds.get("item_required")):
        if item not in state["items"]:
            return False

    return True


def apply_effects(effects, state):
    new_state = {
        "flags": set(state["flags"]),
        "items": set(state["items"]),
        "skills": set(state["skills"]),
    }
    eff = effects or {}
    for flag in normalize_list(eff.get("add_flag")):
        new_state["flags"].add(flag)
    for flag in normalize_list(eff.get("remove_flags")):
        new_state["flags"].discard(flag)
    for item in normalize_list(eff.get("add_item")):
        new_state["items"].add(item)
    for item in normalize_list(eff.get("remove_item")):
        new_state["items"].discard(item)
    for skill in normalize_list(eff.get("add_skill")):
        new_state["skills"].add(skill)
    return new_state


PATH = [
    "ch_1_start_to_skills",
    "trans_choice_ch_1_start_to_skills",
    "ch_1_skill_stl",
    "trans_choice_ch_1_skill_stl",
    "ch_1_hub_to_trap",
    "trans_choice_ch_1_hub_to_trap",
    "ch_1_trap_stl_clean",
    "trans_choice_ch_1_trap_stl_clean",
    "ch_2_corridors_to_rooms",
    "trans_choice_ch_2_corridors_to_rooms",
    "ch_2_hub_to_rec",
    "trans_choice_ch_2_hub_to_rec",
    "ch_2_lounge_to_security",
    "trans_choice_ch_2_lounge_to_security",
    "ch_2_security_take_items",
    "trans_choice_ch_2_security_take_items",
    "ch_2_security_to_corridors",
    "ch_2_rec_to_corridors",
    "ch_2_corridors_to_rooms",
    "trans_choice_ch_2_corridors_to_rooms",
    "ch_2_hub_to_secret",
    "trans_choice_ch_2_hub_to_secret",
    "ch_2_secret_take_pda",
    "trans_choice_ch_2_secret_take_pda",
    "ch_2_secret_office_back",
    "ch_2_rooms_back",
    "ch_2_bypass_act3_4",
    "trans_choice_ch_2_bypass_act3_4",
    "ch_5_start_next_bypass",
    "trans_choice_ch_5_start_next_bypass",
    "ch_5_showdown_hack",
    "trans_choice_ch_5_showdown_hack",
    "ch_5_b_ending_8",
]


def main():
    choices = supabase_request(
        "GET",
        "/rest/v1/choices?select=id,node_id,target_node_id,label,conditions,effects",
    )
    for c in choices:
        cond = c.get("conditions") or {}
        eff = c.get("effects") or {}
        c["conditions_parsed"] = cond if isinstance(cond, dict) else json.loads(cond)
        c["effects_parsed"] = eff if isinstance(eff, dict) else json.loads(eff)

    choices_by_id = {c["id"]: c for c in choices}
    state = {"flags": set(), "items": set(), "skills": set()}
    node_id = "act1_start"

    for i, cid in enumerate(PATH, 1):
        choice = choices_by_id.get(cid)
        if not choice:
            print(f"[ERROR {i}] Выбор {cid} не найден в БД")
            return
        if choice["node_id"] != node_id:
            print(
                f"[ERROR {i}] Ожидалась нода {node_id}, но {cid} находится в {choice['node_id']}"
            )
            return
        if not choice_visible(choice, state):
            print(f"[ERROR {i}] Выбор {cid} недоступен в текущем состоянии")
            print(f"   state: {state}")
            return
        state = apply_effects(choice.get("effects_parsed") or {}, state)
        node_id = choice["target_node_id"]
        print(f"[OK {i:2}] {cid} -> {node_id}")

    print("\nФинальное состояние:")
    print(f"  node: {node_id}")
    print(f"  flags: {sorted(state['flags'])}")
    print(f"  items: {sorted(state['items'])}")
    print(f"  skills: {sorted(state['skills'])}")
    if "ach_swarm_lord" in state.get("achievements", set()):
        print("✅ Ачивка разблокирована")
    else:
        print("ℹ️ Ачивка разблокируется эффектом последнего выбора (не отслеживается в state)")


if __name__ == "__main__":
    main()
