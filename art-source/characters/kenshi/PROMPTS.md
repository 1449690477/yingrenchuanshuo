# 樱酱角色资产提示词与身份锁

## 权威身份参考

- `public/assets/characters/kenshi-sakura.png`：脸、雪白长发、白猫耳、蓝眼、成年娇小体型与蓝白樱粉配色。
- `public/assets/characters/kenshi-sakura-cast.png`：太刀、刀鞘、护手、握持方式与居合战斗气质。
- `base-noshoes-chroma.png`：换装层的注册姿态与身体锚点。
- `base-chroma.png`：默认白蓝草履底模的注册姿态。

所有派生图必须保留成年身份与同一张脸；“可爱”只通过表情、配色与娇小比例表达，不儿童化，不性化。

## 底模生成提示词

```text
Use case: identity-preserve
Asset type: production game character modular base master
Input image: locked adult character 樱酱 identity reference.
Create the same adult petite cat-eared swordswoman as a neutral full-body modular paper-doll base.
Preserve exact face, icy blue eyes, snow-white long hair, white cat ears with pale pink inner fur,
adult identity, proportions, blue-white-pink palette and clean anime rendering.
Neutral standing pose; arms relaxed slightly away from torso; hands and feet fully visible.
Modest fitted white-and-pale-blue under-kimono, opaque full coverage.
Remove sword, scabbard, outer haori, large ornaments, cords, particles and props.
Perfectly flat solid #00ff00 background; no shadow, floor, reflection, gradient or texture.
One adult character, no text, no watermark, no green inside the subject, generous padding.
```

`base.png` 只在该母版上增加低矮白蓝草履；`base-noshoes.png` 保留袜足。两张运行时图均由对应 chroma 源经统一软蒙版、去绿边、`640×960 RGBA` 缩放生成。

## 全批次不变量

- 画布注册：人物中心 `x=320±12`，脚底 `y=925±4`；所有运行时层 `{scale:1,x:0,y:0}`。
- body 不含脸、皮肤、头发或手；head 不重画猫耳和脸；weapon 不含手或身体。
- 太刀至少命中左手锚点 `x145 y375 w120 h130` 或右手锚点 `x435 y250 w145 h180` 的 150 个以上 alpha 像素。
- 猫耳和眼睛不得遮挡；头饰放双耳之间或侧戴，宽度小于 250px。
- 透明源一律使用纯色绿幕与确定性抠图；场景 / CG 一律无人、无人物倒影。
