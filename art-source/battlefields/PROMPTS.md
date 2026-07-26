# 区域 1～2 横版战场生成记录

- **生成模式**：`stylized-concept`
- **参考方式**：每张战场都以对应的 `public/assets/maps/chapter-<id>.webp` 竖版章节图作为风格和地点参考，重新生成真正的 3:2 横版构图，不做裁切放大。
- **统一提示词约束**：
  - 1536 × 1024、日系可爱 2D 手游场景；
  - 远景主体放在上方，画面下方 45%～50% 保留平坦、连续的战斗地面；
  - 左侧预留人物、右侧预留怪物，中间保持技能飞行路线清晰；
  - 边缘可有花草、晶体和粒子，角色站位区域不得堆放遮挡物；
  - 不生成人物、怪物、武器、文字、UI、边框、水印或生命条。

## 章节集合

| 输出 | 地点主题 | 参考图 |
|---|---|---|
| `chapter-1-1.webp` | 初醒的樱庭 | `chapter-1-1.webp` |
| `chapter-1-2.webp` | 镇外小径 | `chapter-1-2.webp` |
| `chapter-1-3.webp` | 荒废的花房 | `chapter-1-3.webp` |
| `chapter-1-4.webp` | 樱之林深处 | `chapter-1-4.webp` |
| `chapter-1-5.webp` | 落樱结界 | `chapter-1-5.webp` |
| `chapter-2-1.webp` | 棉花糖丘陵 | `chapter-2-1.webp` |
| `chapter-2-2.webp` | 打盹稻草田 | `chapter-2-2.webp` |
| `chapter-2-3.webp` | 蜂娘蜂巢 | `chapter-2-3.webp` |
| `chapter-2-4.webp` | 迷路者营地 | `chapter-2-4.webp` |
| `chapter-2-5.webp` | 草原水晶祭坛 | `chapter-2-5.webp` |

ImageGen 返回的 PNG 原件保留在本次 Codex 生成目录；工作副本保存在
`tmp/imagegen/battlefields-source/`。游戏运行时只发布 `public/assets/battlefields/`
中的 WebP。
