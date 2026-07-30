# 区域 7「血月峡谷」美术生产记录

## 生产边界

- 共 81 个独立 ImageGen 调用：地图 6、战场 5、怪物 24、材料 5、普通装备 8、血月套 8、套装徽章 1、普通纸娃娃层 12、血月纸娃娃层 12。
- 每个稳定 ID 与唯一调用 ID 的机器可读对应关系以 `scripts/region7-assets-manifest.mjs` 为准；禁止用换色、复制、emoji、通用占位图或其他区域资产补缺。
- 不透明场景与透明资产的 chroma / Alpha 母版保留于仓库外独立美术源目录 `yingrenchuanshuo-art-source-r7`。主仓只提交压缩后的运行时资产、SHA-256 来源锁和 QA 联系表。

## 统一视觉母题

清新可爱、圆润高级的二次元放置 RPG 风格。区域色为血月红、莓果粉、黑紫、淡丁香与少量粉蓝玻璃光；危险感来自月蚀、雾气和峡谷纵深，不使用写实血腥。

六张地图从血雾入口逐层走向血月祭坛，五张战场均为 3:2 横向构图，下半部保留角色与怪物的对战空间。所有场景禁止文字、UI、人物主体与水印。

怪物使用完整轮廓、正面三分之四视角。普通怪偏圆润可爱，精英和 BOSS 增加礼装、月环与仪式感；「小恶魔娘三姐妹」必须恰好三位成年女性，服装完整且不暴露；「血月恶魔·莉莉姆」以巨大蚀月光环和红黑礼装形成唯一轮廓。

## 透明资产绿幕模板

所有怪物、材料、装备和纸娃娃层先使用均匀 `#00FF00` 绿幕，无地面、无投影、无文字、无边框；之后统一执行：

```text
remove_chroma_key.py --auto-key border --soft-matte
  --transparent-threshold 12 --opaque-threshold 220
  --despill --edge-contract 1 --force
```

Alpha 母版与 chroma 母版一一保留，来源锁同时校验尺寸、透明边缘、绿幕残留、唯一调用 ID 和 SHA-256。

## 装备与纸娃娃约束

- 背包装备图标是八部位通用展示；武器不得画成只属于剑士的一把剑。
- 角色实际装备图标由真实纸娃娃武器层确定性裁切生成，因此列表、图鉴和人物手里的武器保持同源。
- 剑士：月牙长刃；魔女：血月法杖；巫女：月影折扇；喵喵：左右一对猫爪，禁止剑。
- 普通与血月版本均拆为 `body / head / weapon` 三层。人物脸、头发、手、猫耳、猫尾和基础动作不得烘焙进装备层。
- 喵喵衣装必须预留猫耳、猫尾和双爪空间；头饰不得压住猫耳，武器层必须分别覆盖左右手。

## 构建与验收

```bash
$env:REGION7_ART_SOURCE_ROOT='C:\Users\Administrator\Desktop\二次元传奇项目\yingrenchuanshuo-art-source-r7'
npm run assets:region7
npm run assets:region7:source-check
```

运行时规格：地图 768×1024 WebP、战场 1536×1024 WebP、怪物 512×512 透明 WebP、物品 / 装备 256×256 RGBA PNG、纸娃娃层 640×960 RGBA PNG。总联系表位于 `art-source/qa/r7-assets-contact.webp`，四职业穿戴接触表位于 `art-source/qa/r7-appearance-contact.webp`。
