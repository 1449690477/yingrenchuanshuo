# 洗练材料与特效生产记录

生成日期：2026-07-28

生成方式：Codex 内置 `image_gen`，每个不同资产单独调用一次；生成纯 `#00ff00` 绿幕源图，再使用 imagegen skill 自带的 `remove_chroma_key.py` 抠图。

参考素材：

- `public/assets/items/stone_reforge.png`
- `public/assets/items/charm_protect.png`
- `public/assets/effects/forge/icon-gleam.png`
- `public/assets/effects/forge/icon-radiant.png`
- `public/assets/effects/forge/icon-sakura.png`
- `public/assets/effects/forge/icon-starforged.png`

## sand_crystal

源图：`art-source/reforge/sand_crystal-chroma.png`

成品：`public/assets/items/sand_crystal.png`

```text
Use case: stylized-concept
Asset type: square mobile RPG material icon, source for chroma-key extraction
Input images: stone_reforge.png and charm_protect.png are style references only; match their polished anime mobile-game rendering, blue-white-pink palette, gold accents, crisp silhouette, gemlike highlights, and centered presentation, without copying their shapes.
Primary request: create the material icon “凝晶砂” — a small elegant mound of pale icy-blue crystalline fine sand, with several distinct translucent crystal grains and a few tiny white-blue magical glints rising immediately above it. It should read clearly as precious alchemical sand at small size.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background.
Style/medium: polished 2D anime fantasy game-item illustration, clean hand-painted shading, luminous faceted crystals, refined light-blue and white tones.
Composition/framing: one isolated subject centered, near-square compact silhouette, generous padding on all four sides, nothing cropped.
Lighting/mood: bright, clean, delicate magical shimmer contained close to the object.
Constraints: background must be exactly one uniform #00ff00 color with no gradients, texture, lighting variation, floor plane, halo, reflections, cast shadow, or contact shadow. Keep subject fully separated from background with crisp edges. Do not use #00ff00 or green anywhere in the subject. No text, letters, numbers, logo, border, watermark, UI frame, or additional objects.
```

参考图：`stone_reforge.png`、`charm_protect.png`

## charm_bind

源图：`art-source/reforge/charm_bind-chroma.png`

成品：`public/assets/items/charm_bind.png`

```text
Use case: stylized-concept
Asset type: square mobile RPG material icon, source for chroma-key extraction
Input images: charm_protect.png and stone_reforge.png are style references only; match their polished anime mobile-game rendering, blue-white-pink palette, gold edging, clean silhouette, and centered presentation, without copying their exact design.
Primary request: create the material icon “定契符” — one elegant folded white-and-blush-pink magical talisman paper, bound securely by a soft pink ribbon tied around its middle, with a small gold sakura-shaped contract seal and fine decorative gold filigree. It should instantly read as a precious binding-contract charm.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background.
Style/medium: polished 2D anime fantasy game-item illustration, clean hand-painted shading, ivory paper, pink ribbon, subtle pale-blue gem highlight, refined gold trim.
Composition/framing: one isolated compact subject centered, slightly three-quarter view, generous padding on all four sides, nothing cropped.
Lighting/mood: bright, charming, magical, soft contained highlights only.
Constraints: use only abstract decorative sigil lines and sakura motifs; no readable writing or characters. Background must be exactly one uniform #00ff00 color with no gradients, texture, lighting variation, floor plane, halo, reflection, cast shadow, or contact shadow. Keep subject fully separated from background with crisp edges. Do not use #00ff00 or green anywhere in the subject. No text, letters, numbers, logo, border, watermark, UI frame, hand, or additional objects.
```

参考图：`charm_protect.png`、`stone_reforge.png`

## reforge-swirl

源图：`art-source/reforge/reforge-swirl-chroma.png`

成品：`public/assets/effects/reforge/reforge-swirl.png`

```text
Use case: stylized-concept
Asset type: square mobile RPG reforging visual-effect sprite, source for chroma-key extraction
Input images: icon-radiant.png and icon-starforged.png are style references only; match their polished anime-game energy-ring rendering, crisp radial symmetry, fine magical filaments, luminous blue/purple color separation, and transparent-center composition, without copying their exact motifs.
Primary request: create “重铸漩涡” — one circular pink-and-icy-blue double-spiral energy ring, made from two intertwined magical ribbons rotating around an open center. Add a small number of sharp white star glints and short controlled energy wisps attached closely to the ring. The effect should communicate reforging, circulation, and transformation.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background, visible both outside the ring and through the fully open center.
Style/medium: polished 2D anime fantasy VFX sprite, luminous painterly energy, clean bright cores, blue and pink outer glow, crisp readable silhouette at UI size.
Composition/framing: one isolated circular effect centered, near-perfect radial balance, open center, generous even padding, nothing cropped.
Lighting/mood: energetic but elegant; concentrated glow remains attached to the ring.
Constraints: background must be exactly one uniform #00ff00 color with no gradients, texture, lighting variation, floor plane, haze, reflection, cast shadow, or contact shadow. Do not place a glow wash across the green background. Keep all particles close to the effect. Do not use #00ff00 or green in the effect. No text, letters, numbers, logo, border, watermark, UI frame, weapon, character, or extra object.
```

