## Why

《樱刃传说》仍以纯静态 PWA 和本地 IndexedDB 存档为主。现有 Zod 校验、备份槽和 revision/CAS 能防坏档、写盘中断与多标签覆盖，却无法判断“结构合法但内容被直接修改”的存档。需要在不破坏离线挂机和 JSON 备份的前提下，让损坏、低成本编辑和链断裂可见、可恢复，并为未来服务端权威资产划清边界。

## What Changes

- 为 IndexedDB 主槽与备份槽增加版本化完整性信封：稳定序列化、SHA-256 摘要、单调 revision、父摘要链、写入时间和来源。
- 旧裸 SaveData 无损读取，首次成功保存后升级物理信封；业务结构不变，`SAVE_VERSION` 保持 v12。
- 主档、备份、revision 或摘要异常时停止自动写入，不静默恢复或清档；启动页提供显式备份恢复、原始诊断导出和二次确认清除。
- JSON 导出仍只包含可读 SaveData；导入档建立 `imported` 来源链，不能通过文件注入服务端证明或权威 revision。
- “更多 → 存档管理”展示完整性状态，并明确客户端公开摘要只能检测损坏和普通修改，不能代替服务端防作弊。
- 服务端权威装备、货币和奖励账本留给后续独立 OpenSpec；在其生产验收前继续关闭交易和资产型多人奖励。

## Capabilities

### New Capabilities

- `local-save-integrity`: 本地存档信封、摘要链、备份恢复、旧档兼容、导入来源标识和异常交互。

### Modified Capabilities

无。

## Impact

- 修改 `src/core/saveIntegrity.ts`、`src/save/storage.ts`、游戏 store、存档管理 UI、启动失败页及对应测试。
- 物理存储格式升级不修改 SaveData 业务字段，因此不新增存档迁移。
- 每次保存增加一次稳定序列化与异步 WebCrypto SHA-256；以真实 300 件装备存档设置性能门禁。
- 第一阶段只能可靠发现意外损坏和低成本直接编辑；掌握开发者工具的玩家仍能重算公开摘要，联机关键资产必须由后续服务端账本裁定。
