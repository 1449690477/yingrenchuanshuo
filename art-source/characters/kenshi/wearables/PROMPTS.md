# 樱酱竞技 / 心虹 / 精品 / 副本可穿资产

## 整身替换母版

统一参考 `public/assets/characters/modular/kenshi/base.png`，保持同一成年娇小白发猫耳剑士、
同一张脸、同一站姿与脚底锚点；只替换衣装，不生成刀、刀鞘、道具和背景。

- `arena-whitefeather-body.png`：雪白、深蓝与冰蓝的白羽短战衣，羽形肩片、
  深蓝腰封与少量樱粉收边。
- `affection-guardian-body.png`：白羽樱守短羽织，白与淡蓝交领、羽纹刺绣、
  深蓝结带与小樱扣。
- `affection-moonblue-body.png`：月蓝巡灯小振袖，月蓝渐变袖、银色巡灯与雪樱纹、
  白内领和淡粉腰绳。

三张母版由 Meowa HD 身份保持变体生成，运行时先保留最大人物连通域，再按
`640×960` 画布、中心 `x=320±12`、脚底 `y=925±4` 规范化。

## 14 件专属装备

`scripts/build-kenshi-wearables.mjs` 从每件独立 256 图标生成对应纸娃娃层：

- weapon 对位持刀区；
- head 放在右侧耳根外侧，不遮脸与双耳；
- necklace / bracelet / ring / belt / shoes 分别对位胸、腕、手、腰与足；
- 三件 body 使用上节完整人物替换母版。

竞技 4 件与心虹 10 件全部使用独立 `appearanceId`，单穿时
`visibleEquippedCount=1`，禁止回落精品主题或 `slot-only`。

## 精品 / 副本独立变体

过去 3 套精品与 4 档副本的樱酱头饰、太刀直接复制区域资产，形成 18 个重复 SHA 组。
现保留区域资产作为稳定姿态参考，在 `boutique/`、`dungeon/` 下生成 14 张独立
alpha 母版：莓霜樱结、月糖月饰、绯夜蔷薇、晴蓝晶饰、暮紫菱晶、辉金日轮、
绯樱火纹。7 张武器图标必须从对应独立 weapon 母版裁切，不再读取区域 weapon。

构建与 dry rebuild：

```bash
npm run assets:kenshi:wearables
node scripts/build-kenshi-wearables.mjs --check
```
