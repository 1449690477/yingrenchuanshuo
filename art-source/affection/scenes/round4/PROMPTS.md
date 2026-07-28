# A-4 约会日程素材 · 提示词与管线留痕

- 生成通道：Kimi image_generation 插件（gpt-image 通道双双断粮后的自有通道），1K / 3:2 / opaque。
- 源图：`art-source/affection/{scenes,cg}/round4/*.png`（1536×1024，左下含「AI生成」合规标记）。
- 运行时：`scripts/build-affection-round4-assets.mjs` 统一切边（底 64px、左右各 48px，去标记保 3:2）后转 960×640 webp，输出 `public/assets/affection/{scenes,cg}/<slug>.webp`。
- 联系表：`art-source/qa/affection-round4-contact-sheet.png`；审计：`scripts/validate-affection-assets.mjs`（含 16×16 灰度指纹像素查重）。
- 统一约束：无人物、无可读文字、无水印（运行时版本）、严格 3:2、不复用。

## 场景（12 张，统一前缀）

前缀：`anime-style mobile game background art, soft pastel palette, clean composition, no characters, no people, no readable text, no letters, no watermark — `，后缀：`, 2D game stage background, wide shot`。

| slug | 主题 | 场景描述（接前缀后） |
| --- | --- | --- |
| swordsman-morning-market | 晨市挑剑穗 | a morning market street near a training ground, a weapon stall with rows of colorful silk sword tassels swaying in dawn breeze, cherry blossom petals drifting, wooden stalls just opening, warm early sunlight |
| swordsman-lakeside-bento | 午后湖畔便当 | a lakeside picnic spot under willow trees in gentle afternoon light, an open two-tier bento box neatly arranged on a cloth, lotus leaves on sparkling water, dappled shade, peaceful and warm |
| swordsman-lantern-bridge | 灯桥并肩归营 | a night bridge with rows of glowing paper lanterns over a calm river, lantern reflections shimmering on water, distant camp lights at the far end of the bridge, quiet and tender mood |
| witch-starcandy-atelier | 星糖实验约会 | a cozy magical atelier kitchen counter in morning light, glass test tubes filled with colorful star-shaped sugar crystals, copper pots, gentle sparkles, pastel magic atmosphere |
| witch-planetarium-repair | 修复小型星象馆 | an attic mini planetarium at afternoon, an old brass star projector being repaired on a wooden desk, scattered star charts with abstract marks, dust motes in warm light beams, ladder and tools |
| witch-meteor-terrace | 夜台观流星 | a night rooftop terrace with a telescope aimed at a deep starry sky, two mugs of warm drink on a small table, an open journal with abstract star doodles, meteor streaks across the sky |
| shaman-shrine-market | 神社早市同行 | a morning market street below shrine steps, steam rising from breakfast stalls, red paper lanterns, vermilion torii accents, gentle crowd-free street, fresh early light |
| shaman-firefly-ferry | 萤火渡舟 | a small wooden ferry boat with a lit cabin lantern on a calm river at dusk, hundreds of fireflies glowing over the water, distant willow silhouettes, dreamy blue-purple tones |
| shaman-rainy-teahouse | 雨夜茶屋共享安静 | a rainy night teahouse interior corner, two ceramic teacups steaming on a low wooden table, rain drops on the window, one warm paper lamp, quiet cozy atmosphere |
| catkin-supply-market | 补给市集 | a lively fantasy supply market stall in the morning, shelves of dried food packs and travel gear, a wooden sign with a cute paw-print symbol, checklist boards with abstract marks, colorful and tidy |
| catkin-workshop-coffee | 纸箱工坊咖啡时间 | a cardboard workshop cafe corner in afternoon sun, a counter made of stacked cardboard boxes, two mugs of coffee, tape rolls and craft tools neatly arranged, warm and playful |
| catkin-rooftop-platform | 月台屋顶看夜车 | a night view from a train platform rooftop, a night train arriving with lights glowing along the tracks, starry sky above, empty bench and warm platform lamps below, gentle sense of journey |

## 纯物件 CG（4 张，第十二幕）

前缀：`anime-style game illustration, soft pastel palette, clean composition, no characters, no people, no readable text, no letters, no watermark — `，后缀：`, detailed still life`。

| slug | 主题 | 物件描述（接前缀后） |
| --- | --- | --- |
| swordsman-paired-tassels | 并系双剑穗 | still life: two silk sword tassels tied side by side on a polished wooden stand, one slightly worn and one new in matte crimson, soft lantern light, shallow depth of field, tender keepsake mood |
| witch-meteor-journal | 联合观测日志 | still life: an open observation journal with hand-drawn star charts and shooting-star doodles made of abstract marks, two ink bottles in different colors, a small jar of star-shaped candies, candlelight |
| shaman-paired-teacups | 并放双茶盏 | still life: two ceramic teacups with rising steam placed side by side on a wooden table, rain-beaded window behind them, a small brass bell nearby, warm lamplight, tranquil mood |
| catkin-two-tickets | 两张留存的票根 | still life: two blank train tickets with neatly torn corners aligned side by side on a wooden shelf, a paw-shaped rubber stamp beside them, warm bokeh lights in the background, cherished keepsake mood |
