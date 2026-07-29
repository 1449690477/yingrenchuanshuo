# R5 四职业纸娃娃资产生产记录

本批交付四职业 × 两个外观族 × 三个可见槽位，共 **24 张**独立纸娃娃层：

- 职业：`swordsman / witch / shaman / catkin`
- 普通装：`r5-{body|head|weapon}.png`
- 绯焰套：`r5-crimson-{body|head|weapon}.png`
- 运行时：`public/assets/characters/modular/{class}/`
- 绿幕与 alpha 母版（仅外置源仓）：
  `C:/Users/Administrator/Desktop/二次元传奇项目/yingrenchuanshuo-art-source-r5/modular/`

本文件记录生成意图、调用 key、参考图和后处理边界。逐文件 SHA、最终对位框与
确定性擦除参数以同目录 `MODULAR-SOURCE-SHA256.json` 为准。

## 统一 ImageGen 硬约束

每个资产都是一次独立 ImageGen 调用，不通过复制、改色或重命名复用。每次只引用
当前职业的：

`public/assets/characters/modular/{class}/base.png`

参考图只用于注册画布和人体锚点，不得出现在交付图中。实际提示始终包含以下槽位
约束：

### body

> Use Image 1 as a strict pose-registration template for a modular paper-doll
> clothing edit. Preserve its exact 2:3 canvas, shoulder line, neck opening,
> bust, waist, hips and both arm/hand openings, then REMOVE the character.
> Output ONLY a hollow clothing layer in Image 1's canvas coordinates on a
> perfectly flat uniform #00ff00 background. No person, face, hair, skin,
> hands, legs, mannequin, shadow, aura, particles, text, frame or watermark.

### head

> Use Image 1 strictly as a head-position registration guide. Preserve its
> exact 2:3 canvas, crown, forehead, face and hair coordinates, then REMOVE the
> character. Output ONLY the head equipment in Image 1's canvas coordinates on
> a perfectly flat uniform #00ff00 background. Never cover eyes or face. No
> person, face, hair, skin, neck, mannequin, shadow, aura, particles, text,
> frame or watermark.

### weapon

> Use Image 1 strictly as the exact positional guide for a modular paper-doll
> weapon edit. Preserve its 2:3 canvas, hand coordinate, wrist angle and weapon
> direction, then REMOVE the character. Output ONLY the weapon in Image 1's
> canvas coordinates on a perfectly flat uniform #00ff00 background. No
> person, hand, arm, skin, clothing, shadow, aura, particles, text, frame or
> watermark.

统一画风追加：

> Fresh cute premium Japanese mobile RPG illustration, soft rounded forms,
> refined deep warm-brown outline, rose-gold highlights and a crisp silhouette
> readable at small mobile size.

## 24 个稳定生成记录

以下“设计正文”与上方对应槽位硬约束合并使用。除特别标记的父任务恢复项外，均为
本任务的独立 ImageGen 结果，原始文件继续保留在
`C:/Users/Administrator/.codex/generated_images/019facd0-d136-7521-ba8d-9f3ac480f399/`。

### 剑士 swordsman

#### `swordsman:r5:body`

- Call：`call_shgbg8QPORVI15MbsK5mb82o`
- 状态：**parent task recovered / verbatim prompt unavailable**
- 原始文件：
  `C:/Users/Administrator/.codex/generated_images/019fa34f-536a-71e0-887d-007fcc16b9dc/call_shgbg8QPORVI15MbsK5mb82o.png`
- 可确认的设计意图：珊瑚红与玫瑰金轻型战裙、奶白胸甲、半透明熔晶裙片、
  明确领口和双臂开口。
- 说明：无法从当前记录恢复父任务逐字提示词，因此没有伪造原文；该图仅作为候选，
  在完整合成确认肩线、腰线、手位和脸部均通过后保留。

#### `swordsman:r5:head`

- Call：`exec-60bcb9e0-f78b-4a1a-8f52-bd4afbbf94e9`
- 设计正文：small open-front coral-red and rose-gold flame circlet, one
  faceted pale molten-crystal jewel above the forehead, two short petal-like
  side fins following the hairline; never cover eyes, eyebrows, face, ponytail
  or ears.

#### `swordsman:r5:weapon`

- Call：`exec-82d33636-719b-467d-8a0a-91b9d6f7bf5c`
- 设计正文：one elegant one-handed molten-blossom longsword; coral-red
  translucent emberglass blade, rose-gold spine and compact sakura-flame
  guard, cream crystal inlay; hilt registers to viewer-left closed fist and
  blade rises upper-left.

#### `swordsman:r5-crimson:body`

- Call：`exec-cf186453-1c73-4ea0-a740-4b37d37e7c7b`
- 设计正文：ornate deep-crimson phoenix oath battle gown, red-gold segmented
  shoulder mantle, fitted flame-etched cuirass, asymmetric ceremonial skirt,
  translucent dark-ruby emberglass tails and suspended flame crystals; this is
  structurally different from the normal coral dress.
