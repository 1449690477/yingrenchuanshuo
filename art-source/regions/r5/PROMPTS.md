# 区域 5「熔岩神殿」场景资产提示词与追溯记录

本批只覆盖 **6 张竖版地图 + 5 张 3:2 挂机战场**。运行图进入主游戏仓；
ImageGen 原始 PNG 进入独立本地美术源目录
`yingrenchuanshuo-art-source-r5/scenes/`，不复制回主仓。

- 生成方式：Codex 内置 ImageGen，每个 stable key 独立调用。
- 风格参考：`art-source/qa/r34-maps-contact.png` 与
  `art-source/qa/r34-battlefields-contact.png`，仅作为画风、纵深和战斗净空参考。
- 运行图：地图 `768×1024` 不透明 WebP；战场 `1536×1024` 不透明 WebP。
- 源图与运行图哈希：[`SOURCE-SHA256.json`](SOURCE-SHA256.json)。
- 本轮内置工具返回值不提供 `call_*` 字段时，记录输出文件自带的唯一
  `exec-*` 产物 token 作为调用追踪 ID；不将它伪装成 API call id。
- `r5` 使用父任务已生成的真实 `call_*`，其 prompt 只保留了会话恢复文本，
  下文明确标注其追溯边界。

## `r5`

- 调用 ID：`call_DH9W3sCmAz4vxgaJcW3mY0hB`
- 原始生成文件：
  `C:/Users/Administrator/.codex/generated_images/019fa34f-536a-71e0-887d-007fcc16b9dc/call_DH9W3sCmAz4vxgaJcW3mY0hB.png`
- 独立源仓：`scenes/maps/r5-source.png`
- 运行图：`public/assets/maps/r5.webp`
- 追溯说明：以下是**父任务会话恢复文本（语义完整，非接口回读逐字稿）**，
  不声称逐字等同于当时发送给生成接口的原始字符串。

```text
Create a polished vertical anime-fantasy region overview map for the mobile idle RPG Sakura Legend, Region 5 “熔岩神殿 / Molten Temple”. A continuous journey through five clearly distinguishable landmarks from bottom to top: scorched outer ring, lava bridge, temple forecourt, ritual-fire hall, molten-heart sanctuary. Cute clean high-end game illustration, coral red / warm rose / soft gold / translucent molten crystal palette, rounded gentle shapes, luminous fire motifs, layered depth and readable route, visually compatible with the existing fresh pastel blue-white-pink UI while introducing elegant red-gold heat. No people, no characters, no monsters, no text, no labels, no logo, no horror, no gore. Full-bleed vertical 3:4 composition, production-ready mobile game map.
```

> 废弃记录：本子任务在收到父任务对接前曾独立生成
> `exec-6199f6da-a2c5-4c11-a12f-e493e09d1783`。该图没有进入独立源仓、
> SHA 锁、运行目录或联系表；最终 `r5` 只使用上面的父任务调用。

## `chapter-5-1`

- 调用追踪 ID：`exec-e9c7386b-b3ef-4a1b-bb8b-2e4c0241b945`
- 原始生成文件：
  `C:/Users/Administrator/.codex/generated_images/019facd0-d136-7521-ba8d-9f3ac480f399/exec-e9c7386b-b3ef-4a1b-bb8b-2e4c0241b945.png`
- 独立源仓：`scenes/maps/chapter-5-1-source.png`
- 运行图：`public/assets/maps/chapter-5-1.webp`

```text
Use case: stylized-concept
Asset type: vertical chapter cover for a cute Japanese mobile idle RPG
Primary request: Create one original premium 3:4 portrait environment illustration for Chapter 5-1, “Scorched Outer Ring,” the welcoming entrance terrace of a fantasy Lava Temple.
Input image: style reference only; match its clean painterly anime finish, rounded architecture, luminous glass accents, layered depth, and phone-size readability. Do not copy its layout.
Scene/backdrop: a broad ring of cooled dark-navy basalt terraces around the temple foothill, a cream-stone arched gateway ahead, coral crystal flame-lanterns, thin restrained molten-gold seams, and a clearly walkable stair path curving inward.
Style/medium: high-end 2D anime mobile-game environment painting, crisp silhouettes, soft cel-painted textures, cute and polished.
Composition/framing: portrait 3:4; readable foreground path, midground gateway, distant glowing temple destination; open and inviting chapter-entry composition.
Lighting/mood: clear late-afternoon blue sky, warm coral and gold bounce light, pale-pink glass highlights, adventurous and friendly.
Constraints: environment only; no people, characters, monsters, animals, human silhouettes, text, readable symbols, logo, UI, border or watermark. No blood, gore, horror, ash storm, smoke clouds or photorealism.
Avoid: oppressive darkness, muddy brown, excessive lava, clutter blocking the path, ruined hellscape, repeated decorative clutter.
```

