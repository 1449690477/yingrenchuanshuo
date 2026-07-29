# 区域 5 物品与装备 ImageGen 生产记录

> 运行时只提交 256×256 RGBA PNG；ImageGen 原始输出与官方抠图生成的 Alpha 母版保存在仓库外：
> `C:/Users/Administrator/Desktop/二次元传奇项目/yingrenchuanshuo-art-source-r5/items-equipment/`。

## 统一生产约束

- 用途：`stylized-concept`，单个独立的二次元手游物品/装备图标源图。
- 构图：完整主体居中，画布占比约 60%–78%，缩到 48px 仍能辨认轮廓。
- 风格：圆润、柔和、高级粉蓝玻璃感；高光干净，不画写实粗粝材质。
- 普通 R5 装备：珍珠白、冰蓝、粉色为主，珊瑚红和暖金只作克制的火纹点缀。
- 绯焰六件套：深绯红漆金为主，统一白莲、心形红宝石、冰蓝晶石与“双焰徽记”，复杂度显著高于普通装。
- 背景：每个背景像素必须为单一、平坦、精确的 `#00ff00`；无渐变、纹理、地面、接触阴影、反射、场景、画框、光晕或背景光照变化。
- 禁止：物体上出现绿色；人物、身体、模特、手、文字、字母、数字、UI、Logo、水印、重复物品或裁切。
- 每个资产均为一次独立 ImageGen 调用，不从其他图标裁切或复用占位图。

## 官方抠图命令

```powershell
python "C:/Users/Administrator/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py" `
  --input "<chroma.png>" `
  --out "<alpha.png>" `
  --key-color "#00ff00" `
  --soft-matte `
  --transparent-threshold 12 `
  --opaque-threshold 220 `
  --despill `
  --edge-contract 1 `
  --force
