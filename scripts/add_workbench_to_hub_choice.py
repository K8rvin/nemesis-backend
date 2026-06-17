#!/usr/bin/env python3
"""Добавляет прямой выход с инженерного верстака в центр хаба."""
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
    rows = supabase_request("GET", "/rest/v1/choices?id=eq.ch_1_workbench_to_hub")
    if rows:
        print("Выбор ch_1_workbench_to_hub уже существует")
        return
    supabase_request(
        "POST",
        "/rest/v1/choices",
        {
            "id": "ch_1_workbench_to_hub",
            "node_id": "act1_hub_workbench",
            "target_node_id": "act1_hub",
            "label": "↩️ Вернуться в центр хаба",
            "conditions": {},
            "effects": {},
            "sort_order": 6,
        },
    )
    print("Создан выбор ch_1_workbench_to_hub")


if __name__ == "__main__":
    main()
