/**
 * 成就 / 称号统计快照装配（纯函数，成就与称号共用）。
 *
 * 从存档快照 + 战力派生各统计口径的当前值，供 evaluateAchievements /
 * evaluateUnlockedTitles 使用。计数类（enhanceCount 等）待 v27 stats 字段接入。
 */
import { STAGES } from '@/data/stages';
import { getEquipment } from '@/data/equipment';
import type { AchievementInput } from './achievements';

/** 装配所需的存档子集（结构类型，SaveData 天然兼容；core 不反向依赖 save 层）。 */
export interface AchievementSnapshotSource {
  player: { level: number; gold: number };
  stats: { totalKills: number; bossKills: Record<string, number> };
  progress: { clearedStageIds: string[] };
  equipmentCodex: { discoveredDefIds: string[] };
  monsterCodex: { discoveredMonsterIds: string[] };
}

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

export function buildAchievementInput(save: AchievementSnapshotSource, cp: number): AchievementInput {
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
    cp,
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

export { zeroInput as createAchievementInput };
