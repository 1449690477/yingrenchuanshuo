# 冰雪华年套 · 美术源与重建说明

## 视觉锚点

- 主题：春节限定「冰雪华年」，华丽洁白、可爱柔和，不做冷硬写实盔甲。
- 主色：象牙白、冰晶蓝、淡樱粉；点缀只用少量中国结红、银流苏与珍珠。
- 轮廓：帽饰、连衣裙、鞋履与五职业武器必须保持现有人物手、脸、脚底锚点。
- 可读性：手机宽度下先读出白色礼服和职业武器，再读雪花、珍珠等细节。

## 货架源图

`shelf-source.png` 由图像生成工具按下列约束产出，保留为源级资产；运行时由
`scripts/build-ice-snow-assets.mjs` 固定缩放、压缩为 960×640 WebP：

> A luxurious Lunar New Year ice-snow fashion boutique display for a Chinese
> mobile anime idle RPG. Ivory white, ice blue and pale pink translucent glass,
> snowflake crystals, pearls, silver tassels and restrained red Chinese-knot
> accents. A central mannequin wears a complete white winter-festival dress,
> fluffy hat and boots. Side shelves show sword, magic staff, spirit-bell staff,
> twin cat claws and katana. No people, text, letters, numerals, logos or UI.
> Preserve a clear 3:2 mobile-readable composition.

## 五职业穿戴层

冰雪层不重新猜测人体位置。`wearable-base/` 固化了开工时已过实穿校准的五职业、同部位
锚点，构建器只读取这份任务内母版，不再依赖仍会继续修订的 `rose-night` 运行资产。
重建时先把深红/紫转象牙白和冰蓝阴影、金属转银色，再生成本主题真正改变外轮廓的
雪绒披肩、双层透明侧裙、雪绒靴口和五职业冰晶武器结构。新增轮廓仍围绕原手部、脸部、
膝腿和脚底锚点展开，不能以“原创”为由让武器离手、帽子压脸、裙摆穿腿或鞋底漂移。
帽区按首轮实机证据做 180px → 100px 纵向校正；樱酱衣裙槽另生成同源 256×256
缩略图，不显示通用空心裙。穿戴层因共享人体锚点，与特效分开定标：15 张独立新轮廓
对旧母版的归一 Alpha IoU 实测为 `0.459–0.886`，而旧层经过 10×7px 平移、97% 缩放或
水平镜像后的伪装复制最低仍为 `0.966`，所以取两组之间的 `0.95` 为硬阈值；逐像素同形
或达到阈值都会直接判定为换色/微调复用。validator 每次都会重造这三类伪装件校准阈值。
`icon-base/` 保存本主题自己的图标母版。攻击特效不能沿用旧套装轮廓换色：
`effect-chroma/` 保存五张独立绿幕原画，构建器自行抠出软 Alpha，并同步生成
`effect-base/` 与运行时 512×512 PNG。五职业构图分别是六棱雪刃斩、冰晶法阵、
银铃雪符、五道冰爪与猫爪爆点、横向居合雪线，均带少量珍珠流苏和中国结红点缀。

生成约束统一为：纯 `#00FF00` 背景、无人物/文字/边框/场景/玫瑰/蝴蝶，主体限制在
86% 安全区，白 + 冰蓝 + 淡樱粉玻璃光。资产门禁除尺寸、透明度和绿幕残留外，
还会裁出 Alpha 包围盒、归一到 128×128，允许小范围平移并同时比较水平镜像后，
再与旧精品套计算 IoU。实测独立新图最大为 `0.589`，已知旧图经过 10×7px 平移、
97% 缩放或水平镜像后的最低锚点仍为 `0.870`，因此把两组证据之间的 `0.82`
设为硬阈值；达到即判定为换色/微调复用并阻止上线。完整 RGBA 哈希不同不能代替这条检查。

## 重建与验收

```powershell
node scripts/build-ice-snow-assets.mjs
node scripts/validate-ice-snow-assets.mjs
node scripts/capture-ice-snow-qa.mjs
```

最终证据包括五职业合成联系表、精品店 390×844 / 320×568，以及五职业各自两种尺寸
的真实浏览器实穿截图。只要任一截图出现穿模、离手、压脸、裁切或坏图，套装不得上线。
