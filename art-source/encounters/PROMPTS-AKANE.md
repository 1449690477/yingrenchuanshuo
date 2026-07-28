# 茜（char_akane）Galgame 美术生产提示词

> 生产模式：Codex 内置 `image_gen`，每个不同资产单独调用一次。
> 身份锚点：`art-source/encounters/portraits/akane/anchor-chroma.png`。
> 人物品质参考：`public/assets/characters/swordsman-sakura.png`（只参考日系手游渲染品质，严禁复制蓝发剑姬身份）。
> 场景基准：`art-source/encounters/scenes/akane/petalsmith-road-source.png`；补充参考 `public/assets/affection/scenes/swordsman-training-dawn.webp`。

## 1. 人物统一母提示

以下母提示与每张差分后缀拼接后，构成该图的完整生产提示：

```text
Use case: identity-preserve + background-extraction.
Asset type: mobile Galgame full-body character expression sprite, 2:3 portrait.
Image 1 is the exact Akane identity anchor and edit target; Image 2 is rendering-quality reference only, never copy its blue-haired swordswoman identity or outfit.
Preserve exactly the same adult young artisan face, warm reddish-brown bob haircut, the pink cherry-blossom ribbon on the same viewer-left side of her hair, amber eyes, ivory-and-navy workshop blouse, sakura-pink details, brown leather apron, bracers, tool pouch, short boots, body proportions, and polished Japanese mobile-game cel-shaded rendering from Image 1.
Akane is a practical adult young bladesmith, not a swordswoman, child, schoolgirl, maid, princess, or idol.
Change only the requested expression, pose, hand gesture, and explicitly named prop.
Place her on the RIGHT side of the canvas with her body angled slightly LEFT. Full body completely visible and bottom-anchored; head 22–26% of canvas height; natural anatomy and hands; generous padding; no body part touching an edge.
The background must be perfectly flat uniform solid #ff00ff, with no shadow, gradient, texture, floor, reflection, glow, or lighting variation. Do not use #ff00ff in the subject. Crisp clean silhouette.
No extra anatomy, extra props, text, logo, border, UI, or watermark.
```

### 14 张差分后缀

| slug | 精确动作 / 表情后缀 |
|---|---|
| `nervous-request` | `Nervous request: shoulders slightly tucked in; politely pinching a short roll of soft pink-and-white sword-handle wrap between both hands; shy hopeful amber eyes and a small hesitant smile. No blade.` |
| `lasting-grip` | `She has realized the player truly understands her handle design; shoulders soften, amber eyes widen with warm tender surprise, then a small grateful smile; one hand lightly over her heart and the other relaxed near her apron. No prop.` |
| `prove-it` | `Her amber eyes light up; she accepts the challenge with a bright determined smile and one small clenched fist beside her chest; the other hand rests naturally at her apron. No prop.` |
| `rejected-clutch` | `She cradles a returned rounded pink-and-white wrapped sword handle tightly against her chest with both hands; shoulders folded inward, amber eyes wet with restrained tears, downcast and hurt but dignified. Handle only, no blade.` |
| `ask-herself` | `She speaks with candid vulnerability while protectively holding one forearm across the front of her leather apron as if guarding unfinished work; the other hand lightly clenched near her heart; honest worried amber eyes and a restrained determined mouth. No prop.` |
| `not-wrong` | `After wiping away tears she gives a clever, slightly teasing rebuttal; one gloved fingertip has just brushed beneath one eye, brows playfully raised, sly confident half-smile, the other hand on her hip. No prop.` |
| `first-blade-present` | `She solemnly presents a compact silver-white short blade horizontally with both hands, with slightly tense shoulders and hopeful amber eyes. The artisan blade has a rounded soft pink-and-white wrapped handle, small wooden bell tail charm, and a restrained thin sakura light along the metal. Both hands anatomically clear.` |
| `give-name` | `She is surprised that her first blade has been named, then looks at the player for a long gentle beat; widened amber eyes soften into a deeply warm smile; one hand over heart, the other open at waist as if receiving the name. No prop.` |
| `test-blade` | `She has been waiting for an evaluation and finally exhales in relief; one hand loosely clasps the opposite wrist in front of her apron, shoulders dropping, eyes bright with relieved gratitude and a small sincere smile. No prop.` |
| `blind-grip-trust` | `Playful long-time-partner challenge: she hides both hands behind her back while visibly holding TWO separate short wrapped sword-handle samples behind her hips, one pink-white and one navy-white; lively teasing amber eyes, mischievous smile, slight forward lean. Handles only, no blades.` |
| `rain-wrap-trust` | `Slightly rain-damp hair tips and shoulders; she hugs exactly THREE short moisture-proof sword-handle-wrap rolls to her chest with both arms—pink-white, navy-white, ivory-gold—and gives a small embarrassed help-seeking smile. No umbrella, no blade, no rain in the background.` |
| `small-hands-trust` | `She carefully presents one clearly SHORT, FOREARM-LENGTH, UN-SHARPENED practice knife across both open palms: a compact rounded blunt silver-gray training blade with a tiny pink-white wrapped handle and no glow. It must not look like a bat, club, staff, rolling pin, long sword, or wooden stick. Gentle, technically focused expression.` |
| `soft-response` | `She has just heard an unusually precise evaluation and lights up with contained delight; both gloved hands clasp lightly in front of her chest, shoulders relaxed, amber eyes shining, warm happy smile, subtle blush. No prop.` |
| `steady-response` | `Confident professional nod; calm assured amber eyes and a modest capable smile; one gloved fist rests lightly against the front of her apron and the other hand relaxes at her side. The message is “this work is ready for a customer.” No prop and no text.` |

