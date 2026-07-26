/**
 * 成长曲线：等级、经验、职业基础属性、怪物强度。
 * 全部定义见 docs/10-数值与战斗.md 第二节 2.3。
 */

import type { ClassId, Combatant, Element, MonsterDef, MonsterType, Stats } from './types';
import {
  ACC_PER_LEVEL,
  AVG_SKILL_MULTIPLIERS,
  CLASS_ATK_MUL,
  CLASS_BASE_STATS,
  CLASS_GROWTH,
  EVA_PER_LEVEL,
  EXP_BASE,
  EXP_POW,
  MONSTER_ACC_BASE,
  MONSTER_ACC_PER_LEVEL,
  MONSTER_ATK_BASE,
  MONSTER_ATK_POW,
  MONSTER_BASE_CRIT_DMG,
  MONSTER_CRIT_RATE,
  MONSTER_DEF_BASE,
  MONSTER_DEF_POW,
  MONSTER_DEF_TYPE_MUL,
  MONSTER_EVA_PER_LEVEL,
  MONSTER_EXP_BASE,
  MONSTER_EXP_POW,
  MONSTER_GOLD_BASE,
  MONSTER_GOLD_POW,
  MONSTER_HP_BASE,
  MONSTER_HP_POW,
  MONSTER_SPEED,
  MONSTER_TYPE_MUL,
  STAMINA_CAPS,
} from '@/data/constants';

// ─────────────────────── 经验 ───────────────────────

/** 从 L 级升到 L+1 级所需经验 */
export function expToNext(level: number): number {
  if (level < 1) throw new Error(`expToNext: 等级必须 >= 1，收到 ${level}`);
  return Math.round(EXP_BASE * Math.pow(level, EXP_POW));
}

/** 从 1 级累计到 L 级所需的总经验 */
export function totalExpTo(level: number): number {
  let sum = 0;
  for (let l = 1; l < level; l++) sum += expToNext(l);
  return sum;
}

// ─────────────────────── 玩家属性 ───────────────────────

/**
 * 职业在某等级的裸属性（不含装备、技能、宠物等）。
 * 等级只提供约 20% 的最终战力，大头在装备 —— 这是传奇的味道。
 */
export function baseStatsFor(classId: ClassId, level: number): Stats {
  if (level < 1) throw new Error(`baseStatsFor: 等级必须 >= 1，收到 ${level}`);

  const base = CLASS_BASE_STATS[classId];
  const growth = CLASS_GROWTH[classId];
  const n = level - 1;

  return {
    atk: base.atk + growth.atk * n,
    def: base.def + growth.def * n,
    hp: base.hp + growth.hp * n,
    acc: base.acc + ACC_PER_LEVEL * n,
    eva: base.eva + EVA_PER_LEVEL * n,
    critRate: base.critRate,
    critDmg: base.critDmg,
    spd: base.spd,
  };
}

// ─────────────────────── 怪物强度 ───────────────────────

export function monsterHp(level: number, type: MonsterType = 'normal', mul = 1): number {
  return Math.round(
    MONSTER_HP_BASE * Math.pow(level, MONSTER_HP_POW) * MONSTER_TYPE_MUL[type].hp * mul,
  );
}

export function monsterAtk(level: number, type: MonsterType = 'normal', mul = 1): number {
  return Math.round(
    MONSTER_ATK_BASE * Math.pow(level, MONSTER_ATK_POW) * MONSTER_TYPE_MUL[type].atk * mul,
  );
}

export function monsterExp(level: number, type: MonsterType = 'normal', mul = 1): number {
  return Math.round(
    MONSTER_EXP_BASE * Math.pow(level, MONSTER_EXP_POW) * MONSTER_TYPE_MUL[type].exp * mul,
  );
}

export function monsterGold(level: number, type: MonsterType = 'normal', mul = 1): number {
  return Math.round(
    MONSTER_GOLD_BASE * Math.pow(level, MONSTER_GOLD_POW) * MONSTER_TYPE_MUL[type].exp * mul,
  );
}

/**
 * 怪物防御。传奇的怪普遍防御偏低，主要靠血量堆强度，
 * 这样玩家的攻击力成长能有明确体感。
 */
export function monsterDef(level: number, type: MonsterType = 'normal'): number {
  return Math.round(
    MONSTER_DEF_BASE * Math.pow(level, MONSTER_DEF_POW) * MONSTER_DEF_TYPE_MUL[type],
  );
}

/** 把配置表里的 MonsterDef 实例化成可参战的 Combatant */
export function makeMonster(def: MonsterDef): Combatant {
  const hp = monsterHp(def.level, def.type, def.hpMul ?? 1);
  return {
    name: def.name,
    level: def.level,
    element: def.element,
    currentHp: hp,
    stats: {
      atk: monsterAtk(def.level, def.type, def.atkMul ?? 1),
      def: monsterDef(def.level, def.type),
      hp,
      acc: Math.round(MONSTER_ACC_BASE + def.level * MONSTER_ACC_PER_LEVEL),
      eva: Math.round(def.level * MONSTER_EVA_PER_LEVEL),
      critRate: MONSTER_CRIT_RATE[def.type],
      critDmg: MONSTER_BASE_CRIT_DMG,
      spd: MONSTER_SPEED[def.type],
    },
  };
}

/**
 * 应用职业攻击系数。
 *
 * 必须在「裸属性 + 装备」全部累加完之后调用，不能只作用于裸属性 ——
 * 装备是职业通用的，只改裸属性的话职业差异会被装备冲淡。
 * 详见 CLASS_ATK_MUL 的注释。
 */
export function applyClassMods(classId: ClassId, stats: Stats): Stats {
  return { ...stats, atk: stats.atk * CLASS_ATK_MUL[classId] };
}

/** 把玩家属性包装成可参战的 Combatant */
export function makePlayer(
  name: string,
  level: number,
  stats: Stats,
  element: Element = 'none',
): Combatant {
  return { name, level, element, stats, currentHp: stats.hp };
}

/** M2 的平均技能倍率；M3-4 会替换成玩家实际技能栏计算。 */
export function averageSkillMultiplier(level: number): number {
  if (level < 1) throw new Error(`averageSkillMultiplier: 等级必须 >= 1，收到 ${level}`);
  return AVG_SKILL_MULTIPLIERS.find((entry) => level >= entry.minLevel)!.multiplier;
}

export function staminaMaxForLevel(level: number): number {
  if (level < 1) throw new Error(`staminaMaxForLevel: 等级必须 >= 1，收到 ${level}`);
  return STAMINA_CAPS.find((entry) => level >= entry.minLevel)!.max;
}
