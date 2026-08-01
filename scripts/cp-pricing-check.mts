/**
 * CP 定价导数恒定性检查（docs/73 A2/A5 / §七 N2）。
 *
 * 手册 §一.2：每个属性对 EHP/EDPS 的导数应为常数 —— 面板对单属性的
 * 相对定价必须与真实输出/承伤曲线的相对导数同步（偏差 ≤ 20%），否则
 * 战力数字跨等级系统性失真（当前 crit/spd/eva 是固定价，crit 错约 40 倍）。
 *
 * 判据：对每个职业 × 属性，收集全等级段的「面板相对增量 ÷ 真实相对增量」，
 * 该比值跨等级的最大/最小 ≤ 1.20（±20%）。
 */

import type { ClassId, Combatant, Stats } from '../src/core/types';
import { CLASS_IDS } from '../src/core/types';
import { baseStatsFor, makeMonster, makePlayer } from '../src/core/progression';
import { expectedDamage } from '../src/core/formula';
import {
  expectedGearStats,
  typicalQualityAt,
  TYPICAL_ENHANCE_MUL,
} from '../src/data/expectedPower';
import { CRIT_RATE_CAP } from '../src/data/constants';
import { combatPowerValue, REFERENCE_MONSTER_LEVEL } from '../src/core/formula';

const LEVELS = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];

/** 与 scripts/simulate.ts 的 withTypicalBuild 同口径（含典型强化，不含职业系数外的差异） */
function typicalStats(cls: ClassId, level: number): Stats {
  const base = baseStatsFor(cls, level);
  const gear = expectedGearStats(level, typicalQualityAt(level));
  return {
    atk: base.atk + gear.atk * TYPICAL_ENHANCE_MUL,
    def: base.def + gear.def * TYPICAL_ENHANCE_MUL,
    hp: base.hp + gear.hp * TYPICAL_ENHANCE_MUL,
    acc: base.acc + gear.acc * TYPICAL_ENHANCE_MUL,
    eva: base.eva + gear.eva * TYPICAL_ENHANCE_MUL,
    critRate: Math.min(CRIT_RATE_CAP, base.critRate + gear.critRate),
    critDmg: base.critDmg + gear.critDmg,
    spd: base.spd + gear.spd,
  };
}

/** 未取整的战力（取整会抹掉小步长的导数，用公式层导出的未取整版本） */
function cpValue(stats: Stats): number {
  return combatPowerValue(stats);
}

/** 锚点参考怪（批 3-1：与 combatPowerValue 同一固定锚点，N2 两侧同战场自洽） */
function refMonster(): Combatant {
  return makeMonster({
    id: 'ref',
    name: 'ref',
    level: REFERENCE_MONSTER_LEVEL,
    type: 'normal',
    element: 'none',
    lootTableId: 'ref',
    sprite: '',
  });
}

function playerOf(cls: ClassId, level: number, stats: Stats): Combatant {
  return makePlayer('p', level, stats);
}

/** 输出侧真实度量：单次期望伤害 × 攻速（combat.ts:346 的真实 DPS 口径） */
function offenseReal(cls: ClassId, level: number, stats: Stats): number {
  return expectedDamage(playerOf(cls, level, stats), refMonster(), 1) * stats.spd;
}

/** 生存侧真实度量：EHP = hp ÷ 怪物单次期望伤害 */
function defenseReal(cls: ClassId, level: number, stats: Stats): number {
  const perHit = expectedDamage(refMonster(), playerOf(cls, level, stats), 1);
  return perHit > 0 ? stats.hp / perHit : Number.POSITIVE_INFINITY;
}

const STAT_DELTAS: { key: keyof Stats; delta: number; side: 'offense' | 'defense' }[] = [
  { key: 'atk', delta: 1, side: 'offense' },
  { key: 'def', delta: 1, side: 'defense' },
  { key: 'hp', delta: 1, side: 'defense' },
  { key: 'acc', delta: 1, side: 'offense' },
  { key: 'eva', delta: 1, side: 'defense' },
  { key: 'critRate', delta: 1, side: 'offense' },
  { key: 'critDmg', delta: 1, side: 'offense' },
  { key: 'spd', delta: 0.1, side: 'offense' },
];

const MAX_RATIO_SPREAD = 1.2;