源图命名：`art-source/encounters/portraits/akane/<slug>-chroma.png`。
运行时命名：`public/assets/encounters/portraits/akane/<slug>.png`。

## 2. 三张主线横景

以下三张由并行美术批次生产，完整提示词由主代理合并：

- `petalsmith-road-source.png`：初遇花径 / 工匠桌与初稿。
- `rejected-workbench-source.png`：退回作品 / 阴天花房工作台。
- `first-blade-gate-source.png`：鸟居与结界 / 首刀黄昏高潮。

三张主线场景的完整原始提示、编辑去重记录与运行时参数集中保存在
`PROMPTS-MAIN-SCENES.md`，避免在人物差分文档中重复维护。

## 3. 三张 daily 横景

### 场景母提示

```text
Use case: stylized-concept.
Asset type: 1536×1024 mobile Galgame background, strict 3:2.
Image 1 is the exact palette, rendering, lighting softness, and detail-density reference for Akane's village/atelier scenes.
Preserve the fresh polished 2D Japanese fantasy mobile-game cel-painted style: sky blue, ivory, sakura pink, warm wood, restrained gold, clean layered depth, gentle luminous air.
Wide composition; key storytelling environment in LEFT-CENTER; keep the RIGHTMOST 38% visually calm, open, and low-contrast for a standing character sprite and dialogue UI.
Absolutely no people, characters, animals, birds, silhouettes, faces, hands, mannequins, readable text, letters, numbers, symbols, logo, watermark, UI, frame, or border.
No photorealism and no dramatic combat.
```

### `daily-blind-grip`

```text
Sunny clear morning outside the open doorway of a small bladesmith workshop at the town entrance. In left-center, keep two EMPTY low wooden trial-grip testing stands beside a folded artisan cloth and a tiny wooden bell charm. Open doorway, warm beams, a few cherry petals, and a calm sunlit stone path establish a familiar everyday meeting place. Do not place grip samples on the stands; the character sprite carries the two samples.
```

最终精确编辑：

```text
Remove ONLY the two wrapped cylindrical grip samples from the pair of low wooden trial-grip stands. Keep both wooden stands as EMPTY artisan testing supports, with their pegs intact. Reconstruct the vacated areas with matching perspective, light, shadows, depth, and painterly detail. Preserve every other object and the right-side calm path. Do not add replacement props.
```

### `daily-rain-wrap`

```text
View from beneath the eaves of Akane's workshop into a gentle rainy village street. Wet pale stone paving with soft reflections, rain curtain beyond the roof edge, warm workshop lantern at far left. In left-center, keep an EMPTY shallow wooden tray on a low dry bench beside a folded purple artisan cloth. Keep the right side as calm open wet street. Do not place wrap rolls in the tray; the character sprite carries the three rolls.
```

最终精确编辑：

```text
Remove ONLY the three large wrapped cylindrical rolls from the shallow wooden tray. Keep the tray EMPTY and preserve its rim, interior, folded purple cloth, and table. Reconstruct the tray interior with matching rainy light, perspective, wood grain, and shadows. Do not add replacement props.
```

### `daily-small-hands`

```text
Bright welcoming interior of a compact artisan workshop in late morning. In left-center, a low worktable holds child-sized paper patterns with non-readable line drawings, measuring cord, rounded wooden forms, and a pink wrap coil. A nearby left rack holds two small practice blades as environment display. Warm wood, airy window light, sakura blossoms in a vase. Keep the right side open floor and softly lit plain wall. Do not place a practice blade on the foreground table; the character sprite carries it.
```

