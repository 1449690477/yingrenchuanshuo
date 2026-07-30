import { CLASS_IDS, type ClassId, type EquipmentDef, type EquipmentInstance } from '../src/core/types';
import { addStats, combatPower } from '../src/core/formula';
import { createInstance, totalEquipStats } from '../src/core/equipment';
import {
  applyEquipmentSetStats,
  resolveEquipmentSetBonuses,
} from '../src/core/equipmentSets';
import { Rng } from '../src/core/rng';
import {
  applyClassMods,
  averageSkillMultiplier,
  baseStatsFor,
  makePlayer,
} from '../src/core/progression';
import {
  createEquipmentDungeonState,
  resolveEquipmentDungeonChallenge,
} from '../src/core/equipmentDungeon';
import { SLOT_ORDER } from '../src/data/constants';
import { DEPTH_PER_TIER } from '../src/data/equipmentDungeonDepthRules';
import { depthRecommendCp, isDepthOpen } from '../src/core/equipmentDungeonDepth';
import { ALL_CHAPTERS } from '../src/data/regions';

const CONTENT_TOP_LEVEL = Math.max(...ALL_CHAPTERS.map((chapter) => chapter.levelTo));
import { EQUIPMENT, requireEquipment } from '../src/data/equipment';
import {
  EQUIPMENT_DUNGEON_STAGE_LIST,
} from '../src/data/equipmentDungeons';
import {
  EQUIPMENT_DUNGEON_TIERS,
  equipmentDungeonGearFor,
  type EquipmentDungeonTierId,
} from '../src/data/equipmentDungeonGear';
import { getEquipmentSet } from '../src/data/equipmentSets';

const NOW = Date.parse('2026-07-28T12:00:00+08:00');
const RUNS = 120;
const enhanceByTier: Readonly<Record<EquipmentDungeonTierId, number>> = {
  azure: 3,
  violet: 5,
  auric: 8,
  crimson: 11,
};

function entryDefinitions(tierId: EquipmentDungeonTierId, classId: ClassId): EquipmentDef[] {
  const index = EQUIPMENT_DUNGEON_TIERS.findIndex((tier) => tier.id === tierId);
  if (index === 0) {
    return SLOT_ORDER.map((slot) =>
      requireEquipment(`eq_r2_${slot}_rare`),
    );
  }
  const previous = EQUIPMENT_DUNGEON_TIERS[index - 1]!;
  return SLOT_ORDER.map((slot) => {
    const candidates = equipmentDungeonGearFor(previous.id, slot, classId);
    const classSpecific = candidates.find((definition) => definition.classId === classId);
    return classSpecific ?? candidates[0]!;
  });
}

function entryInstances(
  tierId: EquipmentDungeonTierId,
  classId: ClassId,
): EquipmentInstance[] {
  const rng = new Rng(90_000 + CLASS_IDS.indexOf(classId) * 997);
  const enhance = enhanceByTier[tierId];
  return entryDefinitions(tierId, classId).map((definition, index) => {
    const instance = createInstance(
      definition,
      rng,
      `balance-${tierId}-${classId}-${index}`,
      classId,
    );
    instance.enhance = enhance;
    instance.enhanceGainPermille = instance.enhanceGainPermille.map((_, gainIndex) =>
      gainIndex < enhance ? 80 : 0,
    );
    return instance;
  });
}

function playerFor(tierId: EquipmentDungeonTierId, classId: ClassId) {
  const tier = EQUIPMENT_DUNGEON_TIERS.find((candidate) => candidate.id === tierId)!;
  const equipment = entryInstances(tierId, classId);
  const setResolution = resolveEquipmentSetBonuses(
    equipment,
    (id) => EQUIPMENT[id],
    getEquipmentSet,
  );
  const stats = applyClassMods(
    classId,
    applyEquipmentSetStats(
      addStats(
        baseStatsFor(classId, tier.level),
        totalEquipStats(equipment, (id) => EQUIPMENT[id], classId),
      ),
      setResolution,
    ),
  );
  return {
    combatant: makePlayer(classId, tier.level, stats),
    cp: combatPower(stats),
    skillMultiplier:
      averageSkillMultiplier(tier.level) + setResolution.skillMultiplierBonus,
  };
}

