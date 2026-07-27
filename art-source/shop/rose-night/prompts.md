# 绯樱星愿夜宴（rose-night）素材生产记录

## 生产方式

- 模式：Codex 内置 ImageGen，`stylized-concept`。
- 每个不同生成资产均单独调用 ImageGen；没有使用拼图后切块冒充独立生成。
- 所有透明资产先生成在均匀 `#00ff00` 绿幕上，再使用官方脚本：

```powershell
python C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py `
  --input <green-source.png> `
  --out <alpha-master.png> `
  --auto-key border `
  --soft-matte `
  --transparent-threshold 12 `
  --opaque-threshold 220 `
  --despill
```

- 原始绿幕：`tmp/imagegen/rose-night/`
- 去背母版：`art-source/shop/rose-night/*-alpha.png`
- 规范化脚本：`tmp/imagegen/rose-night/process.mjs`
- 文件校验：`tmp/imagegen/rose-night/validate.mjs`

## 统一提示词

### 纸娃娃礼裙

```text
Use case: stylized-concept
Asset type: transparent paper-doll clothing layer for a vertical anime mobile game
Primary request: create ONLY the detached garment overlay for “绯樱星愿夜宴”, a magnificent cute adult-woman Lolita dress. Deep crimson velvet bodice, blackberry-purple panels, white lace ruffles, restrained antique-gold piping, sakura blossoms and tiny star-river embroidery. Elegant, sweet and luxurious, not childish, not revealing.
Input images: Image 1 is the class base used ONLY for exact body proportions, waist position and canvas placement; Image 2 is an existing dress layer used ONLY for transparent-layer composition scale and position.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for local removal.
Composition/framing: vertical 2:3 full paper-doll canvas. Garment occupies the same torso and skirt position as Image 2. Preserve generous empty padding around it. Neck opening, armholes and lower opening must align to Image 1. Output the dress garment only.
Style/medium: polished 2D Japanese mobile RPG item illustration, crisp line art, cel-shaded jeweled fabric, strong readable silhouette at phone size.
Color palette: crimson, blackberry purple, white lace, antique gold, small pale-pink sakura accents.
Constraints: ONLY clothing; absolutely no person, no mannequin, no head, no face, no hair, no skin, no arms, no hands, no legs, no feet, no shoes, no weapon, no text, no watermark. No shadow, reflection, floor, glow, smoke, or particles. Background one uniform #00ff00 with no variation. Do not use green anywhere in the garment. Keep all garment edges complete and uncut.
```

三职业分别追加“按对应底模肩宽、腰线、手臂与长发位置裁制”的约束。

### 星冠蔷薇礼帽

```text
Create ONLY “星冠蔷薇礼帽”, a compact elegant Lolita mini top hat/crown hybrid: deep crimson velvet, blackberry-purple ribbon, white lace trim, restrained antique-gold star crown filigree, pale-pink sakura blossom, one small ruby.
Use the class base only for head position and hair volume, and the existing head layer only for scale.
Output a vertical 2:3 full paper-doll canvas on perfectly uniform #00ff00.
Hat only; no person, face, hair, skin, body, mannequin, text, watermark, shadow, glow or particles.
```

### 星愿水晶鞋

```text
Create ONLY a matched pair of “星愿水晶鞋”: cute elegant opaque Lolita ankle shoes with deep-crimson velvet, blackberry-purple panels, white lace ankle cuffs, antique-gold star clasps and tiny pale-pink sakura jewels.
Use the class base only for exact foot positions and angles.
Output a vertical 2:3 full paper-doll canvas on perfectly uniform #00ff00.
Shoes only; no legs, feet, skin, person, mannequin, text, watermark, shadow, reflection, floor, glow or particles.
```

### 三职业武器

统一约束为：职业底模仅作手位参考、旧武器层仅作尺度参考；输出完整独立武器；绯红、黑莓紫、白珐琅、赤金、樱花宝石；无人物、手臂、皮肤、阴影、文字、粒子。

- 剑姬：`绯樱蔷薇剑`，细长白银礼剑、蔷薇护手与星纹刃脊。
- 魔女：`绯樱天穹杖`，黑莓紫杖身、金色新月星环、绯红樱晶。
- 灵巫：`绯樱御灵扇`，展开的绯红黑莓丝绸折扇、赤金扇骨、樱花星图。

### 首饰图标

```text
Use case: stylized-concept
Asset type: game equipment UI icon source
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background.
Style/medium: premium cute 2D Japanese mobile RPG equipment icon, crisp cel-shaded edges, strong silhouette readable at 36 px.
Composition/framing: square 1:1, exactly one centered item, about 72% canvas.
Color palette: deep crimson, blackberry purple, white lace, antique gold, pale-pink sakura gem.
Constraints: no icon frame, person, skin, hands, mannequin, text, watermark, shadow, reflection, glow or particles.
```

四次独立生成的主体分别是：樱心项链、成对星火腕饰、绯月戒、蔷薇腰封。

### 三职业攻击特效

```text
Use case: stylized-concept
Asset type: transparent battle skill effect for a cute anime mobile RPG
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background.
Style/medium: polished 2D Japanese mobile game VFX, crisp luminous shapes, clean sparse particles.
Color palette: crimson-magenta light, pale-pink sakura petals, antique-gold stars, blackberry-purple accents, white-hot highlights.
Composition/framing: square 1:1, effect inside 84% safe area.
Constraints: effect only; no character, weapon object, hand, monster, scenery, text, watermark, shadow or frame; at most eight loose particles.
```

- 剑姬：`蔷薇星河斩`，左下至右上的金边绯红月牙斩击，中心蔷薇樱爆与短星河尾迹。
- 魔女：`天穹樱爆`，绯红球状魔力爆发，两道赤金轨道与少量樱花星芒。
- 灵巫：`御灵蝶扇阵`，三只灵蝶从绯红黑莓能量扇弧中升起。

## ImageGen 原始输出映射

所有原始输出均位于：

`C:\Users\Administrator\.codex\generated_images\019fa185-8ba0-7ee0-aacb-47354ae0b774\`

| 资产 | ImageGen 原始文件 |
|---|---|
| swordsman body | `exec-9b795490-9f1c-4382-9c60-efc7350da649.png` |
| witch body | `exec-de70b8b3-127d-42f1-aaeb-c40504c23d29.png` |
| shaman body | `exec-4a15df57-263c-4369-a6ed-68110d996f36.png` |
| swordsman head | `exec-1d7c3c8c-b7c3-4925-b589-614dcb1cbafe.png` |
| swordsman shoes | `exec-9c082761-1b87-4488-b54c-d04a43a9b501.png` |
| witch head | `exec-6694dc0a-546a-4629-90e1-71faf3ae8b6e.png` |
| witch shoes | `exec-a05421b2-c8e6-480e-bb24-4d2a64db4b47.png` |
| shaman head | `exec-060596bd-70bf-4def-8939-b8f11db70a83.png` |
| shaman shoes | `exec-73e31d81-5e0f-4f64-bd28-f2b4f4de4bcc.png` |
| swordsman weapon | `exec-d8335a61-fbe6-4b3f-9211-311ab506e235.png` |
| witch weapon | `exec-f592c4b9-ac9b-445a-a50f-5cf7f0e0ec2b.png` |
| shaman weapon | `exec-4322bab0-a5a2-4f74-9c94-8e57b0f26059.png` |
| necklace | `exec-bf8ca803-866f-4e97-8d70-5d916064e251.png` |
| bracelet | `exec-5a9727f7-ac0c-4ff3-9166-27282632d6af.png` |
| ring | `exec-b9ba0ba5-0951-42e0-b491-c52e064584f6.png` |
| belt | `exec-7d9f3cb8-dcc9-4f61-8a1e-3edb358058c1.png` |
| swordsman effect | `exec-e75c99fb-6040-4fff-a5d5-e150e1404bd0.png` |
| witch effect | `exec-795db1b6-2f2b-4132-96ee-0707320ee316.png` |
| shaman effect | `exec-270ee842-c873-4c52-9a5a-b42996d6dd1c.png` |

## 正式文件

### 纸娃娃层

`public/assets/characters/modular/shop/rose-night/`

- `swordsman-{body,head,shoes,weapon}.png`
- `witch-{body,head,shoes,weapon}.png`
- `shaman-{body,head,shoes,weapon}.png`

### 商品图标

`public/assets/equipment/shop/rose-night/`

- `body.png`
- `head.png`
- `shoes.png`
- `weapon-swordsman.png`
- `weapon-witch.png`
- `weapon-shaman.png`
- `necklace.png`
- `bracelet.png`
- `ring.png`
- `belt.png`

`body/head/shoes/weapon-*` 图标由已通过合成验收的正式分层裁切，保证货架图标与试穿造型一致。

### 攻击特效

`public/assets/effects/boutique/`

- `rose-night-swordsman.png`
- `rose-night-witch.png`
- `rose-night-shaman.png`

## 验收结果

- 12 张纸娃娃层：640×960 RGBA，四角透明，单张 12.6～69.0KB，均低于 300KB。
- 10 张图标：256×256 RGBA，四角透明，单张 5.5～27.5KB，均低于 80KB。
- 3 张特效：512×512 RGBA，四角透明，单张 65.5～98.3KB，均低于 180KB。
- 自动像素检查：25 个正式文件均有非空 alpha 包围盒，检测到的残余绿色像素为 0。
- 人工检查：无人物、皮肤、文字、水印、投影或裁切；礼裙、帽、鞋和武器均完成三职业底模合成检查。
- 合成预览：
  - `preview-swordsman.png`
  - `preview-witch.png`
  - `preview-shaman.png`
  - `preview-icons.png`
  - `preview-effects.png`
