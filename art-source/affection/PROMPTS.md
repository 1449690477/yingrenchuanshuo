# 好感度「心虹珍藏」美术复现手册

本文件记录好感度美术的可复现生产规格。第三批完成后的运行时清单固定为：

- 4 个职业 × 10 张独立装备图标，共 40 张透明 PNG。
- 4 个职业 × 3 张偏好礼物图标，共 12 张透明 PNG。
- 4 个职业 × 9 张无人场景，共 36 张 WebP。
- 4 个职业 × 3 张纯物件高潮 CG，共 12 张 WebP。

生成时使用内置 `image_gen`，每件不同素材单独调用一次。不要把多件装备画进同一张图，也不要用代码绘图、SVG 占位图或其它装备的换色版本代替。

## 1. 统一风格与输出约束

### 1.1 装备图标母提示

将下表的「主体提示」替换进这份母提示：

```text
Use case: stylized-concept
Asset type: mobile anime idle RPG collectible equipment icon source
Primary request: [主体提示]
Scene/backdrop: a perfectly flat solid #00ff00 chroma-key background for background removal
Style/medium: polished cute Japanese fantasy game item illustration, clean anime rendering, premium collectible craftsmanship, readable at 64px
Composition/framing: exactly one complete item or one intentional matched pair, centered, three-quarter product view, generous even padding on every edge, no cropping
Lighting/mood: soft luminous studio-like fantasy light, romantic and heart-fluttering, crisp silhouette
Color palette: blue-white-pink shared project palette plus the role palette described below; subtle rainbow crystal accents belong to the item, never green
Constraints: the background is one perfectly uniform #00ff00 color with no shadows, gradients, texture, reflections, floor plane, or lighting variation; keep the item fully separated from the background with crisp edges; no #00ff00 anywhere in the item
Avoid: character, mannequin, body, hands, face, skin, text, letters, numbers, logo, watermark, UI frame, inventory slot, duplicate item, extra accessory, cast shadow, contact shadow, reflection, smoke, fog, green gemstones, green cloth, green glow, green edge spill, cropped tips
```

职业视觉锚点：

- 剑姬：晨樱、象牙白、樱粉、天蓝、玫瑰金，轻骑士礼装与坚定誓约感。
- 魔女：星糖、月蓝、薰衣草紫、奶油粉、银色，甜点魔法与观星器材感。
- 灵巫：月灯、灵蝶、雾蓝、淡紫、银白，安静祈愿与和风仪式感。
- 喵喵：蜜糖、焦糖棕、奶油白、珊瑚粉、湖蓝，成年搭档的俏皮冒险感；不得画成宠物用品。

运行时输出必须是 `256×256` RGBA PNG，路径为：

```text
public/assets/equipment/affection/<classId>/<slug>.png
```

### 1.2 绿幕抠图参数

保留原始绿幕图后，使用系统 imagegen skill 的脚本处理：

```powershell
python "$env:USERPROFILE\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" `
  --input <chroma-source.png> `
  --out <alpha-output.png> `
  --auto-key border `
  --soft-matte `
  --transparent-threshold 12 `
  --opaque-threshold 220 `
  --despill
