/**
 * 数值模拟器 —— 放置游戏最重要的开发工具。
 *
 * 用法：npm run sim
 *
 * 输出六份东西：
 *   1. 校验点表     —— 用来核对 docs/10-数值与战斗.md 里的关键数字
 *   2. 30 天成长曲线 —— 玩家每天能到几级，有没有断档
 *   3. 四职业对比    —— 挂机效率是否在 ±20% 平衡带内
 *   4. 装备随机健康检查 —— 独立验证胚子与逐级强化随机，不混入理想满配曲线
 *   5. 词条洗练验收 —— 对照旧版、新掉落与全 T5，并复验四职业 TTK
 *   6. 竞技场 PvP 胜率验收 —— 同战力镜像胜率 45%~55%（docs/52 §11）
 *
 * 之所以能有这个工具，是因为 core 层是纯函数（AGENTS.md 铁律 1）。
 * 任何人改了公式，跑一次这个脚本就知道有没有把曲线搞坏。
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CLASS_IDS,
  type Affix,
  type AffixKey,
  type ClassId,
  type CombatBonuses,
  type Combatant,
  type Element,
  type EquipSlot,
  type EquipmentDef,
  type FixedAffix,
  type Quality,
  type Stats,
} from '../src/core/types';
import { addStats, combatPower, zeroStats } from '../src/core/formula';
import {
  affixValueRange,
  applyAffix,
  applyCombatAffix,
  enhanceMultiplier,
  rollBasePermille,
  rollAffixes,
  rollAffixValue,
  rollEnhanceGainPermille,
  zeroCombatBonuses,
} from '../src/core/equipment';
import {
  applyClassMods,
  averageSkillMultiplier,
  baseStatsFor,
  expToNext,
  makeMonster,
  makePlayer,
  monsterExp,
  monsterGold,
  monsterHp,
} from '../src/core/progression';
import {
  ITEM_BASE,
  ITEM_POW,
  ITEM_SCALE,
  AFFIX_POOL,
  availableAffixElementsAtLevel,
  QUALITY_MUL,
  QUALITY_PCT_SCALE,
  QUALITY_AFFIX_COUNT,
  QUALITY_PROFESSION_AFFIX_COUNT,
  PROFESSION_AFFIX_POOLS,
  SLOT_PCT_WEIGHTS,
  SLOT_WEIGHTS,
  CRIT_RATE_CAP,
  ENHANCE_MAX,
  ENHANCE_PER_LEVEL,
  ENHANCE_TOTAL_GAIN_CAP_PERMILLE,
} from '../src/data/constants';
import { EQUIPMENT } from '../src/data/equipment';
import { idleCombatEfficiency, killsPerSecond } from '../src/core/idle';
import { ALL_CHAPTERS } from '../src/data/regions';
import { LEVEL_SOFT_CAP_MARGIN } from '../src/data/constants';
import { timeToKill } from '../src/core/combat';
import { estimateDuelWinChance, type DuelSide } from '../src/core/duel';
import type { IdleContext } from '../src/core/idle';
import { Rng } from '../src/core/rng';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, 'out');

// ──────────────────────────────────────────────────────────
// 装备强度模型
//
// 按 docs/12-装备体系.md 的真实公式计算 8 个槽位的属性总和：
//   槽位属性 = ITEM_BASE × L^ITEM_POW × 品质系数 × 部位权重 × ITEM_SCALE
//
// 之所以必须用真实公式而不是「乘个平均倍率」：装备属性是随等级
// 按 L^1.35 增长的，用固定倍率会严重低估中后期玩家强度，
// 从而把怪物曲线调错。这是 ADR-005 的由来。
// ──────────────────────────────────────────────────────────

/** 玩家在某等级的典型装备品质。随进度推进而提升。 */
function typicalQuality(level: number): Quality {
  if (level < 15) return 'common';
  if (level < 25) return 'fine';
  if (level < 40) return 'rare';
  if (level < 65) return 'epic';
  if (level < 90) return 'legendary';
  if (level < 110) return 'mythic';
  return 'divine';
}

/** 全身 8 件装备提供的属性总和 */
function gearStats(level: number, quality: Quality): Stats {
  const baseValue = ITEM_BASE * Math.pow(level, ITEM_POW) * QUALITY_MUL[quality] * ITEM_SCALE;
  const pctScale = QUALITY_PCT_SCALE[quality];
  const out = zeroStats();

  for (const slot of Object.keys(SLOT_WEIGHTS) as EquipSlot[]) {
    // 数值型：乘装备基准值，随等级增长
    for (const [key, w] of Object.entries(SLOT_WEIGHTS[slot]) as [keyof Stats, number][]) {
      out[key] += baseValue * w;
    }
    // 百分比型：只随品质增长
    for (const [key, w] of Object.entries(SLOT_PCT_WEIGHTS[slot]) as [keyof Stats, number][]) {
      out[key] += pctScale * w;
    }
  }
  return out;
}

function withGear(cls: ClassId, level: number): Stats {
  const base = baseStatsFor(cls, level);
  const gear = gearStats(level, typicalQuality(level));

  const combined: Stats = {
    atk: base.atk + gear.atk,
    def: base.def + gear.def,
    hp: base.hp + gear.hp,
    acc: base.acc + gear.acc,
    eva: base.eva + gear.eva,
    critRate: Math.min(CRIT_RATE_CAP, base.critRate + gear.critRate),
    critDmg: base.critDmg + gear.critDmg,
    spd: base.spd + gear.spd,
  };

  // 职业系数必须在装备累加之后应用，见 progression.applyClassMods 的注释
  return applyClassMods(cls, combined);
}

function buildContext(cls: ClassId, level: number, stageLevel: number): IdleContext {
  const stats = withGear(cls, level);
  const player: Combatant = makePlayer('sim', level, stats);
  const monster = makeMonster({
    id: 'sim_mon',
    name: 'sim',
    level: stageLevel,
    type: 'normal',
    element: 'none',
    lootTableId: 'sim',
    sprite: '',
  });
  return {
    classId: cls,
    player,
    monster,
    expPerKill: monsterExp(stageLevel),
    goldPerKill: monsterGold(stageLevel),
    lootTable: { id: 'sim', rolls: 1, entries: [] },
    skillMultiplier: averageSkillMultiplier(level),
  };
}

// ──────────────────────────────────────────────────────────
// 1. 校验点表
// ──────────────────────────────────────────────────────────

function checkpointTable() {
  const levels = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
  const rows = levels.map((L) => {
    const bare = baseStatsFor('swordsman', L);
    const geared = withGear('swordsman', L);
    return {
      等级: L,
      升级所需经验: expToNext(L),
      小怪血量: monsterHp(L),
      裸战力: combatPower(bare),
      满配战力: combatPower(geared),
    };
  });

  console.log('\n【校验点表】用于核对 docs/10-数值与战斗.md 2.3 节\n');
  console.table(rows);

  // 增速检查：玩家战力增速必须略慢于怪物血量增速（卡点的来源）
  console.log('\n【增速对比】每 10 级的倍率 —— 怪物应略快于玩家\n');
  const growth: Record<string, unknown>[] = [];
  for (let L = 10; L <= 110; L += 10) {
    const cpNow = combatPower(withGear('swordsman', L));
    const cpNext = combatPower(withGear('swordsman', L + 10));
    const hpNow = monsterHp(L);
    const hpNext = monsterHp(L + 10);
    growth.push({
      区间: `Lv${L}→${L + 10}`,
      玩家战力倍率: (cpNext / cpNow).toFixed(3),
      怪物血量倍率: (hpNext / hpNow).toFixed(3),
      差值: (hpNext / hpNow - cpNext / cpNow).toFixed(3),
    });
  }
  console.table(growth);

  return rows;
}

