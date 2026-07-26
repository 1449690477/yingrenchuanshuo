import type { Stage } from './types';

type BattleVisualStage = Pick<Stage, 'id' | 'waves'>;

/**
 * 按波次、配置顺序和数量展开一关的怪物出场顺序。
 *
 * 例：[{ A×2, B×1 }, { Elite×1 }] → [A, A, B, Elite]
 */
export function flattenBattleMonsterIds(stage: BattleVisualStage): string[] {
  if (stage.waves.length === 0) {
    throw new Error(`[配置错误] 关卡没有战斗波次：${stage.id}`);
  }

  const monsterIds: string[] = [];

  stage.waves.forEach((wave, waveIndex) => {
    if (wave.monsters.length === 0) {
      throw new Error(`[配置错误] 关卡存在空波次：${stage.id} 第 ${waveIndex + 1} 波`);
    }

    for (const monster of wave.monsters) {
      if (!monster.id) {
        throw new Error(`[配置错误] 波次怪物缺少 id：${stage.id} 第 ${waveIndex + 1} 波`);
      }
      if (!Number.isSafeInteger(monster.count) || monster.count <= 0) {
        throw new Error(
          `[配置错误] 波次怪物数量必须是正整数：${stage.id} 第 ${waveIndex + 1} 波 ${monster.id}`,
        );
      }

      for (let count = 0; count < monster.count; count++) {
        monsterIds.push(monster.id);
      }
    }
  });

  return monsterIds;
}

/** 按非负整数游标循环取得当前应展示的怪物。 */
export function battleMonsterIdAt(stage: BattleVisualStage, cursor: number): string {
  if (!Number.isSafeInteger(cursor) || cursor < 0) {
    throw new Error(`[战斗视觉错误] 怪物游标必须是非负整数：${cursor}`);
  }

  const monsterIds = flattenBattleMonsterIds(stage);
  return monsterIds[cursor % monsterIds.length]!;
}