```

只有肉眼可见细绿边时才重跑并追加 `--edge-contract 1`。随后用 `sharp` 的 `fit: contain`、透明背景缩放为 `256×256`；不得拉伸或裁掉尖端。最终运行：

```powershell
node scripts/validate-affection-assets.mjs
```

校验器会拒绝：非 RGBA、四角不透明、主体触边、主体空白、以及可见绿幕像素超过 `max(64, 可见像素的 0.3%)` 的图标。

### 1.3 场景与 CG 母提示

```text
Use case: illustration-story
Asset type: 3:2 horizontal Galgame background or object-only climax CG for a mobile anime RPG
Primary request: [主体提示]
Style/medium: polished hand-painted 2D Japanese fantasy game background, clean anime environment art, soft detailed brushwork
Composition/framing: exact 3:2 landscape composition, clear depth, mobile-readable focal point, enough calm negative space for a live character layer and bottom dialogue box
Lighting/mood: tender, cute, romantic but restrained, luminous atmospheric light
Color palette: fresh blue-white-pink shared palette with the role palette described above
Constraints: environment or listed still-life objects only; no readable writing
Avoid: person, character, human, face, body, hands, feet, portrait, silhouette, crowd, animal, mascot, text, letters, numbers, logo, watermark, speech bubble, UI, dialogue box, border, split panel, collage, photographic realism, horror, erotic framing
```

运行时输出为无 alpha 的 WebP，必须严格 3:2 且不小于 `960×640`：

```text
public/assets/affection/scenes/<slug>.webp
public/assets/affection/cg/<slug>.webp
```

## 2. 40 件装备提示清单

### 2.1 剑姬（swordsman）

| 中文名 | slug | 主体提示 |
|---|---|---|
| 晨誓樱冠 | `morning-oath-sakura-crown` | 一顶轻巧的樱花骑士小冠，象牙白珐琅、樱粉花瓣、天蓝心形晶石与纤细玫瑰金枝叶，完整独立头饰。 |
| 守心樱瓣项链 | `guardian-heart-petal-necklace` | 一条由樱花瓣环抱澄澈蓝色心石的精致项链，细玫瑰金链条自然盘成柔和弧线。 |
| 并肩丝带腕饰 | `side-by-side-ribbon-bracelet` | 一只由樱粉与天蓝两条丝带编成同心结的腕饰，配小型樱花金扣，结构清晰。 |
| 不凋誓约戒 | `everlasting-vow-ring` | 一枚玫瑰金誓约戒，双层樱枝戒圈托起蓝粉双色心形晶石，庄重但可爱。 |
| 心愿蔷薇腰封 | `wish-rose-belt` | 一条象牙白礼服腰封，中央是层叠粉蔷薇金扣，两侧天蓝丝带与细金链完整展开。 |
| 逐光舞步礼鞋 | `lightstep-dance-shoes` | 一双成对的白粉骑士舞鞋，蓝色鞋底、樱花踝带与小金翼装饰，左右鞋完整可辨。 |
| 樱誓骑士姬礼裙 | `sakura-oath-knight-dress` | 一件无人穿着的完整樱色骑士姬洛丽塔礼裙，白色短披肩、粉蓝层叠裙摆、轻甲腰片和金线樱纹。 |
| 心虹誓约花剑 | `heart-rainbow-vow-rapier` | 一柄完整修长花剑，心形玫瑰金护手、樱瓣剑格、蓝白剑柄与淡彩虹晶石剑刃。 |
| 晚霞约会华礼服 | `sunset-date-gala-dress` | 一件无人穿着的晚霞粉蓝华礼服，层叠薄纱、樱花胸针、短拖尾与细金星点，完整悬浮展示。 |
| 晨樱守护长刃 | `morning-sakura-guardian-blade` | 一柄完整长刃，象牙白刀鞘并列在旁，晨蓝晶刃、樱粉护手和玫瑰金誓带，锋芒温柔。 |

### 2.2 魔女（witch）

| 中文名 | slug | 主体提示 |
|---|---|---|
| 告白星纱魔女帽 | `confession-starveil-witch-hat` | 一顶奶油白与月蓝的软檐魔女帽，粉色星纱垂饰、银色星轨和心形糖晶扣。 |
| 怦然星核项链 | `heartbeat-starcore-necklace` | 一条银色星轨项链，中央悬着粉蓝渐变的发光心形星核，周围有三颗糖晶小星。 |
| 牵星蕾丝手环 | `starbound-lace-bracelet` | 一只薰衣草紫蕾丝手环，银链牵起月蓝与奶油粉小星，中央是蝴蝶结星糖。 |
| 月下心愿戒 | `moonlit-wish-ring` | 一枚银色弯月戒，月牙托起粉蓝双色许愿星晶，细小糖粒宝石环绕戒圈。 |
| 星轨蝴蝶腰封 | `startrail-butterfly-waistbelt` | 一条月蓝魔女腰封，宽蝴蝶结、银色星轨链、紫粉糖晶吊坠，完整横向展开。 |
| 流星软糖舞鞋 | `shooting-star-candy-dance-shoes` | 一双成对的奶油粉魔法舞鞋，月蓝鞋尖、软糖流星扣和银色脚踝星链。 |
| 星糖魔女洛丽塔裙 | `star-sugar-witch-lolita-dress` | 一件无人穿着的完整月蓝星糖魔女洛丽塔裙，奶油白泡袖、紫粉层叠裙摆、星月围裙和糖晶蝴蝶结。 |
| 心虹星匙法杖 | `heart-rainbow-star-key-staff` | 一柄完整星匙法杖，银色钥匙形杖身、心形彩虹星核、月蓝羽翼与粉色糖晶星环。 |
| 银河约会夜礼裙 | `galaxy-date-evening-dress` | 一件无人穿着的完整深月蓝约会夜礼裙，粉紫银河薄纱、银星束腰与不拖地的轻盈裙摆。 |
| 怦然月糖魔杖 | `fluttering-moon-sugar-wand` | 一柄完整短魔杖，弯月糖片、心形粉晶、蓝紫螺旋糖杖身与银色星屑吊坠。 |

### 2.3 灵巫（shaman）

| 中文名 | slug | 主体提示 |
|---|---|---|
| 守愿灵蝶花冠 | `wish-guardian-butterfly-crown` | 一顶银白细枝花冠，雾蓝与淡紫灵蝶停在月白花瓣上，中央悬小型月灯晶石。 |
| 同心御守项链 | `kindred-omamori-necklace` | 一条双层银链项链，中央是没有文字的蓝紫双色御守结与心形月石，日式精致。 |
| 归巢蝶翼手环 | `homebound-butterfly-bracelet` | 一只银白手环，两片雾蓝蝶翼围合成归巢弧线，淡紫流苏与月珠轻垂。 |
| 相守祈愿戒 | `together-prayer-ring` | 一枚双股银色祈愿戒，两道独立月纹在顶部并肩环抱蓝紫心晶。 |
| 安梦流苏腰封 | `dream-tassel-belt` | 一条月白和风腰封，雾蓝蝴蝶结、淡紫长短流苏、小月铃与无字御守结。 |
| 踏月灵绣鞋 | `moonstep-embroidered-shoes` | 一双成对的月白浅口礼鞋，雾蓝鞋尖、银线弯月刺绣、灵蝶踝带和淡紫流苏。 |
| 灵蝶祈愿华礼服 | `spirit-butterfly-prayer-ceremonial-dress` | 一件无人穿着的完整月白祈愿华礼服，雾蓝层叠袖、淡紫裙摆、银月腰结与灵蝶纹。 |
| 心虹祈愿灵铃 | `heart-rainbow-prayer-bell` | 一柄完整仪式灵铃，银白长柄、心形淡彩虹铃身、蓝紫丝带和月灯形坠饰。 |
| 月灯相守约会裙 | `moon-lantern-date-dress` | 一件无人穿着的完整月灯约会裙，雾蓝短披肩、淡紫层叠裙摆、双月灯胸针和银白腰花。 |
| 相守月灯法扇 | `together-moon-lantern-fan` | 一柄完整展开的法扇，月白扇骨，蓝紫渐变扇面上仅有两盏无字月灯与灵蝶光纹。 |

### 2.4 喵喵（catkin）

| 中文名 | slug | 主体提示 |
|---|---|---|
| 心跳猫耳蝴蝶结 | `heartbeat-cat-ear-bow` | 一个成年冒险者风格的猫耳轮廓发箍，焦糖棕奶油白缎带、珊瑚粉心结、湖蓝水滴晶石；不是宠物耳饰。 |
| 心音铃铛颈链 | `heart-sound-bell-necklace` | 一条成年搭档风格的奶油白颈链，中央是珊瑚粉心形铃铛和湖蓝晶石，细焦糖金属链自然展开；不是项圈。 |
| 肉球软糖手环 | `paw-gummy-bracelet` | 一只焦糖金手环，镶嵌珊瑚粉与湖蓝的抽象肉球软糖晶石，配奶油白蝴蝶结。 |
| 搭档心愿戒 | `partner-wish-ring` | 一枚搭档誓约戒，两颗并肩星晶托起珊瑚粉心石，焦糖金戒圈配湖蓝刻线。 |
| 蜜糖大蝴蝶腰封 | `honey-bow-belt` | 一条焦糖与奶油白宽腰封，超大珊瑚粉蝴蝶结、湖蓝心扣和小型糖果袋，完整展开。 |
| 云朵肉球舞鞋 | `cloud-paw-dance-shoes` | 一双成对的奶油白舞鞋，云朵软底、珊瑚粉抽象肉球鞋尖、湖蓝踝带和焦糖蝴蝶结。 |
| 蜜糖猫耳洛丽塔裙 | `honey-cat-lolita-dress` | 一件无人穿着的完整成年款蜜糖洛丽塔裙，焦糖棕上衣、奶油白围裙、珊瑚粉层叠裙摆、湖蓝结饰和克制猫耳轮廓。 |
| 心虹蜜糖双爪 | `heart-rainbow-honey-claws` | 一对刻意成套的完整战斗爪刃，焦糖金护手、奶油白握柄、珊瑚粉心晶和淡彩虹弧形刃。 |
| 月下喵舞约会裙 | `moonlit-cat-dance-dress` | 一件无人穿着的完整成年款月下约会裙，深湖蓝与奶油白裙身、珊瑚粉月光薄纱、焦糖金星铃。 |
| 怦然铃星猫爪 | `flutter-bell-star-claws` | 一对刻意成套的完整短爪，湖蓝星晶刃、焦糖金护手、珊瑚粉心铃与奶油白握带。 |

## 3. 12 张无人场景提示清单

下表主体提示必须接在「场景与 CG 母提示」后。场景严禁画固定角色，游戏会把玩家当前实际换装立绘实时叠在背景上。

| 角色 | slug | 主体提示 |
|---|---|---|
| 剑姬 | `swordsman-training-dawn` | 晨曦中的樱花骑士训练庭院，整齐木剑架、白石地面、蓝白旗帜、粉樱花瓣与远处暖金天空；右侧留立绘空间。 |
| 剑姬 | `swordsman-rain-gate` | 温柔春雨中的剑庭木门廊，屋檐雨帘、收起的两把无字纸伞、湿润石板与水中樱瓣倒影；不出现人物倒影。 |
| 剑姬 | `swordsman-victory-night` | 月夜胜利庭院，蓝白庆典灯笼、樱树、空置双人小桌与横放的双色誓约丝带，安静庆功气氛。 |
| 魔女 | `witch-atelier-spark` | 偏航星工坊，圆窗晨光、星图仪、糖果色试剂瓶、漂浮小星晶与整洁木桌；所有书页和标签都无字。 |
| 魔女 | `witch-observatory-night` | 月夜观星台，打开的银色穹顶、巨大望远镜、并排两张空椅、蓝紫银河与粉色流星。 |
| 魔女 | `witch-secret-festival` | 秘密星糖祭典工坊，月蓝桌布、无字配方书、星形糖果模具、柔光玻璃罐与小型归航星晶。 |
| 灵巫 | `shaman-shrine-morning` | 清晨祈愿亭，月白木构、雾蓝帷幔、无字祈愿牌、淡紫灵蝶光点与清澈浅池。 |
| 灵巫 | `shaman-firefly-lake` | 暮色灵火湖畔，平静湖面、两盏空置月灯、蓝紫灵火、银白芦苇与可以并肩停留的木栈台。 |
| 灵巫 | `shaman-bell-corridor-rain` | 春雨中的神社风铃长廊，月白木廊、蓝紫无字风铃、雨幕、庭院水洼与两张并排坐垫。 |
| 喵喵 | `catkin-box-base` | 明亮可爱的纸箱冒险据点，成熟冒险工坊陈设、加固纸箱桌、无字地图、两只马克杯、蜜糖色工具和蓝粉旗帜。 |
| 喵喵 | `catkin-workbench-evening` | 暮色手套工坊，整洁木工作台、两副未完成的空冒险手套、线轴、软糖罐、湖蓝台灯与双人高凳。 |
| 喵喵 | `catkin-rooftop-moon` | 月夜屋顶露台，蓝白城市远景、空置双人长椅、奶油色毯子、两杯热饮、粉色小灯串与开阔星空。 |

## 4. 4 张纯物件高潮 CG 提示清单

CG 仍然不得出现角色、脸、身体或手。用成对物件和构图表达两人的关系，避免固定玩家外观。

| 角色 | slug | 主体提示 |
|---|---|---|
| 剑姬 | `swordsman-ribbon-promise` | 月光木桌上的粉蓝双色誓约丝带，两端自然相向并围成清晰心形留白，中央落一瓣樱花，近景静物高潮构图。 |
| 魔女 | `witch-coordinate-crystal` | 粉蓝归航星晶悬在两个对称银色星座支架之间，内部两束星轨交汇成心形坐标，桌面散落少量星糖。 |
| 灵巫 | `shaman-split-wish` | 两张可以拼合成完整心形月纹的无字祈愿纸并排放在两盏月灯之间，蓝紫灵蝶光点轻绕。 |
| 喵喵 | `catkin-paw-highfive` | 两只无人佩戴的空冒险手套以搭档击掌姿态在中央轻触，奶油白软垫形成抽象肉球形，接触点迸出珊瑚粉心星光。 |

## 5. 明确负面约束

以下约束对全部资产有效，生产时不得省略：

- 装备：无人物、人体、手、脸、皮肤、模特、展示架、UI 框、文字、水印、额外同款、裁切和投影；绿幕不能有渐变或纹理，主体不能含绿色。
- 场景：无人物、剪影、人形倒影、人群、动物、吉祥物、可读文字、对话框、UI、分镜边框和摄影感。
- CG：只画指定静物；无手、手臂、身体、角色、剪影、可读文字、戒指盒求婚俗套和成人露骨内容。
- 四位角色均为成年女性；暧昧表现来自信任、并肩和主动回应。喵喵始终是成年搭档，不使用主人/宠物语义，不把耳朵或尾巴作为默认触摸入口。

## 6. 人工 QA 联系表

生成、抠图和转码完成后，除脚本验收外，还需逐张查看以下联系表，确认形体没有融合、重复、错位、截断或错误文字：

- 剑姬：`art-source/qa/affection-swordsman-assets.png`
- 魔女：`art-source/qa/affection-witch-assets.png`
- 灵巫：`art-source/qa/affection-shaman-assets.png`
- 喵喵：`art-source/qa/affection-catkin-assets.png`

脚本验证规格，联系表验证审美与可用性；两者都通过才可接入游戏。

## 7. 第二批剧情场景与高潮 CG（第 4～6 幕）

第二批统一使用 3:2 横版、手绘二次元 Galgame 场景。每张图均单独调用
ImageGen，母版保存在 `art-source/affection/<scenes|cg>/round2/`，再由
`npm run assets:affection` 无拉伸转为 960×640 WebP。所有提示都附加以下完整约束：

```text
polished painterly 2D Japanese fantasy game background, cute premium mobile anime idle RPG,
exact 3:2 landscape, soft cinematic light, rich but mobile-readable detail,
keep center-right calm and open for a separately layered full-body current-outfit character
and the bottom dialogue UI; key props stay on the left or perimeter;
no people, humanoids, silhouettes, reflections shaped like people, crowds, animals, mascots,
hands, faces, readable text, letters, numbers, logos, watermarks, UI, frame or split panel
```

### 7.1 第 4～6 幕无人场景

| 角色 / 幕次 | 母版与运行时 slug | 完整主体提示 |
|---|---|---|
| 剑姬 4 | `swordsman-paired-trial-sunset` | 樱木作战室兼手札修复间，晨光、两把空椅、合拢的战术手札、茶杯、收纳整齐的剑架；表现训练后共同复盘，以及“把背后交给你”的信任。 |
| 剑姬 5 | `swordsman-lantern-dayoff` | 月夜樱花露台，双人坐垫、低茶桌、剑架上的入鞘长剑、折好披风、远处灯火城镇；表现第一次不必值守的安静休息。 |
| 剑姬 6 | `swordsman-homecoming-sunrise` | 朝阳中的樱木归来居所，两套餐点、修复手札与玫瑰蓝金编绳、并排披风、门边入鞘长剑；表现每次归来都有并肩座位。 |
| 魔女 4 | `witch-atelier-afterglow` | 雨后星糖实验室，玻璃罐、柔光炉、无字器皿与散落星晶，失败实验已安全熄灭；表现“不完美也会发光”。 |
| 魔女 5 | `witch-star-skiff-night` | 紫色云海上的星舟甲板，望远镜、两杯热可可、折叠毛毯、月牙与光点星座；表现把暂停咒语和副驾驶位置交给搭档。 |
| 魔女 6 | `witch-observatory-dawn` | 云上圆形观星台的黎明，大型铜望远镜、两枚星盘、薰衣草披肩、逐渐熄灭的水晶灯；表现两人成为不会偏航的坐标。 |
| 灵巫 4 | `shaman-quiet-tea-afternoon` | 通透草药温室与小神亭，双坐垫、热茶、无字药瓶、浅蓝与淡紫花朵；表现通灵后把沉默和恢复时间也分给搭档。 |
| 灵巫 5 | `shaman-storm-lantern-path` | 夏雨中的有顶神社长廊，两盏暖灯、干燥长凳、折好披肩、两只茶杯；表现她第一次主动请求同行守护。 |
| 灵巫 6 | `shaman-first-snow-garden` | 初雪清晨的药草庭院，茶亭、两杯热茶、成对花灯符、玻璃罩下的药草与通向朝阳的雪路；表现愿望里已有对方。 |
| 喵喵 4 | `catkin-base-expansion-day` | 珊瑚纸板与蓝白装饰的双人据点厨房 / 工坊，普通面包、矩形隔热手套、齿轮、蝴蝶结和菱形键帽纹样；不出现动物脸、爪印或宠物屋语义。 |
| 喵喵 5 | `catkin-rainy-workshop-night` | 雨夜机械工坊，铜制装置、彩色键帽、无字空白图纸、两杯热饮与小型飞艇模型；表现队长也可以说累。 |
| 喵喵 6 | `catkin-sunrise-departure-platform` | 朝霞中的粉青空轨站，两只旅行包、空白珐琅搭档徽章、只含彩线和圆点的路线图、等待启程的小飞艇；表现下一次仍并肩出发。 |

`catkin-base-expansion-day` 初稿误带卡通动物脸和爪形烘焙物，已做两次定向
编辑：动物脸替换为花形齿轮，爪形面包与隔热手套替换为普通面包和菱纹矩形
手套。最终母版不复用初稿。

### 7.2 四张纯物件高潮 CG

| 角色 | 母版与运行时 slug | 完整主体提示 |
|---|---|---|
| 剑姬 | `swordsman-homecoming-knot` | 朝阳木桌近景：修复的皮革手札由玫瑰、深蓝、金色编绳系住，旁边是剑镡与两杯热茶；编绳是左侧焦点，右侧留对白空间。 |
| 魔女 | `witch-shared-constellation` | 薰衣草绒布近景：两枚黄铜紫晶星盘边缘相触，晶针投出由纯光点连接的共同星座；无文字与符文。 |
| 灵巫 | `shaman-paired-lantern-charm` | 初雪茶席近景：琥珀与冰蓝两枚透明花灯符以梅色丝绳相连，两杯热茶与药花虚化在后景。 |
| 喵喵 | `catkin-partner-badges` | 朝霞站台近景：珊瑚粉与湖蓝旅行包各挂一枚空白珐琅搭档徽章与黄铜键帽坠饰，图案只使用星、圆点和抽象角色识别纹样。 |

### 7.3 第二批人工 QA 联系表

- `art-source/qa/affection-round2-swordsman-contact-sheet.png`
- `art-source/qa/affection-round2-witch-contact-sheet.png`
- `art-source/qa/affection-round2-shaman-contact-sheet.png`
- `art-source/qa/affection-round2-catkin-contact-sheet.png`

四张联系表均按“第 4 幕 / 第 5 幕 / 第 6 幕 / 高潮 CG”排列。自动审计负责
格式、尺寸和精确清单；联系表负责确认无人、无伪文字、无肢体、无幼态宠物语义，
以及中心偏右的实时换装角色叠放区没有被关键物件堵住。

## 8. 第三批：平等互赠（第 7～9 幕）

第三批主题是“收礼不等于欠债 → 明确表达偏好 → 平等回礼”。场景继续使用严格
3:2 横图，每张独立调用 ImageGen。为避免剧情弹窗出现视觉黑带，提示词额外要求：

```text
full-bleed exact 3:2 landscape; keep center-right calm for the live character layer;
keep the whole bottom third illuminated and textured;
no black bars, no vignette, no dark or black bottom fade, no empty black foreground;
no people, hands, silhouettes, readable text, UI, frame or split panel
```

母版位于 `art-source/affection/<scenes|cg>/round3/`，由
`node scripts/build-affection-round3-assets.mjs` 生成 960×640 WebP 与五张联系表。

### 8.1 第 7～9 幕场景与物件 CG

| 角色 | 第 7 幕 | 第 8 幕 | 第 9 幕 | 第 9 幕物件 CG |
|---|---|---|---|---|
| 剑姬 | `swordsman-gift-tea-dawn`：晨光茶室、两杯与礼物罐 | `swordsman-rain-market-tasting`：雨市试味亭、三种低糖点心 | `swordsman-reciprocal-gift-sunset`：夕照居所、两份独立礼布 | `swordsman-two-way-gift-ribbons`：两份礼布、焙茶罐与三色地图书签 |
| 魔女 | `witch-gift-safety-atelier`：礼物安全检测台 | `witch-secret-library-night`：无字空白手札与夜间藏书室 | `witch-reciprocal-star-dawn`：黎明星墨工房与两瓶独立星墨 | `witch-reciprocal-star-ink`：两瓶偏航星墨的对等静物 |
| 灵巫 | `shaman-blank-gift-paper-morning`：无字双页愿纸作间 | `shaman-moontea-rest-evening`：全部值夜灯熄灭的双席茶廊 | `shaman-return-charm-night`：敞门归灯亭与可解护符 | `shaman-open-knot-keepsakes`：两枚完整、可自由解开的护符 |
| 喵喵 | `catkin-gift-inspection-workshop`：成年冒险队检修工坊 | `catkin-sentimental-shelf-rain`：雨夜私人纪念收纳墙 | `catkin-shared-expedition-locker-sunrise`：左右私人格与中央共享格 | `catkin-two-way-supply-tags`：两枚补给标签、两条开放织带与两枚铜扣 |

所有 CG 均只画物件，不出现玩家或角色固定外形。礼布、标签和护符保持“两份独立、
可以取回”的构图，不使用戒指盒、婚礼或所有权符号。

### 8.2 十二件偏好礼物图标

每个礼物图标独立生成在纯 `#00ff00` 绿幕上，禁止背景投影、文字和 UI。绿幕母版：

