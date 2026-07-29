# 周常试炼 ImageGen 提示词与重建记录

> 生成模式：内置 ImageGen。Boss 母版统一使用 `#00FF00` 绿幕，
> 由 `scripts/build-trial-assets.mjs` 调用 imagegen skill 的
> `remove_chroma_key.py --auto-key border --soft-matte --despill --edge-contract 1`
> 抠图。运行时资产不直接手修。

## 试炼场景

```text
Create a polished 2D anime mobile RPG battle background for the game “Sakura Legend”,
landscape 3:2 composition, no characters and no creatures. Scene: an ancient floating
mirror-trial arena at dawn, a wide circular pale-stone platform across the lower 44%
of the image, perfectly readable battle ground with generous empty space on the
lower-left for a player and lower-right for a large boss. In the distance, a giant
fractured crystal mirror gate suspended above clouds, delicate sakura branches and
drifting petals, icy-blue glass prisms, subtle gold trial runes embedded in the
platform, layered mountain silhouettes and luminous mist. Visual direction: fresh
cute premium Japanese fantasy, blue-white-sakura-pink palette, clean deep-blue
outlines, hand-painted 2D anime game background, luminous but not overexposed, crisp
silhouette separation, high-detail production art, soft atmospheric depth. Camera:
eye-level, slight low perspective, foreground platform not cropped, horizon in upper
middle, no strong focal object blocking actor positions. Lighting: cool cyan rim
light with soft pink sunrise, readable contrast under sprites. Absolutely no UI, no
text, no logo, no watermark, no frame, no split panels, no photorealism, no modern
objects. Opaque full-bleed background.
```

## 坚壳三元素母版

```text
Exactly THREE separate full-body Shell weekly-trial boss creatures on a perfectly
flat solid #00FF00 chroma background, evenly spaced left / center / right, facing
left, full feet and tails, shared baseline. LEFT: fire Ember-Shell Dragon, obsidian
plates and magma seams. CENTER: ice Frost-Devouring Shadow, crystalline bear-wolf
guardian with chunky cyan ice armor. RIGHT: thunder Thunder-Scale Mountain Warden,
stocky qilin/tortoise-dragon with indigo-gold shell and violet crystals. Polished
2D anime mobile RPG boss sprites, clean deep-blue outlines, cel shading, readable
at 160px. No scenery, floor, labels, text, UI, frame, watermark or cropped parts.
```

## 幻影三元素母版

```text
Exactly THREE separate full-body Mirage weekly-trial boss creatures on a perfectly
flat solid #00FF00 chroma background, evenly spaced left / center / right, facing
left, full extremities, shared baseline. LEFT: fire mystical moth/firefly beast
with coral amber wing shells. CENTER: ice crystalline owl-griffin with white-cyan
feather plates and ice fan tail. RIGHT: thunder sleek panther-kirin with indigo body,
gold horn armor and compact violet lightning. Polished 2D anime mobile RPG boss
sprites, clean chunky edges for chroma extraction. No scenery, floor, labels, text,
UI, frame, watermark or cropped parts.
```

## 狂怒三元素母版

```text
Exactly THREE separate full-body Fury weekly-trial boss creatures on a perfectly
flat solid #00FF00 chroma background, evenly spaced left / center / right, facing
left, full extremities, shared baseline. LEFT: fire Crimson-Flame Rage-Tusk, a huge
boar-lion beast with charcoal hide, coral flame mane and ivory tusks. CENTER: ice
Rime-Fang Shatterfrost, a giant saber-toothed frost wolf matching
“狂怒·凛牙碎寒”, blue-white plated fur shapes and cyan ice fangs. RIGHT: thunder
Rushing-Thunder Sky-Ripper, indigo winged wyvern with gold armor and violet crystals.
Polished 2D anime mobile RPG boss sprites, clean deep-blue outlines, cel shading,
readable at 160px. No scenery, floor, labels, text, UI, frame, watermark or crop.
```

## 运行时映射

- `shell / mirage / fury`：本周词条倾向。
- `fire / ice / thunder`：Boss 元素。
- 9 个组合均有独立立绘；不存在未知组合的占位图兜底。
