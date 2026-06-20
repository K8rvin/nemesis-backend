#!/usr/bin/env python3
# ==========================================
# 🖼️ convert_achievement_images.py — привести PNG-картинки достижений
# к единому квадратному размеру и сконвертировать в WebP.
# ==========================================
#
# Запуск из корня nemesis-rpg:
#   python nemesis-backend/scripts/convert_achievement_images.py
#
# По умолчанию берёт PNG из nemesis-flutter/assets/images/achievements,
# ресайзит до 1024x1024 (center crop, сохраняя пропорции),
# сохраняет рядом как .webp и удаляет исходный .png.

import argparse
import os
from pathlib import Path
from PIL import Image


def parse_args():
    parser = argparse.ArgumentParser(
        description='Convert achievement PNG images to WebP of uniform size.'
    )
    parser.add_argument(
        '--input-dir',
        type=str,
        default='nemesis-flutter/assets/images/achievements',
        help='Source folder with PNG files (default: nemesis-flutter/assets/images/achievements)',
    )
    parser.add_argument(
        '--output-dir',
        type=str,
        default=None,
        help='Output folder (default: same as input-dir)',
    )
    parser.add_argument(
        '--size',
        type=int,
        default=1024,
        help='Target square side size (default: 1024)',
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


def resize_to_square(img: Image.Image, size: int) -> Image.Image:
    """Привести изображение к квадрату: center crop + resize."""
    width, height = img.size
    if width == height:
        return img.resize((size, size), Image.Resampling.LANCZOS)

    # Минимальная сторона — чтобы обрезать по центру
    min_side = min(width, height)
    left = (width - min_side) // 2
    top = (height - min_side) // 2
    right = left + min_side
    bottom = top + min_side
    cropped = img.crop((left, top, right, bottom))
    return cropped.resize((size, size), Image.Resampling.LANCZOS)


def main():
    args = parse_args()
    input_dir = Path(args.input_dir).resolve()
    output_dir = Path(args.output_dir).resolve() if args.output_dir else input_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    if not input_dir.exists():
        print(f'❌ Папка не найдена: {input_dir}')
        return

    png_files = sorted(input_dir.glob('*.png'))
    if not png_files:
        print(f'⚠️ В {input_dir} не найдено PNG-файлов.')
        return

    print(f'[images] Found {len(png_files)} PNG in {input_dir}')
    print(f'[config] Target size: {args.size}x{args.size}, WebP quality: {args.quality}')

    converted = 0
    skipped = 0

    for src_path in png_files:
        name = src_path.stem
        dst_path = output_dir / f'{name}.webp'

        # Если webp уже существует и новее PNG — пропускаем
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
                square = resize_to_square(img, args.size)
                square.save(dst_path, 'WEBP', quality=args.quality, method=6)

            if not args.keep_source and output_dir == input_dir:
                os.remove(src_path)

            print(f'  [ok] {dst_path.name}')
            converted += 1
        except Exception as e:
            print(f'  [err] {src_path.name}: {e}')

    print(f'\n[done] Converted {converted}, skipped {skipped}.')


if __name__ == '__main__':
    main()
