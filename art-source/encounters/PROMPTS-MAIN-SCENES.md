# 茜 / 穗主线奇遇 Galgame 横景提示词

## 生产说明

- 生成方式：Codex 内置 `image_gen`，六张不同场景分别单独调用。
- 用途：手机竖屏 Galgame 奇遇窗口中的 3:2 横向环境底图。
- 风格参考（只参考笔触、色彩、材质与精度，不复刻构图）：
  - `public/assets/affection/scenes/swordsman-training-dawn.webp`
  - `public/assets/affection/scenes/witch-atelier-spark.webp`
- 源文件：
  - `art-source/encounters/scenes/akane/<slug>-source.png`
  - `art-source/encounters/scenes/sui/<slug>-source.png`
- 运行时：
  - `public/assets/encounters/scenes/akane/<slug>.webp`
  - `public/assets/encounters/scenes/sui/<slug>.webp`
- 运行时规格：严格 `1536×1024`、无 Alpha、WebP quality 82、单张不超过 520 KB。
- 每个场景都与 `src/data/encounters.ts` 的 story、dialogue、choice 和 outcome 对照后生产。

下面每一张的**完整生成提示**由“公共母提示”与该场景的“场景提示”原样拼接组成，
两部分都必须放进对应的单次 `image_gen` 调用。修订过的三张还必须在初稿后继续执行
文末列出的精确编辑提示，最终源图以修订结果为准。

## 公共母提示

```text
Use case: stylized-concept
Asset type: production Galgame encounter background for a mobile 2D Japanese fantasy RPG, 3:2 landscape, final delivery 1536x1024.
Input images: Image 1 and Image 2 are style references only. Match their polished 2D Japanese mobile-game environment rendering, softly painted cel-shaded detail, luminous pastel atmosphere, clean readable depth, refined fantasy materials, and premium finish. Do not copy their composition, architecture, furniture, or exact motifs.
Style/medium: premium 2D Japanese mobile-game background illustration, fresh and cute, rounded fantasy design, soft cel-shaded painting, delicate but uncluttered, gentle blue-white-sakura-pink palette with restrained warm-gold accents, clearly illustrated rather than photographic.
Composition/framing: wide 3:2 establishing view at eye level. Keep every story prop, tall structure, strongest light, magical effect, and bright focal detail inside the left and center 62%. Reserve the rightmost about 38% as a calm low-detail low-contrast staging zone for a live character sprite and dialogue UI. The right staging zone may contain only low ground cover, softly receding path or distant scenery, and open pale sky; no tall foreground object or bright focal point. Preserve foreground, midground, and background depth and remain readable on a 390px-wide phone.
Constraints: environment and still-life props only. Absolutely no human, no character, no face, no body part, no hand, no silhouette, no humanoid reflection, no crowd, no animal, no bird, no insect, no mascot, no doll, no character-shaped statue. No readable text, letters, numbers, runes, glyphs, signage, label, logo, watermark, UI, frame, border, speech bubble, or photo realism. No horror. One clean standalone background image.
```

## 1. 茜 `petalsmith-road`

```text
Primary request: create the empty spring roadside work spot for the first Akane story episode, where a novice bladesmith has been struggling to choose a soft wrapping material for a new knife handle.
Scene/backdrop: a flower path bends around the outer edge of a small fantasy bladesmith workshop in the Sakura Barrier countryside. Pale stone path, low white and blush flowers, soft blue sky, distant pastel roofs and hills. A compact portable workbench and low stool sit entirely in the left-center. On the bench are a completely wordless wrinkled handle sketch, a small wooden mallet, one unfinished short-knife handle core, a shallow tray of stiff brown leather strips, and a separate coil of visibly softer pink-white woven wrapping beside a few sakura petals. The contrast between hard and soft material must read visually without labels. No completed blade and no person.
Lighting/mood: airy late-morning spring light, tender uncertainty but hopeful, soft bloom, a few subtle blue-pink magical motes localized near the soft wrapping material.
Right staging zone: only low flowers, quiet path edge, distant hills, and open pale sky; no tall foreground object or bright focal point.
Additional avoid: no completed weapon, no readable marks on the sketch.
```

叙事对应：第一幕请求柔软包柄材料；硬皮条与粉白软编带在左侧形成无文字对照。

## 2. 茜 `rejected-workbench`

