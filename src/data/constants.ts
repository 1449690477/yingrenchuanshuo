/**
 * 全部数值曲线参数。
 *
 * 这是调平衡的唯一入口 —— 见 docs/10-数值与战斗.md 第五节「平衡调参手册」。
 * 改这里的任何数字，都必须：
 *   1. 跑 npm run sim 看 30 天成长曲线
 *   2. 在 docs/32-决策记录.md 记一条
 */

import type { ClassId, MonsterType, Quality, EquipSlot, Element, Stats } from '@/core/types';

// ─────────────────────── 伤害与战力 ───────────────────────

/** 减伤公式的分母系数：def = K_DEF × 等级 时减伤 50% */
export const K_DEF = 50;

/** 命中率公式：clamp(BASE + (acc-eva)/DIVISOR, MIN, MAX) */
export const HIT_BASE = 0.75;
export const HIT_DIVISOR = 800;
export const HIT_MIN = 0.55;
export const HIT_MAX = 1.0;

/** 暴击基础倍率。实际倍率 = CRIT_BASE + critDmg/100 */
export const CRIT_BASE = 1.5;

/** 伤害浮动区间 */
export const DAMAGE_VARIANCE_MIN = 0.92;
export const DAMAGE_VARIANCE_MAX = 1.08;

/** 保底伤害系数：最终伤害不低于 atk × 此值 */
export const MIN_DAMAGE_RATIO = 0.05;

/** 属性克制系数 */
export const ELEM_ADVANTAGE = 1.25;
export const ELEM_DISADVANTAGE = 0.85;
export const ELEM_NEUTRAL = 1.0;

/** 战力权重 */
export const CP_WEIGHTS: Record<keyof Stats, number> = {
  atk: 2.0,
  def: 3.0,
  hp: 0.15,
  acc: 1.0,
  eva: 1.2,
  critRate: 250,
  critDmg: 80,
  spd: 1500, // 注意：spd 按 (spd - 1.0) 计入
};

// ─────────────────────── 成长曲线 ───────────────────────

/**
 * 升级经验：EXP_BASE × L^EXP_POW
 *
 * 指数 3.25 是相对 MONSTER_EXP_POW(1.55) 定的，差值 1.7 决定了
 * 「每级需要多少只怪」的增长速度。该值由 npm run sim 反复校准得出：
 * 目标是满级 120 约需 30 天（每天有效挂机 14 小时）。
 */
export const EXP_BASE = 30;
export const EXP_POW = 3.25;

/**
 * 怪物血量：MONSTER_HP_BASE × L^MONSTER_HP_POW
 *
 * ⚠ 指数必须贴近装备的 ITEM_POW(1.35)，见 docs/32-决策记录.md ADR-005。
 * 玩家战力的天花板由装备决定（L^1.35），怪物血量指数若明显高于它，
 * 差距会随等级无限拉大，中后期直接卡死。
 * 这里取 1.45，比装备略快 0.1，用这点差值制造「需要主动突破的卡点」。
 */
export const MONSTER_HP_BASE = 60;
export const MONSTER_HP_POW = 1.45;

/** 怪物攻击。同理贴合玩家生命与防御的成长。 */
export const MONSTER_ATK_BASE = 10;
export const MONSTER_ATK_POW = 1.35;

/** 怪物经验 */
export const MONSTER_EXP_BASE = 20;
export const MONSTER_EXP_POW = 1.55;

/** 怪物金币 */
export const MONSTER_GOLD_BASE = 8;
export const MONSTER_GOLD_POW = 1.4;

/** 怪物类型系数 */
export const MONSTER_TYPE_MUL: Record<MonsterType, { hp: number; atk: number; exp: number }> = {
  normal: { hp: 1.0, atk: 1.0, exp: 1.0 },
  elite: { hp: 6.0, atk: 1.8, exp: 5.0 },
  boss: { hp: 40.0, atk: 3.0, exp: 30.0 },
};

// ─────────────────────── 职业 ───────────────────────

/** 各职业 Lv1 基础属性 */
export const CLASS_BASE_STATS: Record<ClassId, Stats> = {
  swordsman: { atk: 12, def: 8, hp: 200, acc: 85, eva: 5, critRate: 5, critDmg: 50, spd: 1.0 },
  witch: { atk: 18, def: 4, hp: 120, acc: 80, eva: 8, critRate: 8, critDmg: 50, spd: 0.9 },
  shaman: { atk: 10, def: 6, hp: 160, acc: 82, eva: 10, critRate: 6, critDmg: 50, spd: 1.1 },
};

/** 各职业每级成长（线性） */
export const CLASS_GROWTH: Record<ClassId, Pick<Stats, 'atk' | 'def' | 'hp'>> = {
  swordsman: { atk: 2.2, def: 1.8, hp: 45 },
  witch: { atk: 3.4, def: 0.8, hp: 22 },
  shaman: { atk: 1.9, def: 1.3, hp: 33 },
};

/**
 * 职业攻击力总系数（作用于「裸属性 + 装备」之后）。
 *
 * 为什么需要这个：装备是职业通用的，到中后期装备贡献 55%+ 属性，
 * 会把 CLASS_GROWTH 造成的职业差异冲淡到几乎为零，只剩 spd 在起作用，
 * 导致攻速最高的灵巫反而输出最高 —— 和设计意图相反。
 * 用一个百分比系数才能让职业定位在所有等级段都成立。
 *
 * 与 spd 相乘后的单体 DPS 相对值，对应 docs/13 第四节的平衡目标：
 *   剑姬 1.00 × 1.0 = 100%
 *   魔女 1.06 × 0.9 =  95%
 *   灵巫 0.78 × 1.1 =  86%
 */
