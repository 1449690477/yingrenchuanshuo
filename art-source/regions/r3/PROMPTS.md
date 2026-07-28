# 区域 3「虫娘洞窟」资产提示词与重建记录

本文件是区域 3 全部视觉资产的唯一可复现记录。总计 **46 个互不复用的资产**：

- 1 张区域总览地图
- 5 张章节封面
- 5 张独立挂机战场
- 23 只怪物
- 4 个区域材料
- 8 个装备部位图标

所有位图都由内置 ImageGen 独立生成；一个稳定 key 对应一次独立生成请求，不用占位图、不复制同一张图充数，也不把一张图裁成多个资产。

## 1. 总体美术约束

- 游戏风格：清新可爱的日系二次元放置 RPG，圆润柔和、蓝白粉玻璃质感。
- 区域辨识：深青 / 藏蓝洞窟，青蓝菌灯、珍珠蛛丝、淡紫卵壳与少量暖琥珀巢蜜。
- 气氛：神秘、温柔、可亲，不做血腥、黏液、寄生、写实昆虫恐怖。
- 人形虫娘必须明确成年、服装完整、非性化。
- 场景不出现人物、怪物、文字、UI、边框、水印。
- 透明资产先生成在严格统一的纯色 `#00ff00` 绿幕上；主体不得使用亮绿色，不生成地面、投影或外发光光晕。

## 2. 路径和运行规格

| 类别 | 源文件 | 运行文件 | 运行规格 |
|---|---|---|---|
| 区域 / 章节图 | `art-source/regions/r3/maps/*-source.png` | `public/assets/maps/*.webp` | 768×1024，不透明 WebP，≤450KB |
| 战场 | `art-source/regions/r3/battlefields/*-source.png` | `public/assets/battlefields/*.webp` | 1536×1024，不透明 WebP，≤520KB |
| 怪物绿幕 | `art-source/regions/r3/monsters/<id>-chroma.png` | — | 每只独立绿幕原图 |
| 怪物透明母版 | `art-source/monsters/r3/<id>.png` | `public/assets/monsters/r3/<id>.webp` | 512×512 透明 WebP，≤120KB，可见底边 y=503 |
| 材料 | `art-source/regions/r3/items/<id>-chroma.png` / `<id>-alpha.png` | `public/assets/items/<id>.png` | 256×256 RGBA PNG，≤120KB |
| 装备 | `art-source/regions/r3/equipment/<slot>-chroma.png` / `<slot>-alpha.png` | `public/assets/equipment/r3/<slot>.png` | 256×256 RGBA PNG，≤120KB |

## 3. 场景公共提示词

以下“公共提示词 + 对应 stable key 的差异段”组成一次完整请求。

### 3.1 竖版地图公共提示词

> Use case: stylized-concept. Create one premium vertical 3:4 environment illustration for a cute Japanese mobile RPG. Clean painterly anime background, rounded fantasy forms, deep navy and dark-teal cave stone, cyan bioluminescence, pearl silk, lavender and soft pink glass accents, gentle high-end mobile-game finish. Establish a readable foreground, middle ground and distant destination with a clear path for a chapter cover. No people, monsters, text, logo, UI, frame, gore or horror.

| stable key | 差异提示词 | ImageGen 生成记录 |
|---|---|---|
| `r3` | 虫娘洞窟的纵向剖面总览；同一条螺旋洞路依次串起洞窟入口、蛛网回廊、幽光菌道、地下湖畔和最深处虫母巢穴，五层地标都能读出，顶端有柔和天光。 | `call_xcO8TmNRHBSEHJGhcgZyBOQM` |
| `chapter-3-1` | 洞窟入口；长满蓝青苔纹的岩拱、向下延伸的石阶、少量粉紫菌灯和远处青光，空间开阔、具有“刚踏入新区”的邀请感。 | `call_gFabb09hZ0d6X2JNySQWxhJV` |
| `chapter-3-2` | 蛛网回廊；珍珠银丝像薄纱帷幕跨越拱顶，垂落水滴宝珠，深蓝石路贯穿画面，结构优雅而非恐怖蛛网。 | `call_WI4QrarUuaom64E2MaMDOsop` |
| `chapter-3-3` | 幽光菌道；大小错落的蓝青与粉紫发光伞菇形成隧道，菌盖内光照亮石板路，清新梦幻、无毒雾。 | `call_xESA34I5a9Xtp14oWMRJhBS9` |
| `chapter-3-4` | 地底湖畔；镜面蓝湖、弧形浅滩石路、远方瀑布与晶亮钟乳石，湖岸有少量粉色洞花，宁静通透。 | `call_mLfA9LEy88MAg9OFNxZg6TxT` |
| `chapter-3-5` | 虫母巢穴；珍珠卵形圣物、银丝帷幔、暗青甲壳蜂房结构与菌灯围成母巢圣所，中心道路明确；强调有机母巢，不做水晶宫殿。 | `call_razoeJdNCqSiqIeQKdiPpNJG` |