## `chapter-5-2`

- 调用追踪 ID：`exec-69cfce4a-696e-4388-9ed2-a544a664a1d9`
- 原始生成文件：
  `C:/Users/Administrator/.codex/generated_images/019facd0-d136-7521-ba8d-9f3ac480f399/exec-69cfce4a-696e-4388-9ed2-a544a664a1d9.png`
- 独立源仓：`scenes/maps/chapter-5-2-source.png`
- 运行图：`public/assets/maps/chapter-5-2.webp`

```text
Use case: stylized-concept
Asset type: vertical chapter cover for a cute Japanese mobile idle RPG
Primary request: Create one original premium 3:4 portrait environment illustration for Chapter 5-2, “Lava Bridge,” an elegant ceremonial crossing inside a friendly fantasy Lava Temple.
Input image: style reference only; match its clean painterly anime finish, rounded fantasy forms, luminous glass highlights, layered depth, and phone-size readability. Do not copy its layout.
Scene/backdrop: a long suspended cream-stone and dark-navy basalt bridge crossing a glowing coral lava gorge, with rose-crystal lantern pylons, fine gold railings, soft red silk accents, and a distant temple gate. The bridge is intact, broad, safe-looking and clearly walkable.
Style/medium: high-end 2D anime mobile-game environment painting, crisp shapes, soft cel-painted textures, polished and cute.
Composition/framing: portrait 3:4; bridge begins wide at the lower edge and narrows toward the destination, dramatic depth without vertigo, foreground/midground/background clearly separated.
Lighting/mood: warm coral-gold underlight balanced by cool azure cave shadows and pale-pink glass; exciting, elegant and inviting.
Constraints: environment only; no people, characters, monsters, animals, human silhouettes, text, readable runes, logo, UI, border or watermark. No blood, gore, horror, collapse, smoke clouds or photorealism.
Avoid: rope bridge, ruined bridge, oppressive darkness, muddy brown, excessive orange saturation, clutter on the walkway, hellscape imagery.
```

## `chapter-5-3`

- 调用追踪 ID：`exec-8bd823b5-025a-44c6-92b7-0454d03d67b8`
- 原始生成文件：
  `C:/Users/Administrator/.codex/generated_images/019facd0-d136-7521-ba8d-9f3ac480f399/exec-8bd823b5-025a-44c6-92b7-0454d03d67b8.png`
- 独立源仓：`scenes/maps/chapter-5-3-source.png`
- 运行图：`public/assets/maps/chapter-5-3.webp`

```text
Use case: stylized-concept
Asset type: vertical chapter cover for a cute Japanese mobile idle RPG
Primary request: Create one original premium 3:4 portrait environment illustration for Chapter 5-3, “Temple Forecourt,” a formal open courtyard deeper inside a friendly fantasy Lava Temple.
Input image: style reference only; match its clean painterly anime finish, rounded fantasy architecture, luminous glass accents, layered depth, and phone-size readability. Do not copy its layout.
Scene/backdrop: a spacious ceremonial courtyard of cream stone and dark-navy basalt, a large coral-and-gold fire-lotus mosaic, symmetrical rose-crystal braziers, shallow contained molten channels, elegant colonnades and a tall inner-temple doorway at the far end. Include a clear central path and a few small pink heat-resistant blossoms in stone planters.
Style/medium: high-end 2D anime mobile-game environment painting, crisp readable shapes, soft cel-painted textures, polished and cute.
Composition/framing: portrait 3:4; foreground mosaic, midground colonnades, distant doorway; balanced but not perfectly flat symmetry, clear progression route.
Lighting/mood: bright warm ceremonial glow balanced by cool azure shadows and cream-white reflections; calm, noble and welcoming.
Constraints: environment only; no people, characters, monsters, animals, human silhouettes, statues of people, text, readable runes, logo, UI, border or watermark. No blood, gore, horror, smoke clouds or photorealism.
Avoid: empty generic palace, realistic religion, oppressive darkness, muddy brown, excessive lava, cluttered floor, throne room composition.
```

## `chapter-5-4`

