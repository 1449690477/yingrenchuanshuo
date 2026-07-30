# 57 · 数值重构分工（kimi 侧 UI 任务书）

> 承 [`56-数值地基重构.md`](56-数值地基重构.md)。
> 分工：**数值、core、store、迁移、sim 门禁全部由 claude 做**；
> 本文档是 kimi 的并行任务书 —— UI 层全部工作，含**接口契约**。
>
> **并行方式**：下面的函数签名是 claude 的交付承诺，先照签名写 UI
> （本地临时 stub 返回假数据即可），claude 的实现落地后删 stub 直连。
> 签名如需变更会在聊天室 @kimi 并同步本文档，不会静默改。

---

## 〇、文件占用边界（开工前先看）

| 归属 | 文件 |
|---|---|
| **claude（勿动）** | `src/data/expectedPower.ts`、`src/data/stages.ts`、`src/data/constants.ts`、`src/core/progression.ts`、`src/core/stageProgress.ts`、`src/core/idle.ts`、`src/stores/game.ts`、`src/save/schema.ts`、`src/save/migrations.ts`、`scripts/simulate.ts` 及以上全部测试 |
| **kimi** | `src/views/IdleView.vue`、`src/components/StageSelect.vue`、`src/components/TopBar.vue`、`src/views/DungeonView.vue`、`src/views/RankView.vue`、新组件 `src/components/DefeatReport.vue` |

冲突时在聊天室喊，不要抢改。

---

## 一、接口契约（claude 承诺的交付面）

### 1.1 章节/区域门槛

```ts
// src/core/stageProgress.ts
export interface ChapterGate {
  ok: boolean;
  /** 进入该章所需战力（expectedBuildCp 口径） */
  requiredCp: number;
  currentCp: number;
  /** max(0, required - current)；ok 时为 0 */
  gapCp: number;
  /** 'ok' | 'cp'（战力不足） | 'legacy-bypass'（老档等级后门放行） */
  reason: 'ok' | 'cp' | 'legacy-bypass';
}
export function evaluateChapterGate(
  currentCp: number,
  playerLevel: number,
  chapterId: string,
): ChapterGate;
```

### 1.2 挑战体力

```ts
// src/core/stageProgress.ts
export interface ChallengeCost {
  ok: boolean;
  /** 本次挑战消耗；已通关关卡恒为 0 */
  cost: number;
  stamina: number;
  staminaMax: number;
  /** 不足时距下一点恢复的秒数；充足时为 0 */
  nextPointInSeconds: number;
  reason: 'ok' | 'stamina';
}
export function evaluateChallengeCost(
  stageId: string,
  clearedStageIds: readonly string[],
  stamina: number,
  staminaMax: number,
  staminaRecoverAt: number,
  now: number,
): ChallengeCost;
```

### 1.3 store 暴露面（`useGameStore`）

```ts
/** 组合门槛+体力，一次拿到 UI 要展示的一切 */
game.evaluateStageEntry(stageId: string): { gate: ChapterGate; cost: ChallengeCost };

/** 战败战报；非 null 时弹层，关闭时调 dismiss */
game.defeatReport: {
  fromStageName: string;   // 被打退的关
  toStageName: string;     // 退回到的关
  monsterName: string;     // 元凶（显示用）
  efficiency: number;      // 触发时效率，如 0.42
} | null;
game.dismissDefeatReport(): void;

/** 经验条冻结态 */
game.levelCapInfo: {
  softCap: number;         // 当前软上限
  frozen: boolean;         // 已顶到上限
  pendingExp: number;      // 冻结期间累积的经验（解锁后释放）
};
```

---

## 二、任务清单（K1 ~ K7）

### K1 · 章节/区域锁定态（最重要的一张卡）

`StageSelect.vue`：未达门槛的章节显示锁定卡。

- 内容：所需战力、**你还差多少**（`gapCp`）、一个「去养成」按钮直接跳养成页
- 文案基调是**指路牌不是墙**：
  ✅「还差 1,200 战力 —— 试试强化武器或洗练词条」
  ❌「战力不足，无法进入」（禁止此类冷拒绝）
- `reason === 'legacy-bypass'` 时不显示门槛条（老档直接放行，别提醒他被特殊对待）
- 验收：320×568 下锁定卡完整可读；gapCp 随战力提升实时刷新

### K2 · 挑战按钮的体力显示

