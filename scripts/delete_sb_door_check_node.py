#!/usr/bin/env python3
"""
Удаление промежуточной ноды trans_ch_2_hub_to_secret (Проверка двери СБ).
Входящий выбор ch_2_hub_to_secret перенаправляется сразу в act2_secret_office.
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


NODE_ID = "trans_ch_2_hub_to_secret"
OUTGOING_CHOICE_ID = "trans_choice_ch_2_hub_to_secret"


def main():
    node_exists = bool(
        supabase_request("GET", f"/rest/v1/nodes?id=eq.{NODE_ID}&select=id")
    )

    if node_exists:
        incoming = supabase_request(
            "GET",
            f"/rest/v1/choices?target_node_id=eq.{NODE_ID}&select=id,target_node_id",
        )
        outgoing = supabase_request(
            "GET",
            f"/rest/v1/choices?node_id=eq.{NODE_ID}&select=id,target_node_id",
        )

        if len(incoming) != 1 or len(outgoing) != 1:
            print(f"[SKIP] {NODE_ID}: incoming={len(incoming)}, outgoing={len(outgoing)}")
            return

        incoming_id = incoming[0]["id"]
        target_node_id = outgoing[0]["target_node_id"]

        supabase_request(
            "PATCH",
            f"/rest/v1/choices?id=eq.{incoming_id}",
            {"target_node_id": target_node_id},
        )
        print(f"[PATCH] {incoming_id} -> {target_node_id}")

        supabase_request("DELETE", f"/rest/v1/nodes?id=eq.{NODE_ID}")
        print(f"[DELETE] node {NODE_ID}")
    else:
        print(f"[INFO] Нода {NODE_ID} уже удалена")

    # Обновить маршруты, которые проходили через удалённую ноду
    routes = supabase_request(
        "GET",
        "/rest/v1/achievement_routes?select=start_node_id,achievement_id,path",
    )
    for route in routes:
        path = route.get("path") or []
        if not isinstance(path, list):
            continue
        new_path = [step for step in path if step not in (NODE_ID, OUTGOING_CHOICE_ID)]
        if len(new_path) != len(path):
            start = route["start_node_id"]
            ach = route["achievement_id"]
            supabase_request(
                "PATCH",
                f"/rest/v1/achievement_routes?start_node_id=eq.{start}&achievement_id=eq.{ach}",
                {
                    "path": new_path,
                    "steps_remaining": max(0, len(new_path) - 1),
                },
            )
            print(
                f"[ROUTE] {start} -> {ach}: removed {len(path) - len(new_path)} steps"
            )

    print("[OK] Готово.")


if __name__ == "__main__":
    main()