- 后处理说明：生成图附带两只不匹配底模手位的独立护腕。构建器只在母版坐标中
  擦除这两个浮空连通件，保留完整主衣裙；具体矩形写入 SHA 锁。

#### `swordsman:r5-crimson:head`

- Call：`exec-8e1b84b0-3c0e-4774-8f3f-7578f7da1672`
- 设计正文：open phoenix diadem with three upward flame-petal prongs,
  central dark-ruby ember crystal, asymmetric side filigree and one short
  translucent emberglass wing; ceremonial, face-safe and not a recolored
  simple circlet.

#### `swordsman:r5-crimson:weapon`

- Call：`exec-6a84ddc6-c53d-4941-98db-3799374a86f7`
- 设计正文：one-handed phoenix oathblade with broad dark-ruby emberglass blade,
  glowing red-gold flame ridge, phoenix-wing guard, deep-crimson wrapped grip
  and faceted ember charm; hilt through viewer-left fist.

### 魔女 witch

#### `witch:r5:body`

- Call：`exec-22feabf1-316b-437e-9e03-8613971fd5f7`
- 设计正文：playful soft-coral molten-alchemy short dress with rose-gold
  corset ribs, cream inner bodice, rounded bell skirt, two translucent pink
  emberglass overskirt petals and tiny crystal potion clasps; airy rather than
  armored.

#### `witch:r5:head`

- Call：`exec-a5adbce4-e13d-4d8a-a91e-7e2e277c3755`
- 设计正文：jaunty compact coral-red alchemist beret tilted viewer-left,
  rose-gold band, one molten-crystal petal and a cream bow; not a large brim
  hat and leaves the full face visible.

#### `witch:r5:weapon`

- Call：`exec-1f80fb87-bc3c-458e-a0ce-3c2094b109de`
- 设计正文：short ember-bloom wand with rose-gold handle, coral glass
  flower-cage head, connected pale molten-crystal seed and tiny cream ribbon;
  handle ends in the viewer-left closed fist.

#### `witch:r5-crimson:body`

- Call：`exec-05d6bbde-e700-4dea-8658-0d2ce9a1413d`
- 设计正文：deep-crimson flame-oracle gown with red-gold corset lattice,
  emberglass cape collar, asymmetric high-low skirt, dark-ruby translucent
  back panels, phoenix-scroll hem and crystal phials; structurally distinct
  from the short normal alchemist dress.

#### `witch:r5-crimson:head`

- Call：`exec-9456a301-93a9-491c-8e04-8973ed950d9b`
- 设计正文：small deep-crimson phoenix-mage fascinator, asymmetric red-gold
  halo fragment, one folded emberglass petal, dark-ruby cabochon and two short
  crystal drops; compact, ceremonial and face-safe.

#### `witch:r5-crimson:weapon`

- Call：`exec-6f33b405-3af1-446e-aa95-d6a163901613`
- 设计正文：phoenix-oracle staff with deep-crimson red-gold shaft, dark-ruby
  molten core inside an open phoenix-wing halo, three connected emberglass
  drops and a flame ribbon; more ceremonial than the normal wand.

### 巫祝 shaman

#### `shaman:r5:body`

- Call：`exec-fba44470-26e7-44c0-9b35-f26532bfd809`
- 设计正文：coral-and-cream shrine alchemist tunic dress with rose-gold knot
  fasteners, fitted waist, short layered flame-petal skirt, translucent pale
  emberglass side panels and small ritual tassels.

#### `shaman:r5:head`

- Call：`exec-19c72cfe-9d97-4914-ab9e-30778a0771cb`
- 设计正文：delicate open rose-gold prayer circlet, small coral
  molten-crystal bell at center, two low flame-petal pins and short cream knot
  cords; quiet, compact and face-safe.

#### `shaman:r5:weapon`

- Call：`exec-564e71d5-56fc-49f4-97b1-2e2f2fd88c0b`
- 设计正文：compact ember-prayer folding fan with coral lacquer ribs,
  rose-gold flame lattice, translucent pale crystal leaf, three connected
  prayer bells and a cream knot tassel; handle registers to the inward hand.

#### `shaman:r5-crimson:body`

- Call：`exec-54e5eeaa-d83a-4b5d-a27a-d1876b12e360`
- 设计正文：deep-crimson fire-shrine oracle robe with red-gold knotted collar,
  ceremonial cuirass, asymmetric phoenix-tail overskirt, dark-ruby translucent
  train, flame scripture borders and suspended crystal bells; not a recolored
  short tunic.

#### `shaman:r5-crimson:head`

