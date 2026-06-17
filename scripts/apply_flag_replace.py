#!/usr/bin/env python3
"""Заменяет обуза_тобиас на tobias_saved в условиях выборов."""
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


def supabase_request(method, path, data=None):
    cfg = load_dev_vars()
    url = cfg["SUPABASE_URL"] + path
    headers = {
        "apikey": cfg["SUPABASE_SERVICE_ROLE_KEY"],
        "Authorization": f"Bearer {cfg['SUPABASE_SERVICE_ROLE_KEY']}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Prefer": "return=representation",
    }
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8") or "[]")
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8")
        raise RuntimeError(f"Supabase {e.code} {path}: {text}")


def replace_in_cond(cond):
    new = dict(cond)
    for key, value in new.items():
        if value == "обуза_тобиас":
            new[key] = "tobias_saved"
    return new


def main():
    choices = supabase_request(
        "GET",
        "/rest/v1/choices?select=id,conditions",
    )
    for c in choices:
        cond = c.get("conditions") or {}
        if isinstance(cond, str):
            cond = json.loads(cond)
        s = json.dumps(cond, ensure_ascii=False)
        if "обуза_тобиас" in s:
            new_cond = replace_in_cond(cond)
            print(f"Обновляем {c['id']}: {cond} -> {new_cond}")
            supabase_request(
                "PATCH",
                f"/rest/v1/choices?id=eq.{c['id']}",
                {"conditions": new_cond},
            )
    print("Готово.")


if __name__ == "__main__":
    main()