// ──────────────────────────────────────────────────────────
// 2. 30 天成长曲线
// ──────────────────────────────────────────────────────────

interface DayRecord {
  天: number;
  等级: number;
  战力: number;
  当日经验: number;
  挂机关卡: number;
  每秒击杀: string;
}

/** 玩家每天实际挂机的有效秒数：8 小时离线上限 + 白天零散在线，按 14 小时估算 */
const EFFECTIVE_SECONDS_PER_DAY = 14 * 3600;

/** 全部已开放内容里最高的关卡等级 —— 玩家能挂的图到此为止。 */
const MAX_CONTENT_LEVEL = Math.max(...ALL_CHAPTERS.map((c) => c.levelTo));

/** 内容边界下的等级软上限（docs/56 §2）。 */
const CONTENT_SOFT_CAP = MAX_CONTENT_LEVEL + LEVEL_SOFT_CAP_MARGIN;

function simulateDays(cls: ClassId, days: number, levelCap = CONTENT_SOFT_CAP): DayRecord[] {
  let level = 1;
  let exp = 0;
  const records: DayRecord[] = [];

  for (let day = 1; day <= days; day++) {
    let dayExp = 0;
    let remaining = EFFECTIVE_SECONDS_PER_DAY;
    let lastKps = 0;
    let stageLevel = level;

    // 按小时推进，这样升级后能及时换到更高的图
    while (remaining > 0) {
      const chunk = Math.min(3600, remaining);
      remaining -= chunk;

      // 玩家挂在自己等级能打的最高图，但**图到内容顶为止** ——
      // 旧模型让怪物等级跟着玩家涨到 120，而真实内容只到 MAX_CONTENT_LEVEL，
      // 于是模拟器测不出「等级反超内容」的脱锚（docs/56 病根一）。
      stageLevel = Math.max(1, Math.min(level, MAX_CONTENT_LEVEL));
      const ctx = buildContext(cls, level, stageLevel);
      const kps = killsPerSecond(ctx);
      lastKps = kps;

      const gained = Math.floor(kps * chunk * ctx.expPerKill);
      dayExp += gained;
      exp += gained;

      // 结算升级：软上限 = 可达内容顶 + 余量；超限经验囤在 exp 里（与 store 同规则）
      while (level < levelCap && exp >= expToNext(level)) {
        exp -= expToNext(level);
        level++;
      }
    }

    records.push({
      天: day,
      等级: level,
      战力: combatPower(withGear(cls, level)),
      当日经验: dayExp,
      挂机关卡: stageLevel,
      每秒击杀: lastKps.toFixed(2),
    });
  }

  return records;
}

// ──────────────────────────────────────────────────────────
// 3. 四职业挂机效率对比
// ──────────────────────────────────────────────────────────

function classBalance() {
  // 与词条验收档位保持一致并覆盖 Lv120；基础职业层也不能只在中期打印好看。
  const levels = [10, 20, 30, 50, 70, 90, 100, 110, 120];
  let maxDeviation = 0;
  const rows = levels.map((L) => {
    const kps = Object.fromEntries(
      CLASS_IDS.map((classId) => [classId, killsPerSecond(buildContext(classId, L, L))]),
    ) as Record<ClassId, number>;
    const avg = CLASS_IDS.reduce((sum, classId) => sum + kps[classId], 0) / CLASS_IDS.length;
    maxDeviation = Math.max(
      maxDeviation,
      ...CLASS_IDS.map((classId) => Math.abs(kps[classId] - avg) / avg),
    );
    const dev = (v: number) => `${(((v - avg) / avg) * 100).toFixed(1)}%`;
    return {
      等级: L,
      剑姬: kps.swordsman.toFixed(3),
      魔女: kps.witch.toFixed(3),
      灵巫: kps.shaman.toFixed(3),
      喵喵: kps.catkin.toFixed(3),
      剑姬偏离: dev(kps.swordsman),
      魔女偏离: dev(kps.witch),
      灵巫偏离: dev(kps.shaman),
      喵喵偏离: dev(kps.catkin),
    };
  });

  console.log('\n【四职业挂机效率】偏离超过 ±20% 需要调整（docs/13 第四节）\n');
  console.table(rows);
  return { rows, maxDeviation };
}

// ──────────────────────────────────────────────────────────
// 4. 装备随机健康检查
//
// 这一段只采样独立的掉落胚子与 +1～+15 单级增幅，不把随机强化
// 乘进上面的 30 天「理想满配」模型。两者混用会让随机方差掩盖
// 玩家/怪物成长指数本身的问题。
// ──────────────────────────────────────────────────────────

const EQUIPMENT_RANDOM_SAMPLE_SIZE = 10_000;
const EQUIPMENT_RANDOM_SEED = 0x5341_4b55;
const MAX_BASE_MIRACLE_RATE = 0.03;
const MAX_ENHANCE_MIRACLE_RATE = 0.02;

type GradeCounts = Record<string, number>;

function incrementGrade(counts: GradeCounts, grade: string): void {
  counts[grade] = (counts[grade] ?? 0) + 1;
}

function nearestRank(sorted: readonly number[], percentile: number): number {
  if (sorted.length === 0) throw new Error('nearestRank: 样本不能为空');
  if (!Number.isFinite(percentile) || percentile < 0 || percentile > 1) {
    throw new Error(`nearestRank: 分位数必须在 0~1，收到 ${percentile}`);
  }
  const index = Math.max(0, Math.ceil(percentile * sorted.length) - 1);
  return sorted[index]!;
}

function gradeRows(counts: GradeCounts, total: number) {
  return Object.entries(counts).map(([grade, count]) => ({
    档位: grade,
    数量: count,
    占比: `${((count / total) * 100).toFixed(2)}%`,
  }));
}

