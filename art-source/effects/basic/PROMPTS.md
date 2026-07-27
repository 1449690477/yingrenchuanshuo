# 三职业普通攻击命中特效

生成日期：2026-07-27
生成模式：内置 ImageGen，`stylized-concept`，每张素材独立调用一次
透明流程：纯 `#00ff00` 绿幕 → 官方 `remove_chroma_key.py` → `edge-contract 1` → Sharp 规范为 512 × 512 RGBA PNG

## 剑姬：`swordsman-strike.png`

- 风格参考：`swordsman-attack.png`、`swordsman-halfmoon.png`、`swordsman-flame.png`
- 生成源：`call_IpvaCYPbfv5v2iUdqBvnL37N.png`
- 提示词摘要：小型普通攻击命中点；冰蓝与樱粉两道短距离交叉剑痕；暖白星芒中心；少量樱花碎光；主体约占画布 38%；不可出现人物、怪物、武器、场景、文字或大型技能构图。

## 魔女：`witch-spark.png`

- 风格参考：`witch-fireball.png`、`witch-fire-ring.png`、`witch-lightning.png`
- 生成源：`call_ZGtholqqSLnJfbG2Eg9sZbnw.png`
- 提示词摘要：小型粉橙魔弹爆点；五星花心、短促珊瑚粉光晕、两三颗蓝白星光与少量樱花光屑；主体约占画布 32%；不可像火球、爆炸或终极技能。

## 灵巫：`shaman-wisp.png`

- 风格参考：`shaman-heal.png`、`shaman-poison.png`、`shaman-skeleton.png`
- 生成源：`call_0AzihPCrNlrWaKzfFZ5dv9rO.png`
- 提示词摘要：小型蓝紫灵火弹命中点；水滴形灵火、两道铃形同心涟漪与三颗水晶星屑；主体约占画布 34%；不可出现大型法阵、骷髅、毒雾、人物或怪物。

三次调用均要求背景为完全均匀的 `#00ff00`，无阴影、渐变、纹理、反射、地面、光晕污染、水印或文字，且主体不得使用绿色。

## 最终验证

| 文件 | 尺寸 / 通道 | Alpha 包围盒 | 包围盒尺寸 | 四角 Alpha | 绿色残边像素 | 体积 |
|---|---|---|---|---|---:|---:|
| `swordsman-strike.png` | 512 × 512 / RGBA | `[160,175,354,335]` | 195 × 161 | 0 / 0 / 0 / 0 | 0 | 39.7 KiB |
| `witch-spark.png` | 512 × 512 / RGBA | `[163,162,350,337]` | 188 × 176 | 0 / 0 / 0 / 0 | 0 | 47.4 KiB |
| `shaman-wisp.png` | 512 × 512 / RGBA | `[169,154,342,326]` | 174 × 173 | 0 / 0 / 0 / 0 | 0 | 48.9 KiB |

绿色残边检测规则：对 `alpha > 8` 的可见像素检查 `G > max(R, B) + 18` 且 `G > 70`；最终三张素材均为 0。
