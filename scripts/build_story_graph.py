#!/usr/bin/env python3
"""Build story_graph.json from the latest Supabase backup.

Outputs:
  - nemesis-flutter/assets/story_graph.json
  - nemesis-web/public/story_graph.json
"""

import json
import re
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKUP_DIR = PROJECT_ROOT / "Материалы" / "backups" / "db" / "20260622"

NODE_COLS = [
    "id", "act", "location_name", "title", "narrative", "thought",
    "image_prompt", "is_start_node", "is_ending", "ending_type",
    "created_at", "image_url", "image_generated", "translations",
]
CHOICE_COLS = [
    "id", "node_id", "target_node_id", "label", "narrative_override",
    "conditions", "effects", "sort_order", "translations",
]


def split_tuples(text: str, sep: str = "), ("):
    """Split PostgreSQL VALUES content into tuple strings by a separator,
    respecting single-quoted strings and escaped quotes ('')."""
    parts = []
    in_str = False
    start = 0
    i = 0
    while i < len(text):
        ch = text[i]
        if ch == "'":
            if in_str:
                if i + 1 < len(text) and text[i + 1] == "'":
                    i += 1
                else:
                    in_str = False
            else:
                in_str = True
        elif not in_str and text.startswith(sep, i):
            parts.append(text[start:i])
            start = i + len(sep)
            i += len(sep) - 1
        i += 1
    parts.append(text[start:])
    return parts


def parse_tuple(s: str):
    """Parse a single PostgreSQL tuple string into a list of Python values."""
    pattern = r"'((?:[^']|'')*)'|true|false|null|ARRAY\[\]|\d+|\d+\.\d+"
    fields = []
    for m in re.finditer(pattern, s):
        if m.group(1) is not None:
            fields.append(m.group(1).replace("''", "'"))
        else:
            raw = m.group(0)
            if raw == "true":
                fields.append(True)
            elif raw == "false":
                fields.append(False)
            elif raw == "null":
                fields.append(None)
            elif raw == "ARRAY[]":
                fields.append([])
            elif raw.isdigit():
                fields.append(int(raw))
            else:
                fields.append(float(raw))
    return fields


def parse_json_field(value):
    if value is None or value == "":
        return None
    try:
        return json.loads(value)
    except Exception:
        return value


def _parse_rows(path: Path, columns):
    raw = path.read_text(encoding="utf-8")
    val_idx = raw.find("VALUES")
    if val_idx == -1:
        raise ValueError(f"Cannot find VALUES clause in {path}")
    first_paren = raw.find("(", val_idx)
    last_paren = raw.rfind(")")
    if first_paren == -1 or last_paren == -1 or first_paren >= last_paren:
        raise ValueError(f"Cannot parse tuples in {path}")
    content = raw[first_paren + 1 : last_paren]
    tuples = split_tuples(content)
    rows = []
    for t in tuples:
        values = parse_tuple(t)
        if len(values) != len(columns):
            continue
        rows.append(dict(zip(columns, values)))
    return rows


def parse_nodes(path: Path):
    rows = _parse_rows(path, NODE_COLS)
    nodes = []
    for node in rows:
        node["act"] = int(node["act"])
        node["is_start_node"] = bool(node["is_start_node"])
        node["is_ending"] = bool(node["is_ending"])
        node["translations"] = parse_json_field(node.get("translations"))
        nodes.append(node)
    return nodes


def parse_choices(path: Path):
    rows = _parse_rows(path, CHOICE_COLS)
    choices = []
    for choice in rows:
        choice["sort_order"] = int(choice["sort_order"])
        choice["conditions"] = parse_json_field(choice.get("conditions"))
        choice["effects"] = parse_json_field(choice.get("effects"))
        choice["translations"] = parse_json_field(choice.get("translations"))
        choices.append(choice)
    return choices


def classify_node(node: dict) -> str:
    if node.get("is_start_node"):
        return "start"
    if node.get("is_ending"):
        et = (node.get("ending_type") or "").lower()
        if et.startswith("death"):
            return "death"
        if et.startswith("victory"):
            return "victory"
        if "secret" in et or "good" in et:
            return "secret"
        if et.startswith("sad") or et == "bad":
            return "sad"
        return "ending"
    return "scene"


