/**
 * 区域 5「熔岩神殿」真实经济模拟。
 *
 * 读取正式 STAGES / MONSTERS / LOOT_TABLES / EQUIPMENT 和强化纯函数，不保存
 * 第二套掉率或成本。模拟结果同时验收：
 *   1. 240 个通用绯焰碎片的 P50 / P90 / P95 成套天数；
 *   2. 四个真实来源的贡献与碎片保底触发占比；
 *   3. R5 普通 legendary 首件与品质组保底；
 *   4. 五章首通 + 14 小时/日挂机的强化材料供需。
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addStats } from '../src/core/formula';
import { instanceStatsForClass } from '../src/core/equipment';
import { attemptEnhance, enhanceCost } from '../src/core/enhance';
import { killsPerSecond } from '../src/core/idle';
import {
  pityGroupKey,
  rollLoot,
  type PityCounters,
} from '../src/core/loot';
import {
  applyClassMods,
  averageSkillMultiplier,
  baseStatsFor,
  makeMonster,
  makePlayer,
} from '../src/core/progression';
import { Rng } from '../src/core/rng';
import { countStageMonsterKills } from '../src/core/stageLoot';
import type {
  ClassId,
  EquipmentInstance,
  LootResult,
  Stage,
} from '../src/core/types';
import {
  ENHANCE_MATERIAL_IDS,
  ENHANCE_MAX,
  SLOT_ORDER,
} from '../src/data/constants';
import { requireEquipment } from '../src/data/equipment';
import { requireLootTable } from '../src/data/lootTables';
import { requireMonster } from '../src/data/monsters';
import {
  REGION_5_FRAGMENT_COST,
  REGION_5_FRAGMENT_ID,
  REGION_5_SET_SLOTS,
} from '../src/data/region5';
import { REGION_5_FRAGMENT_LOOT_SOURCES } from '../src/data/region5Loot';
import { STAGES } from '../src/data/stages';
import { expectedLoot } from '../src/core/loot';
import { expectedBuildCp } from '../src/data/expectedPower';
import {
  REGION_5_LEGENDARY_LEVEL,
  REGION_5_RHYTHM_LEVEL,
} from '../src/data/region5Growth';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, 'out');

const CLASS_ID: ClassId = 'swordsman';
const PLAYER_LEVEL = 52;
const HOURS_PER_EFFECTIVE_DAY = 14;
const MAX_SIM_DAYS = 14;
const SUPPLY_DAYS = 14;
const SAMPLE_SIZE = 160;
const SAMPLE_SEED = 0x5235_0000;
const FRAGMENT_TARGET = REGION_5_FRAGMENT_COST * REGION_5_SET_SLOTS.length;

const ENHANCE_IDS = [
  ENHANCE_MATERIAL_IDS.stone,
  ENHANCE_MATERIAL_IDS.ore,
  ENHANCE_MATERIAL_IDS.lucky,
  ENHANCE_MATERIAL_IDS.protection,
] as const;
type EnhanceMaterialId = (typeof ENHANCE_IDS)[number];
type MaterialTotals = Record<EnhanceMaterialId, number>;

/**
 * 玩家进入 R5 后先推进到两个精英节点，第三个有效日开始驻留最终关。
 * 这是明确的施工模型，不是隐藏掉率：改关卡节奏时必须同步重跑本脚本。
 */
function farmingStageId(day: number): string {
  if (day === 1) return 'stage_5-2_6';
  if (day === 2) return 'stage_5-4_6';
  return 'stage_5-5_6';
}

function emptyMaterials(): MaterialTotals {
  return {
    [ENHANCE_MATERIAL_IDS.stone]: 0,
    [ENHANCE_MATERIAL_IDS.ore]: 0,
    [ENHANCE_MATERIAL_IDS.lucky]: 0,
    [ENHANCE_MATERIAL_IDS.protection]: 0,
  };
}

