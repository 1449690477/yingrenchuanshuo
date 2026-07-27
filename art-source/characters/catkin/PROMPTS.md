# 喵喵（catkin）美术生产记录

> `catkin` 是存档与代码使用的稳定职业 ID；界面显示名暂定「喵喵」。
> 用户提供的小猫表情只用于提炼“焦糖棕 + 奶油白、蓝色泪滴、圆润可爱”的身份特征，
> 正式角色重新设计为明确的成年（18+）猫系冒险少女。

## 一、固定身份锚点

- 明确成年女性，18+，Q 版二次元手游比例，绝不幼态化。
- 焦糖棕与奶油白双色短发/绒毛，头顶一对圆润猫耳。
- 宝石蓝大眼睛，双颊各有一枚蓝色泪滴形花纹。
- 一条蓬松的大尾巴，尾尖奶油白。
- 手套能看到粉色肉球，晶蓝色短爪。
- 服装主色为蓝、白、樱粉，配少量金色；轮廓必须适合 390×844 手机画面。
- 性格是活泼、好奇、略带得意，不做凶恶野兽化。

所有人物图共用以下基础提示：

```text
An explicitly adult 18+ cat-eared female adventurer for a bright Japanese anime mobile RPG.
Cute chibi-proportioned but clearly adult, caramel-brown and cream-white hair/fur,
rounded cat ears, large sapphire-blue eyes, one blue teardrop-shaped cheek marking on each cheek,
one big fluffy tail with a cream tip, pink paw pads, short crystal-blue claws.
Blue, white and sakura-pink outfit with small gold accents, clean polished game asset,
crisp silhouette, soft cel shading, cheerful and mischievous expression.
Keep the exact identity traits, colors and facial marks consistent across every asset.
No text, no logo, no watermark, no scenery, no frame, no cropped ears/tail/hands/feet.
```

## 二、立绘

### `anchor-alpha.png`

```text
[固定身份锚点]
Full-body neutral character anchor, front three-quarter view, relaxed ready stance.
Both ears, both hands, both feet and the full fluffy tail visible.
One paw raised in a friendly greeting; confident cute smile.
Centered with generous empty margin. Flat pure chroma green #00FF00 background,
no green light or green clothing, no cast shadow outside the character.
```

### `cast-alpha.png`

```text
[固定身份锚点]
Full-body action portrait of the same character launching forward for a rapid claw combo.
Body leaning into the motion, tail making a strong counter-curve, both crystal claws visible,
pink and blue sakura sparks around the paws, delighted battle expression.
Centered, complete silhouette, flat pure chroma green #00FF00 background.
```

运行时输出：

- `public/assets/characters/catkin-sakura.png`
- `public/assets/characters/catkin-sakura-cast.png`

## 三、纸娃娃分层

全部母版必须保持与立绘相同的正面站姿、脚底基准和 2:3 画布。生成后统一规范到
640×960；每个装备层只保留该层像素，不能把身体重复画进去。

| 母版 | 内容 |
|---|---|
| `base.png` | 无可替换帽饰、外衣和武器的基础角色；脸、耳、尾、基础内搭完整 |
| `r1-body.png` | 蓝白短斗篷与樱粉蝴蝶结，只画身体装备 |
| `r1-head.png` | 轻量猫耳发饰，只画头饰，中央脸部保持空白 |
| `r1-weapon.png` | 一对短晶爪，只画左右手武器 |
| `r2-body.png` | 月蓝进阶战衣与金色护边，只画身体装备 |
| `r2-head.png` | 月牙与铃铛头饰，只画头饰 |
| `r2-weapon.png` | 一对更明亮的雷晶爪，只画左右手武器 |

通用分层提示尾句：

```text
Exact same pose, camera, proportions and foot anchor as the catkin base doll.
Draw only the requested wearable layer; every other pixel is flat #00FF00 chroma green.
Do not draw face, hair, skin, body, tail or any unrequested garment into this layer.
```

## 四、技能图标与主动特效

14 个技能图标均为 256×256 RGBA。10 个主动技能另有 512×512 RGBA 大特效；
4 个被动技能只使用图标，不伪造攻击特效。

| 技能 | 视觉关键词 | 角色动作 |
|---|---|---|
| 肉球三连 | 三枚蓝粉肉球爪痕 | `flurry` |
| 灵敏胡须 | 发亮胡须、星形感知波 | `victory` |
| 追光飞扑 | 蓝色雷光猫影向前俯冲 | `dash` |
| 轻盈猫步 | 月牙脚印与轻风丝带 | `victory` |
| 疯狂乱抓 | 六道交错樱粉/冰蓝晶爪 | `flurry` |
| 炸毛反击 | 蓬起尾影、雷盾、反击爪 | `counter` |
| 猫爪印记 | 五层肉球刻印环 | `victory` |
| 尾巴横扫 | 冰蓝大尾弧与霜花 | `spin` |
| 纸箱奇袭 | 纸箱弹开、猫影突袭 | `dash` |
| 九命回旋 | 三圈猫尾月轮 | `spin` |
| 狩猎本能 | 蓝眼、瞄准环、BOSS 角影 | `victory` |
| 月影猫步 | 四道月影足迹 | `dash` |
| 毛球风暴 | 八颗带电毛球旋风 | `cast` |
| 百爪樱岚 | 十二道晶爪与樱花雷岚 | `flurry` |

主动特效通用提示：

```text
One isolated 2D VFX sprite for a bright anime mobile RPG, matching catkin's blue,
white, sakura-pink and small gold palette. Strong readable center-to-edge motion,
crisp silhouette at phone size, no character body, no UI frame, no words, no numbers,
no logo, no watermark. Flat pure #00FF00 chroma green background with no gradient,
no green glow and no cast shadow.
```

## 五、珍品换装

三套主题均保留喵喵的耳朵、蓝眼、泪滴脸纹和大尾巴，不改变身份：

- `berry-cream`：草莓奶霜糖晶爪，奶油粉、莓红、糖晶高光。
- `moon-sugar`：月桂星糖月兔爪，月蓝、香槟金、星糖光点。
- `rose-night`：绯樱星愿蔷薇爪，深莓红、蔷薇金、樱花星芒。

每套包含角色换装层 `body/head/shoes/weapon`、256×256 武器图标和
512×512 专属攻击特效。武器母版必须与基础纸娃娃手部锚点一致。

## 六、透明化与验收

1. ImageGen 先输出纯 `#00FF00` 绿幕母版。
2. 使用 imagegen 技能附带的官方 `remove_chroma_key.py`：

```text
--auto-key border --soft-matte --transparent-threshold 12
--opaque-threshold 220 --edge-contract 1 --despill --force
```

3. 运行 `npm run assets:catkin`，依次构建立绘、对齐纸娃娃、换装、技能资源。
4. `scripts/validate-catkin-assets.mjs` 严格检查尺寸、RGBA、体积、四角透明、
   非空主体和荧光绿残留；任何一项失败都直接报错，不做运行时兜底。

当前验收结果：52 个运行时资源与 15 张技能/攻击透明母版全部通过。