def branch_type(node_id: str) -> str:
    return "transition" if node_id.startswith("trans_") else "critical"


def build_layout(nodes, edges):
    """Simple hierarchical layout: acts as columns, BFS levels as vertical order."""
    node_map = {n["id"]: n for n in nodes}
    adjacency = {n["id"]: [] for n in nodes}
    for e in edges:
        adjacency[e["source"]].append(e["target"])

    start_node_id = next((n["id"] for n in nodes if n.get("is_start_node")), None)
    levels = {n["id"]: 9999 for n in nodes}
    if start_node_id:
        levels[start_node_id] = 0
        queue = deque([start_node_id])
        while queue:
            cur = queue.popleft()
            for nxt in adjacency[cur]:
                if levels[nxt] > levels[cur] + 1:
                    levels[nxt] = levels[cur] + 1
                    queue.append(nxt)

    COLUMN_WIDTH = 260
    ROW_HEIGHT = 90
    ACT_OFFSET = {1: 0, 2: 1, 3: 2, 4: 3, 5: 4}

    positions = {}
    per_act_y = {}
    for node in sorted(nodes, key=lambda n: (n["act"], levels[n["id"]], n["id"])):
        act = node["act"]
        x = ACT_OFFSET.get(act, act - 1) * COLUMN_WIDTH
        idx = per_act_y.get(act, 0)
        y = idx * ROW_HEIGHT
        per_act_y[act] = idx + 1
        positions[node["id"]] = (x, y)

    return positions


def main():
    nodes = parse_nodes(BACKUP_DIR / "nodes_rows.sql")
    choices = parse_choices(BACKUP_DIR / "choices_rows.sql")

    edges = []
    for ch in choices:
        if not ch.get("target_node_id"):
            continue
        edges.append({
            "id": ch["id"],
            "source": ch["node_id"],
            "target": ch["target_node_id"],
            "label": ch.get("label", ""),
            "conditions": ch.get("conditions"),
            "effects": ch.get("effects"),
        })

    positions = build_layout(nodes, edges)

    achievement_to_nodes = {}
    for ch in choices:
        effects = ch.get("effects") or {}
        ach_id = effects.get("unlock_achievement")
        if ach_id:
            achievement_to_nodes.setdefault(ach_id, []).append(ch["target_node_id"])

    graph_nodes = {}
    for n in nodes:
        nid = n["id"]
        graph_nodes[nid] = {
            "id": nid,
            "act": n["act"],
            "type": classify_node(n),
            "branch_type": branch_type(nid),
            "title": n.get("title", ""),
            "location": n.get("location_name", ""),
            "is_ending": bool(n.get("is_ending")),
            "ending_type": n.get("ending_type"),
            "x": positions.get(nid, (0, 0))[0],
            "y": positions.get(nid, (0, 0))[1],
            "achievements": achievement_to_nodes.get(nid, []),
        }

    acts = sorted({n["act"] for n in nodes})

    graph = {
        "meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "backup": str(BACKUP_DIR),
            "node_count": len(nodes),
            "edge_count": len(edges),
            "act_count": len(acts),
        },
        "acts": acts,
        "nodes": graph_nodes,
        "edges": edges,
    }

    flutter_path = PROJECT_ROOT / "nemesis-flutter" / "assets" / "story_graph.json"
    web_path = PROJECT_ROOT / "nemesis-web" / "public" / "story_graph.json"

    flutter_path.parent.mkdir(parents=True, exist_ok=True)
    web_path.parent.mkdir(parents=True, exist_ok=True)

    json_str = json.dumps(graph, ensure_ascii=False, indent=2)
    flutter_path.write_text(json_str, encoding="utf-8")
    web_path.write_text(json_str, encoding="utf-8")

    print(f"Wrote {len(nodes)} nodes and {len(edges)} edges to:")
    print(f"  {flutter_path}")
    print(f"  {web_path}")


if __name__ == "__main__":
    main()
