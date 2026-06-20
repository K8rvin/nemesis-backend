#!/usr/bin/env python3
# ==========================================
# convert_node_images.py — привести PNG-картинки нод
# к единому landscape-формату и сконвертировать в WebP.
# ==========================================
#
# Запуск из корня nemesis-rpg:
#   python nemesis-backend/scripts/convert_node_images.py
#
# По умолчанию берёт PNG из nemesis-flutter/assets/images/nodes,
# ресайзит до max 1280x960 с сохранением пропорций (без upscale),
# сохраняет рядом как .webp и удаляет исходный .png.

import argparse
import os
from pathlib import Path
from PIL import Image


def parse_args():
    parser = argparse.ArgumentParser(
        description='Convert node PNG images to WebP of uniform landscape size.'
    )
    parser.add_argument(
        '--input-dir',
        type=str,
        default='nemesis-flutter/assets/images/nodes',
        help='Source folder with PNG files (default: nemesis-flutter/assets/images/nodes)',
    )
    parser.add_argument(
        '--output-dir',
        type=str,
        default=None,
        help='Output folder (default: same as input-dir)',
    )
    parser.add_argument(
        '--max-width',
        type=int,
        default=1280,
        help='Max width in pixels (default: 1280)',
    )
    parser.add_argument(
        '--max-height',
        type=int,
        default=960,
        help='Max height in pixels (default: 960)',
    )
    parser.add_argument(
        '--quality',
        type=int,
        default=90,
        help='WebP quality, 0-100 (default: 90)',
    )
    parser.add_argument(
        '--keep-source',
        action='store_true',
        help='Keep source PNG files after conversion',
    )
    return parser.parse_args()


def resize_to_fit(img: Image.Image, max_width: int, max_height: int) -> Image.Image:
    """Уменьшить изображение до заданных максимальных размеров,
    сохраняя пропорции. Upscale не выполняется."""
    width, height = img.size
    ratio = min(max_width / width, max_height / height, 1.0)
    if ratio == 1.0:
        return img
    new_width = int(width * ratio)
    new_height = int(height * ratio)
    return img.resize((new_width, new_height), Image.Resampling.LANCZOS)


def main():
    args = parse_args()
    input_dir = Path(args.input_dir).resolve()
    output_dir = Path(args.output_dir).resolve() if args.output_dir else input_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    if not input_dir.exists():
        print(f'[err] Folder not found: {input_dir}')
        return

    png_files = sorted(input_dir.glob('*.png'))
    if not png_files:
        print(f'[warn] No PNG files found in {input_dir}')
        return

    print(f'[images] Found {len(png_files)} PNG in {input_dir}')
    print(f'[config] Max size: {args.max_width}x{args.max_height}, WebP quality: {args.quality}')

    converted = 0
    skipped = 0

    for src_path in png_files:
        name = src_path.stem
        dst_path = output_dir / f'{name}.webp'

        if dst_path.exists() and dst_path.stat().st_mtime >= src_path.stat().st_mtime:
            print(f'  [skip] {dst_path.name} is up to date')
            skipped += 1
            continue

        try:
            with Image.open(src_path) as img:
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGBA')
                else:
                    img = img.convert('RGB')
                resized = resize_to_fit(img, args.max_width, args.max_height)
                resized.save(dst_path, 'WEBP', quality=args.quality, method=6)

            if not args.keep_source and output_dir == input_dir:
                os.remove(src_path)

            print(f'  [ok] {dst_path.name} ({resized.width}x{resized.height})')
            converted += 1
        except Exception as e:
            print(f'  [err] {src_path.name}: {e}')

    print(f'\n[done] Converted {converted}, skipped {skipped}.')


if __name__ == '__main__':
    main()
