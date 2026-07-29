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
import { EQUIPMENT, requireEquipment } from '../src/data/equipment';
import {
  EQUIPMENT_DUNGEON_STAGE_LIST,
  requireEquipmentDungeonStage,
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

let failed = false;
for (const tier of EQUIPMENT_DUNGEON_TIERS) {
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
        if (stage.previousStageId) {
          state.records[stage.previousStageId] = {
            clears: 1,
            firstClearedAt: NOW - 1,
            bestDurationMs: 30_000,
          };
        }
        const result = resolveEquipmentDungeonChallenge({
          stage,
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
    const cpRatio = player.cp / requireEquipmentDungeonStage(`equipment_weapon_${tier.id}`).recommendCP;
    console.log(
      [
        tier.id.padEnd(7),
        classId.padEnd(9),
        `胜率 ${(winRate * 100).toFixed(1)}%`,
        `最难 ${worstPortal} ${(worstWins / RUNS * 100).toFixed(1)}%`,
        `胜局均时 ${averageSeconds.toFixed(1)}s`,
        `战力 ${player.cp}`,
        `战力比 ${cpRatio.toFixed(2)}`,
      ].join(' | '),
    );
    if (winRate < 0.72 || worstWins / RUNS < 0.6 || averageSeconds > 70) failed = true;
  }
}

if (failed) {
  throw new Error('装备副本入场套装胜率未达到体验门槛，请调整怪物倍率或推荐战力。');
}
