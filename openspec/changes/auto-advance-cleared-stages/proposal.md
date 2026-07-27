## Why

当前玩家达到关卡击杀目标后虽然完成首通并解锁下一关，但挂机点仍停留在原关卡，需要反复手动打开关卡列表推进。放置玩法应当在首次达标时自然向前推进，同时保留玩家回低层刷材料的自由。

## What Changes

- 当前关卡首次达到通关击杀数量后，自动切换到已解锁的下一关继续挂机。
- 玩家手动切回已经通关的旧关卡后保持在该关卡，不因继续击杀而自动跳走。
- 最后一关没有下一关时保持原地挂机。
- 在线与离线结算采用相同的首通自动推进规则。
- 不新增开关、UI、存档字段或迁移。

## Capabilities

### New Capabilities

- `stage-auto-advance`: 定义关卡首次达标自动推进、手动回刷稳定停留和末关兜底行为。

### Modified Capabilities

无。

## Impact

- 关卡结算：`src/stores/game.ts`
- 行为测试：`src/stores/__tests__/game.spec.ts`
- 交接文档：`docs/31-PROGRESS.md`、`AGENTS.md`
- 无存档、数据表、路由或 UI 结构变化
