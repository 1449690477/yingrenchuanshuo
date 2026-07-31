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
import { CRIT_RATE_CAP, CP_WEIGHTS } from '../src/data/constants';

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

/** 未取整的战力（combatPower 的取整会抹掉小步长的导数，这里用原始加权和） */
function cpValue(stats: Stats): number {
  const base =
    stats.atk * CP_WEIGHTS.atk +
    stats.def * CP_WEIGHTS.def +
    stats.hp * CP_WEIGHTS.hp +
    stats.acc * CP_WEIGHTS.acc +
    stats.eva * CP_WEIGHTS.eva +
    (stats.critRate / 100) * CP_WEIGHTS.critRate +
    (stats.critDmg / 100) * CP_WEIGHTS.critDmg;
  return base * stats.spd;
}

function refMonster(level: number): Combatant {
  return makeMonster({
    id: 'ref',
    name: 'ref',
    level,
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
  return expectedDamage(playerOf(cls, level, stats), refMonster(level), 1) * stats.spd;
}

/** 生存侧真实度量：EHP = hp ÷ 怪物单次期望伤害 */
function defenseReal(cls: ClassId, level: number, stats: Stats): number {
  const perHit = expectedDamage(refMonster(level), playerOf(cls, level, stats), 1);
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

function main(): void {
  const violations: string[] = [];
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
        violations.push(
          `${cls} 的 ${key}：面板价/真实值比值跨等级 ${min.toFixed(3)}~${max.toFixed(3)}（${spread.toFixed(2)}×，目标 ≤ ${MAX_RATIO_SPREAD.toFixed(2)}×）`,
        );
      }
    }
  }

  console.log('\n[N2 门禁] CP 导数恒定性：每单位属性的面板相对价 ∝ 真实 DPS/EHP 相对导数（docs/73 §七）');
  console.log('  比值 =（面板增量 ÷ 面板）÷（真实增量 ÷ 真实）；跨等级跨度 ≤ 1.20×（±20%）');
  console.table(table);
  if (violations.length > 0) {
    throw new Error(`[N2 失败] CP 定价与真实价值脱钩：\n- ${violations.slice(0, 20).join('\n- ')}`);
  }
  console.log('  ✔ 全部职业 × 属性的面板/真实比值跨等级恒定（≤ 1.20×）');
}

main();
