/**
 * 区域 7「血月峡谷」真实内容门禁。
 *
 * 所有输入都来自正式关卡、怪物、掉落、装备与强化纯函数。本脚本只描述玩家推进节奏，
 * 不保存第二份掉率或战斗公式。输出同时覆盖：
 *  - 五章四职业 TTK / KPS 与职业差异；
 *  - 440 血月碎片集齐天数、四来源贡献和保底占比；
 *  - 普通传说首件天数；
 *  - 五章首通 + 14 小时/有效日挂机的强化材料供需。
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { timeToKill } from '../src/core/combat';
import { attemptEnhance, enhanceCost } from '../src/core/enhance';
import { instanceStatsForClass } from '../src/core/equipment';
import { addStats } from '../src/core/formula';
import { killsPerSecond } from '../src/core/idle';
import { expectedLoot, pityGroupKey, rollLoot, type PityCounters } from '../src/core/loot';
import {
  applyClassMods,
  averageSkillMultiplier,
  baseStatsFor,
  makeMonster,
  makePlayer,
} from '../src/core/progression';
import { Rng } from '../src/core/rng';
import { countStageMonsterKills } from '../src/core/stageLoot';
import {
  CLASS_IDS,
  type ClassId,
  type EquipmentInstance,
  type LootResult,
  type Quality,
  type Stage,
} from '../src/core/types';
import { ENHANCE_MATERIAL_IDS, ENHANCE_MAX, SLOT_ORDER } from '../src/data/constants';
import { requireEquipment } from '../src/data/equipment';
import { requireLootTable } from '../src/data/lootTables';
import { requireMonster } from '../src/data/monsters';
import {
  REGION_7_FRAGMENT_COST,
  REGION_7_FRAGMENT_ID,
  REGION_7_SET_SLOTS,
} from '../src/data/region7';
import { REGION_7_FRAGMENT_LOOT_SOURCES } from '../src/data/region7Loot';
import { STAGES } from '../src/data/stages';

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), 'out');
const HOURS_PER_EFFECTIVE_DAY = 14;
const MAX_SIM_DAYS = 14;
const SAMPLE_SIZE = 160;
const SAMPLE_SEED = 0x7373_0000;
const FRAGMENT_TARGET = REGION_7_FRAGMENT_COST * REGION_7_SET_SLOTS.length;
const FINAL_PLAYER_LEVEL = 76;

const ENHANCE_IDS = [
  ENHANCE_MATERIAL_IDS.stone,
  ENHANCE_MATERIAL_IDS.ore,
  ENHANCE_MATERIAL_IDS.lucky,
  ENHANCE_MATERIAL_IDS.protection,
] as const;
type EnhanceMaterialId = (typeof ENHANCE_IDS)[number];
type MaterialTotals = Record<EnhanceMaterialId, number>;

interface ChapterBuild {
  chapterId: string;
  playerLevel: number;
  gearRegion: 'r6' | 'r7';
  quality: Quality;
  weaponRegion?: 'r7';
  weaponQuality?: Quality;
  allEnhance: number;
  mainEnhance: number;
  element: 'ice' | 'thunder';
}

/**
 * 玩家不是一进新区就凭空穿齐毕业史诗：
 * 前两章沿用 R6 史诗，第三章开始换 R7 史诗；R7 不生成稀有装备，
 * 这是 docs/59 明确锁定的“传说时代”品质边界。
 */
const CHAPTER_BUILDS: readonly ChapterBuild[] = [
  {
    chapterId: '7-1',
    playerLevel: 65,
    gearRegion: 'r6',
    quality: 'epic',
    allEnhance: 14,
    mainEnhance: 15,
    element: 'ice',
  },
  {
    chapterId: '7-2',
    playerLevel: 69,
    gearRegion: 'r6',
    quality: 'epic',
    weaponRegion: 'r7',
    weaponQuality: 'epic',
    allEnhance: 14,
    mainEnhance: 15,
    element: 'thunder',
  },
  {
    chapterId: '7-3',
    playerLevel: 70,
    gearRegion: 'r7',
    quality: 'epic',
    allEnhance: 14,
    mainEnhance: 15,
    element: 'thunder',
  },
  {
    chapterId: '7-4',
    playerLevel: 73,
    gearRegion: 'r7',
    quality: 'epic',
    allEnhance: 15,
    mainEnhance: 15,
    element: 'thunder',
  },
  {
    chapterId: '7-5',
    playerLevel: FINAL_PLAYER_LEVEL,
    gearRegion: 'r7',
    quality: 'epic',
    allEnhance: 15,
    mainEnhance: 15,
    element: 'thunder',
  },
] as const;

