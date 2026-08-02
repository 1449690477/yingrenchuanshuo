/*
 * 【小账·标定支援 · 一次性诊断脚本，不进 verify、不进 main】
 *
 * d5 血量轴一维扫描：DEPTH_TARGET_MULTIPLIER[4] ∈ 候选集，
 * 对每个值复算全部开放档位的 d5 格（玩家模型/RNG 种子/挑战路径
 * 与 scripts/equipment-dungeon-balance.mts 的深度门禁一字不差），
 * 输出「胜率 ≤35% 且胜局均时 ≤67.5s」的可行区间。
 *
 * 数学上 DEPTH_TARGET_MULTIPLIER[4] 只影响 d5（k 按层查表），d4 不动。
 * 运行时原位改写数组即可扫描，不改任何被占用文件。
 */
import { CLASS_IDS, type ClassId, type EquipmentDef, type EquipmentInstance } from '../src/core/types';
import { addStats, combatPower } from '../src/core/formula';
import { createInstance, totalEquipStats } from '../src/core/equipment';
import { applyEquipmentSetStats, resolveEquipmentSetBonuses } from '../src/core/equipmentSets';
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
import { DEPTH_TARGET_MULTIPLIER } from '../src/data/equipmentDungeonDepthRules';
import { blankDefinitionId, depthNominalLevel, isDepthOpen } from '../src/core/equipmentDungeonDepth';
import { ALL_CHAPTERS } from '../src/data/regions';
import { EQUIPMENT, requireEquipment } from '../src/data/equipment';
import { EQUIPMENT_DUNGEON_STAGE_LIST } from '../src/data/equipmentDungeons';
import { EQUIPMENT_DUNGEON_TIERS, type EquipmentDungeonTierId } from '../src/data/equipmentDungeonGear';
import { getEquipmentSet } from '../src/data/equipmentSets';

const CONTENT_TOP_LEVEL = Math.max(...ALL_CHAPTERS.map((chapter) => chapter.levelTo));
const NOW = Date.parse('2026-07-28T12:00:00+08:00');
const RUNS = 120;
const TYPICAL_ENHANCE = 9;
const DEPTH = 5;
const WIN_MAX = 0.35;
const DURATION_MAX = 67.5;

function entryDefinitions(
  tierId: EquipmentDungeonTierId,
  atLevel = depthNominalLevel(tierId, 1),
): EquipmentDef[] {
  return SLOT_ORDER.map((slot) => requireEquipment(blankDefinitionId(slot, atLevel)));
}

function entryInstances(
  tierId: EquipmentDungeonTierId,
  classId: ClassId,
  atLevel = depthNominalLevel(tierId, 1),
): EquipmentInstance[] {
  const rng = new Rng(90_000 + CLASS_IDS.indexOf(classId) * 997);
  const enhance = TYPICAL_ENHANCE;
  return entryDefinitions(tierId, atLevel).map((definition, index) => {
    const instance = createInstance(definition, rng, `balance-${tierId}-${classId}-${index}`, classId);
    instance.enhance = enhance;
    instance.enhanceGainPermille = instance.enhanceGainPermille.map((_, gainIndex) =>
      gainIndex < enhance ? 80 : 0,
    );
    return instance;
  });
}

function playerFor(tierId: EquipmentDungeonTierId, classId: ClassId, atLevel = depthNominalLevel(tierId, 1)) {
  const equipment = entryInstances(tierId, classId, atLevel);
  const setResolution = resolveEquipmentSetBonuses(equipment, (id) => EQUIPMENT[id], getEquipmentSet);
  const stats = applyClassMods(
    classId,
    applyEquipmentSetStats(
      addStats(baseStatsFor(classId, atLevel), totalEquipStats(equipment, (id) => EQUIPMENT[id], classId)),
      setResolution,
    ),
  );
  return {
    combatant: makePlayer(classId, atLevel, stats),
    cp: combatPower(stats),
    skillMultiplier: averageSkillMultiplier(atLevel) + setResolution.skillMultiplierBonus,
  };
}

const SCAN = [3.0, 2.8, 2.6, 2.4, 2.2, 2.0];
const baseline = DEPTH_TARGET_MULTIPLIER[DEPTH - 1];
console.log(`d5 血量轴扫描 · 当前基线 DEPTH_TARGET_MULTIPLIER[4]=${baseline}`);
console.log(`门禁口径：胜率 ≤${WIN_MAX * 100}%、胜局均时 ≤${DURATION_MAX}s（wins>0 才判）\n`);

for (const target of SCAN) {
  (DEPTH_TARGET_MULTIPLIER as unknown as number[])[DEPTH - 1] = target;
  console.log(`── d5 目标倍率 ${target.toFixed(1)} ──`);
  let allOk = true;
  for (const tier of EQUIPMENT_DUNGEON_TIERS) {
    if (!isDepthOpen(tier.id, DEPTH)) continue;
    for (const classId of CLASS_IDS) {
      const player = playerFor(tier.id, classId);
      let wins = 0;
      let totalDurationMs = 0;
      for (const stage of EQUIPMENT_DUNGEON_STAGE_LIST.filter((c) => c.tierId === tier.id)) {
        for (let run = 0; run < RUNS; run += 1) {
          const state = createEquipmentDungeonState(NOW);
          state.depth = { [tier.id]: DEPTH - 1 };
          const result = resolveEquipmentDungeonChallenge({
            stage,
            depth: DEPTH,
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
            totalDurationMs += result.durationMs;
          }
        }
      }
      const totalRuns = RUNS * SLOT_ORDER.length;
      const winRate = wins / totalRuns;
      const avg = wins > 0 ? totalDurationMs / wins / 1e3 : NaN;
      const rateBad = winRate > WIN_MAX;
      const timeBad = wins > 0 && avg > DURATION_MAX;
      if (rateBad || timeBad) allOk = false;
      console.log(
        [
          `  ${tier.id.padEnd(7)}`,
          classId.padEnd(9),
          `胜率 ${(winRate * 100).toFixed(1).padStart(5)}% (${wins}/${totalRuns})`,
          `均时 ${Number.isNaN(avg) ? '  —  ' : avg.toFixed(1) + 's'}`,
          rateBad ? '↑破35%' : '',
          timeBad ? '⏱超67.5' : '',
        ].join(' | '),
      );
    }
  }
  console.log(allOk ? `  ✅ ${target.toFixed(1)}：d5 全格达标` : `  ❌ ${target.toFixed(1)}：仍有越界格`);
}
(DEPTH_TARGET_MULTIPLIER as unknown as number[])[DEPTH - 1] = baseline;
