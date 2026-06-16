#!/usr/bin/env python3
"""
Удаление промежуточных transition-нод финала act 5.
Для каждой ноды:
  - входящий выбор перенаправляется на целевую ноду исходящего выбора;
  - сама transition-нода удаляется (исходящий выбор удаляется каскадно).
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


NODE_IDS = [
    "trans_ch_5_b_ending_1",
    "trans_ch_5_b_ending_2",
    "trans_ch_5_b_ending_3",
    "trans_ch_5_b_ending_4",
    "trans_ch_5_b_ending_5",
    "trans_ch_5_b_ending_8",
]


def main():
    for node_id in NODE_IDS:
        incoming = supabase_request(
            "GET",
            f"/rest/v1/choices?target_node_id=eq.{node_id}&select=id",
        )
        outgoing = supabase_request(
            "GET",
            f"/rest/v1/choices?node_id=eq.{node_id}&select=id,target_node_id",
        )

        if len(incoming) != 1 or len(outgoing) != 1:
            print(
                f"[SKIP] {node_id}: incoming={len(incoming)}, outgoing={len(outgoing)}"
            )
            continue

        incoming_id = incoming[0]["id"]
        target_node_id = outgoing[0]["target_node_id"]

        supabase_request(
            "PATCH",
            f"/rest/v1/choices?id=eq.{incoming_id}",
            {"target_node_id": target_node_id},
        )
        print(f"[PATCH] {incoming_id} -> {target_node_id}")

        supabase_request("DELETE", f"/rest/v1/nodes?id=eq.{node_id}")
        print(f"[DELETE] node {node_id}")

    print("[OK] Готово.")


if __name__ == "__main__":
    main()
