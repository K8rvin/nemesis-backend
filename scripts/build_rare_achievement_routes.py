#!/usr/bin/env python3
"""
Build and store achievement routes for 7 rare achievements.
Run from nemesis-backend/ directory with .dev.vars loaded.
"""
import json
import os
import re
import sys
from collections import deque

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")


def load_dev_vars(path=".dev.vars"):
    if not os.path.exists(path):
        raise FileNotFoundError(f"File {path} not found.")
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


def state_key(node_id, state):
    return (
        node_id,
        frozenset(state["flags"]),
        frozenset(state["items"]),
        frozenset(state["skills"]),
    )


def find_route(choices_by_node, start_node, target_choice_id, max_depth=120):
    initial_state = {"flags": set(), "items": set(), "skills": set()}
    start_key = state_key(start_node, initial_state)
    queue = deque([(start_node, initial_state, [])])
    visited = {start_key}

    while queue:
        node_id, state, path = queue.popleft()
        if len(path) > max_depth:
            continue

        for choice in choices_by_node.get(node_id, []):
            if not choice_visible(choice, state):
                continue

            new_path = path + [choice["id"]]
            if choice["id"] == target_choice_id:
                return new_path

            new_state = apply_effects(choice.get("effects_parsed") or {}, state)
            target = choice["target_node_id"]
            if not target:
                continue
            key = state_key(target, new_state)
            if key in visited:
                continue
            visited.add(key)
            queue.append((target, new_state, new_path))

    return None


def upsert_route(ach_id, path):
    data = {
        "start_node_id": "act1_start",
        "achievement_id": ach_id,
        "path": path,
        "next_choice_id": path[0],
        "steps_remaining": len(path) - 1,
        "reachable": True,
    }
    try:
        supabase_request("POST", "/rest/v1/achievement_routes", data)
        return "inserted"
    except RuntimeError:
        supabase_request(
            "PATCH",
            f"/rest/v1/achievement_routes?start_node_id=eq.act1_start&achievement_id=eq.{ach_id}",
            data,
        )
        return "updated"


# Target achievements with their target choice IDs
TARGETS = [
    ("ach_botanist", "ch_2_hydro_bypass_oil"),
    ("ach_self_doctor", "ch_4_to_cryo_stasis"),
    ("ach_reboot", "ch_3_nest_hck"),
    ("ach_hart_dossier", "ch_2_security_take_items"),
    ("ach_lore_historian", "ch_3_lore_back"),
    ("ach_clean_bill", "ch_3_med_heal"),
    ("ach_trap_clean", "ch_1_trap_stl_clean"),
]


def main():
    print("Loading data from Supabase...")
    choices = supabase_request(
        "GET",
        "/rest/v1/choices?select=id,node_id,target_node_id,label,conditions,effects,sort_order",
    )
    for c in choices:
        cond = c.get("conditions") or {}
        eff = c.get("effects") or {}
        c["conditions_parsed"] = cond if isinstance(cond, dict) else json.loads(cond)
        c["effects_parsed"] = eff if isinstance(eff, dict) else json.loads(eff)

    choices_by_node = {}
    for c in choices:
        choices_by_node.setdefault(c["node_id"], []).append(c)

    # Check existing routes
    existing = {
        r["achievement_id"]
        for r in supabase_request(
            "GET", "/rest/v1/achievement_routes?select=achievement_id"
        )
    }

    for ach_id, target_choice_id in TARGETS:
        print(f"\n[CHECK] {ach_id} -> {target_choice_id}")
        if ach_id in existing:
            print(f"  [SKIP] Route already exists for {ach_id}")
            continue

        print(f"  [FIND] Searching route...")
        path = find_route(choices_by_node, "act1_start", target_choice_id)
        if not path:
            print(f"  [FAIL] Route not found for {ach_id}")
            continue

        status = upsert_route(ach_id, path)
        print(f"  [OK] {ach_id}: {len(path)} steps ({status})")

    print("\nDone.")


if __name__ == "__main__":
    main()