function addDrops(target: MaterialTotals, drops: readonly LootResult[]): void {
  for (const drop of drops) {
    if (!ENHANCE_IDS.includes(drop.itemId as EnhanceMaterialId)) continue;
    const id = drop.itemId as EnhanceMaterialId;
    target[id] += drop.count;
  }
}

function representativeEquipmentInstance(
  defId: string,
  enhance: number,
): EquipmentInstance {
  return {
    uid: `r5-economy-${defId}`,
    defId,
    enhance,
    baseRollPermille: 1000,
    enhanceGainPermille: Array.from(
      { length: ENHANCE_MAX },
      (_, index) => (index < enhance ? 80 : 0),
    ),
    enhanceLuck: {},
    affixes: [],
    reforgeResonance: 0,
    locked: false,
  };
}

/** 用正式 R5 史诗定义和推荐强化档构造代表性玩家。 */
function representativePlayer() {
  let stats = baseStatsFor(CLASS_ID, PLAYER_LEVEL);
  for (const slot of SLOT_ORDER) {
    const definition = requireEquipment(`eq_r5_${slot}_epic`);
    const enhance = slot === 'weapon' ? 15 : 13;
    const instance = representativeEquipmentInstance(definition.id, enhance);
    stats = addStats(
      stats,
      instanceStatsForClass(definition, instance, CLASS_ID),
    );
  }
  return makePlayer(
    'R5经济样本',
    PLAYER_LEVEL,
    applyClassMods(CLASS_ID, stats),
    'fire',
  );
}

const REPRESENTATIVE_PLAYER = representativePlayer();

function stageKps(stage: Stage): number {
  const monsterId = stage.waves[0]?.monsters[0]?.id;
  if (!monsterId) throw new Error(`[R5经济模拟] ${stage.id} 没有代表性小怪`);
  const monster = makeMonster(requireMonster(monsterId));
  return killsPerSecond({
    classId: CLASS_ID,
    player: REPRESENTATIVE_PLAYER,
    monster,
    expPerKill: 0,
    goldPerKill: 0,
    lootTable: requireLootTable(stage.lootTableId),
    maxKillsPerSec: stage.maxKillsPerSec,
    skillMultiplier: averageSkillMultiplier(PLAYER_LEVEL),
  });
}

interface HourBatch {
  effectiveDay: number;
  stage: Stage;
  kills: number;
  sourceKillCounts: Readonly<Record<string, number>>;
}

function buildHourBatches(): readonly HourBatch[] {
  const batches: HourBatch[] = [];
  const killCarry = new Map<string, number>();
  const cursor = new Map<string, number>();

  for (let day = 1; day <= MAX_SIM_DAYS; day++) {
    const stageId = farmingStageId(day);
    const stage = STAGES[stageId];
    if (!stage) throw new Error(`[R5经济模拟] 缺少关卡：${stageId}`);
    const kps = stageKps(stage);
    if (!(kps > 0)) throw new Error(`[R5经济模拟] ${stageId} 击杀速度为 0`);

    for (let hour = 1; hour <= HOURS_PER_EFFECTIVE_DAY; hour++) {
      const rawKills = kps * 3600 + (killCarry.get(stageId) ?? 0);
      const kills = Math.floor(rawKills);
      killCarry.set(stageId, rawKills - kills);
      const distribution = countStageMonsterKills(
        stage,
        cursor.get(stageId) ?? 0,
        kills,
      );
      cursor.set(stageId, distribution.nextCursor);

      const sourceKillCounts = Object.fromEntries(
        REGION_5_FRAGMENT_LOOT_SOURCES.map((source) => [
          source.monsterId,
          distribution.counts[source.monsterId] ?? 0,
        ]),
      );
      batches.push({
        effectiveDay: day - 1 + hour / HOURS_PER_EFFECTIVE_DAY,
        stage,
        kills,
        sourceKillCounts,
      });
    }
  }
  return batches;
}

const HOUR_BATCHES = buildHourBatches();