/*
 * ★ 深度门禁尚未标定，本轮**只报不拦**（docs/66 §八 第7步）。
 *
 * 为什么不是「调松阈值让它变绿」：那是今天反复批的反模式 ——
 * 一条被调到永远能过的门禁等于没有门禁，还额外提供虚假的安全感。
 * 这里保留真实阈值、把违反项**每次运行都大声打印**，只是暂不 exit 1，
 * 并用一个必须有人显式翻转的开关记录「这件事没做完」。
 *
 * 实测现状（本开关为 false 的原因，2026-07-31）：
 *   azure d1 战力比 2.07~2.51、胜率 100%      → 太简单，撞上界
 *   azure d2 战力比 1.42~1.73、胜率 97~99.8%
 *   azure d3 战力比 1.00~1.21、胜率 **0%**    → 悬崖：刚好达标却必死
 *   跨档带宽 2.8~4.3×（目标 ≤1.25×）
 *
 * 悬崖的成因是难度随深度增长快于推荐战力：标称等级上升already 把怪物
 * 血量按 L^1.45 抬了一截，再乘 k(d) 就过头了。标定要动的是
 * DEPTH_ENCOUNTER_BASE 与 DEPTH_DIFFICULTY_K 两组数，属数值口径，
 * 按 docs/65 规则① 归 claude（数值）裁定后我执行。
 *
 * 翻 true 的条件：上面四项全部落进阈值。翻的时候删掉这段注释。
 */
const DEPTH_GATES_CALIBRATED = false;

/** 每档每职业每深度的战力比，供 G-12 的两条带宽门禁使用（docs/66 §6.2）。 */
const ratiosByDepth = new Map<number, { tier: string; classId: string; ratio: number }[]>();

let failed = false;
for (const tier of EQUIPMENT_DUNGEON_TIERS) {
 for (let depth = 1; depth <= DEPTH_PER_TIER; depth += 1) {
  if (!isDepthOpen(tier.id, depth)) continue;
  for (const classId of CLASS_IDS) {
    const player = playerFor(tier.id, classId);
    let wins = 0;
    let totalDurationMs = 0;
    let worstPortal = '';
    let worstWins = RUNS + 1;

    for (const stage of EQUIPMENT_DUNGEON_STAGE_LIST.filter(
      (candidate) => candidate.tierId === tier.id,
    )) {
      let stageWins = 0;
      for (let run = 0; run < RUNS; run += 1) {
        const state = createEquipmentDungeonState(NOW);
        // 深度链：要打第 d 层就得先通过 d-1 层（docs/66）。
        // 旧的 previousStageId 档位链已被它取代。
        if (depth > 1) state.depth = { [tier.id]: depth - 1 };
        const result = resolveEquipmentDungeonChallenge({
          stage,
          depth,
          contentTopLevel: CONTENT_TOP_LEVEL,
          state,
          pity: {},
          player: player.combatant,
          classId,
          playerSkillMultiplier: player.skillMultiplier,
          rngState: 10_000 + run * 73 + stage.id.length * 101,
          now: NOW,
        });
        if (result.ok && result.win) {
          wins += 1;
          stageWins += 1;
          totalDurationMs += result.durationMs;
        }
      }
      if (stageWins < worstWins) {
        worstWins = stageWins;
        worstPortal = stage.slot;
      }
    }

    const totalRuns = RUNS * SLOT_ORDER.length;
    const winRate = wins / totalRuns;
    const averageSeconds = wins > 0 ? totalDurationMs / wins / 1000 : Number.POSITIVE_INFINITY;
    const cpRatio = player.cp / depthRecommendCp(tier.id, depth);
    if (!ratiosByDepth.has(depth)) ratiosByDepth.set(depth, []);
    ratiosByDepth.get(depth)!.push({ tier: tier.id, classId, ratio: cpRatio });
    console.log(
      [
        tier.id.padEnd(7),
        `d${depth}`,
        classId.padEnd(9),
        `胜率 ${(winRate * 100).toFixed(1)}%`,
        `最难 ${worstPortal} ${(worstWins / RUNS * 100).toFixed(1)}%`,
        `胜局均时 ${averageSeconds.toFixed(1)}s`,
        `战力 ${player.cp}`,
        `战力比 ${cpRatio.toFixed(2)}`,
      ].join(' | '),
    );
    // 下界：太难。深度越深允许越低 —— 深层本来就是要够得辛苦的。
    const floor = depth <= 3 ? 0.7 : 0.35;
    if (winRate < floor || averageSeconds > 70) failed = true;
    // ★ G-12 上界：太简单同样要红（docs/66 §6.2）。
    // 旧门禁只有下界，于是赤红解封后四职业 100% 胜率、终局副本是场散步，
    // 退出码照样是 0 ——「没有守卫的地方就没有人发现」。
    const ceiling = depth <= 1 ? 0.95 : depth >= 5 ? 0.6 : 0.9;
    if (winRate > ceiling) {
      console.log(`  ↑ 太简单：d${depth} 胜率 ${(winRate * 100).toFixed(1)}% 超过上限 ${(ceiling * 100).toFixed(0)}%`);
      failed = true;
    }
  }
 }
}

