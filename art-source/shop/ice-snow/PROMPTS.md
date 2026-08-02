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
透明层，构建器只读取这份任务内母版，不再依赖仍会继续修订的 `rose-night` 运行资产。
重建时只改变色彩与纹样：深红/紫转象牙白和冰蓝阴影，金属转银色，
再在原透明轮廓内部叠加雪花和中国结点缀。输出 Alpha 必须与母版逐像素一致，避免
武器离手、帽子压脸、裙摆穿腿或鞋底漂移。帽区按首轮实机证据做 180px → 100px
纵向校正；樱酱衣裙槽另生成同源 256×256 缩略图，不显示通用空心裙。
`icon-base/` 与 `effect-base/` 同样保存本主题自己的图标和战斗光效母版；重建器不读取
其它精品主题的运行时输出，避免别的套装修订后让冰雪门禁被动变红。

## 重建与验收

```powershell
node scripts/build-ice-snow-assets.mjs
node scripts/validate-ice-snow-assets.mjs
node scripts/capture-ice-snow-qa.mjs
```

最终证据包括五职业合成联系表、精品店 390×844 / 320×568，以及五职业各自两种尺寸
的真实浏览器实穿截图。只要任一截图出现穿模、离手、压脸、裁切或坏图，套装不得上线。