### 3.2 横版战场公共提示词

> Use case: stylized-concept. Create one independent 3:2 horizontal battle arena background for a cute Japanese mobile RPG. Premium clean anime environment, navy / dark-teal cave palette with cyan, pearl, lavender and restrained pink light. The lower 48–50% must be a broad, flat, low-detail combat floor; keep left, center and right deployment zones clear. Add depth only in the rear half. No people, monsters, text, UI, border, foreground obstruction, gore or horror.

| stable key | 差异提示词 | ImageGen 生成记录 |
|---|---|---|
| `battlefield:chapter-3-1` | 宽阔洞口石坪，远处天光与青蓝洞壁形成明暗层次，边缘只放低矮菌花和少量晶石。 | `call_h2iyx07fDLfJtJeiIzzl6reu` |
| `battlefield:chapter-3-2` | 蛛网回廊战场，后景用珍珠蛛丝穹顶、银丝垂饰和纤细拱柱识别章节，前景保持深蓝平坦地面。 | `call_JBlhGFY1q9n6SExtPN09FPwQ` |
| `battlefield:chapter-3-3` | 幽光菌道战场，后景是蓝青与粉紫巨型菌伞群和点状菌灯，前景是宽阔冷色石坪。 | `call_pnOUe3cLg0mk8XFOgV2UIqPv` |
| `battlefield:chapter-3-4` | 地底湖畔战场，后景为湖面、瀑布和冰蓝钟乳石，前景是与湖水分离的浅色圆形石坪。 | `call_mdc0tmCphWvwNJxBE3KWnFxG` |
| `battlefield:chapter-3-5` | 最终版：后景必须是大量珍珠卵囊、银丝穹顶、暗青甲壳蜂房侧室和少量菌灯；前景为宽阔深青母巢地面，禁止水晶王座与宫殿祭坛感。 | `call_INEzvQ98TxCmQ6X258JJ3FbB` |

`battlefield:chapter-3-5` 首稿 `call_jTmmrsZpuGMh4D9JfytIVrCm` 因水晶宫殿 / 祭坛语义过强、与区域 2 撞题而废弃；运行资产只使用表中最终重绘版。

## 4. 怪物公共提示词

> Use case: stylized-concept. Asset type: one isolated full-body battle monster sprite for a cute Japanese mobile RPG. Premium clean anime game asset, rounded silhouette, crisp painterly rendering, navy / dark teal / pearl / cyan / lavender palette, subtle opaque glass and chitin highlights, readable at small size. Exactly one centered subject, three-quarter view facing left, complete body and appendages inside frame with generous padding. Background must be exact uniform pure chroma green `#00ff00`. No gradient, texture, floor, cast shadow, external glow halo, reflection, scenery, frame, text, UI, logo, duplicate, gore, horror or bright green on the subject. Wings and glasslike parts remain visually opaque.