function equipmentRandomHealth() {
  const rng = new Rng(EQUIPMENT_RANDOM_SEED);
  const baseCounts: GradeCounts = {};
  const enhanceCounts: GradeCounts = {};
  const multipliers: number[] = [];

  for (let item = 0; item < EQUIPMENT_RANDOM_SAMPLE_SIZE; item++) {
    const baseRoll = rollBasePermille(rng);
    incrementGrade(baseCounts, baseRoll.grade);

    const gains = Array.from({ length: ENHANCE_MAX }, () => {
      const gain = rollEnhanceGainPermille(rng);
      incrementGrade(enhanceCounts, gain.grade);
      return gain.permille;
    });
    multipliers.push(enhanceMultiplier(ENHANCE_MAX, gains));
  }

  multipliers.sort((a, b) => a - b);
  const average = multipliers.reduce((sum, value) => sum + value, 0) / multipliers.length;
  const summary = {
    min: multipliers[0]!,
    avg: average,
    p50: nearestRank(multipliers, 0.5),
    p95: nearestRank(multipliers, 0.95),
    p99: nearestRank(multipliers, 0.99),
    max: multipliers[multipliers.length - 1]!,
  };

  console.log(
    `\n【装备随机健康检查】固定种子 0x${EQUIPMENT_RANDOM_SEED.toString(16)}，${EQUIPMENT_RANDOM_SAMPLE_SIZE.toLocaleString()} 件装备\n`,
  );
  console.log('胚子档位占比：');
  console.table(gradeRows(baseCounts, EQUIPMENT_RANDOM_SAMPLE_SIZE));
  console.log(
    `单级强化档位占比（共 ${(EQUIPMENT_RANDOM_SAMPLE_SIZE * ENHANCE_MAX).toLocaleString()} 次）：`,
  );
  console.table(gradeRows(enhanceCounts, EQUIPMENT_RANDOM_SAMPLE_SIZE * ENHANCE_MAX));
  console.log('+15 强化倍率分布（不含胚子倍率）：');
  console.table([
    Object.fromEntries(
      Object.entries(summary).map(([key, value]) => [key, `×${value.toFixed(4)}`]),
    ),
  ]);

  const legacyMultiplier = 1 + ENHANCE_PER_LEVEL * ENHANCE_MAX;
  const multiplierCap = 1 + ENHANCE_TOTAL_GAIN_CAP_PERMILLE / 1000;
  const baseMiracleCount = baseCounts.miracle ?? 0;
  const enhanceMiracleCount = enhanceCounts.miracle ?? 0;
  const baseMiracleRate = baseMiracleCount / EQUIPMENT_RANDOM_SAMPLE_SIZE;
  const enhanceMiracleRate = enhanceMiracleCount / (EQUIPMENT_RANDOM_SAMPLE_SIZE * ENHANCE_MAX);
  const epsilon = 1e-12;

  if (summary.min + epsilon < legacyMultiplier) {
    throw new Error(
      `[装备随机失衡] +15 最低倍率 ×${summary.min.toFixed(4)} 低于旧版 ×${legacyMultiplier.toFixed(2)}`,
    );
  }
  if (summary.max - epsilon > multiplierCap) {
    throw new Error(
      `[装备随机失衡] +15 最高倍率 ×${summary.max.toFixed(4)} 超过硬上限 ×${multiplierCap.toFixed(2)}`,
    );
  }
  if (baseMiracleCount === 0 || baseMiracleRate > MAX_BASE_MIRACLE_RATE) {
    throw new Error(
      `[装备随机失衡] 奇迹胚子数量 ${baseMiracleCount}，占比 ${(baseMiracleRate * 100).toFixed(2)}%`,
    );
  }
  if (enhanceMiracleCount === 0 || enhanceMiracleRate > MAX_ENHANCE_MIRACLE_RATE) {
    throw new Error(
      `[装备随机失衡] 奇迹单级增幅数量 ${enhanceMiracleCount}，占比 ${(enhanceMiracleRate * 100).toFixed(2)}%`,
    );
  }

  console.log(
    `✔ 最低倍率不低于旧版 ×${legacyMultiplier.toFixed(2)}，最高不超过 ×${multiplierCap.toFixed(2)}`,
  );
  console.log(
    `✔ 奇迹胚子 ${(baseMiracleRate * 100).toFixed(2)}%，奇迹单级增幅 ${(enhanceMiracleRate * 100).toFixed(2)}%，均非零且未过量\n`,
  );

  return { baseCounts, enhanceCounts, summary };
}

// ──────────────────────────────────────────────────────────
// 5. 词条与洗练数值验收
//
// 旧版基线必须在模拟器中显式保留：它使用旧槽数、纯通用池以及 min~max
// 连续取值。若直接拿新版函数模拟“旧装备”，改动槽数或品阶公式后基线也会
// 跟着漂移，得到的增长率就失去意义。
// ──────────────────────────────────────────────────────────

const REFORGE_SAMPLE_SIZE = 2_000;
const REFORGE_SAMPLE_SEED = 0x43af_f1a5;
const REFORGE_ACCEPTANCE_CASES = [
  { level: 10, quality: 'common' },
  { level: 20, quality: 'fine' },
  { level: 30, quality: 'rare' },
  { level: 50, quality: 'epic' },
  { level: 70, quality: 'legendary' },
  { level: 90, quality: 'mythic' },
  // 心虹珍藏不在 typicalQuality 的自然阶梯内，仍必须单列验证其 6 词条边界。
  { level: 100, quality: 'prismatic' },
  { level: 110, quality: 'divine' },
  // 满级再验一次，防止 L^1.3 词条在区间末端才把职业差异放大出界。
  { level: 120, quality: 'divine' },
] as const satisfies readonly { level: number; quality: Quality }[];
const LEGACY_QUALITY_AFFIX_COUNT: Readonly<Record<Quality, number>> = {
  common: 0,
  fine: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
  prismatic: 6,
  divine: 6,
};
interface LegacyAffixConfig {
  key: AffixKey;
  min: number;
  max: number;
  weight: number;
  scalesWithLevel: boolean;
  decimals: number;
}
const LEGACY_AFFIX_POOL: readonly LegacyAffixConfig[] = [
  { key: 'atk', min: 0.4, max: 0.8, weight: 20, scalesWithLevel: true, decimals: 0 },
  { key: 'def', min: 0.3, max: 0.6, weight: 20, scalesWithLevel: true, decimals: 0 },
  { key: 'hp', min: 4, max: 8, weight: 20, scalesWithLevel: true, decimals: 0 },
  { key: 'critRate', min: 0.5, max: 3, weight: 10, scalesWithLevel: false, decimals: 1 },
  { key: 'critDmg', min: 2, max: 12, weight: 10, scalesWithLevel: false, decimals: 1 },
  { key: 'acc', min: 0.5, max: 1.2, weight: 8, scalesWithLevel: true, decimals: 0 },
  { key: 'eva', min: 0.4, max: 1, weight: 8, scalesWithLevel: true, decimals: 0 },
  { key: 'spd', min: 0.01, max: 0.05, weight: 4, scalesWithLevel: false, decimals: 2 },
  {
    key: 'dmgReduce',
    min: 0.5,
    max: 2.5,
    weight: 3,
    scalesWithLevel: false,
    decimals: 1,
  },
  { key: 'elemDmg', min: 3, max: 10, weight: 3, scalesWithLevel: false, decimals: 1 },
  {
    key: 'lifesteal',
    min: 0.5,
    max: 2,
    weight: 2,
    scalesWithLevel: false,
    decimals: 1,
  },
  { key: 'skillMul', min: 1, max: 4, weight: 2, scalesWithLevel: false, decimals: 1 },
];
const MAX_FRESH_CP_CHANGE = 0.08;
const MIN_FRESH_CP_CHANGE = -0.08;
const MIN_ALL_T5_CP_GAIN = 0.12;
const MAX_ALL_T5_CP_GAIN = 0.25;
const MAX_CLASS_DEVIATION = 0.2;
const REPRESENTATIVE_TTK_LEVEL = 50;
const MIN_REPRESENTATIVE_TTK = 3.5;
const MAX_REPRESENTATIVE_TTK = 6.5;
const MIN_NORMAL_COMBAT_EFFICIENCY = 0.75;
const MAX_NORMAL_COMBAT_EFFICIENCY = 1;

