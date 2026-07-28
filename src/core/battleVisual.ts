import { combatPressure } from './combat';
import type { Combatant, Stage } from './types';

type BattleVisualStage = Pick<Stage, 'id' | 'waves'>;

export interface BattleVital {
  currentHp: number;
  maxHp: number;
}

export interface BattleVitals {
  player: BattleVital;
  monster: BattleVital;
}

export interface BattleVisualAdvance {
  /** 本批击杀中最后倒下的目标，击杀演出必须绑定它而不是下一只怪。 */
  defeatedTargetId: string;
  /** 本批击杀结算完成后，下一只应展示怪物的循环游标。 */
  nextCursor: number;
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

/**
 * 推进一批击杀对应的视觉游标。
 *
 * 挂机结算可能在一次 tick 内击杀多只怪；动画要落在这批中最后倒下的怪物，
 * 下一帧再切换到 nextCursor，避免旧伤害飘字打到新目标身上。
 */
export function advanceBattleVisualCursor(
  stage: BattleVisualStage,
  cursor: number,
  kills: number,
): BattleVisualAdvance {
  if (!Number.isSafeInteger(cursor) || cursor < 0) {
    throw new Error(`[战斗视觉错误] 怪物游标必须是非负整数：${cursor}`);
  }
  if (!Number.isSafeInteger(kills) || kills <= 0) {
    throw new Error(`[战斗视觉错误] 击杀数必须是正整数：${kills}`);
  }

  const nextAbsoluteCursor = cursor + kills;
  if (!Number.isSafeInteger(nextAbsoluteCursor)) {
    throw new Error(`[战斗视觉错误] 怪物游标推进后超出安全整数范围`);
  }

  const monsterIds = flattenBattleMonsterIds(stage);
  return {
    defeatedTargetId: monsterIds[(nextAbsoluteCursor - 1) % monsterIds.length]!,
    nextCursor: nextAbsoluteCursor % monsterIds.length,
  };
}

/**
 * 把当前遭遇进度投影为双方生命值，专供战斗画面展示。
 *
 * 这是无状态的期望值投影，不修改 Combatant，也不参与金币、经验、掉落或 RNG
 * 结算。怪物生命严格取当前视觉目标；玩家承伤复用真实战斗的期望伤害与击杀耗时，
 * 因而切换普通怪、精英或 BOSS 时会按各自属性重新计算，不会串用代表怪血量。
 */
export function battleVitalsAtProgress(
  player: Combatant,
  monster: Combatant,
  progress: number,
  playerSkillMultiplier = 1,
): BattleVitals {
  assertPositiveHp(player, '玩家');
  assertPositiveHp(monster, '怪物');
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
    throw new Error(`[战斗视觉错误] 遭遇进度必须在 0~1 之间：${progress}`);
  }
  if (!Number.isFinite(playerSkillMultiplier) || playerSkillMultiplier <= 0) {
    throw new Error(`[战斗视觉错误] 玩家技能倍率必须是正有限数：${playerSkillMultiplier}`);
  }

  /*
   * 上限也要取整。
   *
   * stats.hp 是浮点数（装备与成长曲线算出来的），当前生命一直是 Math.ceil，
   * 上限却原样透出 —— 满血时血条会显示成「1355 / 1355.1」，
   * 玩家看到的是「刚出门就掉了一滴血」。
   *
   * 这个函数按注释就是专供画面展示的投影，输出可直接显示的整数才是它的契约；
   * 取整放在这里，血条、读数、aria 值三处自然一致，不必各自再 round 一遍。
   *
   * 用 floor 而不是 round：展示值必须始终不超过真实生命，
   * round 会把 1354.6 抬成 1355，凭空多出半点血 ——
   * 「展示生命不得超过实际生命」这条不变量本就有测试守着。
   */
  const playerMaxHp = Math.max(1, Math.floor(player.stats.hp));
  const monsterMaxHp = Math.max(1, Math.floor(monster.stats.hp));
  const pressure = combatPressure(player, monster, playerSkillMultiplier);
  const incomingDamage = progress === 0 ? 0 : pressure.damagePerFight * progress;
  const playerCurrentHp = Number.isFinite(incomingDamage)
    ? Math.min(playerMaxHp, Math.max(0, Math.ceil(playerMaxHp - incomingDamage)))
    : 0;
  const monsterCurrentHp = Math.max(0, Math.ceil(monsterMaxHp * (1 - progress)));

  return {
    player: { currentHp: playerCurrentHp, maxHp: playerMaxHp },
    monster: { currentHp: monsterCurrentHp, maxHp: monsterMaxHp },
  };
}

function assertPositiveHp(combatant: Combatant, label: string): void {
  if (!Number.isFinite(combatant.stats.hp) || combatant.stats.hp <= 0) {
    throw new Error(`[战斗视觉错误] ${label}最大生命必须是正有限数：${combatant.stats.hp}`);
  }
}