- 调用追踪 ID：`exec-2cfe6ac1-376e-4fb8-ac30-0a2cb5ee4ae2`
- 原始生成文件：
  `C:/Users/Administrator/.codex/generated_images/019facd0-d136-7521-ba8d-9f3ac480f399/exec-2cfe6ac1-376e-4fb8-ac30-0a2cb5ee4ae2.png`
- 独立源仓：`scenes/maps/chapter-5-4-source.png`
- 运行图：`public/assets/maps/chapter-5-4.webp`

```text
Use case: stylized-concept
Asset type: vertical chapter cover for a cute Japanese mobile idle RPG
Primary request: Create one original premium 3:4 portrait environment illustration for Chapter 5-4, “Fire Ritual Hall,” the ornate inner ceremonial hall of a friendly fantasy Lava Temple.
Input image: style reference only; match its clean painterly anime finish, rounded architecture, luminous glass ornaments, layered depth, and phone-size readability. Do not copy its layout or moon motifs.
Scene/backdrop: a tall cream-stone and dark-navy basalt hall with coral silk canopies, concentric golden ritual discs embedded in the floor, suspended rose-crystal fire-lotus chandeliers, elegant columns, contained braziers and a glowing doorway leading deeper into the sanctuary.
Style/medium: high-end 2D anime mobile-game environment painting, crisp shapes, soft cel-painted textures, rounded and luxurious rather than realistic.
Composition/framing: portrait 3:4; low viewpoint across a clear central aisle, readable floor motif in foreground, layered columns and drapery in midground, bright inner doorway at the top-center destination.
Lighting/mood: warm coral-gold light with pale-pink glass refractions and cool azure-violet shadows; festive, sacred, graceful and inviting.
Constraints: environment only; no people, characters, monsters, animals, human silhouettes, statues of people, text, readable symbols, logo, UI, border or watermark. No blood, gore, horror, smoke clouds, religious emblems or photorealism.
Avoid: throne, coffin, realistic church, oppressive darkness, muddy brown, excessive loose flames, clutter blocking the aisle, repeated palace scene.
```

## `chapter-5-5`

- 调用追踪 ID：`exec-a986780c-d817-4f50-ae89-187e40d6db78`
- 原始生成文件：
  `C:/Users/Administrator/.codex/generated_images/019facd0-d136-7521-ba8d-9f3ac480f399/exec-a986780c-d817-4f50-ae89-187e40d6db78.png`
- 独立源仓：`scenes/maps/chapter-5-5-source.png`
- 运行图：`public/assets/maps/chapter-5-5.webp`

```text
Use case: stylized-concept
Asset type: vertical final-chapter cover for a cute Japanese mobile idle RPG
Primary request: Create one original premium 3:4 portrait environment illustration for Chapter 5-5, “Molten-Heart Sanctuary,” the luminous innermost chamber of a friendly fantasy Lava Temple.
Input image: style reference only; match its clean painterly anime finish, rounded fantasy architecture, luminous glass accents, layered depth, and phone-size readability. Do not copy its layout or crystal-palace motifs.
Scene/backdrop: a vast enclosed circular sanctuary carved from deep navy basalt and cream stone; at the far end a single giant warm-gold molten heart core is safely suspended inside layered coral-and-rose glass fire-lotus petals. Gold conduits lead from the core into a clean circular ceremonial platform, with restrained crystal lamps and tall protective arches.
Style/medium: high-end 2D anime mobile-game environment painting, crisp readable shapes, soft cel-painted textures, polished and wondrous rather than realistic.
Composition/framing: portrait 3:4; broad circular foreground platform, a short ascending path, strong singular core focal point in upper-middle, clear depth and final-destination grandeur.
Lighting/mood: radiant golden heart glow, coral and pale-pink glass refractions, cool azure-violet edge shadows; awe-inspiring, warm, pure and hopeful.
Constraints: environment only; no people, characters, monsters, animals, human silhouettes, statues, text, readable runes, logo, UI, border or watermark. No blood, gore, horror, exposed organs, smoke clouds, throne, coffin or photorealism.
Avoid: literal anatomical heart, hellscape, oppressive darkness, muddy brown, excessive loose lava, generic crystal palace, cluttered foreground.
```

## `battlefield:chapter-5-1`

- 调用追踪 ID：`exec-27623f0e-ff7b-41c0-88f8-db3650aa9178`
- 原始生成文件：
  `C:/Users/Administrator/.codex/generated_images/019facd0-d136-7521-ba8d-9f3ac480f399/exec-27623f0e-ff7b-41c0-88f8-db3650aa9178.png`
