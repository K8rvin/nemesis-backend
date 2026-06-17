#!/usr/bin/env python3
"""
Обратный поиск пути по нодам (без учёта условий/эффектов).
Использование:
  python scripts/reverse_path.py <target_node_id>
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


def main():
    if len(sys.argv) < 2:
        print("Usage: python reverse_path.py <target_node_id>")
        sys.exit(1)
    target = sys.argv[1]

    choices = supabase_request(
        "GET",
        "/rest/v1/choices?select=id,node_id,target_node_id,label",
    )
    incoming = {}
    for c in choices:
        incoming.setdefault(c["target_node_id"], []).append(c)

    queue = deque([(target, [])])
    visited = {target}
    while queue:
        node, path = queue.popleft()
        if node == "act1_start":
            for step in reversed(path):
                print(f"{step['node_id']} -> {step['id']} -> {step['target_node_id']} | {step.get('label')}")
            return
        for c in incoming.get(node, []):
            src = c["node_id"]
            if src in visited:
                continue
            visited.add(src)
            queue.append((src, path + [c]))
    print("Путь не найден")


if __name__ == "__main__":
    main()