export const CLASS_ATK_MUL: Record<ClassId, number> = {
  swordsman: 1.0,
  witch: 1.06,
  shaman: 0.78,
};

/** 命中与闪避每级成长（三职业相同） */
export const ACC_PER_LEVEL = 1.5;
export const EVA_PER_LEVEL = 0.8;

// ─────────────────────── 装备 ───────────────────────

/** 装备基准值：ITEM_BASE × L^ITEM_POW */
export const ITEM_BASE = 6;
export const ITEM_POW = 1.35;

/** 量纲调整。想整体增强/削弱装备就改这个数。 */
export const ITEM_SCALE = 0.1;

/** 品质系数 */
export const QUALITY_MUL: Record<Quality, number> = {
  common: 1.0,
  fine: 1.5,
  rare: 2.3,
  epic: 3.6,
  legendary: 5.8,
  mythic: 9.2,
  divine: 15.0,
};

/** 品质对应的随机词条数量 */
export const QUALITY_AFFIX_COUNT: Record<Quality, number> = {
  common: 0,
  fine: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
  divine: 6,
};

/**
 * 部位「数值型」属性权重。这些属性乘以装备基准值（随等级 L^1.35 增长）。
 * 同一部位的权重之和不必为 1。
 *
 * ⚠ 只放绝对数值属性（atk / def / hp / acc / eva）。
 *   百分比属性见下面的 SLOT_PCT_WEIGHTS。
 */
export const SLOT_WEIGHTS: Record<EquipSlot, Partial<Record<keyof Stats, number>>> = {
  weapon: { atk: 2.0 },
  head: { def: 0.7, acc: 0.8, hp: 3.0 },
  body: { def: 1.6, hp: 8.0 },
  necklace: { atk: 1.0 },
  bracelet: { atk: 0.8, acc: 0.6, def: 0.4 },
  ring: { atk: 0.7 },
  belt: { def: 1.0, hp: 5.0 },
  shoes: { def: 0.5, eva: 0.8, hp: 2.0 },
};

/**
 * 部位「百分比型」属性权重（单位：百分点）。
 *
 * 这类属性绝不能乘装备基准值 —— 基准值按 L^1.35 增长，
 * 会让 Lv120 一把武器就给出 100%+ 暴击率。
 * 它们只随品质提升，不随等级提升。
 * 这是 ADR-006 的由来。
 */
export const SLOT_PCT_WEIGHTS: Record<EquipSlot, Partial<Record<keyof Stats, number>>> = {
  weapon: { critRate: 1.5 },
  head: {},
  body: {},
  necklace: { critDmg: 8 },
  bracelet: {},
  ring: { critRate: 2.0, critDmg: 6 },
  belt: {},
  shoes: { spd: 0.02 },
};

/** 百分比属性的品质缩放。只与品质挂钩，与等级无关。 */
export const QUALITY_PCT_SCALE: Record<Quality, number> = {
  common: 0,
  fine: 0.5,
  rare: 1.0,
  epic: 1.6,
  legendary: 2.4,
  mythic: 3.4,
  divine: 4.6,
};

/** 暴击率硬上限（百分点），防止暴击流一家独大 */
export const CRIT_RATE_CAP = 75;

// ─────────────────────── 强化 ───────────────────────

/** 每级强化提升装备基础属性的比例 */
export const ENHANCE_PER_LEVEL = 0.08;

export const ENHANCE_MAX = 15;

/** 各强化等级的成功率（索引 = 目标等级） */
export const ENHANCE_RATES: Record<number, number> = {
  1: 1.0,
  2: 1.0,
  3: 1.0,
  4: 1.0,
  5: 1.0,
  6: 0.85,
  7: 0.75,
  8: 0.65,
  9: 0.55,
  10: 0.45,
  11: 0.38,
  12: 0.3,
  13: 0.22,
  14: 0.15,
  15: 0.08,
};

/** 失败后掉一级的起始目标等级 */
export const ENHANCE_DOWNGRADE_FROM = 10;

/** 失败后可能碎裂的起始目标等级 */
export const ENHANCE_BREAK_FROM = 13;

/** 幸运值满值。每次失败累加 ceil(100 / 成功率百分数)，满则必成。 */
export const LUCK_FULL = 100;

// ─────────────────────── 挂机与体力 ───────────────────────

/** 离线时长上限（秒），初始 8 小时 */
export const OFFLINE_CAP_SECONDS = 8 * 3600;

/** 离线效率。1.0 = 不打折，见 docs/10 的设计理由 */
export const OFFLINE_EFFICIENCY = 1.0;

/** 每秒击杀数的全局上限兜底 */
export const DEFAULT_MAX_KILLS_PER_SEC = 3.0;

/** 体力 */
export const STAMINA_BASE_MAX = 120;
export const STAMINA_RECOVER_SECONDS = 300; // 5 分钟 1 点
export const SWEEP_STAMINA_COST = 5;
/** 一次扫荡等同多少秒的挂机产出 */
export const SWEEP_EQUIV_SECONDS = 30 * 60;

// ─────────────────────── 元素克制表 ───────────────────────

/** 炎 → 冰 → 雷 → 炎 */
export const ELEMENT_BEATS: Record<Element, Element | null> = {
  fire: 'ice',
  ice: 'thunder',
  thunder: 'fire',
  none: null,
};
