/**
 * 怪物永久图鉴账本（M4-8，与 src/core/equipmentCodex.ts 同构）。
 *
 * ── 为什么需要它 ──
 * 怪物图鉴的进度不能按「当前战斗目标 / 关卡波次」推导：玩家通关后不会保留
 * 每一只怪物的击杀记录，若按可回刷内容推导，图鉴进度会随玩家刷回旧关而
 * 反复横跳，违反 docs/40 红线「不允许进度条倒退」。与装备账本同构，用一份
 * 只增不删的集合记录「曾经遇到过哪些怪物定义」。
 *
 * ── 这个模块只做一件事 ──
 * 维护「曾经发现过哪些怪物定义」的只增集合。它不判断稀有度、不算百分比、
 * 不碰展示——那些都是上层的事。与 core 其余模块同规：不讲时间、不接 RNG、
 * 不碰 Vue / Pinia / storage。
 */

/** 存档里的账本形态（v25 起）。 */
export interface MonsterCodexLedger {
  /** 曾经发现过的怪物定义 id，按首次发现顺序追加，永不删除。 */
  discoveredMonsterIds: string[];
}

export function createMonsterCodexLedger(): MonsterCodexLedger {
  return { discoveredMonsterIds: [] };
}

/**
 * 记录一批「刚刚发现」的怪物定义，返回新账本与本次真正新增的部分。
 *
 * 返回 newlyDiscovered 是为了让上层能做「首次发现」的表现（图鉴新增提示），
 * 与 equipmentCodex / affection 里 discoveredGearIds 的用法保持一致。
 *
 * **只增不删**：任何清理、重置、关卡回退都不调用本模块。
 * 这一条是整个账本存在的意义，不要为了「与当前内容一致」把它改成同步。
 */
export function recordDiscoveredMonsters(
  ledger: MonsterCodexLedger,
  monsterIds: readonly string[],
): { ledger: MonsterCodexLedger; newlyDiscovered: string[] } {
  const known = new Set(ledger.discoveredMonsterIds);
  const newlyDiscovered: string[] = [];
  for (const monsterId of monsterIds) {
    if (!monsterId || known.has(monsterId)) continue;
    known.add(monsterId);
    newlyDiscovered.push(monsterId);
  }
  if (newlyDiscovered.length === 0) return { ledger, newlyDiscovered };
  return {
    ledger: {
      discoveredMonsterIds: [...ledger.discoveredMonsterIds, ...newlyDiscovered],
    },
    newlyDiscovered,
  };
}

/** 是否曾经发现过。 */
export function hasDiscoveredMonster(ledger: MonsterCodexLedger, monsterId: string): boolean {
  return ledger.discoveredMonsterIds.includes(monsterId);
}

/**
 * 老档回填：把「当前已通关内容里必然出现过的怪物」补进账本。
 *
 * 只在存档迁移时调用一次。理由与 docs/62 §4.1「老档不补记」看似相反，
 * 实为同一条原则的两面：那条说的是无法证明的历史（谁更早通关）不能凭空
 * 捏造；而「你已通关的章节里存在这些怪物」是当下可验证的事实（章节 spec
 * 决定怪物阵容），补进账本不是捏造。已经分解 / 不再可查的历史无法找回——
 * 账本从迁移那天起才完整。
 */
export function backfillDiscoveredMonsters(
  ledger: MonsterCodexLedger,
  seenMonsterIds: readonly string[],
): MonsterCodexLedger {
  return recordDiscoveredMonsters(ledger, seenMonsterIds).ledger;
}