interface AffixProfile {
  stats: Stats;
  bonuses: CombatBonuses;
}

interface ReforgeAcceptanceRow {
  等级: number;
  品质: Quality;
  职业: ClassId;
  旧版战力: string;
  新掉落战力: string;
  新掉落变化: string;
  全T5战力: string;
  全T5提升: string;
  新掉落TTK: string;
  新掉落η: string;
  新掉落KPS: string;
  全T5TTK: string;
  全T5η: string;
  全T5KPS: string;
}

interface ReforgeClassMetrics {
  level: number;
  quality: Quality;
  classId: ClassId;
  legacyCp: number;
  freshCp: number;
  t5Cp: number;
  freshTtk: number;
  freshEfficiency: number;
  freshKps: number;
  t5Ttk: number;
  t5Efficiency: number;
  t5Kps: number;
}

function syntheticEquipment(level: number, quality: Quality, slot: EquipSlot): EquipmentDef {
  const common = {
    id: `sim_${quality}_${level}_${slot}`,
    name: '模拟装备',
    quality,
    level,
    icon: '',
    appearanceId: 'sim',
  };
  return slot === 'weapon'
    ? { ...common, slot, element: sourcedWeaponElementAtLevel(level) }
    : { ...common, slot };
}

/**
 * 模拟器只能使用玩家在该等级已经能持有的真实武器元素。
 *
 * 优先取不高于当前等级的最高等级定义；同级按 id 升序，保证不同平台结果一致。
 * 没有来源时返回 none，绝不从词条或怪物属性反推。
 */
