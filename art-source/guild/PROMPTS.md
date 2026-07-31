# 公会团本战场 · ImageGen 生产记录

## 运行时接口

- 母版：`art-source/guild/guild-expedition-arena.png`
- 运行时：`public/assets/guild/guild-expedition-arena.webp`
- 重建：`npm run assets:guild`
- 审计：`npm run assets:guild:check`

公会团本与周常试炼使用同一份“倾向 × 元素”首领数据，因此首领形象直接复用
`public/assets/trial/` 下已经逐组合审计的 9 张透明 Boss，而不是再造一套同名但可能
长相冲突的素材。公会只生产独立战场，保证玩法空间有自己的视觉身份。

## 最终提示词（内置 ImageGen）

```text
Use case: stylized-concept
Asset type: mobile game guild expedition battle environment, production runtime background
Primary request: Create a dedicated 3:2 battle arena for a cute Japanese fantasy guild raid in Sakura Legend. It should feel like guild companions are confronting a weekly elemental boss inside a grand open-air sakura citadel.
Scene/backdrop: luminous white-stone guild sanctuary at blue hour, distant cherry blossom towers and banners, circular engraved arena platform, shallow reflective channels, pale blue magical wards, soft pink petals and a few cyan motes in the air.
Style/medium: polished 2D Japanese mobile RPG background, crisp cel-painted concept art, fresh cute blue-white-pink palette with deep navy readability and restrained gold accents; match a bright anime idle-game interface.
Composition/framing: exact landscape 3:2 composition; wide establishing camera at character eye level; lower 45% must be a clean readable battle floor with two open combat positions and no tall props; horizon and architecture in upper half; strong depth layers but no foreground obstruction.
Lighting/mood: heroic, welcoming and ceremonial rather than dark; cool moon-blue ambient light with warm sakura highlights; high clarity at phone size.
Constraints: environment only; absolutely no humans, characters, monsters, silhouettes, weapons, logos, UI, readable text, watermarks, emblems floating in the center, or central object blocking the battlefield. No heavy fog, no dirty gray cast, no photorealism. The image must crop safely to 3:2 without losing the combat floor.
```
