#!/usr/bin/env python3
"""复刻 CharacterAppearance.vue 的 CSS 叠层逻辑，离线渲染换装预览拼图。

叠层顺序（底 -> 顶，与组件 z-index/DOM 顺序一致）：
  1. base (z1)；若 body 为 replacement，则 base 被替换
  2. body 层 (z3)
  3. catkin 的 head 层 (z3，DOM 位于 body 之后 -> 压 body)
  4. shoes 层 (z4)
  5. face-layer (z4，DOM 最后 -> 压 shoes)：base 图按职业椭圆裁剪重绘
  6. head 层（非 catkin，z5）
  7. weapon 层 (z6)
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent / 'public' / 'assets' / 'characters' / 'modular'
OUT = Path(__file__).resolve().parent.parent / 'tmp' / 'appearance-preview'

CLASSES = ['swordsman', 'witch', 'shaman', 'catkin']
# clip-path: ellipse(rx ry at x y)，rx 相对宽、ry 相对高（百分比）
FACE = {
    'swordsman': (52.0, 10.0, 19.0, 9.0),
    'witch': (50.0, 10.0, 18.0, 8.8),
    'shaman': (50.0, 10.0, 17.0, 8.8),
    'catkin': (50.0, 9.7, 18.5, 9.3),
}
W, H = 640, 960

SHOP_THEMES = ['berry-cream', 'moon-sugar', 'rose-night']
DUNGEON_TIERS = ['azure', 'violet', 'auric', 'crimson']
REGIONS = ['r1', 'r2']


def load(path: Path) -> Image.Image:
    im = Image.open(path).convert('RGBA')
    if im.size != (W, H):
        im = im.resize((W, H), Image.LANCZOS)
    return im


def face_overlay(class_id: str, base: Image.Image) -> Image.Image:
    """face-layer：base 图按职业椭圆裁剪后的重绘层。"""
    fx, fy, rx, ry = FACE[class_id]
    mask = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(mask)
    cx, cy = fx / 100 * W, fy / 100 * H
    rw, rh = rx / 100 * W, ry / 100 * H
    d.ellipse([cx - rw, cy - rh, cx + rw, cy + rh], fill=255)
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    out.paste(base, (0, 0), mask)
    return out


def compose(class_id: str, body=None, head=None, shoes=None, weapon=None,
            body_mode='layer', head_above_face=False) -> Image.Image:
    """与修复后的组件逻辑一致：

    - 可见鞋层装备时换用 base-noshoes 底模（整身替换优先）
    - 商店帽 aboveFace=True：喵喵也压到脸层之上
    - 区域鞋与副本鞋都使用重新对位后的独立鞋层
    """
    noshoes = ROOT / class_id / 'base-noshoes.png'
    use_noshoes = shoes is not None and body_mode != 'replacement' and noshoes.exists()
    base = load(noshoes if use_noshoes else ROOT / class_id / 'base.png')
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    face_src = base
    if body is not None and body_mode == 'replacement':
        canvas.alpha_composite(body)
        face_src = body  # replacement 替换底模后，脸层重绘的是新底模
    else:
        canvas.alpha_composite(base)
        if body is not None:
            canvas.alpha_composite(body)
    if class_id == 'catkin' and head is not None and not head_above_face:
        canvas.alpha_composite(head)
    if shoes is not None:
        canvas.alpha_composite(shoes)
    canvas.alpha_composite(face_overlay(class_id, face_src))
    if head is not None and (class_id != 'catkin' or head_above_face):
        canvas.alpha_composite(head)
    if weapon is not None:
        canvas.alpha_composite(weapon)
    return canvas


def sheet(cells: list[tuple[str, Image.Image]], path: Path, cols: int = 4,
          cell_w: int = 320, label_h: int = 34) -> None:
    cell_h = int(cell_w * H / W) + label_h
    rows = (len(cells) + cols - 1) // cols
    img = Image.new('RGB', (cols * cell_w, rows * cell_h), (24, 26, 34))
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 16)
    except OSError:
        font = ImageFont.load_default()
    for i, (label, im) in enumerate(cells):
        x, y = (i % cols) * cell_w, (i // cols) * cell_h
        thumb = im.resize((cell_w, cell_h - label_h), Image.LANCZOS)
        bg = Image.new('RGBA', thumb.size, (58, 62, 78, 255))
        bg.alpha_composite(thumb)
        img.paste(bg.convert('RGB'), (x, y + label_h))
        draw.text((x + 6, y + 8), label, fill=(240, 240, 245), font=font)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)
    print('saved', path)


def shop_layer(theme: str, class_id: str, slot: str) -> Image.Image | None:
    p = ROOT / 'shop' / theme / f'{class_id}-{slot}.png'
    return load(p) if p.exists() else None


def dungeon_layer(tier: str, class_id: str, slot: str) -> Image.Image | None:
    p = ROOT / 'dungeon' / tier / f'{class_id}-{slot}.png'
    return load(p) if p.exists() else None


def region_layer(region: str, class_id: str, slot: str) -> Image.Image | None:
    p = ROOT / class_id / f'{region}-{slot}.png'
    return load(p) if p.exists() else None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--group', default='all',
                    choices=['all', 'shop-single', 'shop-full', 'dungeon', 'region', 'cat-head'])
    args = ap.parse_args()

    if args.group in ('all', 'shop-single'):
        # 每个商店主题 × 每类部件 × 每角色：单件试穿（含 cardboard-cat）
        for theme in SHOP_THEMES + ['cardboard-cat']:
            for slot in ['body', 'head', 'shoes', 'weapon']:
                cells = []
                for c in CLASSES:
                    layer = shop_layer(theme, c, slot)
                    if layer is None:
                        continue
                    mode = 'replacement' if (theme == 'cardboard-cat' and slot == 'body') else 'layer'
                    kw = {slot: layer}
                    cells.append((f'{c} · {slot}', compose(
                        c, body_mode=mode, head_above_face=(slot == 'head'), **kw)))
                if cells:
                    sheet(cells, OUT / f'shop-single-{theme}-{slot}.png')

    if args.group in ('all', 'shop-full'):
        # 每主题整套 × 每角色
        for theme in SHOP_THEMES:
            cells = []
            for c in CLASSES:
                cells.append((f'{c} · {theme} 整套', compose(
                    c,
                    body=shop_layer(theme, c, 'body'),
                    head=shop_layer(theme, c, 'head'),
                    head_above_face=True,
                    shoes=shop_layer(theme, c, 'shoes'),
                    weapon=shop_layer(theme, c, 'weapon'),
                )))
            sheet(cells, OUT / f'shop-full-{theme}.png')
        cells = [('catkin · cardboard-cat 整套', compose(
            'catkin',
            body=shop_layer('cardboard-cat', 'catkin', 'body'),
            body_mode='replacement',
            weapon=shop_layer('cardboard-cat', 'catkin', 'weapon'),
        ))]
        sheet(cells, OUT / 'shop-full-cardboard-cat.png', cols=1)

    if args.group in ('all', 'dungeon'):
        for tier in DUNGEON_TIERS:
            cells = []
            for c in CLASSES:
                cells.append((f'{c} · {tier}', compose(
                    c,
                    body=dungeon_layer(tier, c, 'body'),
                    body_mode='replacement',
                    head=dungeon_layer(tier, c, 'head'),
                    shoes=dungeon_layer(tier, c, 'shoes'),
                    weapon=dungeon_layer(tier, c, 'weapon'),
                )))
            sheet(cells, OUT / f'dungeon-{tier}.png')

    if args.group in ('all', 'region'):
        for region in REGIONS:
            cells = []
            for c in CLASSES:
                cells.append((f'{c} · {region}', compose(
                    c,
                    body=region_layer(region, c, 'body'),
                    head=region_layer(region, c, 'head'),
                    shoes=region_layer(region, c, 'shoes'),
                    weapon=region_layer(region, c, 'weapon'),
                )))
            sheet(cells, OUT / f'region-{region}.png')

    if args.group in ('all', 'cat-head'):
        # 头部特写：帽子问题的直接证据
        cells = []
        for theme in SHOP_THEMES:
            for c in CLASSES:
                head = shop_layer(theme, c, 'head')
                if head is None:
                    continue
                im = compose(c, head=head, head_above_face=True)
                cells.append((f'{c} · {theme} 帽', im.crop((120, 0, 520, 400)).resize((320, 320))))
        sheet(cells, OUT / 'cat-head-shop.png', cell_w=320, label_h=34)


if __name__ == '__main__':
    main()
