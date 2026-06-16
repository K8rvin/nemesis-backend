#!/usr/bin/env python3
"""
Универсальный поиск маршрута до заданного выбора.
Использование:
  python scripts/find_route.py <target_choice_id>
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


def state_key(node_id, state):
    return (
        node_id,
        frozenset(state["flags"]),
        frozenset(state["items"]),
        frozenset(state["skills"]),
    )


def find_route(choices, start_node, target_choice_id, max_depth=120):
    choices_by_node = {}
    for c in choices:
        choices_by_node.setdefault(c["node_id"], []).append(c)

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

            new_path = path + [choice]
            if choice["id"] == target_choice_id:
                return new_path, state

            new_state = apply_effects(choice.get("effects_parsed") or {}, state)
            target = choice["target_node_id"]
            if not target:
                continue
            key = state_key(target, new_state)
            if key in visited:
                continue
            visited.add(key)
            queue.append((target, new_state, new_path))

    return None, None


def main():
    if len(sys.argv) < 2:
        print("Usage: python find_route.py <target_choice_id>")
        sys.exit(1)
    target = sys.argv[1]

    print(f"Поиск маршрута до {target}...")
    choices = supabase_request(
        "GET",
        "/rest/v1/choices?select=id,node_id,target_node_id,label,conditions,effects,sort_order",
    )
    for c in choices:
        cond = c.get("conditions") or {}
        eff = c.get("effects") or {}
        c["conditions_parsed"] = cond if isinstance(cond, dict) else json.loads(cond)
        c["effects_parsed"] = eff if isinstance(eff, dict) else json.loads(eff)

    route, final_state = find_route(choices, "act1_start", target)
    if not route:
        print("Маршрут не найден.")
        return

    ids = [c["id"] for c in route]
    print("\nМаршрут:\n")
    for c in route:
        print(f"  {c['id']}  ({c.get('label') or ''})")
    print("\nPath JSON:")
    print(json.dumps(ids, ensure_ascii=False, indent=2))
    print("\nФинальное состояние:")
    print(f"  flags: {sorted(final_state['flags'])}")
    print(f"  items: {sorted(final_state['items'])}")
    print(f"  skills: {sorted(final_state['skills'])}")


if __name__ == "__main__":
    main()
