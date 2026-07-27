import type { Stage } from './types';

type BattleVisualStage = Pick<Stage, 'id' | 'waves'>;

export interface AttackPulseStep {
  /** 这次画面需要补播的攻击次数。 */
  hits: number;
  /** 尚不足下一次攻击的剩余时间。 */
  carrySec: number;
}

/**
 * 把连续流逝的时间换算成离散的攻击演出。
 *
 * 挂机收益仍由 idle.ts 结算；这个函数只决定画面何时挥剑、受击和飘字，
 * 因而手机掉帧后也能合并补播，不会让视觉攻速越来越慢。
 */
export function advanceAttackPulse(
  dtSec: number,
  carrySec: number,
  attacksPerSecond: number,
): AttackPulseStep {
  if (!Number.isFinite(dtSec) || dtSec < 0) {
    throw new Error(`[战斗视觉错误] 帧时长必须是非负有限数：${dtSec}`);
  }
  if (!Number.isFinite(carrySec) || carrySec < 0) {
    throw new Error(`[战斗视觉错误] 攻击计时余量必须是非负有限数：${carrySec}`);
  }
  if (!Number.isFinite(attacksPerSecond) || attacksPerSecond <= 0) {
    throw new Error(`[战斗视觉错误] 攻速必须是正有限数：${attacksPerSecond}`);
  }

  const intervalSec = 1 / attacksPerSecond;
  const totalSec = carrySec + dtSec;
  const hits = Math.floor((totalSec + Number.EPSILON) / intervalSec);

  return {
    hits,
    carrySec: Math.max(0, totalSec - hits * intervalSec),
  };
}

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
