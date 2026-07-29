# 区域 6「幽影祀塔」美术生产记录

## 生产边界

- 共 80 个独立 ImageGen 调用：地图 6、战场 5、怪物 24、材料 5、普通装备 8、幽影套 8、普通纸娃娃层 12、幽影纸娃娃层 12。
- 每个稳定 ID 与唯一调用 ID 的机器可读对应关系以 `scripts/region6-assets-manifest.mjs` 为准；禁止用换色、复制或通用占位图补缺。
- 原始图保留于 `~/.codex/generated_images`，chroma 与 Alpha 母版保留于仓库外 `yingrenchuanshuo-art-source-r6`。主仓只提交压缩运行时资产。

## 统一视觉母题

清新可爱、圆润高级的二次元放置 RPG 风格。区域色为薰衣草紫、烟紫、珍珠白、月银与少量青色玻璃光；地图从石像回廊逐层走向虚空祭坛，五张战场下半部保留双方战斗空间。

怪物采用单主体、完整轮廓、正面三分之四视角。普通怪偏圆润，精英具有人形威压，最终 BOSS「幽影教主·诺瓦」以巨大月环、星象法术和墨紫礼装形成唯一轮廓。

## 透明资产绿幕模板

所有怪物、材料、装备和纸娃娃层使用均匀 `#00FF66` 绿幕、无地面、无投影、无文字、无边框。随后统一执行：

```text
remove_chroma_key.py --auto-key border --soft-matte
  --transparent-threshold 12 --opaque-threshold 220
  --despill --edge-contract 1 --force
```

## 纸娃娃约束

- 剑士：修身战裙、低位月冠、直剑。
- 魔女：短款法裙、小贝雷帽、法杖。
- 巫女：层叠祭服、侧发饰、折扇。
- 喵喵：无袖短装并留尾巴通道；额饰不得遮猫耳；武器必须是左右一对猫爪。
- 普通与幽影版本均拆为 `body / head / weapon` 三层，人物脸、头发、手与基础动作不烘焙进装备层。

## 构建与验收

```bash
npm run assets:region6
npm run assets:region6:source-check
```

运行时规格：地图 768×1024 WebP、战场 1536×1024 WebP、怪物 512×512 透明 WebP、物品/装备 256×256 RGBA PNG、纸娃娃层 640×960 RGBA PNG。总联系表位于 `art-source/qa/r6-assets-contact.webp`。