| stable key | 名称 | 差异提示词 | ImageGen 生成记录 |
|---|---|---|---|
| `mon_3-1_0` | 岩甲虫娘 | 成年甲虫骑士娘；藏蓝岩甲、青色甲缝、厚重背甲与短触角，无武器，稳固护卫姿态。 | `call_xhkABmTW7t2nRVrXG15MZ9bL` |
| `mon_3-1_1` | 灯笼蛾灵 | 非人形可爱蛾灵；粉蓝王纹翅、珍珠绒毛、腹部一枚暖色封闭灯笼，悬浮姿态。 | `call_bKuT6NJXsjK74hKEaZdFYx3A` |
| `mon_3-1_2` | 苔藓蜗牛 | 淡蓝蜗牛、深蓝螺旋壳、蓝青绒苔与淡紫小菌芽，低宽轮廓，不做黏液。 | `call_Pl26JM4TalldjRrak6sYkrLB` |
| `mon_3-1_3` | 水晶蚁兵 | 小型藏蓝蚁兵，青晶额甲与一面冰晶壳盾，六足完整，勇敢但可爱。 | `call_36fOaQu49DSxhyUvmq020L8g` |
| `mon_3-2_0` | 丝囊蛛灵 | 圆润珍珠白蛛灵，八条短藏蓝甲足，背负扎好的巨大丝囊，淡紫吐丝带与青色复眼。 | `call_DiRwCkgEOM8qAZxBWK5dvr9s` |
| `mon_3-2_1` | 银线蛾娘 | 成年银发蛾娘；全覆盖藏蓝珍珠茧裙、银线月纹不透明双翼，手持小线轴挂饰。 | `call_pIyFLQTFJbawzO6SRlBmN2Ok` |
| `mon_3-2_2` | 网巢侦察蛛 | 低伏流线型侦察蛛；长腿、青色单眼镜般主眼、腹部丝线罗盘纹，无背包。 | `call_Ws5dpPR9Q9VPYCK6uVX3wTYl` |
| `mon_3-2_3` | 茧灯精 | 悬浮泪滴茧灯；三片珍珠茧壳包围带笑脸的青光灯芯，两侧小蛾翼、底部银丝穗。 | `call_ywOS4frDcCHdMTGMwVbknOrj` |
| `mon_3-2_elite` | 织网蛛娘 | 成年银发蛛丝工匠精英；深蓝长裙、四条大型甲壳蛛足、手牵银丝，优雅且明显高一阶。 | `call_d7N4jIxGvhhhd1oQofYbr5WE` |
| `mon_3-3_0` | 荧伞菇娘 | 成年菌菇娘；巨大深蓝荧光菌伞、银色短发、层叠菌盖裙与卷曲菌丝杖。 | `call_dy0gTAQGYVWu9UdClTmNLVxG` |
| `mon_3-3_1` | 孢子团子 | 单只糯米团般淡蓝菌灵，三层蓝紫菌盖、珍珠孢子藏在盖下，困倦表情。 | `call_beaYYkI0uoI67kubsrxYMJrc` |
| `mon_3-3_2` | 蓝晶蠕灵 | 五节淡蓝可爱蠕灵，每节有深蓝甲环和青晶背板，短足与淡紫触角完整，不做写实虫。 | `call_xTlAMcjABM5PTytwuCgqrhKJ` |
| `mon_3-3_3` | 菌灯甲虫 | 粗壮四足深青甲虫，背部长出五盏淡紫菌灯，叶片状大角与暖青眼睛。 | `call_pH7rzYXBl9e2egaokWpWnPev` |
| `mon_3-4_0` | 水萤虫灵 | 悬浮水萤；珍珠蓝椭圆身体、青色水滴尾灯、四片带水纹的不透明淡紫翼。 | `call_SLHTufNqFVzpWEcWpay0omF5` |
| `mon_3-4_1` | 洞湖螺娘 | 成年水螺娘；银蓝长发、巨大深蓝螺壳、全覆盖湖色长裙与合拢贝扇。 | `call_cz9g6LDB8rN37ha5LgUro9pM` |
| `mon_3-4_2` | 冰壳水蚤 | 月牙形冰壳水蚤；不透明青晶外壳、藏蓝内身、蓝宝主眼、卷曲触须和六只银色桨足。 | `call_FcaWYog5lzSPFwjRNCX2F20s` |
| `mon_3-4_3` | 月纹蝾螈 | 圆润深靛蝾螈；珍珠外鳃、淡紫尾鳍、背部银色月相纹、四足与长尾完整。 | `call_eWUwMgQtklqbVrimAOZUKRXo` |
| `mon_3-5_0` | 护卵甲虫 | 宽体防御甲虫，两片藏蓝背甲护住蜂房托中的一枚完整淡紫珍珠卵，六足稳固。 | `call_Gu8qvWLjCZGI1a8Zz4NblMZa` |
| `mon_3-5_1` | 巢蜜蠕虫 | 六节奶油色可爱幼虫，深蓝蜂房甲片、琥珀描边与封闭巢蜜尾珠，不滴落。 | `call_aSDG9spwNr2KmLKQrcfCpLGb` |
| `mon_3-5_2` | 王纹飞蛾 | 非人形王纹飞蛾；珍珠胸绒、四片藏蓝王冠与卵纹翅、少量琥珀徽饰，贵气但非 BOSS。 | `call_pv9fSbsp2E4f2ahoHQfbTYoX` |
| `mon_3-5_3` | 卵壳守卫 | 完整淡紫卵壳作为圆形躯干的甲壳构装守卫，藏蓝头盔、两只重甲拳与短腿。 | `call_klxUCSbznespyJ2rmDJnZxsG` |
| `mon_3-5_elite` | 虫巢近卫 | 成年全覆甲皇家近卫；藏蓝虫甲、折叠甲翅、青眼缝，持一柄钳月长镰和淡紫卵壳盾。 | `call_hNckDsw7t6GGJjzuWeOtkEcH` |
| `mon_3-5_boss` | 虫母·缇娅 | 成年虫母女王；脸部大且无遮挡，银发、触角卵晶冠、完整藏蓝珍珠茧裙，腰间三枚卵形圣物，巨大王纹蛾翼与甲腹框架；只保留两只人类手臂，一手牵银丝、一手号令。 | `call_QrFvZ2nkbBCxG8YadjOqqcTy` |

