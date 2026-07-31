/**
 * 装备永久图鉴账本（docs/63 §4.2 的前置，鉴藏榜的地基）。
 *
 * ── 为什么需要它 ──
 * 套装图鉴（SetCodexView）现在按「背包 + 穿戴」推导拥有关系，于是
 * **玩家分解一件装备，图鉴进度就当场变小、部位重新变灰**。
 * 那是 docs/40 红线「不许进度条倒退」；而且 BAG_CAPACITY 是 300 且会强制
 * 裁剪，「把 58 件全留着」在设计上根本做不到 —— 这个口径无法达成。
 * 鉴藏榜也因为同一条理由被撤下（docs/63 §四，@claude 06:23 实测）。
 *
 * 口径照抄好感线现成的 discoveredGearIds，那份注释写得很清楚：
 * **永久图鉴记录；分解装备不会抹掉曾经获得过的事实。**
 *
 * ── 这个模块只做一件事 ──
 * 维护「曾经获得过哪些装备定义」的只增集合。它不判断稀有度、不算百分比、
 * 不碰展示 —— 那些都是上层的事。与 core 其余模块同规：
 * 不读时间、不掷骰、不碰 Vue / Pinia / storage。
 */

/** 存档里的账本形状（v17 起）。 */
export interface EquipmentCodexLedger {
  /** 曾经获得过的装备定义 id，按首次获得顺序追加，永不删除。 */
  discoveredDefIds: string[];
}

export function createEquipmentCodexLedger(): EquipmentCodexLedger {
  return { discoveredDefIds: [] };
}

/**
 * 记录一批「刚刚获得」的装备定义，返回新账本与本次真正新增的部分。
 *
 * 返回 newlyDiscovered 是为了让上层能做「首次获得」的表现（图鉴新增提示），
 * 与 core/affection.ts 里 discoveredGearIds 的用法保持一致。
 *
 * **只增不删**：分解、出售、被背包上限裁掉，都不调用本模块。
 * 这一条是整个账本存在的意义，不要为了「保持与背包一致」把它改成同步。
 */
export function recordDiscoveredEquipment(
  ledger: EquipmentCodexLedger,
  defIds: readonly string[],
): { ledger: EquipmentCodexLedger; newlyDiscovered: string[] } {
  const known = new Set(ledger.discoveredDefIds);
  const newlyDiscovered: string[] = [];
  for (const defId of defIds) {
    if (!defId || known.has(defId)) continue;
    known.add(defId);
    newlyDiscovered.push(defId);
  }
  if (newlyDiscovered.length === 0) return { ledger, newlyDiscovered };
  return {
    ledger: { discoveredDefIds: [...ledger.discoveredDefIds, ...newlyDiscovered] },
    newlyDiscovered,
  };
}

/** 是否曾经获得过。 */
export function hasDiscoveredEquipment(ledger: EquipmentCodexLedger, defId: string): boolean {
  return ledger.discoveredDefIds.includes(defId);
}

/**
 * 老档回填：把当前持有的装备补进账本。
 *
 * 只在存档迁移时调用一次。理由与 docs/62 §4.1「老档不补记」看似相反，
 * 其实是同一条原则的两面：那条说的是**无法证明的历史**（谁更早通关）
 * 不能凭空捏造；而「你现在背包里有这件装备」是**当下可验证的事实**，
 * 把它记进账本不是捏造。
 * 已经分解掉的那些确实找不回来了 —— 账本从迁移那天开始才完整。
 */
export function backfillDiscoveredEquipment(
  ledger: EquipmentCodexLedger,
  ownedDefIds: readonly string[],
): EquipmentCodexLedger {
  return recordDiscoveredEquipment(ledger, ownedDefIds).ledger;
}

/**
 * 图鉴展示用的拥有集合：**曾经获得过的** ∪ **此刻持有的**。
 *
 * 为什么还要并上「此刻持有」：迁移之前入包的装备可能没进账本
 * （比如玩家在旧版本里拿到、还没触发过任何写入点），并集能让展示
 * 在任何中间状态下都不倒退。账本落地之后这一项会自然变成冗余。
 */
export function codexOwnedDefIds(
  ledger: EquipmentCodexLedger,
  currentlyOwnedDefIds: readonly string[],
): ReadonlySet<string> {
  return new Set([...ledger.discoveredDefIds, ...currentlyOwnedDefIds]);
}
