# 草莓奶霜茶会（berry-cream）素材生产记录

## 生产方式

- 模式：Codex 内置 ImageGen，`stylized-concept` / `compositing`。
- 每个不同资产均使用一次独立 ImageGen 调用；灵巫头冠首稿误带头发，已废弃并独立重试。
- 所有接受的原始图保存在 `art-source/shop/berry-cream/chroma/`。
- 绿幕要求：完全平坦的 `#00ff00`，无人物、皮肤、文字、水印、场景、地面、投影或反射。
- 抠图命令：官方 `remove_chroma_key.py --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`。
- 三张发光特效追加 `--edge-contract 1`；剑姬斩弧剩余 186 个强绿像素做定向去绿校正。
- 分层统一输出为 640×960 RGBA；图标为 256×256 RGBA；特效为 512×512 RGBA。

## 全局提示词约束

以下约束加入了每一次调用：

> Scene/backdrop: perfectly flat uniform #00ff00 chroma-key background.
> Style/medium: polished anime fantasy mobile RPG equipment or VFX illustration, crisp painted edges and a clear silhouette.
> Color palette: cream white, blush pink, strawberry red, warm pale gold.
> Constraints: no person, face, hair, hands, arms, legs, skin, mannequin, text, watermark, logo, floor, scenery, cast shadow or reflection; do not use #00ff00 inside the subject; generous padding; no cropped edges.

纸娃娃层调用另外引用对应职业 `base.png`，并声明输入图只用于姿态和锚点参考，输出不得包含角色。

## 独立生成提示词与文件

| 资产 | 每次调用的 Primary request | 接受的绿幕源 | 最终文件 |
|---|---|---|---|
| 剑姬伞剑 | Cute luxurious strawberry-and-cream Lolita parasol sword; closed parasol forms a long ivory rapier blade, strawberry-red tip, pink scalloped canopy guard, cream bows, gold filigree and strawberry jewel. | `chroma/swordsman-weapon.png` | `public/assets/characters/modular/shop/berry-cream/swordsman-weapon.png` |
| 魔女星匙杖 | Strawberry cream star-key magic wand; cream-gold staff, ornate heart-key head, strawberry crystal, five-point star, pink ribbon and pearls. | `chroma/witch-weapon.png` | `public/assets/characters/modular/shop/berry-cream/witch-weapon.png` |
| 灵巫茶铃 | Strawberry tea-bell ritual weapon; cream-gold handle, porcelain teacup bell, strawberry clapper, pink bows, pearl chain and sakura details. | `chroma/shaman-weapon.png` | `public/assets/characters/modular/shop/berry-cream/shaman-weapon.png` |
| 剑姬头冠 | Compact ivory lace half-bonnet with pink ribbon loops, strawberry jewel and cream-gold crown points; face fully open. | `chroma/swordsman-head.png` | `public/assets/characters/modular/shop/berry-cream/swordsman-head.png` |
| 魔女头冠 | Rounded mini-bonnet for a short bob; white lace, pink side bows, strawberry heart gem and tiny cream-gold crown. | `chroma/witch-head.png` | `public/assets/characters/modular/shop/berry-cream/witch-head.png` |
| 灵巫头冠 | Empty standalone ivory lace half-bonnet arch with strawberry cabochon, pale pink bows and slim gold tiara points; absolutely no hair. | `chroma/shaman-head.png` | `public/assets/characters/modular/shop/berry-cream/shaman-head.png` |
| 剑姬衣裙 | Combat-Lolita dress; fitted high-collar bodice, detached puff sleeves, red ribbon corset, asymmetric knee-length layered skirt and strawberry appliques. | `chroma/swordsman-body.png` | `public/assets/characters/modular/shop/berry-cream/swordsman-body.png` |
| 魔女衣裙 | Magical-Lolita dress; fitted sleeveless bodice, detached puff sleeves, heart brooch, pink corset and short star-trimmed bell skirt. | `chroma/witch-body.png` | `public/assets/characters/modular/shop/berry-cream/witch-body.png` |
| 灵巫衣裙 | Tea-ceremony Lolita dress; high collar, detached puff sleeves, ribbon corset, tea-length lace apron skirt, bell and sakura motifs. | `chroma/shaman-body.png` | `public/assets/characters/modular/shop/berry-cream/shaman-body.png` |
| 剑姬鞋 | Pair of practical ivory Lolita combat ankle boots with pink scalloped cuffs, red straps, gold heel guards and compact bows. | `chroma/swordsman-shoes.png` | `public/assets/characters/modular/shop/berry-cream/swordsman-shoes.png` |
| 魔女鞋 | Pair of rounded ivory Mary-Jane ankle boots with pink scalloped cuffs, strawberry heart buckles, gold stars and bows. | `chroma/witch-shoes.png` | `public/assets/characters/modular/shop/berry-cream/witch-shoes.png` |
| 灵巫鞋 | Pair of elegant ivory tea-Lolita ankle boots with pink wrap straps, red oval gems, lace cuffs and gold bell charms. | `chroma/shaman-shoes.png` | `public/assets/characters/modular/shop/berry-cream/shaman-shoes.png` |
| 项链 | Pale-gold chain, strawberry-red heart jewel in cream enamel, pink bow and pearl drops. | `chroma/necklace.png` | `public/assets/equipment/shop/berry-cream/necklace.png` |
| 手镯 | Ivory lace cuff band, gold filigree clasp, red heart gem, pink bow and pearl charm. | `chroma/bracelet.png` | `public/assets/equipment/shop/berry-cream/bracelet.png` |
| 戒指 | Slim gold band, heart-cut strawberry gem in cream enamel, pink bow and pearl beads. | `chroma/ring.png` | `public/assets/equipment/shop/berry-cream/ring.png` |
| 腰带 | Pink ribbon belt with ivory lace, ornate gold heart buckle, strawberry jewel, layered bow and pearl tassels. | `chroma/belt.png` | `public/assets/equipment/shop/berry-cream/belt.png` |
| 剑姬特效 | Dynamic strawberry cream heart-shaped sword slash; sweeping pink-red crescent, white hot core, gold sparks and strawberry petals. | `chroma/effect-swordsman.png` | `public/assets/effects/boutique/berry-cream-swordsman.png` |
| 魔女特效 | Strawberry berry-star projectile; faceted red star-berry core, orbiting pink stars, cream spiral trail, gold sparkles and hearts. | `chroma/effect-witch.png` | `public/assets/effects/boutique/berry-cream-witch.png` |
| 灵巫特效 | Tea-bell healing wave; pink circular sound ring, three gold bells, cream heart pulse, red petal notes and pearls. | `chroma/effect-shaman.png` | `public/assets/effects/boutique/berry-cream-shaman.png` |