function farmingStageId(day: number): string {
  if (day === 1) return 'stage_7-2_6';
  if (day === 2) return 'stage_7-4_6';
  return 'stage_7-5_6';
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
    target[drop.itemId as EnhanceMaterialId] += drop.count;
  }
}

function representativeEquipmentInstance(
  defId: string,
  enhance: number,
): EquipmentInstance {
  return {
    uid: `r7-economy-${defId}`,
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

function representativePlayer(classId: ClassId, build: ChapterBuild) {
  let stats = baseStatsFor(classId, build.playerLevel);
  for (const slot of SLOT_ORDER) {
    const equipmentRegion = slot === 'weapon' ? (build.weaponRegion ?? build.gearRegion) : build.gearRegion;
    const equipmentQuality = slot === 'weapon' ? (build.weaponQuality ?? build.quality) : build.quality;
    const definition = requireEquipment(
      `eq_${equipmentRegion}_${slot}_${equipmentQuality}`,
    );
    const enhance = slot === 'weapon' ? build.mainEnhance : build.allEnhance;
    stats = addStats(
      stats,
      instanceStatsForClass(
        definition,
        representativeEquipmentInstance(definition.id, enhance),
        classId,
      ),
    );
  }
  return makePlayer(
    `${classId}-${build.chapterId}`,
    build.playerLevel,
    applyClassMods(classId, stats),
    build.element,
  );
}

function buildForChapter(chapterId: string): ChapterBuild {
  const build = CHAPTER_BUILDS.find((candidate) => candidate.chapterId === chapterId);
  if (!build) throw new Error(`[R7 simulation] missing chapter build: ${chapterId}`);
  return build;
}

function stageKps(stage: Stage, classId: ClassId): number {
  const monsterId = stage.waves[0]?.monsters[0]?.id;
  if (!monsterId) throw new Error(`[R7 simulation] ${stage.id} has no representative monster`);
  const build = buildForChapter(stage.chapterId);
  return killsPerSecond({
    classId,
    player: representativePlayer(classId, build),
    monster: makeMonster(requireMonster(monsterId)),
    expPerKill: 0,
    goldPerKill: 0,
    lootTable: requireLootTable(stage.lootTableId),
    maxKillsPerSec: stage.maxKillsPerSec,
    skillMultiplier: averageSkillMultiplier(build.playerLevel),
  });
}

interface CombatMetric {
  chapterId: string;
  classId: ClassId;
  stageId: string;
  ttk: number;
  kps: number;
}

function combatMetrics(): readonly CombatMetric[] {
  return CHAPTER_BUILDS.flatMap((build) => {
    const stageId = `stage_${build.chapterId}_1`;
    const stage = STAGES[stageId];
    if (!stage) throw new Error(`[R7 simulation] missing stage: ${stageId}`);
    const monsterId = stage.waves[0]?.monsters[0]?.id;
    if (!monsterId) throw new Error(`[R7 simulation] missing monster: ${stageId}`);
    const monster = makeMonster(requireMonster(monsterId));
    return CLASS_IDS.map((classId) => {
      const player = representativePlayer(classId, build);
      return {
        chapterId: build.chapterId,
        classId,
        stageId,
        ttk: timeToKill(
          player,
          monster,
          averageSkillMultiplier(build.playerLevel),
        ),
        kps: stageKps(stage, classId),
      };
    });
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
    if (!stage) throw new Error(`[R7 simulation] missing farming stage: ${stageId}`);
    const kps = stageKps(stage, 'swordsman');
    if (!(kps > 0 && kps < 3)) {
      throw new Error(`[R7 simulation] invalid KPS at ${stageId}: ${kps}`);
    }
    for (let hour = 1; hour <= HOURS_PER_EFFECTIVE_DAY; hour++) {
      const rawKills = kps * 3_600 + (killCarry.get(stageId) ?? 0);
      const kills = Math.floor(rawKills);
      killCarry.set(stageId, rawKills - kills);
      const distribution = countStageMonsterKills(
        stage,
        cursor.get(stageId) ?? 0,
        kills,
      );
      cursor.set(stageId, distribution.nextCursor);
      batches.push({
        effectiveDay: day - 1 + hour / HOURS_PER_EFFECTIVE_DAY,
        stage,
        kills,
        sourceKillCounts: Object.fromEntries(
          REGION_7_FRAGMENT_LOOT_SOURCES.map((source) => [
            source.monsterId,
            distribution.counts[source.monsterId] ?? 0,
          ]),
        ),
      });
    }
  }
  return batches;
}

const HOUR_BATCHES = buildHourBatches();

function firstClearEnhanceSupply(): MaterialTotals {
  const totals = emptyMaterials();
  for (const stage of Object.values(STAGES)) {
    if (stage.chapterId.startsWith('7-')) addDrops(totals, stage.firstClearRewards);
  }
  return totals;
}

function expectedNormalEnhanceSupply(): MaterialTotals {
  const totals = emptyMaterials();
  const killsByStage = new Map<string, number>();
  for (const batch of HOUR_BATCHES) {
    killsByStage.set(
      batch.stage.id,
      (killsByStage.get(batch.stage.id) ?? 0) + batch.kills,
    );
  }
  for (const [stageId, kills] of killsByStage) {
    const stage = STAGES[stageId]!;
    addDrops(totals, expectedLoot(requireLootTable(stage.lootTableId), kills, 'swordsman'));
  }
  return totals;
}

const FIXED_FIRST_CLEAR_SUPPLY = firstClearEnhanceSupply();
const EXPECTED_NORMAL_SUPPLY = expectedNormalEnhanceSupply();

interface EnhanceConsumption {
  materials: MaterialTotals;
  attempts: number;
}

function simulateEnhanceConsumption(seed: number): EnhanceConsumption {
  const rng = new Rng(seed);
  const materials = emptyMaterials();
  let attempts = 0;
  for (const slot of SLOT_ORDER) {
    const equipment = requireEquipment(`eq_r7_${slot}_epic`);
    const target = 15;
    const luckByTarget: Record<string, number> = {};
    let level = 0;
    let guard = 0;
    while (level < target) {
      if (guard++ > 20_000) throw new Error(`[R7 simulation] enhance stalled: ${slot}`);
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
      if (result.protectionConsumed) materials[ENHANCE_MATERIAL_IDS.protection]++;
      if (result.nextLuck !== null) luckByTarget[String(targetLevel)] = result.nextLuck;
      if (result.nextLevel === null) {
        throw new Error('[R7 simulation] protected enhancement shattered');
      }
      level = result.nextLevel;
    }
  }
  return { materials, attempts };
}

interface SampleResult {
  completionDay: number;
  firstLegendaryDay: number;
  sourceFragments: Record<string, number>;
  fragmentDropEvents: number;
  fragmentPityEvents: number;
  legendaryDropEvents: number;
  legendaryPityEvents: number;
  enhanceSupply: MaterialTotals;
  enhanceConsumption: MaterialTotals;
  enhanceAttempts: number;
}

const LEGENDARY_IDS = SLOT_ORDER.map((slot) => `eq_r7_${slot}_legendary`);

function runSample(index: number): SampleResult {
  const rng = new Rng((SAMPLE_SEED + index * 0x9e37) >>> 0);
  const pity: PityCounters = {};
  const sourceFragments = Object.fromEntries(
    REGION_7_FRAGMENT_LOOT_SOURCES.map((source) => [source.monsterId, 0]),
  );
  const enhanceSupply = { ...FIXED_FIRST_CLEAR_SUPPLY };
  for (const id of ENHANCE_IDS) enhanceSupply[id] += EXPECTED_NORMAL_SUPPLY[id];

  let fragments = 0;
  let completionDay = Number.POSITIVE_INFINITY;
  let firstLegendaryDay = Number.POSITIVE_INFINITY;
  let fragmentDropEvents = 0;
  let fragmentPityEvents = 0;
  let legendaryDropEvents = 0;
  let legendaryPityEvents = 0;

  for (const batch of HOUR_BATCHES) {
    for (const source of REGION_7_FRAGMENT_LOOT_SOURCES) {
      const count = batch.sourceKillCounts[source.monsterId] ?? 0;
      if (count <= 0) continue;
      const table = requireLootTable(source.lootTableId);
      for (let kill = 0; kill < count; kill++) {
        const fragmentPityKey = `${table.id}:${REGION_7_FRAGMENT_ID}`;
        const fragmentWasForced =
          (pity[fragmentPityKey] ?? 0) >= (source.entry.pityCount ?? Infinity);
        const group = table.pityGroups?.[0];
        const legendaryWasForced =
          group !== undefined &&
          (pity[pityGroupKey(table.id, group.id)] ?? 0) >= group.pityCount;
        const drops = rollLoot(table, rng, pity, 'swordsman');
        const fragmentDrop =
          drops.find((drop) => drop.itemId === REGION_7_FRAGMENT_ID)?.count ?? 0;
        if (fragmentDrop > 0 && !Number.isFinite(completionDay)) {
          const credited = Math.min(fragmentDrop, FRAGMENT_TARGET - fragments);
          fragments += fragmentDrop;
          sourceFragments[source.monsterId] += credited;
          fragmentDropEvents++;
          if (fragmentWasForced) fragmentPityEvents++;
          if (fragments >= FRAGMENT_TARGET) completionDay = batch.effectiveDay;
        }
        if (drops.some((drop) => LEGENDARY_IDS.includes(drop.itemId))) {
          legendaryDropEvents++;
          if (legendaryWasForced) legendaryPityEvents++;
          if (!Number.isFinite(firstLegendaryDay)) firstLegendaryDay = batch.effectiveDay;
        }
        addDrops(enhanceSupply, drops);
      }
    }
  }

  const consumption = simulateEnhanceConsumption(
    (SAMPLE_SEED ^ 0xa5a5_5a5a ^ index) >>> 0,
  );
  return {
    completionDay,
    firstLegendaryDay,
    sourceFragments,
    fragmentDropEvents,
    fragmentPityEvents,
    legendaryDropEvents,
    legendaryPityEvents,
    enhanceSupply,
    enhanceConsumption: consumption.materials,
    enhanceAttempts: consumption.attempts,
  };
}

function nearestRank(values: readonly number[], percentile: number): number {
  if (values.length === 0) throw new Error('[R7 simulation] percentile has no samples');
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(percentile * sorted.length) - 1)]!;
}

function finitePercentile(
  samples: readonly SampleResult[],
  select: (sample: SampleResult) => number,
  percentile: number,
  label: string,
): number {
  const values = samples.map(select);
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error(`[R7 simulation] ${label} has unfinished samples after ${MAX_SIM_DAYS} days`);
  }
  return nearestRank(values, percentile);
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function main(): void {
  const startedAt = performance.now();
  const metrics = combatMetrics();
  const samples = Array.from({ length: SAMPLE_SIZE }, (_, index) => runSample(index));
  const fragmentDays = {
    p50: finitePercentile(samples, (sample) => sample.completionDay, 0.5, 'bloodmoon set'),
    p90: finitePercentile(samples, (sample) => sample.completionDay, 0.9, 'bloodmoon set'),
    p95: finitePercentile(samples, (sample) => sample.completionDay, 0.95, 'bloodmoon set'),
  };
  const legendaryDays = {
    p50: finitePercentile(samples, (sample) => sample.firstLegendaryDay, 0.5, 'legendary'),
    p90: finitePercentile(samples, (sample) => sample.firstLegendaryDay, 0.9, 'legendary'),
    p95: finitePercentile(samples, (sample) => sample.firstLegendaryDay, 0.95, 'legendary'),
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
  const enhance = ENHANCE_IDS.map((id) => {
    const p50Supply = nearestRank(samples.map((sample) => sample.enhanceSupply[id]), 0.5);
    const p50Cost = nearestRank(samples.map((sample) => sample.enhanceConsumption[id]), 0.5);
    const p90Cost = nearestRank(samples.map((sample) => sample.enhanceConsumption[id]), 0.9);
    return {
      itemId: id,
      p50Supply: round(p50Supply, 1),
      p50Cost,
      p90Cost,
      medianSupplyRatio: round(p50Supply / p50Cost, 3),
    };
  });
  const sources = REGION_7_FRAGMENT_LOOT_SOURCES.map((source) => {
    const mean = average(
      samples.map((sample) => sample.sourceFragments[source.monsterId] ?? 0),
    );
    return {
      source: source.monsterName,
      monsterId: source.monsterId,
      averageFragments: round(mean, 2),
      averageShare: round(mean / FRAGMENT_TARGET, 4),
    };
  });
  const chapterDivergence = CHAPTER_BUILDS.map((build) => {
    const rows = metrics.filter((metric) => metric.chapterId === build.chapterId);
    const kps = rows.map((row) => row.kps);
    return {
      chapterId: build.chapterId,
      minKps: round(Math.min(...kps), 4),
      maxKps: round(Math.max(...kps), 4),
      ratio: round(Math.max(...kps) / Math.min(...kps), 4),
    };
  });
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
    combat: metrics.map((metric) => ({
      ...metric,
      ttk: round(metric.ttk),
      kps: round(metric.kps, 4),
    })),
    chapterDivergence,
    sources,
    enhance,
    fixedFirstClearSupply: FIXED_FIRST_CLEAR_SUPPLY,
    expectedNormalSupply: EXPECTED_NORMAL_SUPPLY,
    averageEnhanceAttempts: round(
      average(samples.map((sample) => sample.enhanceAttempts)),
      2,
    ),
    elapsedMs: Math.round(performance.now() - startedAt),
  };

  console.log('\n[R7 血月峡谷模拟]\n');
  console.table(summary.combat);
  console.table([
    { target: `${FRAGMENT_TARGET} 血月碎片`, ...fragmentDays },
    { target: 'R7 普通传说首件', ...legendaryDays },
  ]);
  console.table(sources);
  console.table(enhance);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    resolve(OUT_DIR, 'region7-economy.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );

  const violations: string[] = [];
  for (const metric of metrics) {
    if (metric.ttk < 3.5 || metric.ttk > 6.5) {
      violations.push(`${metric.chapterId}/${metric.classId} TTK ${round(metric.ttk)} 不在 3.5～6.5 秒`);
    }
    if (!(metric.kps > 0 && metric.kps < 3)) {
      violations.push(`${metric.chapterId}/${metric.classId} KPS ${round(metric.kps)} 非法`);
    }
  }
  for (const row of chapterDivergence) {
    if (row.ratio > 1.2) {
      violations.push(`${row.chapterId} 职业 KPS 差异 ${row.ratio} 超过 20%`);
    }
  }
  if (fragmentDays.p50 < 6 || fragmentDays.p50 > 11) {
    violations.push(`血月套 P50 ${round(fragmentDays.p50)} 天不在 6～11 天`);
  }
  if (fragmentDays.p95 > 14) {
    violations.push(`血月套 P95 ${round(fragmentDays.p95)} 天超过 14 天`);
  }
  if (legendaryDays.p95 > 5) {
    violations.push(`普通传说首件 P95 ${round(legendaryDays.p95)} 天超过 5 天`);
  }
  for (const row of enhance) {
    if (row.medianSupplyRatio < 1.02 || row.medianSupplyRatio > 1.35) {
      violations.push(
        `${row.itemId} 中位供需比 ${row.medianSupplyRatio.toFixed(3)} 不在 1.02～1.35`,
      );
    }
  }
  if (violations.length > 0) {
    throw new Error(`R7 经济门禁失败：\n- ${violations.join('\n- ')}`);
  }
  console.log(`✓ R7 经济门禁通过：${resolve(OUT_DIR, 'region7-economy.json')}\n`);
}

main();