```text
Primary request: create the empty hidden work corner for the second Akane story episode, behind a flower greenhouse, where a rejected handmade knife-handle prototype has been set down after its maker was told to dismantle it.
Scene/backdrop: the sheltered rear side of a bright fantasy glass flowerhouse beside a small bladesmith workshop. Flowerhouse glass panes and trailing pale blossoms occupy the far left; a low wooden repair bench and several terracotta flowerpots sit in the left-center. The emotional focal prop is a single unfinished short-knife handle prototype with a rounded soft pink-white wrapping, partly visible beside one flowerpot as if held tightly and then set down. Nearby are a completely wordless folded old-style handle template, a small wooden mallet, fine dismantling pliers, loose cord, and three simple wooden bell pieces that could become a lightweight tail charm. The prototype looks lovingly handmade and unconventional, not broken or dangerous. A closed workshop side door is visible only in the left background, with no plaque or writing.
Lighting/mood: softened late-afternoon light after disappointment, a quiet private corner that feels sad but safe and recoverable; gentle cool blue shadows and warm pink reflections through the glass.
Right staging zone: simple flagstone, low moss and flowers, distant soft workshop garden wall, and even pale ambient light only.
Additional avoid: no humanoid reflection in greenhouse glass; no weapon display, blood, or threatening mood.
```

叙事对应：第二幕花房后、被退回的粉白试作品、拆解工具与可改成尾坠的木铃。

## 3. 茜 `first-blade-gate`

```text
Primary request: create the empty Sakura Barrier gate setting for the third Akane story episode, where a novice bladesmith is about to present and test the first short blade she designed by herself. The live Akane sprite already holds that one unique first blade, so no blade or handle appears in the background.
Scene/backdrop: a quiet flower-lined approach to a graceful fantasy barrier gate at the edge of a pastel town. A low pale-stone testing plinth stands entirely in the left-center. A simple dark-blue ceremonial cloth lies upon the plinth with a subtle empty resting impression. On it are a closed plain navy-blue empty scabbard, a completely blank oval metal name token, one unused faceted blue barrier crystal socket, and a few petals. The scabbard is non-glowing and has no visible blade, handle, guard, cord, tag, writing, or emblem. Behind the plinth, a translucent blue-pink barrier arc glows between two low gate posts, using only smooth abstract light bands with no runes. The road continues beyond toward soft hills.
Lighting/mood: clear early-evening spring light, ceremonial but intimate, a proud hopeful turning point; soft off-frame-left golden light and controlled blue-pink magical bloom localized near the barrier crystal and gate.
Right staging zone: only low pale grass, quiet flower edge, distant hills, and open blue-pink sky; no gate post, blade, crystal, or focal point.
Additional avoid: no blade, knife, sword, visible handle, weapon silhouette, inscription, or marked name token.
```

叙事对应：第三幕结界试刀。唯一的粉柄短刀由 `first-blade-present` 立绘双手托举，
背景只保留空刀鞘、空刀铭和结界芯，防止画面出现两把“第一把刀”。

## 4. 穗 `hayfield-wakeup`

```text
Primary request: create the empty sunny grassland rest stop for the first Sui story episode, immediately after a sleepy courier has discovered that several parcel bindings came loose beside a haystack. The live Sui sprite already hugs the one unique messenger satchel and its letters, so no bag or mail appears in the background.
Scene/backdrop: a fresh highland meadow road with rolling blue-green hills, pastel wildflowers, soft white clouds, and a few whimsical distant honeycomb-shaped cottage roofs. In the left-center sits one rounded golden haystack with a shallow resting hollow in the straw, but no figure. On a blue-white plaid picnic cloth are exactly three small cloth-wrapped parcels, a sky-blue water flask, a coil of plain binding rope, and a small tuft of soft cotton packing fiber. A simple route pebble marker sits behind them. Nothing is damaged.
Lighting/mood: bright late morning, drowsy and slightly flustered but cozy and humorous, with a light breeze shown only through a few drifting grass seeds over the left-center.
Right staging zone: only low grass, tiny sparse flowers, a softly receding path, distant hills, and open pale sky.
Additional avoid: absolutely no messenger satchel, shoulder bag, pouch, basket, case, chest, envelope, letter, paper sheet, wax seal, stamp, or extra mail container.
```

叙事对应：第一幕草垛休息点与散开的捆包物资。信袋与信件全部由 `hay-sleep`
立绘承担，背景只留三件包裹、水壶、绳和格纹布。

## 5. 穗 `old-letter-door`