function sourcedWeaponElementAtLevel(level: number): Element {
  const source = Object.values(EQUIPMENT)
    .filter(
      (definition) =>
        definition.slot === 'weapon' && definition.element !== 'none' && definition.level <= level,
    )
    .sort((a, b) => b.level - a.level || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
  return source?.element ?? 'none';
}

/** 元素词条解锁必须有同级或更早的真实武器定义支撑。 */
function assertElementSourcesAtLevel(level: number): void {
  const weapons = Object.values(EQUIPMENT).filter(
    (definition) => definition.slot === 'weapon' && definition.level <= level,
  );
  for (const element of availableAffixElementsAtLevel(level)) {
    if (!weapons.some((definition) => definition.element === element)) {
      throw new Error(
        `[模拟配置错误] Lv${level} 已允许生成 ${element} 元素词条，但没有 level<=${level} 的真实武器来源`,
      );
    }
  }
}

function rollLegacyAffixes(def: EquipmentDef, rng: Rng): FixedAffix[] {
  const pool = [...LEGACY_AFFIX_POOL];
  const count = LEGACY_QUALITY_AFFIX_COUNT[def.quality];
  const out: FixedAffix[] = [];

  for (let index = 0; index < count; index++) {
    const picked = rng.weighted(pool, (entry) => entry.weight);
    pool.splice(pool.indexOf(picked), 1);
    const scale = picked.scalesWithLevel ? Math.pow(def.level, 1.3) : 1;
    const precision = 10 ** picked.decimals;
    out.push({
      key: picked.key,
      value: Math.round(rng.float(picked.min * scale, picked.max * scale) * precision) / precision,
    });
  }
  return out;
}

function t5VersionOf(affix: Affix, level: number, rng: Rng): Affix {
  const configured =
    AFFIX_POOL.find((entry) => entry.key === affix.key) ??
    Object.values(PROFESSION_AFFIX_POOLS)
      .flat()
      .find((entry) => entry.key === affix.key);
  if (!configured) throw new Error(`[模拟配置错误] 找不到 T5 词条基准：${affix.key}`);
  return {
    ...affix,
    tier: 5,
    value: rollAffixValue(configured, level, 5, rng),
  };
}

function addAffixesToProfile(
  profile: AffixProfile,
  affixes: readonly FixedAffix[],
  includeCombatBonuses = true,
): AffixProfile {
  let stats = profile.stats;
  let bonuses = profile.bonuses;
  for (const affix of affixes) {
    stats = applyAffix(stats, affix);
    if (includeCombatBonuses) bonuses = applyCombatAffix(bonuses, affix);
  }
  return { stats, bonuses };
}

function statsWithProfile(cls: ClassId, level: number, profile: AffixProfile): Stats {
  const baseAndGear = addStats(baseStatsFor(cls, level), gearStats(level, typicalQuality(level)));
  return applyClassMods(cls, addStats(baseAndGear, profile.stats));
}

function playerWithProfile(cls: ClassId, level: number, profile: AffixProfile): Combatant {
  return makePlayer(
    'sim',
    level,
    statsWithProfile(cls, level, profile),
    sourcedWeaponElementAtLevel(level),
    profile.bonuses,
  );
}

function idleMetricsWithProfile(
  cls: ClassId,
  level: number,
  profile: AffixProfile,
): { ttk: number; efficiency: number; kps: number } {
  const context: IdleContext = {
    classId: cls,
    player: playerWithProfile(cls, level, profile),
    monster: representativeMonster(level),
    expPerKill: monsterExp(level),
    goldPerKill: monsterGold(level),
    lootTable: { id: 'sim_reforge', rolls: 1, entries: [] },
    skillMultiplier: averageSkillMultiplier(level),
  };
  return {
    // docs/45 把 TTK 定义为“怪物血量 / 玩家 DPS”；承伤恢复造成的减速由 η
    // 单独验收。1 / killsPerSecond 已经再次除过 η，是有效秒/杀，不是 TTK。
    ttk: timeToKill(context.player, context.monster, context.skillMultiplier),
    efficiency: idleCombatEfficiency(context),
    kps: killsPerSecond(context),
  };
}

function representativeMonster(level: number): Combatant {
  return makeMonster({
    id: `sim_reforge_${level}`,
    name: 'sim',
    level,
    type: 'normal',
    element: 'none',
    lootTableId: 'sim',
    sprite: '',
  });
}

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function reforgeSampleSeed(
  base: number,
  level: number,
  sample: number,
  slotIndex: number,
  key = '',
): number {
  let seed =
    (base ^
      Math.imul(level, 0x9e37_79b1) ^
      Math.imul(sample + 1, 0x85eb_ca6b) ^
      Math.imul(slotIndex + 1, 0xc2b2_ae35)) >>>
    0;
  for (let index = 0; index < key.length; index++) {
    seed = Math.imul(seed ^ key.charCodeAt(index), 0x27d4_eb2d) >>> 0;
  }
  return seed;
}

function maxRelativeDeviation(values: readonly number[]): number {
  if (values.length === 0) throw new Error('maxRelativeDeviation: 样本不能为空');
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.max(...values.map((value) => Math.abs(value - average) / average));
}

/** 枚举 total 个职业槽在各输出词条间的全部可达分配。 */
function slotAllocations(total: number, kinds: number): number[][] {
  if (!Number.isInteger(total) || total < 0 || !Number.isInteger(kinds) || kinds < 1) {
    throw new Error(`slotAllocations: 非法参数 total=${total}, kinds=${kinds}`);
  }
  if (kinds === 1) return [[total]];
  const out: number[][] = [];
  for (let count = 0; count <= total; count++) {
    for (const rest of slotAllocations(total - count, kinds - 1)) {
      out.push([count, ...rest]);
    }
  }
  return out;
}

/**
 * 玩家可以靠重铸定向追逐某个职业输出词条，随机平均合格并不代表可达极值安全。
 * 这里枚举史诗以上八件装备的职业槽在全部输出词条间的可达分配；
 * 不能只测“八条同 key”，否则攻击与元素增伤的乘法协同会被漏掉。
 */
function offenseExtremeAcceptance() {
  const rows = REFORGE_ACCEPTANCE_CASES.filter(
    ({ quality }) => QUALITY_PROFESSION_AFFIX_COUNT[quality] > 0,
  ).map(({ level, quality }) => {
    const strongest = Object.fromEntries(
      CLASS_IDS.map((classId) => {
        const professionSlots = QUALITY_PROFESSION_AFFIX_COUNT[quality];
        if (professionSlots !== 1) {
          throw new Error(
            `[模拟配置错误] 输出极值组合只覆盖每件 1 个职业槽，当前 ${quality} 为 ${professionSlots}`,
          );
        }
        const offenseSpecs = PROFESSION_AFFIX_POOLS[classId].filter(
          (entry) => entry.balanceRole === 'offense',
        );
        if (offenseSpecs.length === 0) {
          throw new Error(`[模拟配置错误] ${classId} 没有输出定位职业词条`);
        }
        const weaponElement = sourcedWeaponElementAtLevel(level);
        const candidates = slotAllocations(
          Object.keys(SLOT_WEIGHTS).length,
          offenseSpecs.length,
        ).map((allocation) => {
          let profile: AffixProfile = { stats: zeroStats(), bonuses: zeroCombatBonuses() };
          for (const [specIndex, count] of allocation.entries()) {
            const spec = offenseSpecs[specIndex]!;
            const elemental = spec.key === 'elemDmg' || spec.key === 'wit_elem';
            if (elemental && weaponElement === 'none') {
              throw new Error(`[模拟配置错误] Lv${level} 的 ${spec.key} 极值没有真实元素武器来源`);
            }
            const affix: Affix = {
              key: spec.key,
              tier: 5,
              value: affixValueRange(spec.key, level, 5).max,
              ...(elemental ? { element: weaponElement } : {}),
            };
            for (let slot = 0; slot < count; slot++) {
              profile = addAffixesToProfile(profile, [affix]);
            }
          }
          return {
            build: allocation
              .map((count, index) => `${count}×${offenseSpecs[index]!.key}`)
              .filter((_, index) => allocation[index]! > 0)
              .join(' + '),
            kps: idleMetricsWithProfile(classId, level, profile).kps,
          };
        });
        return [
          classId,
          candidates.reduce((best, candidate) => (candidate.kps > best.kps ? candidate : best)),
        ];
      }),
    ) as Record<ClassId, { build: string; kps: number }>;
    const deviation = maxRelativeDeviation(CLASS_IDS.map((classId) => strongest[classId].kps));
    return {
      等级: level,
      品质: quality,
      剑姬: `${strongest.swordsman.build} · ${strongest.swordsman.kps.toFixed(4)}`,
      魔女: `${strongest.witch.build} · ${strongest.witch.kps.toFixed(4)}`,
      灵巫: `${strongest.shaman.build} · ${strongest.shaman.kps.toFixed(4)}`,
      喵喵: `${strongest.catkin.build} · ${strongest.catkin.kps.toFixed(4)}`,
      最大偏离: percent(deviation),
      rawDeviation: deviation,
    };
  });

  console.log('\n【职业词条可达输出极值】八件职业槽枚举全部输出 T5 混合分配\n');
  console.table(rows.map(({ rawDeviation: _rawDeviation, ...row }) => row));
  return {
    rows,
    maxDeviation: Math.max(...rows.map((row) => row.rawDeviation)),
  };
}

function reforgeAcceptance() {
  for (const quality of Object.keys(LEGACY_QUALITY_AFFIX_COUNT) as Quality[]) {
    const expected =
      quality === 'common'
        ? LEGACY_QUALITY_AFFIX_COUNT.common + 1
        : LEGACY_QUALITY_AFFIX_COUNT[quality];
    if (QUALITY_AFFIX_COUNT[quality] !== expected) {
      throw new Error(
        `[词条验收基线失效] ${quality} 新槽数应为 ${expected}，实际 ${QUALITY_AFFIX_COUNT[quality]}`,
      );
    }
  }
  for (const { level } of REFORGE_ACCEPTANCE_CASES) {
    assertElementSourcesAtLevel(level);
  }

  const rows: ReforgeAcceptanceRow[] = [];
  const classMetrics: ReforgeClassMetrics[] = [];
  const slots = Object.keys(SLOT_WEIGHTS) as EquipSlot[];

  for (const { level, quality } of REFORGE_ACCEPTANCE_CASES) {
    for (const cls of CLASS_IDS) {
      let legacyCp = 0;
      let freshCp = 0;
      let t5Cp = 0;
      let freshTtk = 0;
      let t5Ttk = 0;
      let freshEfficiency = 0;
      let t5Efficiency = 0;
      let freshKps = 0;
      let t5Kps = 0;

      for (let sample = 0; sample < REFORGE_SAMPLE_SIZE; sample++) {
        let legacy: AffixProfile = { stats: zeroStats(), bonuses: zeroCombatBonuses() };
        let fresh: AffixProfile = { stats: zeroStats(), bonuses: zeroCombatBonuses() };
        let t5: AffixProfile = { stats: zeroStats(), bonuses: zeroCombatBonuses() };

        for (const [slotIndex, slot] of slots.entries()) {
          const definition = syntheticEquipment(level, quality, slot);
          legacy = addAffixesToProfile(
            legacy,
            rollLegacyAffixes(
              definition,
              new Rng(reforgeSampleSeed(REFORGE_SAMPLE_SEED, level, sample, slotIndex)),
            ),
            false,
          );
          /*
           * 每个职业在同等级、同样本、同部位使用同一条随机流。
           * 通用词条因此完全配对，职业差只来自职业池本身，而不是抽样噪声。
           */
          const freshAffixes = rollAffixes(
            definition,
            new Rng(reforgeSampleSeed(REFORGE_SAMPLE_SEED ^ 0x1111_1111, level, sample, slotIndex)),
            cls,
          );
          fresh = addAffixesToProfile(fresh, freshAffixes);
          t5 = addAffixesToProfile(
            t5,
            freshAffixes.map((affix) =>
              t5VersionOf(
                affix,
                level,
                new Rng(
                  reforgeSampleSeed(
                    REFORGE_SAMPLE_SEED ^ 0x5555_5555,
                    level,
                    sample,
                    slotIndex,
                    affix.key,
                  ),
                ),
              ),
            ),
          );
        }

        legacyCp += combatPower(statsWithProfile(cls, level, legacy));
        freshCp += combatPower(statsWithProfile(cls, level, fresh));
        t5Cp += combatPower(statsWithProfile(cls, level, t5));
        const freshMetrics = idleMetricsWithProfile(cls, level, fresh);
        const t5Metrics = idleMetricsWithProfile(cls, level, t5);
        freshTtk += freshMetrics.ttk;
        t5Ttk += t5Metrics.ttk;
        freshEfficiency += freshMetrics.efficiency;
        t5Efficiency += t5Metrics.efficiency;
        freshKps += freshMetrics.kps;
        t5Kps += t5Metrics.kps;
      }

      legacyCp /= REFORGE_SAMPLE_SIZE;
      freshCp /= REFORGE_SAMPLE_SIZE;
      t5Cp /= REFORGE_SAMPLE_SIZE;
      freshTtk /= REFORGE_SAMPLE_SIZE;
      t5Ttk /= REFORGE_SAMPLE_SIZE;
      freshEfficiency /= REFORGE_SAMPLE_SIZE;
      t5Efficiency /= REFORGE_SAMPLE_SIZE;
      freshKps /= REFORGE_SAMPLE_SIZE;
      t5Kps /= REFORGE_SAMPLE_SIZE;
      classMetrics.push({
        level,
        quality,
        classId: cls,
        legacyCp,
        freshCp,
        t5Cp,
        freshTtk,
        freshEfficiency,
        freshKps,
        t5Ttk,
        t5Efficiency,
        t5Kps,
      });
      rows.push({
        等级: level,
        品质: quality,
        职业: cls,
        旧版战力: legacyCp.toFixed(1),
        新掉落战力: freshCp.toFixed(1),
        新掉落变化: percent(freshCp / legacyCp - 1),
        全T5战力: t5Cp.toFixed(1),
        全T5提升: percent(t5Cp / freshCp - 1),
        新掉落TTK: freshTtk.toFixed(2),
        新掉落η: freshEfficiency.toFixed(3),
        新掉落KPS: freshKps.toFixed(4),
        全T5TTK: t5Ttk.toFixed(2),
        全T5η: t5Efficiency.toFixed(3),
        全T5KPS: t5Kps.toFixed(4),
      });
    }
  }

  console.log(
    `\n【词条与洗练数值验收】固定种子 0x${REFORGE_SAMPLE_SEED.toString(16)}，每档每职业 ${REFORGE_SAMPLE_SIZE.toLocaleString()} 套八件装备\n`,
  );
  console.table(rows);

  const classRows = REFORGE_ACCEPTANCE_CASES.map(({ level, quality }) => {
    const levelMetrics = Object.fromEntries(
      classMetrics
        .filter((metrics) => metrics.level === level && metrics.quality === quality)
        .map((metrics) => [metrics.classId, metrics]),
    ) as Record<ClassId, ReforgeClassMetrics>;
    const freshDeviation = maxRelativeDeviation(
      CLASS_IDS.map((classId) => levelMetrics[classId].freshKps),
    );
    const t5Deviation = maxRelativeDeviation(
      CLASS_IDS.map((classId) => levelMetrics[classId].t5Kps),
    );

    return {
      等级: level,
      品质: quality,
      剑姬KPS: levelMetrics.swordsman.freshKps.toFixed(4),
      魔女KPS: levelMetrics.witch.freshKps.toFixed(4),
      灵巫KPS: levelMetrics.shaman.freshKps.toFixed(4),
      喵喵KPS: levelMetrics.catkin.freshKps.toFixed(4),
      新掉落最大偏离: percent(freshDeviation),
      全T5最大偏离: percent(t5Deviation),
    };
  });
  console.log('新鲜掉落词条下的四职业真实 KPS：');
  console.table(classRows);

  /*
   * 战力涨跌与全 T5 成长空间都**只统计精良及以上**。
   *
   * 普通品质是从「0 条词条」变成「1 条词条」，这是所有者明确要求的
   * 产品决定，不是平衡失误：无论系数怎么配，白装都必然大幅变强，
   * 而单独一条词条也撬不动整套战力的成长空间。
   * 把它算进同一个门槛，等于用一把尺子量两种性质的东西。
   *
   * 普通品质单独打印出来备查，绝不隐藏。
   */
  const gradedMetrics = classMetrics.filter((metrics) => metrics.quality !== 'common');
  const commonMetrics = classMetrics.filter((metrics) => metrics.quality === 'common');
  const cpChangeValues = gradedMetrics.map((metrics) => metrics.freshCp / metrics.legacyCp - 1);
  const t5GainValues = gradedMetrics.map((metrics) => metrics.t5Cp / metrics.freshCp - 1);
  const minFreshCpChange = Math.min(...cpChangeValues);
  const maxFreshCpChange = Math.max(...cpChangeValues);
  const minT5Gain = Math.min(...t5GainValues);
  const maxT5Gain = Math.max(...t5GainValues);
  /*
   * 必须直接聚合每个样本的 killsPerSecond，不能把已经求平均并 toFixed 的
   * TTK 与 η 再相除。E[η/TTK] 不等于 E[η] / E[TTK]，后者会制造假绿。
   */
  const classKpsDeviation = (key: 'freshKps' | 't5Kps') =>
    Math.max(
      ...REFORGE_ACCEPTANCE_CASES.map(({ level, quality }) =>
        maxRelativeDeviation(
          classMetrics
            .filter((metrics) => metrics.level === level && metrics.quality === quality)
            .map((metrics) => metrics[key]),
        ),
      ),
    );
  const maxFreshClassDeviation = classKpsDeviation('freshKps');
  const maxT5ClassDeviation = classKpsDeviation('t5Kps');
  const maxClassDeviation = Math.max(maxFreshClassDeviation, maxT5ClassDeviation);
  const representativeTtks = classMetrics
    .filter((metrics) => metrics.level === REPRESENTATIVE_TTK_LEVEL)
    .map((metrics) => metrics.freshTtk);
  const freshEfficiencies = classMetrics.map((metrics) => metrics.freshEfficiency);
  const t5Efficiencies = classMetrics.map((metrics) => metrics.t5Efficiency);
  const minFreshEfficiency = Math.min(...freshEfficiencies);
  const maxFreshEfficiency = Math.max(...freshEfficiencies);
  const minT5Efficiency = Math.min(...t5Efficiencies);
  const maxT5Efficiency = Math.max(...t5Efficiencies);

  console.log('词条验收摘要：');
  const commonChanges = commonMetrics.map((metrics) => metrics.freshCp / metrics.legacyCp - 1);
  console.log(
    `  普通品质（0→1 条词条，产品决定，不纳入门槛）：${percent(Math.min(...commonChanges))} ~ ${percent(Math.max(...commonChanges))}`,
  );
  console.log(
    `  新掉落相对旧装备（精良及以上）：${percent(minFreshCpChange)} ~ ${percent(maxFreshCpChange)}（目标 ${percent(MIN_FRESH_CP_CHANGE)} ~ +${percent(MAX_FRESH_CP_CHANGE)}）`,
  );
  console.log(
    `  全 T5 相对新掉落：${percent(minT5Gain)} ~ ${percent(maxT5Gain)}（目标 ${percent(MIN_ALL_T5_CP_GAIN)} ~ ${percent(MAX_ALL_T5_CP_GAIN)}）`,
  );
  console.log(
    `  四职业最大有效击杀率偏离：新掉落 ${percent(maxFreshClassDeviation)}，全 T5 ${percent(maxT5ClassDeviation)}（目标均 ≤ ${percent(MAX_CLASS_DEVIATION)}）`,
  );
  console.log(
    `  Lv${REPRESENTATIVE_TTK_LEVEL} TTK：${Math.min(...representativeTtks).toFixed(2)} ~ ${Math.max(...representativeTtks).toFixed(2)} 秒（目标 ${MIN_REPRESENTATIVE_TTK} ~ ${MAX_REPRESENTATIVE_TTK} 秒）`,
  );
  console.log(
    `  普通关卡 η：新掉落 ${minFreshEfficiency.toFixed(3)} ~ ${maxFreshEfficiency.toFixed(3)}，全 T5 ${minT5Efficiency.toFixed(3)} ~ ${maxT5Efficiency.toFixed(3)}（目标均 ${MIN_NORMAL_COMBAT_EFFICIENCY.toFixed(2)} ~ ${MAX_NORMAL_COMBAT_EFFICIENCY.toFixed(2)}）\n`,
  );

  return {
    rows,
    classRows,
    minFreshCpChange,
    maxFreshCpChange,
    minT5Gain,
    maxT5Gain,
    maxClassDeviation,
    maxFreshClassDeviation,
    maxT5ClassDeviation,
    representativeTtks,
    minFreshEfficiency,
    maxFreshEfficiency,
    minT5Efficiency,
    maxT5Efficiency,
  };
}

/*
 * 词条与成长曲线验收，全部为硬门禁。
 *
 * 【历史】TTK 带宽与承伤效率 η 曾因成长曲线缺陷长期报红，一度被降级为
 * 「已知待办」以免阻断开发。根因是 ADR-005 把怪物血量指数对齐到 ITEM_POW，
 * 却漏了装备战力还要再乘 QUALITY_MUL（普通 1.0 → 神圣 15.0），
 * 那一整段增长怪物没有跟上，TTK 从 Lv10 的 7.9 秒掉到 Lv120 的 0.41 秒。
 *
 * 现已由 progression.ts 的 expectedGearFactor 补上品质增长并同步下调
 * MONSTER_ATK_BASE，两项恢复为硬门禁 —— **不要再把它们降级**，
 * 它们现在是真的能过。
 *
 * 四职业平衡同样必须在这里硬判：基础、新掉落、全 T5 与玩家可定向追到的
 * 全输出 T5 都统一读取真实 killsPerSecond，任何一层超过 20% 都退出非零。
 */
function assertReforgeAcceptance(
  result: ReturnType<typeof reforgeAcceptance>,
  baseBalance: ReturnType<typeof classBalance>,
  offenseExtreme: ReturnType<typeof offenseExtremeAcceptance>,
): void {
  const minRepresentativeTtk = Math.min(...result.representativeTtks);
  const maxRepresentativeTtk = Math.max(...result.representativeTtks);

  const checks = [
    {
      ok:
        minRepresentativeTtk >= MIN_REPRESENTATIVE_TTK &&
        maxRepresentativeTtk <= MAX_REPRESENTATIVE_TTK,
      detail: `Lv${REPRESENTATIVE_TTK_LEVEL} TTK ${minRepresentativeTtk.toFixed(2)}~${maxRepresentativeTtk.toFixed(2)} 秒（目标 ${MIN_REPRESENTATIVE_TTK}~${MAX_REPRESENTATIVE_TTK} 秒）`,
    },
    {
      ok:
        result.minFreshEfficiency >= MIN_NORMAL_COMBAT_EFFICIENCY &&
        result.maxFreshEfficiency <= MAX_NORMAL_COMBAT_EFFICIENCY &&
        result.minT5Efficiency >= MIN_NORMAL_COMBAT_EFFICIENCY &&
        result.maxT5Efficiency <= MAX_NORMAL_COMBAT_EFFICIENCY,
      detail: `普通关卡 η 新掉落 ${result.minFreshEfficiency.toFixed(3)}~${result.maxFreshEfficiency.toFixed(3)}、全 T5 ${result.minT5Efficiency.toFixed(3)}~${result.maxT5Efficiency.toFixed(3)}（目标 ${MIN_NORMAL_COMBAT_EFFICIENCY.toFixed(2)}~${MAX_NORMAL_COMBAT_EFFICIENCY.toFixed(2)}）`,
    },
    {
      ok:
        result.minFreshCpChange >= MIN_FRESH_CP_CHANGE &&
        result.maxFreshCpChange <= MAX_FRESH_CP_CHANGE,
      detail: `新掉落总战力 ${percent(result.minFreshCpChange)}~${percent(result.maxFreshCpChange)}（目标 ${percent(MIN_FRESH_CP_CHANGE)}~+${percent(MAX_FRESH_CP_CHANGE)}）`,
    },
    {
      ok: result.minT5Gain >= MIN_ALL_T5_CP_GAIN && result.maxT5Gain <= MAX_ALL_T5_CP_GAIN,
      detail: `全 T5 总战力提升 ${percent(result.minT5Gain)}~${percent(result.maxT5Gain)}（目标 ${percent(MIN_ALL_T5_CP_GAIN)}~${percent(MAX_ALL_T5_CP_GAIN)}）`,
    },
    {
      ok: baseBalance.maxDeviation <= MAX_CLASS_DEVIATION,
      detail: `基础四职业真实 KPS 最大偏离 ${percent(baseBalance.maxDeviation)}（目标 ≤ ${percent(MAX_CLASS_DEVIATION)}）`,
    },
    {
      ok:
        result.maxFreshClassDeviation <= MAX_CLASS_DEVIATION &&
        result.maxT5ClassDeviation <= MAX_CLASS_DEVIATION,
      detail: `词条四职业真实 KPS 最大偏离：新掉落 ${percent(result.maxFreshClassDeviation)}、全 T5 ${percent(result.maxT5ClassDeviation)}（目标均 ≤ ${percent(MAX_CLASS_DEVIATION)}）`,
    },
    {
      ok: offenseExtreme.maxDeviation <= MAX_CLASS_DEVIATION,
      detail: `八件定向输出 T5 的四职业真实 KPS 最大偏离 ${percent(offenseExtreme.maxDeviation)}（目标 ≤ ${percent(MAX_CLASS_DEVIATION)}）`,
    },
  ];

  console.log('【词条、承伤与职业平衡验收门禁】');
  for (const check of checks) console.log(`  ${check.ok ? '✔' : '✘'} ${check.detail}`);
  const violations = checks.filter((check) => !check.ok).map((check) => check.detail);
  if (violations.length > 0) {
    throw new Error(`词条与承伤数值验收失败：\n- ${violations.join('\n- ')}`);
  }
}

// ──────────────────────────────────────────────────────────
// 6. 竞技场 PvP 胜率验收（docs/52 §11）
// ──────────────────────────────────────────────────────────

/**
 * docs/52 §11 的硬门禁：同战力双方胜率应落在 45%~55%。
 *
 * 「同战力」的口径 = 同职业、同等级、同典型装备的镜像局（唯一严格同战力
 * 且可复现的对阵）。estimateDuelWinChance 使用确定性分层抽样，
 * 镜像局天然落在 50% 附近，本门禁读数稳定、不会抖动。
 *
 * 跨职业矩阵同步打印并写入 CSV 作为诊断：职业间 PvP 数值平衡
 * （docs/53 明确归 claude）如有偏离在那里可见，但不在这里硬判。
 */
const PVP_GATE_LEVELS = [60, 100] as const;
const PVP_GATE_SIMULATIONS = 200;
const PVP_MIRROR_MIN = 0.45;
const PVP_MIRROR_MAX = 0.55;

function pvpSide(cls: ClassId, level: number): DuelSide {
  return {
    combatant: makePlayer(`pvp-${cls}-${level}`, level, withGear(cls, level)),
    skillMultiplier: averageSkillMultiplier(level),
  };
}

interface PvpRow {
  等级: number;
  挑战者: ClassId;
  防守方: ClassId;
  胜率: number;
}

function pvpBalance() {
  const rows: PvpRow[] = [];
  const mirrors: { level: number; cls: ClassId; winRate: number }[] = [];
  for (const level of PVP_GATE_LEVELS) {
    for (const attacker of CLASS_IDS) {
      const side = pvpSide(attacker, level);
      for (const defender of CLASS_IDS) {
        const winRate = estimateDuelWinChance(side, pvpSide(defender, level), PVP_GATE_SIMULATIONS);
        rows.push({ 等级: level, 挑战者: attacker, 防守方: defender, 胜率: Number(winRate.toFixed(4)) });
        if (attacker === defender) mirrors.push({ level, cls: attacker, winRate });
      }
    }
  }
  return { rows, mirrors };
}

function assertPvpBalance(result: ReturnType<typeof pvpBalance>): void {
  console.log('\n【竞技场 PvP 胜率门禁（docs/52 §11：同战力镜像 45%~55%）】');
  const violations: string[] = [];
  for (const m of result.mirrors) {
    const ok = m.winRate >= PVP_MIRROR_MIN && m.winRate <= PVP_MIRROR_MAX;
    const detail = `Lv${m.level} ${m.cls} 镜像胜率 ${(m.winRate * 100).toFixed(1)}%（目标 45%~55%）`;
    console.log(`  ${ok ? '✔' : '✘'} ${detail}`);
    if (!ok) violations.push(detail);
  }
  console.log('  跨职业胜率矩阵（行=挑战者 列=防守方；诊断用，职业数值归属 docs/53）：');
  for (const level of PVP_GATE_LEVELS) {
    console.log(`    Lv${level}:`);
    console.log('      ' + ''.padEnd(10) + CLASS_IDS.map((c) => c.padStart(10)).join(''));
    for (const attacker of CLASS_IDS) {
      const cells = CLASS_IDS.map((defender) => {
        const row = result.rows.find(
          (r) => r.等级 === level && r.挑战者 === attacker && r.防守方 === defender,
        )!;
        return `${(row.胜率 * 100).toFixed(0)}%`.padStart(10);
      }).join('');
      console.log(`      ${attacker.padEnd(10)}${cells}`);
    }
  }
  if (violations.length > 0) {
    throw new Error(`竞技场 PvP 同战力胜率验收失败：\n- ${violations.join('\n- ')}`);
  }
}

// ──────────────────────────────────────────────────────────
// 主流程
// ──────────────────────────────────────────────────────────

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]!);
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map((h) => String(r[h])).join(','));
  return lines.join('\n');
}

