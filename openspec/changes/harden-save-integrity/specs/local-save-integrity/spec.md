## ADDED Requirements

### Requirement: 存档槽使用可版本化完整性信封
系统 SHALL 为主槽和备份槽保存版本、revision、父摘要、内容摘要、来源、写入时间与业务 payload，并 MUST 对规范化内容计算确定性 SHA-256 摘要。

#### Scenario: 正常连续保存
- **WHEN** 同一客户端基于当前 revision 连续保存两次
- **THEN** 新信封 revision 单调增加且 `parentDigest` 等于上一主槽摘要

#### Scenario: 同内容可复现
- **WHEN** 两个等价 SaveData 对象只存在对象 key 插入顺序差异
- **THEN** 稳定序列化与摘要结果完全一致

### Requirement: 旧裸快照无损兼容
系统 SHALL 读取当前迁移链可接受的旧裸 SaveData，并在首次成功写入时升级为信封；该物理升级 MUST NOT 修改业务字段或提升 `SAVE_VERSION`。

#### Scenario: 首次读取 v12 裸存档
- **WHEN** IndexedDB 主槽仍直接保存合法 v12 SaveData
- **THEN** 游戏正常加载且下一次保存产生完整性信封

### Requirement: 完整性异常不被静默覆盖
系统 MUST 区分结构校验失败、摘要不匹配、父链不匹配和 revision 损坏；异常发生后 MUST 停止自动写入并提供恢复或导出路径。

#### Scenario: 主槽 payload 被直接修改
- **WHEN** 主槽摘要与规范化 payload 不一致而备份合法
- **THEN** 系统不加载篡改主槽、不上传联机数据，并允许玩家显式恢复备份

#### Scenario: 主备份均异常
- **WHEN** 主槽和备份都无法通过结构与完整性校验
- **THEN** 系统保留原始数据，允许只读导出并要求玩家明确选择清档

### Requirement: JSON 导入不伪造联网可信度
系统 SHALL 保持 SaveData JSON 导入导出兼容；导入成功后 MUST 创建来源为 `imported` 的本地链，且 MUST NOT 从文件接受服务端证明、权威 revision 或资产可信标记。

#### Scenario: 导入合法旧档
- **WHEN** 玩家导入通过迁移与结构校验的 JSON
- **THEN** 单机玩法正常可用，信封来源标记为 imported，联网资产等待服务端对账

### Requirement: 本地完整性不宣传为绝对防作弊
系统文案和文档 MUST 将客户端摘要称为完整性检测，并 MUST 明确高级玩家可以重算客户端摘要。

#### Scenario: 查看安全说明
- **WHEN** 玩家在存档设置中查看完整性状态
- **THEN** 页面说明它用于发现损坏和普通修改，真正影响他人的资产由服务端记录裁定
