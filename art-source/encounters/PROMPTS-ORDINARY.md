# 普通奇遇 Galgame 横景提示词

## 生产约束

- 生成方式：Codex 内置 `image_gen`，每张不同素材单独生成。
- 用途：手机竖屏 Galgame 奇遇窗口中的 3:2 横向环境底图。
- 风格参考（仅参考笔触、色彩与精度，不复刻构图或物件）：
  - `public/assets/affection/scenes/swordsman-training-dawn.webp`
  - `public/assets/affection/scenes/witch-atelier-spark.webp`
- 源文件：`art-source/encounters/scenes/ordinary/<slug>-source.png`
- 运行时：`public/assets/encounters/scenes/ordinary/<slug>.webp`
- 运行时规格：严格 `1536×1024`、无 Alpha、WebP quality 82、单张不超过 520 KB。

## 公共母提示

```text
Use case: stylized-concept
Asset type: production Galgame encounter background for a mobile 2D Japanese fantasy RPG, 3:2 landscape, final delivery will be 1536x1024
Input images: Image 1 and Image 2 are style references only. Match their polished 2D Japanese mobile-game environment rendering, softly painted cel-shaded detail, luminous pastel atmosphere, clean readable depth, and refined fantasy material treatment. Do not copy their composition, buildings, furniture, or specific motifs.
Style/medium: premium 2D Japanese mobile game background illustration, fresh and cute, rounded fantasy design, soft cel-shaded painting, delicate but uncluttered, gentle blue-white-sakura-pink palette with restrained warm-gold accents, clearly illustrated rather than photographic.
Composition/framing: wide 3:2 establishing view at eye level. Keep every story prop and bright focal point in the left and center 62%. Reserve the rightmost about 38% as a calm, low-detail, low-contrast staging zone for a character sprite and dialogue UI. The right staging zone may contain only low ground cover, distant scenery, and open sky; no tall foreground object or bright focal point. Preserve foreground, midground, and background depth while remaining readable on a 390px-wide phone.
Constraints: environment and still-life props only. Absolutely no human, no character, no face, no body part, no hand, no silhouette, no humanoid reflection, no crowd, no animal, no bird, no insect, no mascot. No readable text, letters, numbers, runes, glyphs, signage, logo, watermark, UI, frame, border, speech bubble, or photo realism. No horror, deity, idol, doll, character-shaped statue, face-like motif, or anthropomorphic prop. One clean standalone background image.
```

## 1. `r1-bell-path`

```text
Primary request: an empty flower path outside a peaceful fantasy town, centered on a small open-sided prayer-bell pavilion that tells the story of a lost wind chime and a bell sound guiding the way.
Scene/backdrop: spring countryside at a quiet fork in the path; pale stone steps curve in from the lower left toward the pavilion; white and blush-pink flowers and drifting petals; several small blue glass wind chimes hang under the pavilion eaves and catch tiny blue points of light; a second quiet road recedes toward distant pastel hills and soft blue sky. The pavilion contains only abstract decorative marks, never writing.
Subject: the wordless bell pavilion, wind chimes, stone steps, and a clearly readable tranquil crossroads, all inside the left and center 62%.
Lighting/mood: bright late-morning spring light, airy and reassuring, soft bloom and a few subtle magical blue glints.
Right staging zone: simple flower meadow, soft sky, and low-detail path edge only.
Additional avoid: no shrine deity, no character-shaped statue, no writing-like plaque.
```

## 2. `r1-barrier-glade`

```text
Primary request: an empty spring forest barrier glade whose environment tells the story of a small magical ward that has just broken, gentle and hopeful rather than dangerous.
Scene/backdrop: open circular clearing in a fresh spring woodland; a low weathered stone dais sits in the left-center; across it lies a snapped braided charm cord with several completely blank paper-like tabs; soft blue and sakura-pink concentric barrier lines glow across the moss and stone; a few petals and tiny light motes drift through sunbeams; pale blossoms, ferns, and slender trees create layered depth.
Subject: the low stone dais, clearly broken wordless charm cord, and smooth blue-pink ward glow, all inside the left and center 62%.
Lighting/mood: warm spring afternoon shafts of light, serene magical relief, friendly and bright.
Right staging zone: low moss, sparse petals, soft grass, and an open patch of glowing air only.
Additional avoid: the blank tabs contain no marks; no letters, numbers, runes, occult writing, horror, blood, skulls, or threatening thorns.
```

初稿右边缘残留高树干和偏亮光斑，正式源图在查看初稿后使用下面的单点修订提示完成：