## 5. 材料公共提示词

> Use case: asset-generation. One isolated inventory material icon for a premium cute Japanese mobile RPG. Rounded painterly item rendering, pink-blue glass finish, one compact connected subject centered with safe margin. Exact uniform pure `#00ff00` background. No hands, characters, floor, shadow, glow halo, scenery, frame, rarity badge, text, UI, logo or duplicate. No bright green on the item.

| stable key | 名称 | 差异提示词 |
|---|---|---|
| `chitin_wing` | 虫翅碎片 | 3–4 片薄荷青、半透明观感但边缘不透绿的甲翅扇束，底部用一枚小琥珀金扣束住；轻薄、会折射粉蓝光。 |
| `moss_cave` | 洞窟苔藓 | 两块深青卵石上的绒软蓝青洞苔，附青光孢子珠和一枚淡紫菌芽；单一连体物件，不用亮草绿。 |
| `silk_spider` | 蛛丝束 | 珍珠白蛛丝绕成紧致 8 字线束，中部是淡紫蝶形甲扣和一枚青宝石；银丝柔韧、无松散背景蛛网。 |
| `egg_broodmother` | 虫母之卵 | 一枚奶油粉青珍珠卵，放在暗青甲壳与银丝组成的花瓣巢托内，巢托垂三滴淡紫晶泪；无裂纹、胎儿或黏液。 |

## 6. 装备公共提示词

> Use case: asset-generation. One isolated equipment inventory icon source for a premium cute Japanese mobile RPG. Rounded anime mobile-game item art, crisp painterly rendering, navy / dark teal / cyan / silver / pearl / lavender palette, polished shell and opaque glass highlights, readable at 64 px, soft top-left studio lighting. Exactly one centered equipment item or one matched wearable set, complete silhouette, roughly 72–78% canvas occupancy with safe margin. Exact uniform pure `#00ff00` background. No character, mannequin, floor, cast shadow, glow halo, scenery, frame, rarity badge, text, UI, logo, duplicate or bright green on the item.