/*
 * ★ G-12 带宽（docs/66 §6.2）：跨档与跨职业**必须分开量**。
 *
 * 合成一条会得到一个假门禁：辉金单档内跨职业实测就已经 1.32×，
 * 若只写一条「跨四档四职业 ≤ 1.35×」等于要求跨档差异压进 0.03× ——
 * 做不到，门禁永远红，最后被人注掉。而一条永远红的门禁比没有门禁更糟。
 *
 * 拆开的第二个好处是红了能立刻归因：
 * 跨档红 → 标称等级或 k(d) 有问题；跨职业红 → 门户系数有问题。
 */
const CROSS_TIER_BANDWIDTH = 1.25;
const CROSS_CLASS_BANDWIDTH = 1.35;
for (const [depth, rows] of [...ratiosByDepth].sort((a, b) => a[0] - b[0])) {
  const byClass = new Map<string, number[]>();
  for (const row of rows) {
    if (!byClass.has(row.classId)) byClass.set(row.classId, []);
    byClass.get(row.classId)!.push(row.ratio);
  }
  for (const [classId, values] of byClass) {
    const spread = Math.max(...values) / Math.min(...values);
    if (values.length > 1 && spread > CROSS_TIER_BANDWIDTH) {
      console.log(`  ✗ d${depth} ${classId} 跨档带宽 ${spread.toFixed(2)}× > ${CROSS_TIER_BANDWIDTH}×`);
      failed = true;
    }
  }

  const byTier = new Map<string, number[]>();
  for (const row of rows) {
    if (!byTier.has(row.tier)) byTier.set(row.tier, []);
    byTier.get(row.tier)!.push(row.ratio);
  }
  for (const [tierId, values] of byTier) {
    const spread = Math.max(...values) / Math.min(...values);
    if (spread > CROSS_CLASS_BANDWIDTH) {
      console.log(`  ✗ d${depth} ${tierId} 跨职业带宽 ${spread.toFixed(2)}× > ${CROSS_CLASS_BANDWIDTH}×`);
      failed = true;
    }
  }
}

if (failed && !DEPTH_GATES_CALIBRATED) {
  console.log('');
  console.log('⚠ 深度门禁有违反项（见上），但 DEPTH_GATES_CALIBRATED=false，本轮只报不拦。');
  console.log('  标定完成后把该常量翻为 true，这些违反项就会真的挡住提交。');
} else if (failed) {
  throw new Error('装备副本深度门禁未通过：胜率越出上下界，或跨档/跨职业带宽超标。');
}
