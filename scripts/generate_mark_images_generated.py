#!/usr/bin/env python3
"""
Генерирует SQL-миграцию, которая отмечает image_generated = TRUE
для всех нод, у которых есть локальная картинка в Flutter-assets.

Использование:
    python scripts/generate_mark_images_generated.py

Результат:
    migrations/007_mark_images_generated.sql
"""

from pathlib import Path

# Пути относительно корня nemesis-backend/
BACKEND_ROOT = Path(__file__).resolve().parent.parent
IMAGES_DIR = BACKEND_ROOT.parent / "nemesis-flutter" / "assets" / "images" / "nodes"
OUTPUT_SQL = BACKEND_ROOT / "migrations" / "007_mark_images_generated.sql"


def main():
    if not IMAGES_DIR.exists():
        raise FileNotFoundError(f"Папка с изображениями не найдена: {IMAGES_DIR}")

    node_ids = set()
    for img in IMAGES_DIR.iterdir():
        if img.is_file() and img.suffix.lower() in {".webp", ".png", ".jpg", ".jpeg"}:
            node_ids.add(img.stem)

    if not node_ids:
        print("Не найдено изображений.")
        return

    sorted_ids = sorted(node_ids)
    values = ",\n  ".join(f"'{nid}'" for nid in sorted_ids)

    sql = f"""-- Автоматически сгенерированная миграция.
-- Отмечает image_generated = TRUE для всех нод, у которых есть
-- локальная картинка в nemesis-flutter/assets/images/nodes/.

UPDATE public.nodes
SET image_generated = TRUE
WHERE id IN (
  {values}
);
"""

    OUTPUT_SQL.write_text(sql, encoding="utf-8")
    print(f"Сгенерирован {OUTPUT_SQL}")
    print(f"Нод с картинками: {len(sorted_ids)}")


if __name__ == "__main__":
    main()