- 独立源仓：`scenes/battlefields/chapter-5-1-source.png`
- 运行图：`public/assets/battlefields/chapter-5-1.webp`

```text
Use case: stylized-concept
Asset type: independent 3:2 horizontal battle arena background for a cute Japanese mobile idle RPG
Primary request: Create one original premium landscape battle arena for Chapter 5-1, “Scorched Outer Ring,” at the welcoming exterior terrace of a fantasy Lava Temple.
Input image: style reference only; match its clean painterly anime finish, rounded fantasy forms, luminous glass accents, broad combat floor, and mobile readability. Do not copy any existing arena.
Scene/backdrop: cooled dark-navy basalt terrace beneath a clear blue sky; rear half has a cream-stone fire-lotus gate, distant coral temple towers, restrained rose-crystal lanterns and thin golden lava channels at the far edges.
Style/medium: high-end 2D anime mobile-game environment painting, crisp readable shapes, soft cel-painted texture, bright and cute.
Composition/framing: exact landscape 3:2. The lower 52% is one broad, flat, low-detail dark basalt combat floor with subtle coral-gold seams; left, center and right deployment zones all unobstructed. Scenic depth and architecture stay in the rear 48%.
Lighting/mood: bright daylight, warm coral-gold rim light balanced by cool azure shadows and pale-pink glass; adventurous and welcoming.
Constraints: environment only; no people, characters, monsters, animals, human silhouettes, text, readable symbols, logo, UI, border or watermark. No foreground props, pillars, crystals or flames crossing the combat floor. No blood, gore, horror, smoke clouds or photorealism.
Avoid: stairs in the lower half, central pedestal, circular altar occupying the floor, cluttered ground, excessive lava, oppressive darkness, hellscape imagery.
```

## `battlefield:chapter-5-2`

- 调用追踪 ID：`exec-078d6c75-47c9-4db1-907f-4b07339ea0d0`
- 原始生成文件：
  `C:/Users/Administrator/.codex/generated_images/019facd0-d136-7521-ba8d-9f3ac480f399/exec-078d6c75-47c9-4db1-907f-4b07339ea0d0.png`
- 独立源仓：`scenes/battlefields/chapter-5-2-source.png`
- 运行图：`public/assets/battlefields/chapter-5-2.webp`

```text
Use case: stylized-concept
Asset type: independent 3:2 horizontal battle arena background for a cute Japanese mobile idle RPG
Primary request: Create one original premium landscape battle arena for Chapter 5-2, “Lava Bridge,” on a wide ceremonial bridge inside a friendly fantasy Lava Temple.
Input image: style reference only; match its clean painterly anime finish, rounded fantasy architecture, luminous glass accents, broad combat floor, and mobile readability. Do not copy any existing arena.
Scene/backdrop: an exceptionally broad intact cream-and-navy bridge deck spanning a coral molten gorge; the rear half shows elegant gold railings, rose-crystal lantern pylons, deep azure cavern walls and a distant domed fire gate. Lava is visible only beyond the far side edges.
Style/medium: high-end 2D anime mobile-game environment painting, crisp readable shapes, soft cel-painted textures, polished and cute.
Composition/framing: exact landscape 3:2. The lower 52% is one continuous flat low-detail cream-and-navy stone bridge deck, wide enough for left, center and right deployment zones with no gaps or obstacles. Scenic bridge rails, lanterns and destination stay in the rear 48%.
Lighting/mood: warm coral-gold underlight balanced by cool azure cavern shadows and pale-pink glass; thrilling, elegant and safe.
Constraints: environment only; no people, characters, monsters, animals, human silhouettes, text, readable symbols, logo, UI, border or watermark. No foreground railings, pillars, crystals, flames or holes crossing the combat floor. No blood, gore, horror, smoke clouds or photorealism.
Avoid: narrow walkway, rope bridge, broken bridge, stairs in the lower half, central pedestal, circular altar, excessive lava occupying the floor, oppressive darkness, hellscape imagery.
```

## `battlefield:chapter-5-3`

- 调用追踪 ID：`exec-75e96f80-b77c-4fe6-a3f8-0ca0c117f16a`
- 原始生成文件：
  `C:/Users/Administrator/.codex/generated_images/019facd0-d136-7521-ba8d-9f3ac480f399/exec-75e96f80-b77c-4fe6-a3f8-0ca0c117f16a.png`
