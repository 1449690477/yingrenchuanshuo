# 月桂星糖茶会（moon-sugar）素材生产记录

## 生产方式

- 模式：Codex 内置 ImageGen（`stylized-concept`），每个不同资产独立调用。
- 绿幕：所有源图使用纯色 `#00ff00`；项目内副本位于
  `tmp/imagegen/moon-sugar/green-*.png`。
- 抠图：统一执行官方脚本：

```powershell
python C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py `
  --input <green-source.png> `
  --out <alpha-source.png> `
  --auto-key border `
  --soft-matte `
  --transparent-threshold 12 `
  --opaque-threshold 220 `
  --despill
```

- 对齐、裁切和压缩：`node art-source/shop/moon-sugar/process.mjs`
- 主色：夜蓝、月白、奶金、淡紫；元素：月兔、月桂、月相、星糖。

## 每次生成调用的共享约束

以下内容附加在每条 prompt 后：

> Scene/backdrop: perfectly flat exact #00ff00 chroma-key background.
> Constraints: isolated requested asset only; no unrelated object, person,
> mannequin, face, hair, skin, hands, legs, text, watermark, cast/contact
> shadow or reflection. Background must be one uniform exact #00ff00 with no
> gradient, texture, floor, vignette or lighting variation. Do not use
> #00ff00 in the asset.

纸娃娃输入图仅作为姿势与比例参考，prompt 明确要求不得复现人物。

## 12 张纸娃娃分层

| 资产 | 独立 prompt 主体与构图 | 参考图 | 绿幕源 | 最终文件 |
|---|---|---|---|---|
| 剑姬衣裙 | 仅生成夜蓝/月白/奶金/月兔刺绣的华丽洛丽塔战裙；空领口与袖口；概念 640×960 锚点：领口 y145、腰 y355、裙摆 y535 | `public/assets/characters/modular/swordsman/base.png` | `tmp/imagegen/moon-sugar/green-swordsman-body.png` | `public/assets/characters/modular/shop/moon-sugar/swordsman-body.png` |
| 魔女衣裙 | 仅生成短款月桂星糖洛丽塔裙；月白泡袖开口、淡紫薄纱；领口 y170、腰 y370、裙摆 y535，明确禁止长礼服 | `public/assets/characters/modular/witch/base.png` | `tmp/imagegen/moon-sugar/green-witch-body.png` | `public/assets/characters/modular/shop/moon-sugar/witch-body.png` |
| 灵巫衣裙 | 仅生成无袖短款月兔洛丽塔战裙；东方结饰细节；领口 y160、腰 y380、裙摆 y550 | `public/assets/characters/modular/shaman/base.png` | `tmp/imagegen/moon-sugar/green-shaman-body.png` | `public/assets/characters/modular/shop/moon-sugar/shaman-body.png` |
| 剑姬头冠 | 仅生成夜蓝新月迷你礼帽、月白蕾丝、淡紫薄纱、兔耳与星糖晶石；中心约 x325/y85 | 剑姬底模 | `tmp/imagegen/moon-sugar/green-swordsman-head.png` | `public/assets/characters/modular/shop/moon-sugar/swordsman-head.png` |
| 魔女头冠 | 同系列轻巧月兔薄纱礼帽；适配短发头型；中心约 x320/y110 | 魔女底模 | `tmp/imagegen/moon-sugar/green-witch-head.png` | `public/assets/characters/modular/shop/moon-sugar/witch-head.png` |
| 灵巫头冠 | 同系列长薄纱礼帽；在深色长发上保持清晰轮廓；中心约 x325/y90 | 灵巫底模 | `tmp/imagegen/moon-sugar/green-shaman-head.png` | `public/assets/characters/modular/shop/moon-sugar/shaman-head.png` |
| 剑姬鞋 | 仅生成一双月兔珍珠短靴；宽站姿，概念锚点 x205/x450、y850 | 剑姬底模 | `tmp/imagegen/moon-sugar/green-swordsman-shoes.png` | `public/assets/characters/modular/shop/moon-sugar/swordsman-shoes.png` |
| 魔女鞋 | 仅生成一双月兔珍珠短靴；窄站姿，概念锚点 x270/x375、y845 | 魔女底模 | `tmp/imagegen/moon-sugar/green-witch-shoes.png` | `public/assets/characters/modular/shop/moon-sugar/witch-shoes.png` |
| 灵巫鞋 | 仅生成一双带东方绳结的月兔短靴；锚点 x280/x370、y825 | 灵巫底模 | `tmp/imagegen/moon-sugar/green-shaman-shoes.png` | `public/assets/characters/modular/shop/moon-sugar/shaman-shoes.png` |
| 剑姬武器 | 月桂星糖新月刃：夜蓝刀芯、月白刃、奶金月桂护手、淡紫星晶；握柄对齐左拳，刀锋向左上 | 剑姬底模 | `tmp/imagegen/moon-sugar/green-swordsman-weapon.png` | `public/assets/characters/modular/shop/moon-sugar/swordsman-weapon.png` |
| 魔女武器 | 月兔杖：奶金月环、淡紫星晶、坐月兔、夜蓝杖身；位于人物左侧，禁止遮脸与躯干 | 魔女底模 | `tmp/imagegen/moon-sugar/green-witch-weapon.png` | `public/assets/characters/modular/shop/moon-sugar/witch-weapon.png` |
| 灵巫武器 | 祷灯：月白灯面、奶金框、夜蓝珐琅、淡紫灵晶、月兔镂空与流苏；短柄对齐左手 | 灵巫底模 | `tmp/imagegen/moon-sugar/green-shaman-weapon.png` | `public/assets/characters/modular/shop/moon-sugar/shaman-weapon.png` |

## 4 张独立首饰 / 腰带图标源

| 商品 | 独立 prompt 主体 | 绿幕源 | 最终文件 |
|---|---|---|---|
| 星砂月相颈链 | 夜蓝缎带项圈、奶金月相、月白珍珠、淡紫八芒星糖吊坠与小月兔坠饰；正面商品图 | `tmp/imagegen/moon-sugar/green-necklace.png` | `public/assets/equipment/shop/moon-sugar/necklace.png` |
| 月辉蕾丝手镯 | 夜蓝蕾丝圆环、奶金新月、月白珍珠、淡紫星晶和月兔吊饰；三分之四商品视角 | `tmp/imagegen/moon-sugar/green-bracelet.png` | `public/assets/equipment/shop/moon-sugar/bracelet.png` |
| 新月祷愿戒 | 单枚奶金戒指、夜蓝珐琅肩部、淡紫八芒星主石、月兔雕刻和珍珠；三分之四商品视角 | `tmp/imagegen/moon-sugar/green-ring.png` | `public/assets/equipment/shop/moon-sugar/ring.png` |
| 夜蓝蝴蝶腰封 | 单件夜蓝天鹅绒束腰、奶金滚边、月白蕾丝、新月扣、淡紫星晶和对称蝴蝶结；正面横构图 | `tmp/imagegen/moon-sugar/green-belt.png` | `public/assets/equipment/shop/moon-sugar/belt.png` |

衣裙、头冠、鞋和三职业武器的商店图标由对应合格分层源裁切，
输出为：

- `body.png`
- `head.png`
- `shoes.png`
- `weapon-swordsman.png`
- `weapon-witch.png`
- `weapon-shaman.png`

## 3 张职业攻击特效

| 职业 | 独立 prompt 主体 | 绿幕源 | 最终文件 |
|---|---|---|---|
| 剑姬 | 左下至右上的月桂新月剑弧；月白实色核心、奶金边、淡紫星糖火花和夜蓝碎月；紧凑辉光，无武器/人物 | `tmp/imagegen/moon-sugar/green-effect-swordsman.png` | `public/assets/effects/boutique/moon-sugar-swordsman.png` |
| 魔女 | 月兔骑乘淡紫八芒星流星；月白/奶金彗尾、星糖晶粒与两枚新月；紧凑辉光，无法杖/人物 | `tmp/imagegen/moon-sugar/green-effect-witch.png` | `public/assets/effects/boutique/moon-sugar-witch.png` |
| 灵巫 | 三枚淡紫月兔灵火围绕奶金新月祷印旋转；夜蓝焰心、月白星粒与兔形纸符；无灯笼/人物 | `tmp/imagegen/moon-sugar/green-effect-shaman.png` | `public/assets/effects/boutique/moon-sugar-shaman.png` |

## 验收结果

- 三职业底模合成图：
  - `tmp/imagegen/moon-sugar/preview-swordsman.png`
  - `tmp/imagegen/moon-sugar/preview-witch.png`
  - `tmp/imagegen/moon-sugar/preview-shaman.png`
- 图标总览：`tmp/imagegen/moon-sugar/preview-icons.png`
- 特效总览：`tmp/imagegen/moon-sugar/preview-effects.png`
- 12 张分层全部为 `640×960 RGBA`，四角 alpha=0，残留高饱和绿色像素=0，
  单文件 `14.4–64.2KB`（要求 `<300KB`）。
- 10 张图标全部为 `256×256 RGBA`，四角透明，残绿=0，
  单文件 `7.8–25.5KB`（要求 `<80KB`）。
- 3 张特效全部为 `512×512 RGBA`，四角透明，残绿=0，
  单文件 `59.9–89.7KB`（要求 `<180KB`）。
- 视觉检查：无人、无皮肤、无文字、无水印、无投影；人物脸部和主要手势未被衣裙/
  头冠遮挡；鞋与底模脚位一致；三把武器分别贴合职业姿势。
- 主体覆盖率：分层 `1.9%–13.9%`、图标 `5.5%–44.3%`、特效
  `23.3%–43.8%`，没有空图或贴边裁切。