function main() {
  const checkpoints = checkpointTable();

  console.log('\n【30 天成长曲线 · 剑姬】每天有效挂机 14 小时\n');
  const curve = simulateDays('swordsman', 30);
  console.table(
    curve.filter((r) => r.天 === 1 || r.天 % 5 === 0).map((r) => ({ ...r, 当日经验: r.当日经验 })),
  );

  const balance = classBalance();
  equipmentRandomHealth();
  const reforge = reforgeAcceptance();
  const offenseExtreme = offenseExtremeAcceptance();
  const pvp = pvpBalance();

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, 'checkpoints.csv'), toCsv(checkpoints), 'utf8');
  writeFileSync(
    resolve(OUT_DIR, 'growth-30d.csv'),
    toCsv(curve as unknown as Record<string, unknown>[]),
    'utf8',
  );
  writeFileSync(resolve(OUT_DIR, 'class-balance.csv'), toCsv(balance.rows), 'utf8');
  writeFileSync(
    resolve(OUT_DIR, 'reforge-acceptance.csv'),
    toCsv(reforge.rows as unknown as Record<string, unknown>[]),
    'utf8',
  );
  writeFileSync(
    resolve(OUT_DIR, 'pvp-balance.csv'),
    toCsv(pvp.rows as unknown as Record<string, unknown>[]),
    'utf8',
  );

  console.log(`\n✔ CSV 已输出到 ${OUT_DIR}`);
  console.log(
    '  checkpoints.csv / growth-30d.csv / class-balance.csv / reforge-acceptance.csv / pvp-balance.csv\n',
  );

  // 健康检查（docs/56 §8）
  const day30 = curve[curve.length - 1]!;
  console.log('【健康检查】');
  console.log(`  30 天后等级：Lv${day30.等级}（软上限 Lv${CONTENT_SOFT_CAP}）`);

  // G2：等级绝不允许越过内容软上限 —— 这正是 docs/56 病根一的防回归锁。
  // 旧门禁「满级前无等级停滞」已废除：停滞（卡点）在新设计里是特性不是病，
  // 玩家顶到软上限后靠推进关卡解锁继续升级。
  if (day30.等级 > CONTENT_SOFT_CAP) {
    throw new Error(
      `[G2 失败] 30 天等级 Lv${day30.等级} 越过内容软上限 Lv${CONTENT_SOFT_CAP}（docs/56 §2）`,
    );
  }
  console.log(`  ✔ G2：30 天等级未越过内容软上限`);

  // 软上限之下不允许长期停滞（到顶后停滞是设计使然，不算病）
  const stalledBelowCap = curve.findIndex(
    (r, i) => i > 0 && r.等级 < CONTENT_SOFT_CAP && r.等级 === curve[i - 1]!.等级,
  );
  if (stalledBelowCap >= 0) {
    throw new Error(
      `[成长曲线验收失败] 第 ${curve[stalledBelowCap]!.天} 天在软上限之下等级未增长` +
        `（Lv${curve[stalledBelowCap]!.等级}）—— 到顶前不该有整天零增长`,
    );
  }
  console.log('  ✔ 软上限之下无整天停滞');

  assertReforgeAcceptance(reforge, balance, offenseExtreme);
  assertPvpBalance(pvp);
}

main();