- Call：`exec-61eabca4-665e-40f6-93b1-5c1862397a70`
- 设计正文：open fire-shrine halo crown with red-gold twin phoenix arcs,
  central dark-ruby ember jewel, three small flame bell drops and ritual
  knotwork; ceremonial without becoming a face-covering helmet.

#### `shaman:r5-crimson:weapon`

- Call：`exec-07a478d0-f1a5-4fbf-b15e-1855ab65fc39`
- 设计正文：broad phoenix scripture war-fan with deep-crimson segmented leaves,
  red-gold phoenix skeleton, central dark-ruby molten eye, three emberglass
  bells and reinforced ritual handle; structurally different from the normal
  prayer fan.

### 喵喵 catkin

#### `catkin:r5:body`

- Call：`exec-d7eb0660-d238-48c5-b623-4ddc5b5d1dac`
- 设计正文：soft-coral lava-runner sleeveless battle dress with cream chest
  panel, rose-gold harness seams, short overskirt over fitted shorts,
  translucent emberglass hip petals and paw crystal buckles; deliberate open
  passage for the existing tail.

#### `catkin:r5:head`

- Call：`exec-162199d2-cf80-405f-8549-12a5ab2f86e7`
- 设计正文：tiny V-shaped coral and rose-gold ember-paw tiara placed strictly
  between the two cat ears, with one pale molten-crystal paw jewel and two
  short flame-petal tips; never redraw or cut either ear.

#### `catkin:r5:weapon`

- Call：`exec-20646b6b-2775-444f-8e95-da5031687bd1`
- 设计正文：one separated pair of compact molten-paw claws, coral gauntlet
  cuffs, rose-gold knuckle frames, three short pale emberglass claws each and
  paw crystal insets; left piece targets the lower fist and right piece the
  higher open claw-hand.

#### `catkin:r5-crimson:body`

- Call：`exec-90a7d133-1809-4a8e-abf9-e5b8cafb3ee0`
- 设计正文：deep-crimson phoenix-prowler battle suit with red-gold segmented
  collar, fitted flame cuirass, asymmetric short battle skirt, dark-ruby hip
  fins, flexible thigh guards and ember-paw charms; deliberate tail passage
  retained.

#### `catkin:r5-crimson:head`

- Call：`exec-eb11d061-4c86-43a8-9e79-e8c5482045e4`
- 设计正文：open fire-paw crown strictly between the ears, red-gold twin
  phoenix arcs, central dark-ruby paw-flame jewel and two tiny emberglass
  drops; ornate but ear-safe and face-safe.

#### `catkin:r5-crimson:weapon`

- Call：`exec-2c56b506-1986-471c-b6a6-cc60874134d2`
- 设计正文：one separated pair of phoenix-rend claws, deep-crimson segmented
  cuffs, red-gold phoenix-wing guards, four longer dark-ruby emberglass talons
  each and one flame charm per wrist; distinct from the compact normal claws.

## 绿幕与构建

每张绿幕图独立执行官方脚本：

```powershell
python "C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" `
  --input "<external>/<class>/<family>/<slot>-chroma.png" `
  --out "<external>/<class>/<family>/<slot>-alpha.png" `
  --auto-key border `
  --soft-matte `
  --transparent-threshold 12 `
  --opaque-threshold 220 `
  --despill `
  --edge-contract 1 `
  --force
```

运行时构建与 QA：

```powershell
node scripts/build-region5-modular-assets.mjs
node scripts/build-region5-modular-contact-sheet.mjs
node scripts/validate-region5-modular-assets.mjs
node scripts/validate-region5-modular-assets.mjs --with-sources
```

构建器只做确定性的抠图母版读取、裁边、对位、缩放和 PNG 压缩；不会生成缺失
内容，也不会把绿幕 / alpha 母版复制进主仓。喵喵双爪按原图水平中线拆为两件，
再分别对齐左右手。

## 人工合成 QA

联系表：`art-source/qa/r5-modular-contact.webp`

第三轮全尺寸复审结论：

- 剑士：普通剑与绯焰巨刃均穿过左拳握点；脸、马尾和右手完整。绯焰母版中
  不匹配底模的浮空护腕已确定性移除。
- 魔女：普通短杖与绯焰法杖均落在左拳；绯焰头饰缩小上移后眼睛、鼻口完全可见。
- 巫祝：普通祈扇和绯焰战扇均下移到内侧结印手，扇面不再遮眼或挡嘴；长发轮廓
  与右侧开放手掌完整。
- 喵喵：两套双爪均分别命中左右手；两只猫耳、蓝色泪滴、尾巴和尾巴通道完整，
  普通衣领下移后嘴部可见。
- 普通装统一使用软珊瑚红、玫瑰金、奶白与浅熔晶；绯焰套使用深绯红、赤金、
  凤凰结构与深红熔晶，八套在轮廓和部件结构上均不是简单改色。