| stable key | 玩家可见名 | 差异提示词 | ImageGen 生成记录 |
|---|---|---|---|
| `weapon` | 晶壳双刃 | 一对交叉成 X 的短月牙双刃；青晶刃沿、藏蓝甲壳刃脊、银色护手、珍珠握柄与淡紫薄翼坠。 | `call_7T0lZVoTFPBX1d5BuSJrQxbD` |
| `head` | 薄翼触角冠 | 藏蓝蜂房纹轻冠，中央青色泪滴晶，两根银色卷曲触角与两侧不透明淡紫薄翼。 | `call_mgG4WJBKntvggVFSeRuGHFWM` |
| `body` | 幽光虫甲裙 | 无人体的完整甲裙；全覆盖藏蓝甲胄上身、青色幽光胸晶、层叠深青甲翅裙片与珍珠内裙。 | `call_z51SooIWkWrSnMVVWeTjvBGi` |
| `necklace` | 蜕壳吊坠 | 完整银链围成柔和椭圆；两片打开的珍珠淡紫蜕壳包住青色泪滴晶，藏蓝小扣与珍珠点缀。 | `call_oWUgHKyoy5uZ37dDdQYGjrUc` |
| `bracelet` | 蛛丝护腕 | 一对略微交叉的前臂护腕；藏蓝甲壳框架、珍珠银丝紧密编网、淡紫翼片和青色线结宝石。 | `call_QWPPEwKutzSb137t0SbR9hhx` |
| `ring` | 复眼晶戒 | 单枚藏蓝甲节戒；中央一枚青晶，周围六枚蓝紫小晶按蜂房排列成复眼花冠，两侧珍珠翼饰。 | `call_EnKNGX9AZf2qTHr3GL2BZFaE` |
| `belt` | 甲节腰封 | 完整弧形腰封；重叠藏蓝甲节与银铰链，中央淡紫卵晶扣、青色蜂房环、两条短深青翼片和银丝结。 | `call_vjGtEuRM2GwtuU3nGD2Ctymt` |
| `shoes` | 苔纹轻靴 | 一对外撇摆放的轻型短靴；藏蓝软革、深青甲壳鞋头、蓝青苔纹刺绣、银丝鞋带、淡紫菌芽坠和翼形脚踝。 | `call_6sEMZasfv4SPH0Nhylbh6zuV` |

## 7. 官方抠图命令

透明资产必须使用 ImageGen skill 自带 helper，不手写颜色阈值算法：

```powershell
python "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" `
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

## 8. 运行资产归一规则

### 怪物

1. 从透明母版按 alpha 阈值 8 trim。
2. 等比缩放进 480×480。
3. 合成到 512×512 透明画布，水平居中，底部留 8 px。
4. 因此最后一个可见像素行固定为 `y=503`。
5. 输出 WebP：`quality=88, alphaQuality=100, effort=6, smartSubsample=true, preset=picture`。

### 材料 / 装备

1. 从 alpha 母版按阈值 8 trim。
2. 等比缩放进 232×232。
3. 合成到 256×256 透明画布中央，四边至少留 12 px。
4. 输出 RGBA PNG：`compressionLevel=9, adaptiveFiltering=true, palette=true, colours=256, quality=94`。

### 场景

- 地图统一缩放到 768×1024，输出不透明 WebP。
- 战场统一缩放到 1536×1024，输出不透明 WebP。
- 当前归档使用 `quality=82, effort=6`。

## 9. 视觉 QA 与验收

- `art-source/qa/r3-maps-contact.png`
- `art-source/qa/r3-battlefields-contact.png`
- `art-source/qa/r3-monsters-contact.png`
- `art-source/qa/r3-items-equipment-contact.png`
- `art-source/qa/r3-elite-boss-battle-scale.png`

最终审计：

- 地图 6 / 6、战场 5 / 5：尺寸、格式、不透明和体积门禁通过。
- 怪物 23 / 23：512×512、透明四角、`y=503` 底锚点全部通过；最大文件 91,202 B。
- 材料 4 / 4、装备 8 / 8：256×256 RGBA、透明四角和 120KB 上限全部通过；整组最大文件 101,005 B。
- `虫巢近卫` 与 `虫母·缇娅` 已按 `BattleScene.vue` 的真实精英 / BOSS 占位比例放入 600×400 战场复核；缩放后近卫武器和卵盾、缇娅脸部、三枚卵形圣物、王冠和虫翼均可辨认。
- 本批只生产与检查资产，不修改共享 TypeScript、共享构建脚本，也不提交或推送。
