#!/usr/bin/env python3
"""Проверка сохранённого маршрута из achievement_routes."""
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


def supabase_request(method, path, data=None, retries=3):
    cfg = load_dev_vars()
    url = cfg["SUPABASE_URL"] + path
    headers = {
        "apikey": cfg["SUPABASE_SERVICE_ROLE_KEY"],
        "Authorization": f"Bearer {cfg['SUPABASE_SERVICE_ROLE_KEY']}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    body = json.dumps(data).encode("utf-8") if data else None
    last = None
    for i in range(retries):
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read().decode("utf-8") or "[]")
        except Exception as e:
            last = e
            print(f"  [retry {i+1}] {e}", file=sys.stderr)
    raise last


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


def verify(achievement_id):
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

    rows = supabase_request(
        "GET",
        f"/rest/v1/achievement_routes?select=*&achievement_id=eq.{achievement_id}",
    )
    if not rows:
        print(f"[NOT FOUND] Маршрут для {achievement_id} не найден")
        return False

    row = rows[0]
    path = row["path"]
    node_id = row["start_node_id"]
    state = {"flags": set(), "items": set(), "skills": set()}

    for i, cid in enumerate(path, 1):
        choice = choices_by_id.get(cid)
        if not choice:
            print(f"[ERROR {i}] Выбор {cid} не найден в БД")
            return False
        if choice["node_id"] != node_id:
            print(
                f"[ERROR {i}] Ожидалась нода {node_id}, но {cid} находится в {choice['node_id']}"
            )
            return False
        if not choice_visible(choice, state):
            print(f"[ERROR {i}] Выбор {cid} недоступен в текущем состоянии")
            print(f"   state: {state}")
            return False
        state = apply_effects(choice.get("effects_parsed") or {}, state)
        node_id = choice["target_node_id"]

    print(f"[OK] {achievement_id}: {len(path)} шагов -> {node_id}")
    print(f"  flags: {sorted(state['flags'])}")
    print(f"  items: {sorted(state['items'])}")
    print(f"  skills: {sorted(state['skills'])}")
    return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python verify_achievement_route.py <achievement_id>")
        sys.exit(1)
    ok = verify(sys.argv[1])
    sys.exit(0 if ok else 1)
