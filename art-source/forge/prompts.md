# 锻造阶段光环素材生成记录

生成方式：OpenAI ImageGen 全新生成；先输出纯绿色背景位图，再使用项目标准色键脚本抠成透明 PNG。
统一要求：可爱日系幻想手游、正交正面、空心圆环、中心完全留空、无文字、无人物、无装备、无界面底板、单一主体、适合叠加在 256×256 装备图标上。

## 微光（+5）

> Cute Japanese fantasy mobile game equipment enhancement overlay, a delicate hollow circular halo made of silver-white and pale cyan magical light, four small diamond ornaments and sparse star sparks, clean symmetrical front view, center fully empty, single isolated object, bright chroma green background, no text, no equipment, no character, no frame or square panel.

## 辉光（+9）

> Cute Japanese fantasy mobile game equipment enhancement overlay, a stronger hollow circular halo made of sapphire blue, icy cyan and polished silver magical arcs, crystalline shards and six-point star glints, clean symmetrical front view, center fully empty, single isolated object, bright chroma green background, no text, no equipment, no character, no frame or square panel.

## 星铸（+12）

> Cute Japanese fantasy mobile game equipment enhancement overlay, a luxurious hollow circular astral halo made of violet, lavender and pearlescent white energy, ornate crystal star crowns with tiny floating stardust, clean symmetrical front view, center fully empty, single isolated object, bright chroma green background, no text, no equipment, no character, no frame or square panel.

## 樱华（+15）

> Cute Japanese fantasy mobile game equipment enhancement overlay, a premium hollow circular sakura halo made of warm gold, blush pink and pearly white light, ornate cherry blossom crowns, petals and tiny golden stars, clean symmetrical front view, center fully empty, single isolated object, bright chroma green background, no text, no equipment, no character, no frame or square panel.

## 后处理

色键脚本参数：

```text
--auto-key border --soft-matte --transparent-threshold 12
--opaque-threshold 220 --despill
```

`art-source/forge/icon-*.png` 保留 1256×1256 透明母版；运行时文件缩放为 240×240 后置于 256×256 透明画布中央，四周各保留 8 px 安全边距，并以 PNG 调色板压缩。