```text
Use case: precise-object-edit
Asset type: production Galgame encounter background for a mobile 2D Japanese fantasy RPG, 3:2 landscape
Input image: Image 1 is the edit target.
Primary request: change only the rightmost 38% of Image 1 to make it a genuinely calm character-sprite and dialogue-UI staging zone.
Required edit: remove the tall tree trunk at the far right edge, remove the strong white sunbeam and bright hotspot from the upper-right, and simplify that right zone into low moss, sparse soft grass, a few tiny pale petals, distant slender tree shapes with very low contrast, and a gentle even blue-pink ambient glow. Keep the right side open, quiet, lower-detail, lower-contrast, and slightly dimmer than the left-center focal area.
Invariants: preserve the entire left and center 62% exactly in subject and composition: the low broken stone dais, snapped braided charm cord, completely blank paper tabs, blue and sakura-pink barrier circles, moss, flowers, and forest depth. Do not move, add, remove, recolor, crop, or redesign any of those story elements. Preserve the same premium 2D Japanese mobile-game background style, soft cel-shaded painting, fresh blue-white-sakura-pink palette, and 3:2 framing.
Constraints: environment only. Absolutely no human, no character, no face, no body part, no hand, no silhouette, no humanoid reflection, no crowd, no animal, no bird, no insect, no mascot. No readable text, letters, numbers, runes, glyphs, occult writing, signage, logo, watermark, UI, frame, border, speech bubble, or photo realism. The paper tabs stay blank. No tall foreground object, bright focal point, or high-contrast effect in the rightmost 38%.
```

## 3. `r2-honey-tea`

```text
Primary request: an empty grassland afternoon-tea scene outside a whimsical honeycomb-shaped stone-and-wood archway, telling a small mystery through two untouched cups and one conspicuously missing coaster position.
Scene/backdrop: sunny highland meadow with low pastel wildflowers and rolling blue-green hills; a tasteful open arch built from warm pale stone and light wood with abstract hexagonal honeycomb geometry; a small round tea table sits in the left-center under the arch shade; two delicate cups of amber honey tea, a tiny glass honey jar, a simple covered sugar bowl, and a little flower sprig; one cup sits on a pale blue coaster while the other cup has an obvious empty coaster-shaped gap beside it. A soft cloth picnic napkin folds over one side of the table.
Subject: the tea table, two honey-tea cups, single coaster plus obvious missing coaster position, honey jar, and honeycomb-shaped arch, all inside the left and center 62%.
Lighting/mood: gentle late-afternoon sunshine, cozy and cheerful, soft breeze in the grass, mild magical sparkle only around the tea glass.
Right staging zone: low grass, soft flower field, distant hills, and open sky only.
Additional avoid: no bee, honeybee, insect, butterfly, creature icon, creature-shaped decoration, character-shaped chair, face-like motif, or anthropomorphic teapot.
```

## 4. `r2-altar-echo`

首稿因夕阳主光落在最右侧、会与立绘争夺焦点而废弃；正式稿采用下面的收紧版构图提示。

```text
Primary request: an empty ancient crystal altar on a bright grassland at sunset, showing a mysterious echo phenomenon and one clearly missing crystal from the altar, but remaining cute, gentle, and inviting.
Scene/backdrop: rolling spring grassland with soft waves of grass and tiny pastel flowers; an old low oval altar of pale stone stands entirely in the left-center, weathered and partially softened by moss; several small faceted blue and pink crystals are set around its rim; one conspicuous empty faceted socket in the front-left altar rim shows that a crystal is missing; thin translucent blue-pink ripple rings rise above the altar like visible sound echoes, made only from smooth abstract light bands without runes; a few small prism motes appear above the altar only; distant hills fade to lavender.
Subject: the ancient low crystal altar, the empty faceted crystal socket, and soft blue-pink echo rings. Keep every magical effect, crystal, bright point, and story prop inside the left and center 58%.
Composition/framing: the sun itself is completely outside the frame on the upper-left, so warm light enters from off-frame left. Reserve the entire rightmost 42% as a deliberately subdued staging zone: only low lavender-tinted grass waves, faint distant hills, and a smooth pale pink-blue sky gradient; significantly lower contrast, lower saturation, lower detail, and lower brightness than the altar side. No sun, sun disk, sunbeam, flare, bright cloud, glowing horizon, crystal, light mote, ring, tall object, foreground boulder, or visual focal point anywhere in that right staging zone.
Lighting/mood: soft pastel afterglow coming from off-frame left, gentle wonder, slightly mysterious yet comforting and bright, controlled magical bloom localized to the altar.
Additional avoid: no humanoid reflection inside crystals, runes, occult writing, ritual sacrifice, portal containing a figure, or face-like crystal.
```

## Sharp 转码命令

在仓库根目录执行：

```powershell
node -e "const sharp=require('sharp'); const fs=require('fs'); const path=require('path'); const slugs=['r1-bell-path','r1-barrier-glade','r2-honey-tea','r2-altar-echo']; Promise.all(slugs.map(async slug=>{const input=path.join('art-source','encounters','scenes','ordinary',slug+'-source.png'); const output=path.join('public','assets','encounters','scenes','ordinary',slug+'.webp'); await sharp(input).resize(1536,1024,{fit:'cover',position:'centre'}).flatten({background:'#ffffff'}).webp({quality:82,smartSubsample:true}).toFile(output); const m=await sharp(output).metadata(); console.log(slug,String(m.width)+'x'+String(m.height),m.hasAlpha?'alpha':'opaque',fs.statSync(output).size);}))"
```
