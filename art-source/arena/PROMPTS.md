# 竞技场奖励资产 · ImageGen 生产记录

## 生产方式

- 日期：2026-07-29
- 工具：Codex 内置 `image_gen`（默认 built-in 模式）
- 方式：25 个资产逐张独立生成；未使用 CLI、批量占位图或本地绘图替代
- 风格参考：
  - `art-source/qa/r5-items-equipment-contact.webp`：现有装备 / 物品图标的线稿、赛璐璐上色与缩略图密度
  - `art-source/qa/r4-equipment-contact.png`：清新金属、白色衣料与深蓝轮廓
  - `art-source/arena/honor_sigil-chroma.png`：本批共同「带翼冠冕 + 天平 + 樱花宝石」圣痕锚点
- 抠图：`scripts/build-arena-assets.mjs` 调用官方
  `remove_chroma_key.py --auto-key border --soft-matte --transparent-threshold 12
  --opaque-threshold 220 --despill`
- 运行时构建：主体缩入 `224×224` 安全区，再放入 `256×256` RGBA 画布；
  横幅转为 WebP。

## 图标共同提示

除下表的「主体」与「配色」外，所有图标都使用以下共同提示：

```text
Use case: stylized-concept
Asset type: 256×256 mobile JRPG inventory / rank icon source
Scene/backdrop: perfectly flat solid chroma-key background, one uniform color only,
with no shadows, gradients, texture, reflections, floor plane or lighting variation.
Style/medium: polished 2D Japanese mobile RPG icon, clean deep-navy linework,
cel-shaded metal/enamel/cloth/crystal, bright friendly anime-game rendering matching
the repository references; not photorealistic and not 3D product photography.
Composition/framing: exactly one requested asset centered, strong silhouette that
remains readable at 24–32px, generous clear padding, every tip and appendage visible.
Constraints: no text, letters or numbers; no people, hands, faces or mannequins;
no frame, scenery, cast/contact shadow, watermark or unrelated logo; do not use the
chroma color in the subject; keep every subject pixel away from every canvas edge.
```

默认绿幕为 `#00ff00`。`tier-qingying` 的主体原计划含玉色，为避免误抠，单独使用
`#ff00ff`，并禁止主体出现洋红 / 粉色。首版浅玉区域仍命中项目的残绿像素规则，
因此没有放宽门禁，而是用一次 `precise-object-edit` 保持造型不变、只改为冰青 / 水蓝。

## 逐张主体提示

