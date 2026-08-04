/**
 * 区域 8「龙渊魔城」90+ 推荐战力双样本门禁（docs/84 门禁 A，2026-08-03 裁定）。
 *
 * 判据（数值线 2026-08-03/04 裁定）：
 *   样本 1「刚到 8-5 全传奇持有」：Lv88~89 玩家穿 r8 legendary 定义装备
 *   （当前 r8 未施工时回落 r7@78 定义）÷ 推荐线，须 ∈ [0.80, 1.80]；
 *   样本 2「Lv90+ 混合持有」：Lv90 起按 8-5 掉率进度取 1~2 件 mythic
 *   替代对应部位，÷ 推荐线须 ∈ [0.80, 1.80]；
 *   推荐线 = max(裸属性 × 0.85, expectedBuildCp(level) × 0.85)
 *   （docs/56 §3.2：RECOMMEND_BUILD_RATIO = 0.85）。
 *   Lv90 翻转点瞬态（刚够级仍全 legendary ≈0.74）不算失败——
 *   设计内 N6 台阶瞬态，由台阶登记说明（docs/84 门禁 B）。
 *
 * 用法：npm run check:r8:g3   （当前 r8 未施工时输出基线，应全绿）
 * r8 定义落地后重跑：若样本 2 跌破 0.80，按裁定把 mythic 首次可得移到
 * Lv90（8-5 中段）或 mythic 定义按 ~0.7× 曲线下调。
 */

import { baseStatsFor } from '../src/core/progression';
import { addStats, combatPower } from '../src/core/formula';
import {
  expectedBuildCp,
  expectedGearStats,
  expectedGearStatsFromDefinitions,
} from '../src/data/expectedPower';
import { CLASS_IDS, type ClassId } from '../src/core/types';

const RECOMMEND_BUILD_RATIO = 0.85;
const TYPICAL_ENHANCE_MUL = 1.6;
const TYPICAL_AFFIX_CP_MUL = 1.15;
const G3_MIN = 0.8;
const G3_MAX = 1.8;

/** 推荐线（与 src/data/stages.ts estimateRecommendCP 同口径）。 */
function recommendCp(level: number, classId: ClassId): number {
  const bare = combatPower(baseStatsFor(classId, level));
  const e = expectedBuildCp(level, classId);
  return Math.max(bare * RECOMMEND_BUILD_RATIO, e * RECOMMEND_BUILD_RATIO);
}

/** 典型强化+词条后的战力（expectedBuildCp 同款公式，装备可替换）。 */
function typicalCp(
  baseLevel: number,
  gear: { atk: number; def: number; hp: number; acc: number; eva: number; critRate: number; critDmg: number; spd: number },
  classId: ClassId,
): number {
  const enhanced = {
    atk: gear.atk * TYPICAL_ENHANCE_MUL,
    def: gear.def * TYPICAL_ENHANCE_MUL,
    hp: gear.hp * TYPICAL_ENHANCE_MUL,
    acc: gear.acc * TYPICAL_ENHANCE_MUL,
    eva: gear.eva * TYPICAL_ENHANCE_MUL,
    critRate: gear.critRate,
    critDmg: gear.critDmg,
    spd: gear.spd,
  };
  return combatPower(addStats(baseStatsFor(classId, baseLevel), enhanced)) * TYPICAL_AFFIX_CP_MUL;
}

/** 样本 1：全 legendary 持有（r8 定义落地前回落 r7@78 定义选装）。 */
function sampleFullLegendary(level: number, classId: ClassId): number {
  return typicalCp(level, expectedGearStatsFromDefinitions(level), classId);
}

/**
 * 样本 2：Lv90+ 混合持有——1~2 件 mythic 替代对应部位。
 * 近似：1.5 件 mythic（解析式曲线）× 其余 legendary（定义选装）。
 */
function sampleMixedMythic(level: number, classId: ClassId): number {
  const legendary = expectedGearStatsFromDefinitions(level);
  const mythic = expectedGearStats(level, 'mythic');
  const mixed = {
    atk: (legendary.atk * 6.5 + mythic.atk * 1.5) / 8,
    def: (legendary.def * 6.5 + mythic.def * 1.5) / 8,
    hp: (legendary.hp * 6.5 + mythic.hp * 1.5) / 8,
    acc: (legendary.acc * 6.5 + mythic.acc * 1.5) / 8,
    eva: (legendary.eva * 6.5 + mythic.eva * 1.5) / 8,
    critRate: legendary.critRate,
    critDmg: legendary.critDmg,
    spd: legendary.spd,
  };
  return typicalCp(level, mixed, classId);
}

let failures = 0;
for (const classId of CLASS_IDS) {
  // 单调性从 85 级起比（86 的前一级），避免首轮误报。
  let prev = expectedBuildCp(85, classId);
  for (let level = 86; level <= 92; level += 1) {
    const rec = recommendCp(level, classId);
    const s1 = sampleFullLegendary(level, classId);
    const r1 = s1 / rec;
    const s2 = sampleMixedMythic(level, classId);
    const r2 = s2 / rec;
    const e = expectedBuildCp(level, classId);
    const monotonic = e >= prev;
    prev = e;
    const line = (ok: boolean, label: string, value: number) =>
      `${ok ? '✔' : '✘'} ${label} Lv${level} ${classId}: 玩家/推荐=${value.toFixed(3)}（带 ${G3_MIN}~${G3_MAX}）`;
    if (level <= 89) {
      if (r1 < G3_MIN || r1 > G3_MAX) { failures += 1; console.log(line(false, '样本1 全传奇', r1)); }
    } else {
      // Lv90 翻转点瞬态：全传奇样本在 90 可略低于 0.80（N6 台阶瞬态），
      // 只验混合持有样本。
      if (r2 < G3_MIN || r2 > G3_MAX) { failures += 1; console.log(line(false, '样本2 混合持有', r2)); }
    }
    if (!monotonic) { failures += 1; console.log(`✘ expectedBuildCp 非单调 Lv${level - 1}→Lv${level} ${classId}`); }
  }
}

if (failures === 0) {
  console.log('✓ G3 双样本门禁通过：86~92 段推荐线单调、样本 1/样本 2 均在 [0.80, 1.80] 带内。');
} else {
  console.error(`✗ G3 双样本门禁失败：${failures} 项越界。`);
  console.error('处置（docs/84 裁定）：r8 mythic 定义落地后若样本 2 跌破 0.80，');
  console.error('把 mythic 首次可得移到 Lv90（8-5 中段）或 mythic 定义按 ~0.7× 曲线下调。');
  process.exit(1);
}