```

抠图前后文件由 `ITEMS-EQUIPMENT-SHA256.txt` 锁定。运行时构建命令：

```powershell
node scripts/build-region5-items-equipment.mjs
node scripts/validate-region5-items-equipment.mjs
node scripts/build-region5-items-equipment-contact-sheet.mjs
```

## 5 张掉落物

| 稳定 ID | 中文名 | 独立视觉指令 | ImageGen call ID |
|---|---|---|---|
| `slag_lava` | 熔岩渣 | 三块相连的圆润炭黑熔渣，珊瑚熔纹、金色晶粒、少量粉蓝玻璃凝珠；低阶但不脏乱 | `call_JdjTeVzcpRz0E96Q9U5Ynb3A` |
| `shard_scorched` | 焦岩碎片 | 四片扇形焦岩薄片，黑褐基底、赤金火线、粉蓝晶化断口；比熔岩渣更规整 | `call_6oYc2DVMZbbtqCVs90LmvI5j` |
| `ember_ritual` | 祭火余烬 | 粉蓝珍珠莲座小圣匣，中央封存一簇赤金仪式火焰；精良阶、神圣但紧凑 | `call_FHV9vepqM9lVJFJ7SZac4XjG` |
| `core_moltenheart` | 熔心核心 | 大颗红色切面熔心，被粉蓝水晶壳包裹，金色热纹从核心向外扩散；高阶核心感 | `call_sedz7HamGorBrlo0uPjtBAtf` |
| `frag_crimson` | 绯焰碎片 | 单片绯红装甲花瓣，赤金双焰徽记、白蓝晶边与粉色铆钉；一眼关联绯焰套装 | `call_LIhLaA6Oyc3qDq8QMyPBvUeR` |

源路径：`chroma/items/{id}.png`、`alpha/items/{id}.png`

运行时：`public/assets/items/{id}.png`

## 8 张普通装备

| 稳定 ID | 中文名 | 独立视觉指令 | ImageGen call ID |
|---|---|---|---|
| `r5-weapon` | 绯金誓刃 | 珍珠白/冰蓝晶刃，珊瑚火槽、细金护手、粉色宝石和短穗；轻盈实用 | `call_FxdDN2cCgWwMtdVqOrikNBKo` |
| `r5-head` | 火纹祭冠 | 低矮珍珠白冰蓝额冠，中央珊瑚火纹和粉色水滴宝石；不用高冠和双焰徽记 | `call_coSiz14xp0hxImP91bMigCsI` |
| `r5-body` | 赤焰祭礼裙 | 空置珍珠白/冰蓝/浅粉祭礼裙，珊瑚腰带和细金边；圆润轻便 | `call_EZYPlDfkcoTGGgEIRqZJMy1T` |
| `r5-necklace` | 余烬心坠 | 完整细金椭圆链，白莲、红色余烬水滴、冰蓝侧瓣和粉珠；保持小尺寸可读 | `call_O2LNTOZGi1pbAi42RmJzFKnp` |
| `r5-bracelet` | 熔纹护腕 | 一对交叉珍珠白冰蓝护腕，克制珊瑚熔纹和细金收边；无传奇翅焰 | `call_Ywe9HXj0qHFYo4FqlHHRJhwA` |
| `r5-ring` | 誓火金戒 | 单枚暖金戒，浅蓝托座、珊瑚火石、白色花瓣与粉色点缀；造型简洁 | `call_w6DT7rP3qpQwdTqKBcOMDwOT` |
| `r5-belt` | 赤金绶带 | 珍珠白冰蓝宽绶带，浅粉蝴蝶结、细金边和克制珊瑚火绣；完整椭圆腰带 | `call_kPmehDJXDtLFeUsmPXCp3aWa` |
| `r5-shoes` | 焰步短靴 | 一对空置交叉短靴，珍珠白鞋身、冰蓝鞋头、粉色扣带和珊瑚火绣 | `call_HE5ST7ESVFbWOOxVJ5Qua7QI` |

源路径：`chroma/equipment/r5/{slot}.png`、`alpha/equipment/r5/{slot}.png`

运行时：`public/assets/equipment/r5/{slot}.png`

## 6 张绯焰誓约套装

| 稳定 ID | 中文名 | 独立视觉指令 | ImageGen call ID |
|---|---|---|---|
| `r5-crimson-weapon` | 维斯塔誓焰刃 | 深绯红漆晶单手礼刃，暖金刃缘、冰蓝芯线；护手为白莲心宝石与巨大双焰徽记 | `call_CcRhuMLLItpepLlUMHrN3Tjl` |
| `r5-crimson-head` | 绯焰圣冠 | 两片高耸对称绯红焰翼构成圣冠，暖金冠环、白莲、心形红宝石和冰蓝水滴 | `call_3JHsSfoF1b47E4o1Vb697CE3` |
| `r5-crimson-body` | 绯焰誓约礼装 | 空置绯红漆金战斗礼装，白莲心宝石、冰蓝肩晶；裙摆展开为对称双焰翼 | `call_XhNX9VSimRDi1eCsjuwMCdu3` |
| `r5-crimson-necklace` | 熔心誓坠 | 完整粗金链，白莲托住巨大熔心；两侧深绯焰翼、冰蓝水滴与珍珠流苏 | `call_EQixU9WBoYWGD9xcat90A3Qn` |
| `r5-crimson-ring` | 不灭焰戒 | 厚暖金绯红戒环，白莲托心形焰晶，两侧紧凑双焰翼和冰蓝方晶 | `call_Xz5nKwmCnjuK4m1gkbKnbigh` |
| `r5-crimson-bracelet` | 赤金焰护 | 一对交叉深绯漆金护臂，白莲腕口、心形红晶、冰蓝方晶；外侧焰翼组成双焰徽记 | `call_by8p6sbpI4NRBZVynUToNieV` |

源路径：`chroma/equipment/r5-crimson/{slot}.png`、`alpha/equipment/r5-crimson/{slot}.png`

运行时：`public/assets/equipment/sets/r5-crimson/{slot}.png`

## 视觉验收

- 普通装备在 48px 下首先读到“珍珠白/冰蓝/粉色”，套装首先读到“深绯红/暖金/双焰”，两者不得只靠文件名区分。
- 19 张运行时图标均为独立像素内容、透明四角、主体四边至少 12px 安全留白，单张不超过 120KiB。
- 联系表：`art-source/qa/r5-items-equipment-contact.webp`。