| 文件 | 主体提示 | 配色 |
|---|---|---|
| `honor_sigil-chroma.png` | 厚实八角金质荣誉章；中央是带翼冠冕、完整天平和一颗樱花宝石，32px 下仍一眼可认 | 金、象牙白、樱粉宝石、深蓝描边 |
| `swordsman/triumph-verdict-blade-chroma.png` | 凯旋·裁决之剑；象牙白单刃长剑，圣痕嵌在护手，整剑左下到右上 | 金白、绯红、樱粉 |
| `swordsman/triumph-laurel-crown-chroma.png` | 凯旋·荣冠；可佩戴的开放式月桂冠，圣痕与小天平集中在额心，不能画成硬币 | 金白、绯红宝石 |
| `swordsman/triumph-battle-mantle-chroma.png` | 凯旋·战披；空置白色战披与短甲衣，绯红内衬、结构肩甲、圣痕胸扣 | 金白、绯红 |
| `swordsman/triumph-oath-ring-chroma.png` | 凯旋·誓约指环；厚金戒、月桂刻纹、樱花主石与圣痕台座，戒圈开口清楚 | 金白、绯红宝石 |
| `witch/starjudge-scale-staff-chroma.png` | 裁星·天平法杖；细长星象杖，顶端星盘、固定星晶、冠翼与完整小天平 | 金白、深蓝、星紫、青蓝 |
| `witch/starjudge-observatory-crown-chroma.png` | 裁星·观星冠；可佩戴的横向星盘冠冕，轨道环、固定星晶、冠翼与小天平 | 金白、深蓝、星紫、青蓝 |
| `witch/starjudge-orbit-robe-chroma.png` | 裁星·星轨长袍；空置长袍、钟形袖、深蓝星空内衬与金色轨道，圣痕胸扣 | 金白、深蓝、星紫、青蓝 |
| `witch/starjudge-fixedstar-ring-chroma.png` | 裁星·恒星指环；星盘台座围住蓝紫固定星，带翼和天平细节，戒圈清楚 | 金白、深蓝、星紫、青蓝 |
| `shaman/oracle-spirit-bell-staff-chroma.png` | 神谕·灵铃杖；象牙漆木仪杖、青玉灵晶、冠翼与天平横杆、三枚礼铃和淡紫流苏 | 金白、蓝青玉、淡紫 |
| `shaman/oracle-rite-crown-chroma.png` | 神谕·祭冠；横向仪式冠，向上翼角、青玉主石、冠翼天平与两侧铃穗 | 金白、蓝青玉、淡紫 |
| `shaman/oracle-ritual-vestment-chroma.png` | 神谕·巫祝礼衣；空置层叠仪式袍、青玉襟片、淡紫飘带、礼铃和圣痕胸扣 | 金白、蓝青玉、淡紫 |
| `shaman/oracle-pact-ring-chroma.png` | 神谕·契灵指环；青玉灵石、冠翼天平、双铃与淡紫流苏，戒圈清楚 | 金白、蓝青玉、淡紫 |
| `catkin/swiftshadow-twin-claws-chroma.png` | 疾影·双弦爪；恰好一对镜像爪铠，每只三刃，浅 X 交叉，不能画成剑 | 金白、午夜蓝、电光青、樱粉 |
| `catkin/swiftshadow-nighthunt-ears-chroma.png` | 疾影·夜猎耳饰；一对硬质猫耳由细冠相连，内嵌青晶，中央是冠翼天平与爪印樱花 | 金白、午夜蓝、电光青、樱粉 |
| `catkin/swiftshadow-stalker-suit-chroma.png` | 疾影·潜行战衣；空置敏捷短战衣与合身护甲，青晶速度线、分尾下摆、圣痕胸扣 | 金白、午夜蓝、电光青、樱粉 |
| `catkin/swiftshadow-agile-ring-chroma.png` | 疾影·迅捷指环；流线分叉戒身、爪 / 箭头形青晶、冠翼天平，戒圈清楚 | 金白、午夜蓝、电光青、樱粉 |
| `box_sacred-chroma.png` | 高档圣痕匣；关闭的象牙白穹顶宝箱，正面大圣痕锁和樱粉封晶，比星辉匣明显更华贵 | 金白、樱粉 |
| `box_starlight-chroma.png` | 常规星辉匣；关闭的深蓝白宝箱，简化金边、青色四芒星锁和小樱花，比圣痕匣朴素 | 深蓝、白、金、青蓝、少量樱粉 |
| `tier-qingying-chroma.png` | 青樱最低段徽章；白金盾章、一朵冰青樱花、短翼、克制金边和小天平，亲和而不寒酸 | 冰青、水蓝、白、少量金；洋红绿幕 |
| `tier-feiyue-chroma.png` | 绯月第二段徽章；银白盾章、玫瑰新月抱住樱花、中型金边、双翼和小天平 | 玫粉、月银、白、金、紫 |
| `tier-hupo-chroma.png` | 琥珀中段徽章；大块琥珀晶盾、完整天平、层叠白翼和小冠尖 | 琥珀、蜜金、白 |
| `tier-feiying-chroma.png` | 绯樱高段徽章；赤金盾章、大颗切面樱花、展开白翼、冠冕天平和上扬花焰 | 深绯、樱粉、金白 |
| `tier-yingguan-chroma.png` | 樱冠最高段徽章；整套中最宏伟的金冠、切面樱花星、展开白翼、完整天平和收束光芒 | 白金、樱粉、少量深蓝 |

## 横幅提示

```text
Use case: stylized-concept
Asset type: wide 3:2 mobile JRPG arena banner background
Primary request: create an original Sakura Legend arena reward banner: a luminous
ceremonial sky arena at dawn, with white marble terraces, gold railings, sakura-petal
inlays, paired scale-shaped braziers, wing-like arches, and the shared
winged-crown-and-balanced-scales sacred mark mounted high at center. The scene should
communicate glory, judgment and welcoming competition, not war.
Scene/backdrop: full opaque environment, pale blue sky and soft clouds, no chroma key.
Style/medium: polished 2D Japanese mobile-game environment illustration, clean linework,
cel-shaded architecture, bright crisp colors matching the project’s blue-white-pink look.
Composition/framing: landscape 3:2; symmetrical wide establishing view; center sacred
mark and distant arena floor; clean lower-center area usable behind UI; no important
detail within 5% of any edge.
Lighting/mood: clear morning radiance, celebratory and majestic, sparse sakura petals.
Constraints: no characters, people, silhouettes, animals, weapons, readable text,
letters, numbers, UI mockup, border, watermark, dark storm or photorealism.
```