## 图标派生

以下图标均从已通过抠图检查的对应源图裁切，不再次生成：

- `body.png` ← `witch-body`
- `head.png` ← `witch-head`
- `shoes.png` ← `witch-shoes`
- `weapon-swordsman.png` ← `swordsman-weapon`
- `weapon-witch.png` ← `witch-weapon`
- `weapon-shaman.png` ← `shaman-weapon`

项链、手镯、戒指和腰带均为独立 ImageGen 生成，不复用其他饰品。

## 验收

- 12 张分层：全部 640×960 RGBA，四角 Alpha 为 0，强绿残留像素为 0，单张 14.5～75.4 KB（均低于 300 KB）。
- 10 张图标：全部 256×256 RGBA，四角 Alpha 为 0，强绿残留像素为 0，单张 5.7～28.2 KB（均低于 80 KB）。
- 3 张特效：全部 512×512 RGBA，四角 Alpha 为 0，强绿残留像素为 0，单张 60.4～101.9 KB（均低于 180 KB）。
- 主体覆盖率：分层 1.7%～13.4%，图标 5.5%～41.9%，特效 25.8%～53.4%。
- 三职业分别与正式底模进行完整合成检查：
  - 剑姬：头冠不挡脸，衣裙覆盖训练服主体，伞剑靠近左手，双鞋落在脚底范围。
  - 魔女：首轮法杖遮脸，已缩小并移到左侧；修正后脸、右手互动动作和裙摆均无遮挡。
  - 灵巫：首轮茶铃遮脸，已缩小并移到左侧；修正后脸、双手和长发轮廓保持完整。
- 合成验收图保存在 `tmp/imagegen/berry-cream/composites/`，图标总览保存在 `tmp/imagegen/berry-cream/icons-contact.png`。