function firstClearEnhanceSupply(): MaterialTotals {
  const totals = emptyMaterials();
  for (const stage of Object.values(STAGES)) {
    if (!stage.chapterId.startsWith('5-')) continue;
    addDrops(totals, stage.firstClearRewards);
  }
  return totals;
}

function expectedNormalEnhanceSupply(): MaterialTotals {
  const totals = emptyMaterials();
  const killsByStage = new Map<string, number>();
  for (const batch of HOUR_BATCHES) {
    if (batch.effectiveDay > SUPPLY_DAYS) continue;
    killsByStage.set(
      batch.stage.id,
      (killsByStage.get(batch.stage.id) ?? 0) + batch.kills,
    );
  }
  for (const [stageId, kills] of killsByStage) {
    const stage = STAGES[stageId]!;
    addDrops(
      totals,
      expectedLoot(requireLootTable(stage.lootTableId), kills, CLASS_ID),
    );
  }
  return totals;
}

const FIXED_FIRST_CLEAR_SUPPLY = firstClearEnhanceSupply();
const EXPECTED_NORMAL_SUPPLY = expectedNormalEnhanceSupply();

interface EnhanceConsumptionResult {
  materials: MaterialTotals;
  attempts: number;
}

/** 真实模拟八部位：武器 +15，其余 +13，并在碎裂段始终使用保护符。 */
function simulateEnhanceConsumption(seed: number): EnhanceConsumptionResult {
  const rng = new Rng(seed);
  const materials = emptyMaterials();
  let attempts = 0;

  for (const slot of SLOT_ORDER) {
    const equipment = requireEquipment(`eq_r5_${slot}_epic`);
    const target = slot === 'weapon' ? 15 : 13;
    const luckByTarget: Record<string, number> = {};
    let level = 0;
    let guard = 0;

    while (level < target) {
      if (guard++ > 20_000) {
        throw new Error(`[R5经济模拟] ${slot} 强化过程异常停滞`);
      }
      const targetLevel = level + 1;
      const cost = enhanceCost(targetLevel, equipment.level);
      materials[ENHANCE_MATERIAL_IDS.stone] += cost.stone;
      materials[ENHANCE_MATERIAL_IDS.ore] += cost.ore;
      materials[ENHANCE_MATERIAL_IDS.lucky] += cost.lucky;

      const result = attemptEnhance(
        {
          level,
          luck: luckByTarget[String(targetLevel)] ?? 0,
          useProtection: targetLevel >= 13,
        },
        rng,
      );
      attempts++;
      if (result.protectionConsumed) {
        materials[ENHANCE_MATERIAL_IDS.protection]++;
      }
      if (result.nextLuck !== null) {
        luckByTarget[String(targetLevel)] = result.nextLuck;
      }
      if (result.nextLevel === null) {
        throw new Error('[R5经济模拟] 使用保护符时不应出现碎裂');
      }
      level = result.nextLevel;
    }
  }

  return { materials, attempts };
}

interface SampleResult {
  completionDay: number;
  sourceFragments: Record<string, number>;
  fragmentDropEvents: number;
  fragmentPityEvents: number;
  firstLegendaryDay: number;
  legendaryDropEvents: number;
  legendaryPityEvents: number;
  enhanceSupply: MaterialTotals;
  enhanceConsumption: MaterialTotals;
  enhanceAttempts: number;
}

const LEGENDARY_IDS = SLOT_ORDER.map((slot) => `eq_r5_${slot}_legendary`);