```text
Primary request: create the empty recipient-door setting for the second Sui story episode, where an anxious courier has finally reached a honeycomb cottage but is afraid to knock after a late delivery. The live Sui character sprite already holds the one unique old letter and messenger satchel, so neither appears in this background.
Scene/backdrop: a welcoming whimsical grassland cottage porch built from warm pale stone and light wood, with tasteful abstract hexagonal honeycomb geometry. The rounded closed front door and small covered porch occupy the left-center; the door has a simple round brass knocker and a tiny hanging glass chime, but absolutely no sign, mailbox, mail slot, plaque, or writing. Beside the approach path is one familiar smooth oval pacing stone surrounded by three subtle curved pressed-grass arcs, suggesting someone has circled it repeatedly without showing footprints. A small covered gift jar of amber honey sits on a shallow oval plain wooden serving tray on the porch as a possible apology gift. The tray has no cloth, paper, label, engraving, emblem, or writing. Warm interior light glows gently through small frosted windows.
Lighting/mood: gentle late-afternoon light, hesitation at the threshold but a sense of kindness waiting inside; warm honey glow localized on the left and cooler blue-pink ambient light across the open right.
Right staging zone: low grass, sparse pastel flowers, softly receding path edge, distant hills, and open pale sky only.
Additional avoid: absolutely no letter, envelope, paper sheet, postage, seal, stamp, satchel, bag, pouch, parcel, mailbox, or mail slot; no bee or insect.
```

叙事对应：第二幕蜂巢小屋门前迟疑。唯一旧信由 `old-letter-anxious` 立绘持有；
门前只用踱步石、蜂蜜赔礼与温暖窗光表达“迟到但仍有人等待”。

## 6. 穗 `storm-delivery`

```text
Primary request: create the empty windswept grassland route for the third Sui story episode, during a magical altar storm on a delivery that must arrive on time. The live character sprite already carries the unique messenger satchel and urgent letter, so no mail or bag appears in the background.
Scene/backdrop: a highland meadow path climbing toward a distant welcoming cottage gate, with the ancient crystal altar far off on the left horizon. In the left-center, a low stone route marker has been tilted by the wind; it uses only a smooth blank blue inlay with no symbol or writing. A small faceted blue-pink windbreak crystal is secured in a low plain metal cradle beside the path, creating a localized transparent curved shelter ripple across the road. Bent grass, loose straw, and sakura petals stream diagonally through the left-center, showing strong wind. The distant destination gate glows softly as a clear endpoint beacon, entirely left of center. The path itself remains readable and safe, not disastrous.
Lighting/mood: dramatic late-afternoon storm light that remains colorful, hopeful, and safe; determination rather than danger. Cool lavender-blue wind light from the left, warm destination glow localized in the left-center, no lightning.
Right staging zone: low subdued grass waves, a softly blurred distant ridge, and an even blue-lavender sky gradient only. Gentle directional wind in grass is allowed, but no bright cloud, lightning, flare, tall object, building, crystal, petal cluster, or focal effect.
Additional avoid: absolutely no letter, envelope, paper mail, postage, seal, stamp, satchel, bag, pouch, parcel, mailbox, or mail slot; no arrow symbol on the route marker; no tornado or destruction.
```

叙事对应：第三幕祭坛风暴、吹歪的路标、避风结晶与左侧终点信标；唯一急件和信袋
由 `storm-run-ready` 立绘承担。

## 唯一道具合成修订

以下编辑均使用内置 `image_gen` 的 `precise-object-edit`，输入图为对应初稿。

### `first-blade-gate`：移除背景里的第二把刀

```text
Use case: precise-object-edit
Asset type: production Galgame encounter background for a mobile 2D Japanese fantasy RPG, 3:2 landscape.
Input image: Image 1 is the edit target.
Primary request: remove only the finished pink-handled short blade from the blue cloth on the stone plinth, because the live character sprite will already be holding that one unique first blade.
Required edit: replace the removed blade area with a subtle empty cloth impression and a simple closed navy-blue ceremonial scabbard lying horizontally near the back edge of the cloth. The scabbard must be completely empty, closed, non-glowing, and contain no visible blade, handle, guard, cord, tag, writing, or emblem. Keep the blank oval metal name token, faceted blue barrier crystal, petals, stone plinth, barrier gate, landscape, and open right staging zone unchanged.
Invariants: preserve the exact 3:2 framing, camera angle, lighting, palette, premium 2D Japanese mobile-game background style, all architecture, flowers, barrier arc, and the rightmost 38% calm low-detail sprite space. Change only the blade and the immediately covered cloth pixels. Do not add any person, character, face, hand, silhouette, reflection, animal, mascot, text, letters, numbers, runes, glyphs, logo, watermark, UI, frame, or new focal prop.
```

