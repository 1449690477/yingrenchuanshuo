/**
 * 成长曲线：等级、经验、职业基础属性、怪物强度。
 * 全部定义见 docs/10-数值与战斗.md 第二节 2.3。
 */

import type {
  ClassId,
  CombatBonuses,
  Combatant,
  Element,
  MonsterDef,
  MonsterType,
  Stats,
} from './types';
import {
  ACC_PER_LEVEL,
  AVG_SKILL_MULTIPLIERS,
  CLASS_ATK_MUL,
  CLASS_BASE_STATS,
  CLASS_GROWTH,
  EVA_PER_LEVEL,
  EXP_BASE,
  LEVEL_SOFT_CAP_MARGIN,
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

/**
 * 等级软上限（docs/56 §2）：等级追内容，不许反超。
 *
 * @param highestReachableStageLevel 玩家当前**可进入**的最高关卡的等级
 *   （不是已通关的 —— 卡在某关时，那一关本身就是他在打的内容）
 */
export function levelSoftCap(highestReachableStageLevel: number): number {
  if (!Number.isInteger(highestReachableStageLevel) || highestReachableStageLevel < 1) {
    throw new Error(`levelSoftCap: 关卡等级必须是正整数，收到 ${highestReachableStageLevel}`);
  }
  return highestReachableStageLevel + LEVEL_SOFT_CAP_MARGIN;
}

export interface LevelSettleResult {
  level: number;
  exp: number;
  /** 本次结算实际升了几级 */
  levelsGained: number;
}

/**
 * 带软上限的升级结算。
 *
 * - 到达上限后停止升级，**经验原样保留在 exp 里继续累积** ——
 *   解锁新章节使上限上移后，下一次结算会把囤积的经验一口气释放
 * - 老存档等级可能已经高于上限（历史无上限时期升上去的）：
 *   **原样保留，绝不回收**（docs/40 红线：不得没收已得之物），只是不再继续升
 */
export function settleLevelUps(level: number, exp: number, softCap: number): LevelSettleResult {
  if (!Number.isInteger(level) || level < 1) {
    throw new Error(`settleLevelUps: 等级必须是正整数，收到 ${level}`);
  }
  if (!Number.isFinite(exp) || exp < 0) {
    throw new Error(`settleLevelUps: 经验必须是非负数，收到 ${exp}`);
  }
  let l = level;
  let e = exp;
  let guard = 0;
  while (l < softCap && e >= expToNext(l) && guard++ < 500) {
    e -= expToNext(l);
    l++;
  }
  return { level: l, exp: e, levelsGained: l - level };
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

/**
 * 玩家在该等级「应有装备」带来的战力倍数。
 *
 * ## 为什么怪物血量必须乘这一项
 *
 * ADR-005 当年把怪物血量指数（L^1.45）对齐到装备指数（ITEM_POW = L^1.35），
 * 结论是「只比装备快 0.1，用这点差值制造卡点」。
 * **但它漏了一项**：装备战力还要再乘 QUALITY_MUL，而品质从普通的 1.0
 * 一路涨到神圣的 15.0 —— 这一整段增长怪物完全没有跟上。
 *
 * 后果是实测 TTK 从 Lv10 的 7.9 秒一路掉到 Lv120 的 0.41 秒：
 * 前期嫌慢、后期一秒好几只，全程只有 Lv20 附近落在 5±1.5 秒的目标带里。
 *
 * ## 为什么用插值而不是查表
 *
 * 直接取 QUALITY_MUL[该等级典型品质] 会在品质切换点造成难度断崖 ——
 * 玩家刚换上史诗装，怪物血量同一帧翻倍，体感是「装备白换了」。
 * 这里按等级对品质倍率做线性插值，难度平滑爬升。
 *
 * 锚点取自模拟器的 typicalQuality 分档中值；末尾的 (0.5 + L/400)
 * 来自实测「所需血量 ÷ 品质倍率」这一比值，它从 0.52 缓慢升到 0.82。
 *
 * ⚠ 改这里必然改变全部关卡难度与产出，必须跑 npm run sim 复验
 * 30 天成长曲线、材料收支与四职业偏离。
 */
const EXPECTED_GEAR_ANCHORS: readonly (readonly [number, number])[] = [
  [1, 1.0],
  [8, 1.0],
  [20, 1.5],
  [32, 2.3],
  [52, 3.6],
  // 史诗档要持有到 64 级再爬向传说：52→77 直接插值会在 Lv60 附近鼓出一个
  // 6.7 秒的包，那一段玩家其实还穿着史诗，怪物血量不该提前按传说算。
  [62, 3.6],
  // Lv65 是玩家换上传说装的临界点，战力一次性跳一档；
  // 血量必须在同一级跟着抬，否则那一级会掉到 3.2 秒（低于 3.5 秒下限）。
  [65, 4.9],
  [77, 5.8],
  [100, 9.2],
  [120, 15.0],
];

export function expectedGearFactor(level: number): number {
  const lv = Math.max(1, level);
  let qualityMul = EXPECTED_GEAR_ANCHORS[EXPECTED_GEAR_ANCHORS.length - 1]![1];
  for (let i = 0; i < EXPECTED_GEAR_ANCHORS.length - 1; i++) {
    const [l0, q0] = EXPECTED_GEAR_ANCHORS[i]!;
    const [l1, q1] = EXPECTED_GEAR_ANCHORS[i + 1]!;
    if (lv <= l1) {
      const t = l1 === l0 ? 0 : (lv - l0) / (l1 - l0);
      qualityMul = q0 + (q1 - q0) * t;
      break;
    }
  }
  // 标定系数按 npm run sim 的装备模型反推，而不是「满强化满词条」的理想模型 ——
  // 模拟器用的是新掉落品阶、无强化，实际战力更低，按理想模型标定会整体过校。
  return qualityMul * (0.33 + lv / 600);
}

export function monsterHp(level: number, type: MonsterType = 'normal', mul = 1): number {
  return Math.round(
    MONSTER_HP_BASE *
      Math.pow(level, MONSTER_HP_POW) *
      expectedGearFactor(level) *
      MONSTER_TYPE_MUL[type].hp *
      mul,
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
  combatBonuses?: CombatBonuses,
): Combatant {
  return {
    name,
    level,
    element,
    stats,
    currentHp: stats.hp,
    ...(combatBonuses ? { combatBonuses } : {}),
  };
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