最终精确编辑：

```text
Remove ONLY the single small practice knife from the purple cloth at the FRONT edge of the worktable. Leave the cloth continuous and recreate its woven texture, folds, gold seams, and sunlight. Keep the two display blades on the LEFT rack, paper patterns, measuring pieces, coil, table, stool, vase, window, and calm right wall unchanged.
```

源图：`art-source/encounters/scenes/akane/<slug>-source.png`。
运行时：`public/assets/encounters/scenes/akane/<slug>.webp`。

## 4. 高潮 CG：`akane-first-blade`

初次生成提示要求纯物件叙事：银白短刀“久握”横陈在深蓝工匠布上，粉白包柄、木铃尾坠、细樱光、无人物/手/文字。最终为贴合 `climaxAlt`，执行如下精确编辑：

```text
Use case: precise-object-edit.
Asset type: 1536×1024 mobile Galgame climax object CG.
Image 1 is the exact edit target.
Preserve the finished silver-white short blade exactly: compact shape, pink-and-white rounded wrapped handle, flower guard, small wooden bell tail charm, delicate sakura motif, and thin sakura light. Keep the deep navy artisan cloth, warm wooden workbench, lantern, tools, one cherry blossom, dusk peach light, camera, 3:2 composition, painterly detail, and shadows unchanged.
Remove ONLY the TWO separate spare wrapped handles below the blade. Replace that lower area with ONE slightly worn cream-colored initial-meeting hand-drawn design sheet partly tucked beneath/beside the finished blade: a simple pencil/charcoal line sketch of the same rounded grip proportions and wrap pattern, clearly a rough early concept, with NO words, letters, numbers, calligraphy, signature, or readable notation.
The emotional focus is one finished blade plus its humble first sketch, not a product lineup.
Absolutely no person, character, body, face, eye, hair, hand, arm, fingers, human reflection, silhouette, animal, readable text, logo, watermark, UI, frame, or border. Do not redesign the blade or add another weapon.
```

源图：`art-source/encounters/cg/akane-first-blade-source.png`。
运行时：`public/assets/encounters/cg/akane-first-blade.webp`。

## 5. 透明处理与尺寸规范

### 洋红幕误判审计

对 `#ff00ff` 源图直接使用通用软遮罩：

```powershell
python "$env:USERPROFILE\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" `
  --input <source> --out <alpha> `
  --auto-key border --soft-matte `
  --transparent-threshold 12 --opaque-threshold 220 --despill --force
```

会触发算法冲突：茜的赤棕发、肤色与粉色配饰被全图 `dominance alpha` 识别成接近洋红键色。以 `nervous-request` 为例，1572864 个源像素中出现 297098 个半透明像素；`despill` 同时抽掉红色，人物在棋盘底上明显灰白。这里不能靠 UI 或增益滤镜掩盖。

最终按“均匀背景是边界近色、人物内部红粉必须保留”的图像原理，仍使用官方 helper，但改为边界采样硬色键：

```powershell
python "$env:USERPROFILE\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" `
  --input <source> --out <alpha> `
  --auto-key border --tolerance 40 --edge-contract 1 --force
```

该流程在 14 张 1024×1536 源图中均得到 0 个源级半透明误判；随后由 Sharp 的高质量缩放生成正常抗锯齿 alpha：

```js
sharp(alpha)
  .resize(640, 960, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png({
    compressionLevel: 9,
    adaptiveFiltering: true,
    palette: true,
    quality: 94,
    effort: 10,
    colours: 256,
    dither: 0.8,
  })
  .toFile(runtime)
```

横景与 CG：

```js
sharp(source)
  .resize(1536, 1024, { fit: 'cover', position: 'centre' })
  .webp({ quality: 82, effort: 6, smartSubsample: true })
  .toFile(runtime)
```

## 6. QA

- 4 列人物联系表：`art-source/qa/encounter-akane-portraits.png`。
- 14 张运行时立绘严格为 640×960 RGBA PNG；四角透明；主体不触边；顶部留白 23–38 px；底部留白 6–26 px。
- 最宽动作仍有足够可读尺寸：`first-blade-present` bbox 约 443×919 px；`small-hands-trust` bbox 约 384×905 px。
- 每张立绘远低于 550 KB；三张 daily 场景和高潮 CG 均为 1536×1024 WebP，远低于 520 KB。
- 人工检查：同脸、同发型、同服装；无断肢、额外手指、裁边或可读文字；daily 场景已去除与立绘重复的手持道具；CG 仅保留成刀与初遇草图。