- 独立源仓：`scenes/battlefields/chapter-5-3-source.png`
- 运行图：`public/assets/battlefields/chapter-5-3.webp`

```text
Use case: stylized-concept
Asset type: independent 3:2 horizontal battle arena background for a cute Japanese mobile idle RPG
Primary request: Create one original premium landscape battle arena for Chapter 5-3, “Temple Forecourt,” in the open ceremonial courtyard of a friendly fantasy Lava Temple.
Input image: style reference only; match its clean painterly anime finish, rounded fantasy architecture, luminous glass accents, broad combat floor, and mobile readability. Do not copy any existing arena.
Scene/backdrop: a cream-stone courtyard framed in the rear by elegant dark-navy colonnades, coral fire-lotus windows, low rose-crystal braziers and a tall inner-temple door. Tiny pink blossoms stay in raised side planters behind the combat plane.
Style/medium: high-end 2D anime mobile-game environment painting, crisp readable shapes, soft cel-painted textures, polished and cute.
Composition/framing: exact landscape 3:2. The lower 52% is one broad, flat, low-detail pale-stone combat floor with a very subtle oversized fire-lotus line motif; left, center and right deployment zones unobstructed. Architecture and decoration remain in the rear 48%.
Lighting/mood: clear soft daylight filtering into the courtyard, coral-gold glow balanced by pale blue shadows and pink glass; noble, calm and welcoming.
Constraints: environment only; no people, characters, monsters, animals, human silhouettes, statues, text, readable symbols, logo, UI, border or watermark. No foreground props, steps, braziers, plants or crystals crossing the combat floor. No blood, gore, horror, smoke clouds or photorealism.
Avoid: central raised altar, throne, stairs in the lower half, strong floor glare, clutter, excessive lava, oppressive darkness, generic moon palace.
```

## `battlefield:chapter-5-4`

- 调用追踪 ID：`exec-6e2fa776-8ffa-4540-8ada-a24fe4779a71`
- 原始生成文件：
  `C:/Users/Administrator/.codex/generated_images/019facd0-d136-7521-ba8d-9f3ac480f399/exec-6e2fa776-8ffa-4540-8ada-a24fe4779a71.png`
- 独立源仓：`scenes/battlefields/chapter-5-4-source.png`
- 运行图：`public/assets/battlefields/chapter-5-4.webp`

```text
Use case: stylized-concept
Asset type: independent 3:2 horizontal battle arena background for a cute Japanese mobile idle RPG
Primary request: Create one original premium landscape battle arena for Chapter 5-4, “Fire Ritual Hall,” inside the grand ceremonial hall of a friendly fantasy Lava Temple.
Input image: style reference only; match its clean painterly anime finish, rounded fantasy architecture, luminous glass accents, broad combat floor, and mobile readability. Do not copy any existing arena or moon-palace motifs.
Scene/backdrop: rear half contains tall cream-stone columns with dark-navy bases, sweeping coral silk canopies, suspended rose-glass fire-lotus chandeliers, restrained golden braziers and a glowing inner doorway. The hall is festive and refined, not religious or grim.
Style/medium: high-end 2D anime mobile-game environment painting, crisp readable shapes, soft cel-painted textures, polished and cute.
Composition/framing: exact landscape 3:2. The lower 52% is one broad, flat, low-detail navy ceremonial stone floor with only a faint thin gold concentric motif; left, center and right deployment zones unobstructed. Drapery, chandeliers, columns and doorway remain in the rear 48%.
Lighting/mood: soft coral-gold illumination, pale-pink glass reflections and cool azure-violet shadows; warm, graceful and dramatic.
Constraints: environment only; no people, characters, monsters, animals, human silhouettes, statues, text, readable symbols, logo, UI, border or watermark. No foreground props, steps, braziers, curtains or crystals crossing the combat floor. No blood, gore, horror, smoke clouds, realistic religion or photorealism.
Avoid: throne, altar raised into the floor, cathedral, excessive fire, strong mirror glare, oppressive darkness, clutter, generic moon palace.
```

## `battlefield:chapter-5-5`

- 调用追踪 ID：`exec-8fbc35ff-faef-4472-883c-c968464207e8`
- 原始生成文件：
  `C:/Users/Administrator/.codex/generated_images/019facd0-d136-7521-ba8d-9f3ac480f399/exec-8fbc35ff-faef-4472-883c-c968464207e8.png`
- 独立源仓：`scenes/battlefields/chapter-5-5-source.png`
- 运行图：`public/assets/battlefields/chapter-5-5.webp`