### `hayfield-wakeup`：移除第二个信袋与全部散落信件

```text
Use case: precise-object-edit
Asset type: production Galgame encounter background for a mobile 2D Japanese fantasy RPG, 3:2 landscape.
Input image: Image 1 is the edit target.
Primary request: remove the large brown leather messenger satchel, its shoulder strap, every loose envelope, paper letter, and wax-sealed letter, because the live Sui sprite already holds the one unique messenger satchel and its letters.
Required edit: fill the removed satchel area naturally with hay, low meadow grass, tiny pastel flowers, and the existing short stone wall texture. Replace removed papers with visible empty plaid cloth and short loose pieces of plain binding cord. Keep exactly three cloth-wrapped parcels, the rope coil, cotton packing fiber, blue water flask, haystack resting hollow, route pebble marker, meadow, path, hills, sky, and open right staging zone unchanged. Do not add any other bag, basket, case, chest, mail pouch, envelope, letter, paper, seal, stamp, or replacement mail container.
Invariants: preserve exact 3:2 framing, camera angle, lighting, palette, premium 2D Japanese mobile-game background style, every remaining prop, and the rightmost 38% calm low-detail sprite space. No person, character, face, hand, silhouette, reflection, animal, insect, readable text, letters, numbers, runes, glyphs, logo, watermark, UI, frame, or new focal prop.
```

### `old-letter-door`：纸状垫片改成木托盘

```text
Use case: precise-object-edit
Asset type: production Galgame encounter background for a mobile 2D Japanese fantasy RPG, 3:2 landscape.
Input image: Image 1 is the edit target.
Primary request: remove only the folded pale paper-like rectangle under the honey jar on the porch, because it can be mistaken for a second letter while the live Sui sprite already holds the unique old letter.
Required edit: replace that paper-like rectangle with a small shallow oval wooden serving tray under the honey jar. The tray has warm plain wood grain, softly rounded edges, no cloth, no paper, no label, no engraving, no emblem, and no writing. Keep the honey jar, porch, closed round door, brass knocker, glass chime, frosted windows, flowers, pacing stone, circular pressed-grass arcs, landscape, and open right staging zone unchanged.
Invariants: preserve exact 3:2 framing, camera angle, lighting, palette, premium 2D Japanese mobile-game background style, and rightmost 38% calm low-detail sprite space. Change only the paper-like object and its immediately covered pixels. Absolutely no letter, envelope, paper sheet, mail, seal, stamp, satchel, bag, pouch, parcel, mailbox, mail slot, person, character, face, hand, silhouette, reflection, animal, insect, readable text, letters, numbers, runes, glyphs, logo, watermark, UI, frame, or new focal prop.
```

## Sharp 转码

```powershell
node -e "const sharp=require('sharp'); const fs=require('fs'); const path=require('path'); const groups={akane:['petalsmith-road','rejected-workbench','first-blade-gate'],sui:['hayfield-wakeup','old-letter-door','storm-delivery']}; (async()=>{for(const [group,slugs] of Object.entries(groups)){for(const slug of slugs){const input=path.join('art-source','encounters','scenes',group,slug+'-source.png'); const output=path.join('public','assets','encounters','scenes',group,slug+'.webp'); await sharp(input).resize(1536,1024,{fit:'cover',position:'centre'}).flatten({background:'#ffffff'}).webp({quality:82,smartSubsample:true}).toFile(output); const m=await sharp(output).metadata(); console.log(group+'/'+slug,m.width+'x'+m.height,m.hasAlpha?'alpha':'opaque',fs.statSync(output).size);}}})()"
```

## 输出说明

| 场景 | 最终叙事锚点 | 右侧立绘区 |
|---|---|---|
| `akane/petalsmith-road` | 软 / 硬包柄材料、草图、木槌 | 花径与远山 |
| `akane/rejected-workbench` | 花房后、粉白试作品、拆解工具、木铃 | 空石地与低花 |
| `akane/first-blade-gate` | 结界、空刀鞘、空刀铭、结界芯 | 花路与天空 |
| `sui/hayfield-wakeup` | 草垛、三件包裹、水壶、绳、格纹布 | 草原小路 |
| `sui/old-letter-door` | 蜂巢门、踱步石、蜂蜜木托盘 | 草坡与远山 |
| `sui/storm-delivery` | 风暴路、吹歪路标、避风晶石、终点灯 | 低草浪与均匀天空 |

六张总览联系表：`art-source/qa/encounter-main-scenes.png`。