参考图：`icon-radiant.png`、`icon-starforged.png`

## tier-up-burst

源图：`art-source/reforge/tier-up-burst-chroma.png`

成品：`public/assets/effects/reforge/tier-up-burst.png`

```text
Use case: stylized-concept
Asset type: square mobile RPG reforging visual-effect sprite, source for chroma-key extraction
Input images: icon-gleam.png and icon-sakura.png are style references only; match their polished anime-game VFX rendering, precise star points, delicate gold ornament, luminous white cores, and clean radial composition, without copying the circular wreath design.
Primary request: create “升阶爆闪” — a brilliant gold-and-white tier-up starburst: one large faceted eight-point white star at the center, layered with a compact warm-gold radial burst, several shorter razor-thin rays, and a restrained halo of tiny gold sparkles. The effect should clearly communicate a rare quality upgrade and triumphant breakthrough.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background.
Style/medium: polished 2D anime fantasy VFX sprite, crisp luminous star geometry, white-hot center, pale gold and champagne-gold rays, refined high-rarity game effect.
Composition/framing: one isolated radial burst perfectly centered, symmetrical, all rays fully visible, generous even padding, nothing cropped.
Lighting/mood: celebratory, precious, instantaneous flash; glow stays concentrated around the starburst.
Constraints: background must be exactly one uniform #00ff00 color with no gradients, texture, lighting variation, floor plane, haze, reflection, cast shadow, or contact shadow. Do not place a full-frame light wash over the green background. Keep particles close to the burst. Do not use #00ff00 or green in the effect. No text, letters, numbers, logo, border, watermark, UI frame, object, or character.
```

参考图：`icon-gleam.png`、`icon-sakura.png`

## lock-seal

源图：`art-source/reforge/lock-seal-chroma.png`

成品：`public/assets/effects/reforge/lock-seal.png`

```text
Use case: stylized-concept
Asset type: square mobile RPG reforging visual-effect sprite, source for chroma-key extraction
Input images: icon-sakura.png and icon-gleam.png are style references only; match their polished anime-game circular VFX rendering, refined radial symmetry, delicate ornaments, crisp light cores, and open-center composition, without copying their exact design.
Primary request: create “锁定封印圈” — one elegant pink-and-gold contract sigil ring: two fine concentric magic circles connected by four small sakura-shaped gold seals, short geometric covenant marks, and restrained pale-pink luminous threads. Add a subtle small diamond-shaped lock emblem at the top of the ring, but keep the center largely open and transparent-looking. It should communicate locking selected affixes under a magical contract.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background, visible outside the circle and through its open center.
Style/medium: polished 2D anime fantasy VFX sprite, fine gold linework, rose-pink magical light, ivory-white highlights, clean mobile-game readability.
Composition/framing: one isolated circular seal centered, near-perfect symmetry, open center, generous even padding, nothing cropped.
Lighting/mood: protective, precise, precious, contractual rather than aggressive.
Constraints: use only abstract rune-like geometry and floral motifs, no readable alphabet or characters. Background must be exactly one uniform #00ff00 color with no gradients, texture, lighting variation, floor plane, haze, reflection, cast shadow, or contact shadow. Do not place a glow wash across the green background. Keep particles and glow attached closely to the ring. Do not use #00ff00 or green in the effect. No text, letters, numbers, logo, border, watermark, UI frame, character, or extra object.
```

参考图：`icon-sakura.png`、`icon-gleam.png`

## 后处理命令

每张源图分别执行以下命令，将输入输出路径替换成上文对应路径：

```powershell
python 'C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py' `
  --input '<chroma-source.png>' `
  --out '<final.png>' `
  --auto-key border `
  --soft-matte `
  --transparent-threshold 12 `
  --opaque-threshold 220 `
  --despill
```

内置生成结果的绿幕边界会有极轻微色值波动。为让留档源图的背景严格等于 `#00ff00`，先用上述命令取得完整分辨率 RGBA 抠图，再按以下方式重新铺到纯绿背景：

```python
from PIL import Image

with Image.open("<full-size-rgba.png>") as image:
    foreground = image.convert("RGBA")
    chroma = Image.new("RGBA", foreground.size, (0, 255, 0, 255))
    chroma.alpha_composite(foreground)
    chroma.convert("RGB").save("<chroma-source.png>", optimize=True, compress_level=9)
```

使用 Pillow `Image.Resampling.LANCZOS` 将材料缩放为 `256×256`、特效缩放为 `512×512`，统一转成 `RGBA`，并以 `optimize=True, compress_level=9` 保存。为给 250 KB 特效门禁留足空间，三个特效的 RGB 通道另做无感知的 6 bit 级量化（每通道步长 4），Alpha 通道保持原始 8 bit。