```text
Use case: stylized-concept
Asset type: independent 3:2 horizontal final-boss battle arena background for a cute Japanese mobile idle RPG
Primary request: Create one original premium landscape battle arena for Chapter 5-5, “Molten-Heart Sanctuary,” in the innermost chamber of a friendly fantasy Lava Temple.
Input image: style reference only; match its clean painterly anime finish, rounded fantasy architecture, luminous glass accents, broad combat floor, and mobile readability. Do not copy any existing arena or moon motifs.
Scene/backdrop: the rear half contains one monumental warm-gold molten core safely suspended inside layered coral-and-rose glass fire-lotus petals, framed by deep navy basalt arches and restrained golden conduits. Low crystal lamps and a short rear dais emphasize a final sanctuary without becoming a throne room.
Style/medium: high-end 2D anime mobile-game environment painting, crisp readable shapes, soft cel-painted textures, polished and wondrous rather than realistic.
Composition/framing: exact landscape 3:2. The lower 54% is one broad, flat, low-detail dark-navy circular combat floor with only thin restrained gold rings; left, center and right deployment zones fully unobstructed, with extra vertical clearance on the right for a large boss. Core, petals, arches and dais remain in the rear 46%.
Lighting/mood: radiant warm-gold core light, coral and pale-pink glass refractions, cool azure-violet edge shadows; climactic, pure, hopeful and majestic.
Constraints: environment only; no people, characters, monsters, animals, human silhouettes, statues, text, readable symbols, logo, UI, border or watermark. No foreground rails, steps, lamps, crystals, fire or lava crossing the combat floor. No blood, gore, horror, exposed organs, smoke clouds, throne, coffin or photorealism.
Avoid: literal anatomical heart, central floor obstacle, excessive glare, hellscape, oppressive darkness, generic crystal palace, cluttered combat plane.
```

## 构建、联系表与门禁

```powershell
node scripts/build-region5-scene-assets.mjs
node scripts/build-region5-scene-contact-sheet.mjs
node scripts/validate-region5-scene-assets.mjs --with-sources
```

若独立源仓不在主仓同级目录，必须显式设置 `REGION5_ART_SOURCE_ROOT`。缺少原图时
禁止拿运行 WebP 回填 `sourcePath` 或 source SHA；不做这种会掩盖源管线断裂的兜底。

## 逐张人工检查记录

| stable key | 画面检查 | 结果 |
|---|---|---|
| `r5` | 五层地标与连续桥路可读；天空、粉花、红金神殿兼容现有清新 UI | ✅ |
| `chapter-5-1` | 入口拱门、外环台地与远处神殿形成明确开章路线 | ✅ |
| `chapter-5-2` | 完整宽桥跨越熔岩峡谷；无断桥、绳桥或路面人物 | ✅ |
| `chapter-5-3` | 火莲前庭、回廊和内门层次清楚；不与桥或室内厅撞景 | ✅ |
| `chapter-5-4` | 珊瑚帷幔、火莲吊灯与环形仪式纹构成独立章节语言 | ✅ |
| `chapter-5-5` | 熔心使用抽象金色能量核而非解剖心脏；终章焦点唯一 | ✅ |
| `battlefield:chapter-5-1` | 下半冷却玄武岩坪完整，左中右三站位无障碍 | ✅ |
| `battlefield:chapter-5-2` | 下半宽桥面连续，无孔洞、栏杆或熔岩侵入站位 | ✅ |
| `battlefield:chapter-5-3` | 浅色前庭地坪低细节，后景花台和灯具不压战斗层 | ✅ |
| `battlefield:chapter-5-4` | 深蓝仪式厅地坪留空，帷幔与吊灯全部处于后景 | ✅ |
| `battlefield:chapter-5-5` | BOSS 右侧净空充足；熔心、台阶和灯具均留在后景 | ✅ |

全部画面均已人工确认：无人物、怪物、动物、可读文字、UI、Logo、水印、血腥、
恐怖或写实地狱景象。自动门禁复核结果：

- 6 张地图均为 `768×1024` 不透明 WebP，162,682～204,058 B，
  低于 450 KiB。
- 5 张战场均为 `1536×1024` 不透明 WebP，203,010～276,428 B，
  低于 520 KiB。
- 11 张源图 SHA、运行图 SHA 与像素唯一性全部通过；联系表为不透明压缩 WebP，
  233,270 B。
- `npm run verify`：78 个测试文件 / 987 项测试、模拟与既有四套资产门禁全绿。