`IdleView.vue` / `StageSelect.vue` 挑战入口：

- `cost > 0` 时按钮上显示「挑战 ⚡6」；`cost === 0`（已通关）不显示任何体力元素
- 体力不足：按钮置灰 + 显示「⚡ 3/6 · 12 分钟后可挑战」（用 `nextPointInSeconds` 算）
- **禁止**出现「购买体力」「看广告恢复」类入口（docs/40 红线）
- 验收：倒计时每分钟刷新；体力恢复到位后按钮自动恢复可点

### K3 · 战败战报弹层（新组件 `DefeatReport.vue`）

监听 `game.defeatReport`，非 null 时弹出：

- 结构：元凶怪物名 + 一句有温度的败退文案 + 「退回了 XX 关」+ 两个按钮
  （「先养成」跳养成页 /「知道了」关闭）
- 文案模板：「{monsterName} 太凶了，少女退回了 {toStageName} —— 强化装备后再来」
- **不显示**损失类字样（本来也没有任何损失，别让玩家误以为有）
- 复用全局 `.overlay` 滚动居中模式（docs 见 style.css 注释），关闭调 `dismissDefeatReport()`
- 验收：375×812 与 320×568 按钮可达；连续战败不叠多层弹窗

### K4 · 经验条冻结态

`TopBar.vue` 经验条：

- `levelCapInfo.frozen` 时：经验条改为满格呼吸样式 + 角标「区域顶点」，
  点击弹 tooltip：「已达当前区域顶点（Lv{softCap}）· 推进关卡以继续升级，
  已积攒 {pendingExp} 经验」
- 解锁新章后（frozen 变 false 且连升多级）：可选做一个连升数字滚动演出——
  这是本次重构里唯一的爽点演出，值得花心思，但属可选项不阻塞验收
- 验收：冻结态不再播普通的经验增长动画（视觉上「停住了」要成立）

### K5 · crimson 档「敬请期待」

`DungeonView.vue` 装备副本列表：

- crimson 档（claude 会在 `equipmentDungeonGear.ts` 加 `comingSoon: true`）
  显示为暗色卡 + 「区域 7 开放后解锁」，**不显示门槛数字**，不可点击
- 验收：其余三档交互不受影响

### K6 · 试炼分段显示适配

`RankView.vue`：周常试炼的 4 个等级分段（31/60/90/120），
在软上限 55 的版本里绯月以上不可达。

- 只显示玩家**当前可达**的分段页签；不可达分段整体隐藏（不是置灰——
  置灰会引发「怎么解锁」的疑问，而答案「等三个版本」只会让人失望）
- 验收：Lv55 满级号只看得到初樱/绯月两个分段

### K7 · 全部新文案过红线自检

上线前对照 [`40-玩法设计透镜.md`](40-玩法设计透镜.md) 第三节逐条检查：

- [ ] 没有「你被超越/你退步了」类表述
- [ ] 没有倒计时施压（体力倒计时是**信息**，措辞必须中性）
- [ ] 没有付费/广告恢复入口
- [ ] 所有「不能做 X」的地方都同时给出「怎样才能做 X」

---

## 三、建议顺序与联调点

| 顺序 | 任务 | 何时能真联调 |
|---|---|---|
| 1 | K3 战败弹层（纯新组件，零依赖） | claude 落地 defeatReport 后 |
| 2 | K1 锁定卡 | claude 落地 evaluateChapterGate 后（P0 首日） |
| 3 | K2 体力按钮 | 同上（evaluateChallengeCost 同批交付） |
| 4 | K4 经验条 | levelCapInfo 同批 |
| 5 | K5 / K6 | 随时可做（数据标记很小） |
| 6 | K7 自检 | 全部完成后 |

stub 示例（开发期临时放组件内，联调时删）：

```ts
const stubGate: ChapterGate = { ok: false, requiredCp: 4200, currentCp: 3000, gapCp: 1200, reason: 'cp' };
```

---

## 四、明确不属于 kimi 的

- 任何数值常量的取值（0.75 / 0.85 / 6 点体力 / +3 软上限）—— claude 定，改也走 claude
- `npm run sim` 门禁 —— claude 写
- 存档迁移 —— claude 写
- **不要**为了 UI 方便在组件里复算战力或门槛 —— 一律调 store 暴露面，
  否则口径又会裂成两把尺子（这次重构就是在修这个）
