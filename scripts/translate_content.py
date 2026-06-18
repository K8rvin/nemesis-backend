#!/usr/bin/env python3
# ==========================================
# 🌐 Автоматический перевод content_ru.json -> content_en.json
# ==========================================
# Использует Google Translate (deep-translator) с кэшем, чтобы можно было
# прервать и продолжить. Пустые строки и строки из пробелов пропускаются.

import json
import hashlib
import time
import os
import sys
import io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Добавляем путь к venv, если скрипт запущен без активации
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / '.venv' / 'Lib' / 'site-packages'))

from deep_translator import GoogleTranslator

DATA_DIR = ROOT / 'data'
RU_FILE = DATA_DIR / 'content_ru.json'
EN_FILE = DATA_DIR / 'content_en.json'
CACHE_FILE = DATA_DIR / 'translation_cache.json'

SLEEP_SECONDS = 0.15
CACHE_SAVE_EVERY = 50


def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def text_key(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()[:16]


def collect_leaf_paths(data, prefix=None):
    """Возвращает список кортежей (path, text) для всех строковых листьев."""
    items = []
    prefix = prefix or []
    if isinstance(data, dict):
        for k, v in data.items():
            items.extend(collect_leaf_paths(v, prefix + [k]))
    elif isinstance(data, list):
        for i, v in enumerate(data):
            items.extend(collect_leaf_paths(v, prefix + [str(i)]))
    elif isinstance(data, str):
        items.append((prefix, data))
    return items


def set_leaf(data, path, value):
    cur = data
    for part in path[:-1]:
        cur = cur[part]
    cur[path[-1]] = value


def translate_texts(texts, cache, translator, cache_path):
    results = []
    for idx, original in enumerate(texts, start=1):
        original = original.strip()
        if not original:
            results.append(original)
            continue

        key = text_key(original)
        if key in cache:
            results.append(cache[key])
            continue

        for attempt in range(1, 4):
            try:
                translated = translator.translate(original)
                break
            except Exception as e:
                print(f"Attempt {attempt} failed for '{original[:40]}...': {e}")
                time.sleep(attempt * 2)
                translated = None

        if translated is None:
            print(f"Giving up on: {original[:60]}...")
            translated = original

        cache[key] = translated
        results.append(translated)

        if idx % CACHE_SAVE_EVERY == 0:
            save_json(cache_path, cache)
            print(f"  ...saved cache after {idx}/{len(texts)}")

        time.sleep(SLEEP_SECONDS)
    return results


def main():
    if not RU_FILE.exists():
        print(f"❌ {RU_FILE} not found. Run export_content.mjs first.")
        sys.exit(1)

    print(f"⏳ Loading {RU_FILE}...")
    ru_data = load_json(RU_FILE)

    cache = load_json(CACHE_FILE) if CACHE_FILE.exists() else {}
    print(f"💾 Cache entries: {len(cache)}")

    paths, texts = zip(*collect_leaf_paths(ru_data)) if collect_leaf_paths(ru_data) else ([], [])
    total = len(texts)
    print(f"📝 Total strings to translate: {total}")

    translator = GoogleTranslator(source='ru', target='en')

    translated = translate_texts(texts, cache, translator, CACHE_FILE)

    en_data = {}
    # Копируем структуру ru_data
    def copy_structure(d):
        if isinstance(d, dict):
            return {k: copy_structure(v) for k, v in d.items()}
        if isinstance(d, list):
            return [copy_structure(v) for v in d]
        return ''

    en_data = copy_structure(ru_data)
    for path, value in zip(paths, translated):
        set_leaf(en_data, path, value)

    save_json(EN_FILE, en_data)
    save_json(CACHE_FILE, cache)

    print(f"✅ Translated {total} strings. Saved to {EN_FILE}")
    print(f"💾 Cache saved to {CACHE_FILE} ({len(cache)} entries)")


if __name__ == '__main__':
    main()
