import { computed } from 'vue';
import { defineStore } from 'pinia';
import {
  evaluateAchievements,
  type AchievementEvaluation,
  type AchievementInput,
} from '@/core/achievements';
import { STAGES } from '@/data/stages';
import { getEquipment } from '@/data/equipment';
import { useGameStore } from './game';

function zeroInput(): AchievementInput {
  return {
    totalKills: 0,
    bossKillKinds: 0,
    bossKills: 0,
    level: 0,
    cp: 0,
    gold: 0,
    equipmentCodexCount: 0,
    monsterCodexCount: 0,
    epicCount: 0,
    legendaryCount: 0,
    totalCodexCount: 0,
    clearedChapterCount: 0,
    clearedStageCount: 0,
    enhanceCount: 0,
    reforgeCount: 0,
    sweepCount: 0,
    affectionCount: 0,
    arenaCount: 0,
    dungeonCount: 0,
  };
}

/**
 * 从 game store 装配成就统计快照（成就与称号共用）。
 * 计数类（enhanceCount 等）待 v27 stats 字段接入后改为读存档。
 */
export function buildAchievementInput(
  game: ReturnType<typeof useGameStore>,
): AchievementInput {
  const save = game.save;
  if (!save) return zeroInput();

  const chapters = new Set<string>();
  for (const stageId of save.progress.clearedStageIds) {
    const stage = STAGES[stageId];
    if (stage) chapters.add(stage.chapterId);
  }

  let epicCount = 0;
  let legendaryCount = 0;
  for (const defId of save.equipmentCodex.discoveredDefIds) {
    const definition = getEquipment(defId);
    if (!definition) continue;
    if (definition.quality === 'epic') epicCount += 1;
    if (definition.quality === 'legendary') legendaryCount += 1;
  }

  const monsterCodexCount = save.monsterCodex.discoveredMonsterIds.length;
  const equipmentCodexCount = save.equipmentCodex.discoveredDefIds.length;

  return {
    totalKills: save.stats.totalKills,
    bossKillKinds: Object.keys(save.stats.bossKills).filter(
      (id) => (save.stats.bossKills[id] ?? 0) > 0,
    ).length,
    bossKills: Object.values(save.stats.bossKills).reduce((sum, count) => sum + count, 0),
    level: save.player.level,
    cp: game.cp,
    gold: save.player.gold,
    equipmentCodexCount,
    monsterCodexCount,
    epicCount,
    legendaryCount,
    totalCodexCount: equipmentCodexCount + monsterCodexCount,
    clearedChapterCount: chapters.size,
    clearedStageCount: save.progress.clearedStageIds.length,
    enhanceCount: 0,
    reforgeCount: 0,
    sweepCount: 0,
    affectionCount: 0,
    arenaCount: 0,
    dungeonCount: 0,
  };
}

/** M4-7 成就聚合：从存档快照装配派生数据 → core 纯函数评估（计数类待 v27 stats 字段）。 */
export const useAchievementStore = defineStore('achievements', () => {
  const game = useGameStore();

  const evaluation = computed<AchievementEvaluation>(() =>
    evaluateAchievements(buildAchievementInput(game)),
  );

  return { evaluation };
});