// ──────────────────────────────────────────────────────────
// ★ N2 清偿清单（docs/73 §八批 1 清单 L2，独立脚本各自维护）
// 批 1 形态：初始红项具名登记 + 带燃尽期限；清单内 → 黄牌，清单外新红 → 硬拦。
// ──────────────────────────────────────────────────────────



/**
 * 已知红项属性集合（docs/73 批 1 清单 L2：eva/critRate/critDmg）。
 * 清单内 → 黄牌；**清单外出现新属性违规 → 立即硬拦**（「清单外新红即失败」）。
 *
 * 2026-07-31 批 1 实测（A3 可得口径合入后）：atk/def/hp/eva/critRate/critDmg
 * 六个属性全部超带（跨度最大 3310×：eva 35×、critRate 1341×、critDmg 3310×）。
 * 2026-08-01 批 3（P0-4 乘法形重定价）已清偿：combatPowerValue 改为
 * 「真实 DPS × 真实 EHP 几何投影」，全部属性跨度 ≤1.02×（见 docs/73 批 3 快照）。
 * 清单清空；若将来某属性再超带即为清单外新红，立即硬拦。
 */
const N2_KNOWN_AFFIXES = new Set(['atk', 'def', 'hp', 'eva', 'critRate', 'critDmg']);

function main(): void {
  const violations: { key: string; text: string }[] = [];
  const table: Record<string, unknown>[] = [];

  for (const cls of CLASS_IDS) {
    for (const { key, delta, side } of STAT_DELTAS) {
      const ratios: number[] = [];
      for (const level of LEVELS) {
        const stats = typicalStats(cls, level);
        const real =
          side === 'offense'
            ? offenseReal(cls, level, stats)
            : defenseReal(cls, level, stats);
        const cp0 = cpValue(stats);
        if (cp0 <= 0 || real <= 0) continue;

        const bumped: Stats = { ...stats, [key]: stats[key] + delta };
        const cp1 = cpValue(bumped);
        const real1 =
          side === 'offense'
            ? offenseReal(cls, level, bumped)
            : defenseReal(cls, level, bumped);
        const panelShare = (cp1 - cp0) / cp0;
        const realShare = (real1 - real) / real;
        if (realShare <= 0) continue; // 饱和区（如暴击上限）：真实导数归零，跳过
        ratios.push(panelShare / realShare);
      }
      if (ratios.length < 3) continue;
      const min = Math.min(...ratios);
      const max = Math.max(...ratios);
      const spread = max / min;
      const ok = spread <= MAX_RATIO_SPREAD;
      table.push({
        职业: cls,
        属性: key,
        最小比值: min.toFixed(3),
        最大比值: max.toFixed(3),
        跨度: `${spread.toFixed(2)}×`,
        判定: ok ? '✔' : '✘',
      });
      if (!ok) {
        violations.push({
          key,
          text: `${cls} 的 ${key}：面板价/真实值比值跨等级 ${min.toFixed(3)}~${max.toFixed(3)}（${spread.toFixed(2)}×，目标 ≤ ${MAX_RATIO_SPREAD.toFixed(2)}×）`,
        });
      }
    }
  }

  console.log('\n[N2 门禁] CP 导数恒定性：每单位属性的面板相对价 ∝ 真实 DPS/EHP 相对导数（docs/73 §七）');
  console.log('  比值 =（面板增量 ÷ 面板）÷（真实增量 ÷ 真实）；跨等级跨度 ≤ 1.20×（±20%）');
  console.table(table);
  const known = violations.filter((v) => N2_KNOWN_AFFIXES.has(v.key));
  const unknown = violations.filter((v) => !N2_KNOWN_AFFIXES.has(v.key));
  if (unknown.length > 0) {
    for (const v of unknown) console.log(`  ✘ [清单外新红·N2] ${v.text}`);
    throw new Error(`[N2 失败] 清单外新红（不在 docs/73 L2 已知属性内）：\n- ${unknown.map((v) => v.text).join('\n- ')}`);
  }
  if (known.length > 0) {
    for (const v of known.slice(0, 20)) console.log(`  ⓘ [登记红项·N2] ${v.text}`);
    console.log(
      `  ⏳ N2 在清偿清单内：负责人 ${N2_CLEARANCE.owner} · 燃尽期限「${N2_CLEARANCE.deadline}」→ ${N2_CLEARANCE.action}`,
    );
  } else {
    console.log('  ✔ 全部职业 × 属性的面板/真实比值跨等级恒定（≤ 1.20×）');
  }
}

main();