function runSample(index: number): SampleResult {
  const rng = new Rng((SAMPLE_SEED + index * 0x9e37) >>> 0);
  const pity: PityCounters = {};
  const sourceFragments = Object.fromEntries(
    REGION_5_FRAGMENT_LOOT_SOURCES.map((source) => [source.monsterId, 0]),
  );
  const enhanceSupply: MaterialTotals = {
    ...FIXED_FIRST_CLEAR_SUPPLY,
  };
  for (const id of ENHANCE_IDS) enhanceSupply[id] += EXPECTED_NORMAL_SUPPLY[id];

  let fragments = 0;
  let completionDay = Number.POSITIVE_INFINITY;
  let fragmentDropEvents = 0;
  let fragmentPityEvents = 0;
  let firstLegendaryDay = Number.POSITIVE_INFINITY;
  let legendaryDropEvents = 0;
  let legendaryPityEvents = 0;

  for (const batch of HOUR_BATCHES) {
    for (const source of REGION_5_FRAGMENT_LOOT_SOURCES) {
      const count = batch.sourceKillCounts[source.monsterId] ?? 0;
      if (count <= 0) continue;
      const table = requireLootTable(source.lootTableId);

      for (let kill = 0; kill < count; kill++) {
        const fragmentPityKey = `${table.id}:${REGION_5_FRAGMENT_ID}`;
        const fragmentWasForced =
          (pity[fragmentPityKey] ?? 0) >= (source.entry.pityCount ?? Infinity);
        const group = table.pityGroups?.[0];
        const legendaryWasForced =
          group !== undefined &&
          (pity[pityGroupKey(table.id, group.id)] ?? 0) >= group.pityCount;

        const drops = rollLoot(table, rng, pity, CLASS_ID);
        const fragmentDrop =
          drops.find((drop) => drop.itemId === REGION_5_FRAGMENT_ID)?.count ?? 0;
        if (fragmentDrop > 0 && !Number.isFinite(completionDay)) {
          const credited = Math.min(fragmentDrop, FRAGMENT_TARGET - fragments);
          fragments += fragmentDrop;
          sourceFragments[source.monsterId] += credited;
          fragmentDropEvents++;
          if (fragmentWasForced) fragmentPityEvents++;
          if (fragments >= FRAGMENT_TARGET) {
            completionDay = batch.effectiveDay;
          }
        }

        if (drops.some((drop) => LEGENDARY_IDS.includes(drop.itemId))) {
          legendaryDropEvents++;
          if (legendaryWasForced) legendaryPityEvents++;
          if (!Number.isFinite(firstLegendaryDay)) {
            firstLegendaryDay = batch.effectiveDay;
          }
        }

        if (batch.effectiveDay <= SUPPLY_DAYS) {
          addDrops(enhanceSupply, drops);
        }
      }
    }
  }

  const consumption = simulateEnhanceConsumption(
    (SAMPLE_SEED ^ 0xa5a5_5a5a ^ index) >>> 0,
  );
  return {
    completionDay,
    sourceFragments,
    fragmentDropEvents,
    fragmentPityEvents,
    firstLegendaryDay,
    legendaryDropEvents,
    legendaryPityEvents,
    enhanceSupply,
    enhanceConsumption: consumption.materials,
    enhanceAttempts: consumption.attempts,
  };
}

function nearestRank(values: readonly number[], percentile: number): number {
  if (values.length === 0) throw new Error('[R5经济模拟] 分位数样本为空');
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(percentile * sorted.length) - 1);
  return sorted[index]!;
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function finitePercentile(
  samples: readonly SampleResult[],
  select: (sample: SampleResult) => number,
  percentile: number,
  label: string,
): number {
  const values = samples.map(select);
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error(`[R5经济模拟] ${label} 在 ${MAX_SIM_DAYS} 天内仍有未完成样本`);
  }
  return nearestRank(values, percentile);
}

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function toCsv(rows: readonly Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]!);
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => String(row[header])).join(',')),
  ].join('\n');
}

