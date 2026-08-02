# 樱酱第二轮视觉母版

## 目标

- 保留樱酱已经上线的成年娇小猫耳剑士身份：雪白长发、白猫耳、冰蓝眼、蓝白粉配色、居合刀。
- 第二轮只提升清晰度、材质统一和战斗姿态，不把角色幼儿化，不增加暴露度，不改变装备与技能契约。
- 立绘和施法立绘都以 1024×1536 绿幕母版保存，再经统一软蒙版、去溢色和 640×960 缩放生成运行时图片。

## 主立绘生成提示词

```text
Edit the supplied production character reference. Preserve the exact adult petite white-haired cat-eared swordswoman identity, icy-blue eyes, white cat ears, blue-white-pink palette, face, proportions and ornate iaido outfit. Produce a clean high-end anime game character illustration with controlled cel shading, smooth fabric gradients and crisp line work. Remove grain, canvas texture, paper texture, watercolor noise, chromatic fringe, halo, glow haze and compression artifacts. Full body, hands and feet visible, generous padding, one character only. Perfectly flat green-screen background, no shadow, no floor, no text, no watermark.
```

## 战斗施法立绘生成提示词

```text
Edit the supplied cast/action reference and use the approved R2 portrait as identity and rendering reference. Preserve the same adult petite white-haired cat-eared iaido swordswoman, face, costume and blue-white-pink palette. Dynamic draw-cut pose with both sword and scabbard clearly readable, clean high-end anime game rendering, controlled cel shading and crisp edges. Remove grain, canvas texture, paper texture, watercolor noise, chromatic fringe, halo, glow haze and compression artifacts. Full body contained with generous padding, one character only. Perfectly flat green-screen background, no shadow, no floor, no text, no watermark.
```

## 可复现处理

所有 `*-chroma.png` 统一调用 Codex imagegen 自带的 `remove_chroma_key.py`：

```text
--auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
```

随后只清理半透明边缘的绿溢色与黑色蒙版污染；不对主体做磨皮、锐化或纹理滤镜。

## 竞技场“瞬樱·归鞘指环”真实穿戴层

`arena/blinkbloom-return-ring.png` 不是把商品图标缩小贴到人物上，而是由
`scripts/build-kenshi-r2-assets.mjs` 在樱酱右手/手腕锚点确定性绘制：

- 金色椭圆圣痕环：对应竞技场的荣耀与裁决；
- 湖蓝剑气圆阵：对应樱酱的冰系居合身份；
- 一枚小樱花与三点金光：保持蓝白粉角色识别；
- 画布固定 `640×960`，`alpha>20` 可见像素保持 `2500–5000`、手腕合同区至少 `900`；禁止变回 `26×26` 商品贴图，也禁止扩成遮住人物的整圆光盘。

这张层不依赖随机生成，因此每次 R2 `--check`、`--source-check` 和旧 wearables `--check` 都会逐像素复验。

R2 `--check` 只使用仓内透明母版，可在 GitHub Actions 跨平台运行；`--source-check` 才调用
本机 Codex 官方抠图工具，从绿幕重新生成并复验透明母版。发布前两层都必须通过。