```text
art-source/affection/gifts/round3/<giftId>-chroma.png
```

运行：

```powershell
node scripts/build-affection-round3-gifts.mjs
```

脚本调用 imagegen skill 的 `remove_chroma_key.py`，使用 border 自动取色、soft matte、
12/220 阈值和 despill，再以 `sharp` 保持比例放进 224×224 主体区，四边各留 16px
透明边距，输出 256×256 RGBA PNG。

| 角色 | 偏爱（+18） | 喜欢（+14） | 合心（+10） |
|---|---|---|---|
| 剑姬 | `gift_swordsman_sakura_roast_tea`：樱叶焙茶罐与两杯 | `gift_swordsman_guard_care_case`：打开的护手养护匣 | `gift_swordsman_morning_training_cloth`：晨蓝练剑巾与小收纳袋 |
| 魔女 | `gift_witch_deviant_star_ink`：偏航星晶墨 | `gift_witch_blank_starmap_notebook`：无锁、无字星图手札 | `gift_witch_meteor_candy_jar`：无标签流星软糖罐 |
| 灵巫 | `gift_shaman_blank_wish_album`：无字双页愿纸册 | `gift_shaman_moonwhite_rest_tea`：月白茶壶与两杯 | `gift_shaman_clear_lantern_cover`：透明清月花灯罩 |
| 喵喵 | `gift_catkin_modular_field_case`：模块化远征收纳匣 | `gift_catkin_dual_repair_lamp`：两侧独立控制的维修灯 | `gift_catkin_victory_candy_pack`：两袋可独立开启的胜利软糖 |

喵喵礼物不得带项圈、宠物箱、宠物零食、动物脸或主人语义；所有标签片保持无字。

### 8.3 第三批 QA

- 总联系表：`art-source/qa/affection-round3-contact-sheet.png`
- 四职业场景联系表：`art-source/qa/affection-round3-<class>-contact-sheet.png`
- 礼物联系表：`art-source/qa/affection-round3-gifts-contact-sheet.png`
- 自动审计：`node scripts/validate-affection-assets.mjs`

审计后的精确运行时清单为 40 装备图标 + 12 礼物图标 + 36 场景 + 12 CG，共
100 个文件。脚本负责格式、尺寸、透明边距、残绿、比例与清单；联系表和两档浏览器
截图负责审美、伪文字、构图、弹窗黑带和移动端可用性。