function main(): void {
  const startedAt = performance.now();
  const samples = Array.from({ length: SAMPLE_SIZE }, (_, index) =>
    runSample(index),
  );

  const fragmentDays = {
    p50: finitePercentile(samples, (sample) => sample.completionDay, 0.5, '绯焰六件套'),
    p90: finitePercentile(samples, (sample) => sample.completionDay, 0.9, '绯焰六件套'),
    p95: finitePercentile(samples, (sample) => sample.completionDay, 0.95, '绯焰六件套'),
  };
  const legendaryDays = {
    p50: finitePercentile(samples, (sample) => sample.firstLegendaryDay, 0.5, '首件传说'),
    p90: finitePercentile(samples, (sample) => sample.firstLegendaryDay, 0.9, '首件传说'),
    p95: finitePercentile(samples, (sample) => sample.firstLegendaryDay, 0.95, '首件传说'),
  };

  const fragmentDropEvents = samples.reduce(
    (sum, sample) => sum + sample.fragmentDropEvents,
    0,
  );
  const fragmentPityEvents = samples.reduce(
    (sum, sample) => sum + sample.fragmentPityEvents,
    0,
  );
  const legendaryDropEvents = samples.reduce(
    (sum, sample) => sum + sample.legendaryDropEvents,
    0,
  );
  const legendaryPityEvents = samples.reduce(
    (sum, sample) => sum + sample.legendaryPityEvents,
    0,
  );

  const sourceRows = REGION_5_FRAGMENT_LOOT_SOURCES.map((source) => {
    const contribution = average(
      samples.map((sample) => sample.sourceFragments[source.monsterId] ?? 0),
    );
    return {
      来源: source.monsterName,
      怪物ID: source.monsterId,
      平均碎片: round(contribution, 2),
      平均占比: percent(contribution / FRAGMENT_TARGET),
    };
  });

  const enhanceRows = ENHANCE_IDS.map((id) => {
    const p50Supply = nearestRank(
      samples.map((sample) => sample.enhanceSupply[id]),
      0.5,
    );
    const p50Cost = nearestRank(
      samples.map((sample) => sample.enhanceConsumption[id]),
      0.5,
    );
    const p90Cost = nearestRank(
      samples.map((sample) => sample.enhanceConsumption[id]),
      0.9,
    );
    return {
      材料ID: id,
      P50产出: round(p50Supply, 1),
      P50消耗: p50Cost,
      P90消耗: p90Cost,
      中位供需比: round(p50Supply / p50Cost, 3),
    };
  });

  const kpsRows = [1, 2, 3].map((day) => {
    const stage = STAGES[farmingStageId(day)]!;
    return {
      有效日: day,
      关卡: stage.id,
      KPS: round(stageKps(stage), 4),
    };
  });

  const growthLevels = [40, REGION_5_RHYTHM_LEVEL, 50, REGION_5_LEGENDARY_LEVEL] as const;
  const growthRows = growthLevels.map((level) => ({
    等级: level,
    典型战力: Math.round(expectedBuildCp(level, CLASS_ID)),
    挂机技能倍率: averageSkillMultiplier(level),
  }));
  const cpAt = (level: number) => expectedBuildCp(level, CLASS_ID);
  const rhythmJump =
    averageSkillMultiplier(REGION_5_RHYTHM_LEVEL) /
    averageSkillMultiplier(REGION_5_RHYTHM_LEVEL - 1);
  const preLegendaryGrowth = cpAt(REGION_5_LEGENDARY_LEVEL - 1) / cpAt(40);
  const legendaryJump =
    cpAt(REGION_5_LEGENDARY_LEVEL) / cpAt(REGION_5_LEGENDARY_LEVEL - 1);
  const totalGrowth = cpAt(52) / cpAt(40);

  console.log(
    `\n【R5 经济模拟】${SAMPLE_SIZE} 个固定种子，${HOURS_PER_EFFECTIVE_DAY} 小时/有效日\n`,
  );
  console.table(kpsRows);
  console.log('Lv40～52 可见成长锚点：');
  console.table(growthRows);
  console.table([
    {
      指标: `Lv40→${REGION_5_LEGENDARY_LEVEL - 1} 普通传说前面板成长`,
      倍率: round(preLegendaryGrowth),
      口径: '观察值（docs/73 B1 明确不设硬门禁）',
    },
    {
      指标: `Lv${REGION_5_RHYTHM_LEVEL} 挂机节奏跃迁`,
      倍率: round(rhythmJump),
      口径: '玩家可见节点',
    },
    {
      指标: `Lv${REGION_5_LEGENDARY_LEVEL} 普通传说品质跃迁`,
      倍率: round(legendaryJump),
      口径: '观察值（不改品质带）',
    },
    {
      指标: 'Lv40→52 面板总成长',
      倍率: round(totalGrowth),
      口径: '观察值',
    },
  ]);
  console.table([
    {
      目标: `${FRAGMENT_TARGET} 绯焰碎片`,
      P50天: round(fragmentDays.p50),
      P90天: round(fragmentDays.p90),
      P95天: round(fragmentDays.p95),
      保底触发占比: percent(fragmentPityEvents / fragmentDropEvents),
    },
    {
      目标: 'R5 普通首件 legendary',
      P50天: round(legendaryDays.p50),
      P90天: round(legendaryDays.p90),
      P95天: round(legendaryDays.p95),
      保底触发占比: percent(legendaryPityEvents / legendaryDropEvents),
    },
  ]);
  console.log('四个碎片来源贡献：');
  console.table(sourceRows);
  console.log('强化材料供需（五章首通 + 14 个有效日）：');
  console.table(enhanceRows);

  const summary = {
    sampleSize: SAMPLE_SIZE,
    seed: `0x${SAMPLE_SEED.toString(16)}`,
    hoursPerEffectiveDay: HOURS_PER_EFFECTIVE_DAY,
    schedule: {
      day1: farmingStageId(1),
      day2: farmingStageId(2),
      day3Plus: farmingStageId(3),
    },
    fragmentTarget: FRAGMENT_TARGET,
    fragmentDays,
    fragmentPityShare:
      fragmentDropEvents > 0 ? fragmentPityEvents / fragmentDropEvents : 0,
    legendaryDays,
    legendaryPityShare:
      legendaryDropEvents > 0 ? legendaryPityEvents / legendaryDropEvents : 0,
    growth: {
      rows: growthRows,
      preLegendaryGrowth,
      rhythmJump,
      legendaryJump,
      totalGrowth,
    },
    sources: sourceRows,
    enhance: enhanceRows,
    averageEnhanceAttempts: average(
      samples.map((sample) => sample.enhanceAttempts),
    ),
    elapsedMs: Math.round(performance.now() - startedAt),
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    resolve(OUT_DIR, 'region5-economy.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );
  writeFileSync(
    resolve(OUT_DIR, 'region5-economy.csv'),
    `${toCsv([
      {
        指标: '绯焰成套天数',
        P50: round(fragmentDays.p50),
        P90: round(fragmentDays.p90),
        P95: round(fragmentDays.p95),
      },
      {
        指标: '普通传说首件天数',
        P50: round(legendaryDays.p50),
        P90: round(legendaryDays.p90),
        P95: round(legendaryDays.p95),
      },
    ])}\n`,
    'utf8',
  );

  const violations: string[] = [];
  if (fragmentDays.p50 < 5 || fragmentDays.p50 > 10) {
    violations.push(`绯焰 P50 ${round(fragmentDays.p50)} 天不在 5～10 天目标带`);
  }
  if (fragmentDays.p95 > 14) {
    violations.push(`绯焰 P95 ${round(fragmentDays.p95)} 天超过 14 天`);
  }
  if (legendaryDays.p95 > 4) {
    violations.push(`普通传说首件 P95 ${round(legendaryDays.p95)} 天超过 4 天`);
  }
  for (const row of enhanceRows) {
    const ratio = Number(row.中位供需比);
    if (ratio < 1.02 || ratio > 1.35) {
      violations.push(
        `${row.材料ID} 中位供需比 ${ratio.toFixed(3)} 不在 1.02～1.35`,
      );
    }
  }
  if (violations.length > 0) {
    throw new Error(`R5 经济门禁失败：\n- ${violations.join('\n- ')}`);
  }

  console.log(
    `✔ R5 经济门禁通过；结果已写入 ${resolve(OUT_DIR, 'region5-economy.json')}\n`,
  );
}

main();
