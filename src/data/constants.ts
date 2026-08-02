/**
 * 全部数值曲线参数。
 *
 * 这是调平衡的唯一入口 —— 见 docs/10-数值与战斗.md 第五节「平衡调参手册」。
 * 改这里的任何数字，都必须：
 *   1. 跑 npm run sim 看 30 天成长曲线
 *   2. 在 docs/32-决策记录.md 记一条
 */

import type {
  AffixKey,
  AffixTier,
  ClassId,
  Element,
  EquipSlot,
  ForgeStage,
  MonsterType,
  Quality,
  Stats,
} from '@/core/types';

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

/**
 * 一场战斗承伤不超过最大生命 25% 时，不扣挂机效率。
 * 超额承伤使用 1 / (1 + excess) 软衰减，禁止做死亡或产出归零的硬墙。
 */
export const IDLE_FREE_DAMAGE_RATIO = 0.25;

/** 效率低于 30% 时只提示换图，不停止挂机。 */
export const IDLE_SUSTAIN_HINT_EFFICIENCY = 0.3;

/**
 * 战力公式（docs/73 批 3 P0-4）：已从「固定线性权重求和」重定价为
 * 「真实 DPS × 真实 EHP 的几何平均投影」（combatPowerValue，见 core/formula.ts）。
 * 旧 CP_WEIGHTS（atk2/def3/hp0.15/acc1/eva1.2/critRate250/critDmg80）因固定价
 * 对暴击错价约 40 倍而废弃删除 —— 历史见 ADR-009（攻速仍作为整体乘数）与
 * docs/73 §二 A2/A5。
 */

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
 * M3-4 真实技能接管后，Lv50 新掉落装 TTK 从旧平均倍率口径的约 5.2 秒
 * 上升到 6.7~8.1 秒；基础量因此重标到 40.5，恢复 3.5~6.5 秒手感带。
 */
export const MONSTER_HP_BASE = 40.5;
export const MONSTER_HP_POW = 1.45;

/**
 * 怪物攻击。同理贴合玩家生命与防御的成长。
 *
 * 血量基础从 60 重标到 40.5 时，攻击基础同步乘 60/40.5：战斗缩短约 32%，
 * 但整场承伤压力与 N1 安全边际保持同阶，不把“节奏变快”偷换成“整体变简单”。
 * 若 η 大面积偏低，仍优先复核本常数，不抬玩家生命污染推荐战力。
 */
export const MONSTER_ATK_BASE = 7.26;
export const MONSTER_ATK_POW = 1.35;

/** 怪物经验 */
export const MONSTER_EXP_BASE = 20;
export const MONSTER_EXP_POW = 1.55;

/** 怪物金币 */
export const MONSTER_GOLD_BASE = 8;
export const MONSTER_GOLD_POW = 1.4;

/** 怪物防御与辅助战斗属性 */
export const MONSTER_DEF_BASE = 4;
export const MONSTER_DEF_POW = 1.3;
export const MONSTER_ACC_BASE = 80;
export const MONSTER_ACC_PER_LEVEL = 1.2;
export const MONSTER_EVA_PER_LEVEL = 0.6;
export const MONSTER_BASE_CRIT_DMG = 50;

/** 怪物类型系数 */
export const MONSTER_TYPE_MUL: Record<MonsterType, { hp: number; atk: number; exp: number }> = {
  normal: { hp: 1.0, atk: 1.0, exp: 1.0 },
  elite: { hp: 6.0, atk: 1.8, exp: 5.0 },
  boss: { hp: 40.0, atk: 3.0, exp: 30.0 },
};

export const MONSTER_DEF_TYPE_MUL: Record<MonsterType, number> = {
  normal: 1,
  elite: 1.4,
  boss: 2,
};

export const MONSTER_CRIT_RATE: Record<MonsterType, number> = {
  normal: 2,
  elite: 5,
  boss: 10,
};

export const MONSTER_SPEED: Record<MonsterType, number> = {
  normal: 1,
  elite: 1,
  boss: 1.2,
};

// ─────────────────────── 职业 ───────────────────────

/** 各职业 Lv1 基础属性 */
export const CLASS_BASE_STATS: Record<ClassId, Stats> = {
  swordsman: { atk: 12, def: 8, hp: 200, acc: 85, eva: 5, critRate: 5, critDmg: 50, spd: 1.0 },
  witch: { atk: 18, def: 4, hp: 120, acc: 80, eva: 8, critRate: 8, critDmg: 50, spd: 0.9 },
  shaman: { atk: 10, def: 6, hp: 160, acc: 82, eva: 10, critRate: 6, critDmg: 50, spd: 1.1 },
  catkin: { atk: 13, def: 5, hp: 140, acc: 88, eva: 12, critRate: 10, critDmg: 50, spd: 1.25 },
  kenshi: { atk: 15, def: 6, hp: 127, acc: 87, eva: 9, critRate: 9, critDmg: 50, spd: 1.15 },
};

/** 各职业每级成长（线性） */
export const CLASS_GROWTH: Record<ClassId, Pick<Stats, 'atk' | 'def' | 'hp'>> = {
  swordsman: { atk: 2.2, def: 1.8, hp: 45 },
  witch: { atk: 3.4, def: 0.8, hp: 22 },
  shaman: { atk: 1.9, def: 1.3, hp: 33 },
  catkin: { atk: 2.6, def: 1.0, hp: 28 },
  kenshi: { atk: 2.8, def: 1.1, hp: 31.1 },
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
 *   灵巫 0.86 × 1.1 =  95%
 *   喵喵 0.76 × 1.25 = 95%（再由高暴击与技能多段形成上限）
 *
 * ⚠ 灵巫从 0.78 上调到 0.86，是承伤效率模型（docs/45）上线后的必要修正。
 *
 * 旧模型里挂机产出只看 DPS，灵巫的低攻击由「高血续航」在设定上补偿，
 * 但那份补偿在结算里根本不存在，所以 0.78 尚可接受。
 * 承伤模型上线后情况反转：产出 = 击杀速度 × 承伤效率 η，
 * 而 η = 1/(1 + 每场承伤/生命)，**每场承伤又正比于 TTK**。
 * 灵巫攻击低 → TTK 长 → 挨打次数多 → η 反而是四职业最低，
 * 等于同一个弱点被罚了两次，Lv10 实测偏离 −29.7%（门槛 ±20%）。
 *
 * 治本方案是给灵巫一条真正走 η 的职业减伤（对应它的「续航」定位），
 * 但那需要新的职业级战斗机制；在那之前先用攻击系数把偏离拉回带内。
 */
export const CLASS_ATK_MUL: Record<ClassId, number> = {
  swordsman: 1.0,
  witch: 1.06,
  shaman: 0.86,
  catkin: 0.76,
  kenshi: 0.85,
};

/** 命中与闪避每级成长（全职业相同） */
export const ACC_PER_LEVEL = 1.5;
export const EVA_PER_LEVEL = 0.8;

// ─────────────────────── 装备 ───────────────────────

/** 装备基准值：ITEM_BASE × L^ITEM_POW */
export const ITEM_BASE = 6;
export const ITEM_POW = 1.35;

/** 量纲调整。想整体增强/削弱装备就改这个数。 */
export const ITEM_SCALE = 0.1;

/**
 * 全局品质顺序（由低到高）。
 *
 * 心虹珍藏是好感专属的稀有收藏品质，强于神话但仍不越过最终追求「圣器」。
 * 所有排序、筛选与最高品质判断都应复用这张表。
 */
export const QUALITY_ORDER = [
  'common',
  'fine',
  'rare',
  'epic',
  'legendary',
  'mythic',
  'prismatic',
  'divine',
] as const satisfies readonly Quality[];

export const QUALITY_RANK: Readonly<Record<Quality, number>> = {
  common: 0,
  fine: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
  prismatic: 6,
  divine: 7,
};

/** 品质系数 */
export const QUALITY_MUL: Record<Quality, number> = {
  common: 1.0,
  fine: 1.5,
  rare: 2.3,
  epic: 3.6,
  legendary: 5.8,
  mythic: 9.2,
  prismatic: 11.8,
  divine: 15.0,
};

/** 品质对应的随机词条数量 */
export const QUALITY_AFFIX_COUNT: Record<Quality, number> = {
  common: 1,
  fine: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
  prismatic: 6,
  divine: 6,
};

/**
 * 史诗以上装备固定留给当前职业专属池的槽位数。
 *
 * ⚠ 神话以上曾经是 2 个槽，实测把四职业 TTK 偏离顶到 39%。
 * 当前虽已补齐每职业的输出 / 生存定位，但两个槽仍会把玩家可定向追逐的
 * 同类 T5 极值放大一倍。恢复前必须扩展组合模拟并通过同一真实 KPS 门禁，
 * 不能仅凭池中词条数量解除限制。
 * 补齐后再考虑恢复 2 槽，并重跑 npm run sim 验收。
 */
export const QUALITY_PROFESSION_AFFIX_COUNT: Readonly<Record<Quality, number>> = {
  common: 0,
  fine: 0,
  rare: 0,
  epic: 1,
  legendary: 1,
  mythic: 1,
  prismatic: 1,
  divine: 1,
};

/** 随机词条五档品阶；权重总和固定为 100，系数决定该档相对基准值。 */
export interface AffixTierConfig {
  tier: AffixTier;
  name: string;
  weight: number;
  multiplier: number;
}

export const AFFIX_TIERS: readonly AffixTierConfig[] = [
  { tier: 1, name: '粗糙', weight: 40, multiplier: 0.62 },
  { tier: 2, name: '普通', weight: 27, multiplier: 0.76 },
  { tier: 3, name: '优良', weight: 18, multiplier: 0.88 },
  { tier: 4, name: '卓越', weight: 11, multiplier: 1.1 },
  { tier: 5, name: '极品', weight: 4, multiplier: 1.64 },
];

/**
 * 发布版 v10 的冻结品阶系数。
 *
 * v9 装备使用旧连续区间生成词条，v9→v10 会按这组系数反推品阶，
 * v10→v11 再把 T5 从 1.54 重标到当前 1.64。它既是存档迁移契约，
 * 也是联机硬校验证明“历史值确实能由正式版本产生”的依据；不得随当前
 * 平衡参数一起改动。
 */
export const LEGACY_V10_AFFIX_TIER_MULTIPLIERS: Readonly<Record<AffixTier, number>> = {
  1: 0.62,
  2: 0.76,
  3: 0.88,
  4: 1.1,
  5: 1.54,
};

/** 品阶确定后仅保留 ±3% 微浮动，让品阶而不是小数点承担辨识度。 */
export const AFFIX_VALUE_VARIANCE = 0.03;

/** 属性伤害词条最终可绑定的三种攻击属性；无属性不能成为词条目标。 */
export const AFFIX_ELEMENT_OPTIONS = ['fire', 'ice', 'thunder'] as const satisfies readonly Exclude<
  Element,
  'none'
>[];

export type AffixElement = (typeof AFFIX_ELEMENT_OPTIONS)[number];

/**
 * 元素词条的等级解锁必须晚于或等于真实武器来源。
 *
 * r2 在 Lv16 提供固定炎武器；同级精品 / 装备副本补上冰系，
 * Lv20 精品武器再开放雷系。生成与洗练统一读取本表，禁止各自写死三元素。
 */
export const AFFIX_ELEMENT_UNLOCK_LEVELS = {
  fire: 16,
  ice: 16,
  thunder: 20,
} as const satisfies Readonly<Record<AffixElement, number>>;

/** 返回指定装备等级已经可以生成的元素词条目标，顺序固定且可复现。 */
export function availableAffixElementsAtLevel(level: number): readonly AffixElement[] {
  if (!Number.isInteger(level) || level < 1) {
    throw new Error(`[配置错误] 元素词条解锁等级必须是正整数，收到 ${level}`);
  }
  return AFFIX_ELEMENT_OPTIONS.filter((element) => level >= AFFIX_ELEMENT_UNLOCK_LEVELS[element]);
}

/** 元素词条在尚无可用元素时必须从候选池移除，其他词条不受等级门槛影响。 */
export function isAffixGenerationLevelUnlocked(key: AffixKey, level: number): boolean {
  return (
    (key !== 'elemDmg' && key !== 'wit_elem') || availableAffixElementsAtLevel(level).length > 0
  );
}

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
  prismatic: 4.0,
  divine: 4.6,
};

/** 暴击率硬上限（百分点），防止暴击流一家独大 */
export const CRIT_RATE_CAP = 75;

/**
 * 随机词条池，见 docs/12-装备体系.md「词条池」。
 *
 * scalesWithLevel = true 的词条，数值范围会乘 L^1.3（数值型）；
 * false 的是百分比型，范围固定（同 ADR-006 的道理）。
 */
export interface AffixPoolEntry {
  key: AffixKey;
  min: number;
  max: number;
  weight: number;
  scalesWithLevel: boolean;
  decimals: number;
  label: string;
}

/**
 * 职业槽先决定“输出 / 生存”定位，再在同定位内按权重抽具体词条。
 * 这样职业池里词条数量不同也不会偷偷改变两类定位的总概率。
 */
export type ProfessionAffixRole = 'offense' | 'sustain';

export interface ProfessionAffixPoolEntry extends AffixPoolEntry {
  balanceRole: ProfessionAffixRole;
}

export type AffixRuntimeRule =
  | {
      generation: 'active';
      settlement: 'active';
    }
  | {
      generation: 'deferred';
      settlement: 'deferred';
      milestone: 'M3-4';
      notice: string;
    };

const ACTIVE_AFFIX_RUNTIME = {
  generation: 'active',
  settlement: 'active',
} as const satisfies AffixRuntimeRule;

/**
 * 词条发布状态的唯一配置源。
 *
 * generation 控制新掉落、重铸候选；settlement 控制淬炼、同调等继续投入。
 * 延后词条仍保留在类型与数值池中，专门用于严格读取、迁移和展示旧存档。
 */
export const AFFIX_RUNTIME_RULES = {
  atk: ACTIVE_AFFIX_RUNTIME,
  def: ACTIVE_AFFIX_RUNTIME,
  hp: ACTIVE_AFFIX_RUNTIME,
  acc: ACTIVE_AFFIX_RUNTIME,
  eva: ACTIVE_AFFIX_RUNTIME,
  critRate: ACTIVE_AFFIX_RUNTIME,
  critDmg: ACTIVE_AFFIX_RUNTIME,
  spd: ACTIVE_AFFIX_RUNTIME,
  dmgReduce: ACTIVE_AFFIX_RUNTIME,
  elemDmg: ACTIVE_AFFIX_RUNTIME,
  lifesteal: ACTIVE_AFFIX_RUNTIME,
  skillMul: {
    generation: 'deferred',
    settlement: 'deferred',
    milestone: 'M3-4',
    notice: '待 M3-4 技能结算',
  },
  swd_guard: ACTIVE_AFFIX_RUNTIME,
  swd_heavy: ACTIVE_AFFIX_RUNTIME,
  swd_force: ACTIVE_AFFIX_RUNTIME,
  wit_power: ACTIVE_AFFIX_RUNTIME,
  wit_elem: ACTIVE_AFFIX_RUNTIME,
  wit_veil: ACTIVE_AFFIX_RUNTIME,
  wit_vitality: ACTIVE_AFFIX_RUNTIME,
  sha_vitality: ACTIVE_AFFIX_RUNTIME,
  sha_drain: ACTIVE_AFFIX_RUNTIME,
  sha_ward: ACTIVE_AFFIX_RUNTIME,
  sha_spirit: ACTIVE_AFFIX_RUNTIME,
  sha_ember: ACTIVE_AFFIX_RUNTIME,
  cat_swift: ACTIVE_AFFIX_RUNTIME,
  cat_nimble: ACTIVE_AFFIX_RUNTIME,
  cat_tough: ACTIVE_AFFIX_RUNTIME,
  cat_sharp: ACTIVE_AFFIX_RUNTIME,
  kenshi_iai: ACTIVE_AFFIX_RUNTIME,
  kenshi_blade: ACTIVE_AFFIX_RUNTIME,
  kenshi_honor: ACTIVE_AFFIX_RUNTIME,
  kenshi_bushido: ACTIVE_AFFIX_RUNTIME,
} as const satisfies Readonly<Record<AffixKey, AffixRuntimeRule>>;

export function isAffixGenerationActive(key: AffixKey): boolean {
  return AFFIX_RUNTIME_RULES[key].generation === 'active';
}

export function isAffixSettlementActive(key: AffixKey): boolean {
  return AFFIX_RUNTIME_RULES[key].settlement === 'active';
}

export const AFFIX_POOL: AffixPoolEntry[] = [
  {
    key: 'atk',
    min: 0.4,
    max: 0.8,
    weight: 20,
    scalesWithLevel: true,
    decimals: 1,
    label: '攻击力',
  },
  {
    key: 'def',
    min: 0.3,
    max: 0.6,
    weight: 20,
    scalesWithLevel: true,
    decimals: 1,
    label: '防御力',
  },
  { key: 'hp', min: 4, max: 8, weight: 20, scalesWithLevel: true, decimals: 1, label: '生命值' },
  {
    key: 'critRate',
    min: 0.5,
    max: 3.0,
    weight: 10,
    scalesWithLevel: false,
    decimals: 1,
    label: '暴击率',
  },
  {
    key: 'critDmg',
    min: 2,
    max: 12,
    weight: 10,
    scalesWithLevel: false,
    decimals: 1,
    label: '暴击伤害',
  },
  { key: 'acc', min: 0.5, max: 1.2, weight: 8, scalesWithLevel: true, decimals: 1, label: '命中' },
  { key: 'eva', min: 0.4, max: 1.0, weight: 8, scalesWithLevel: true, decimals: 1, label: '闪避' },
  {
    key: 'spd',
    min: 0.01,
    max: 0.05,
    weight: 4,
    scalesWithLevel: false,
    decimals: 2,
    label: '攻速',
  },
  {
    key: 'dmgReduce',
    min: 0.5,
    max: 2.5,
    weight: 3,
    scalesWithLevel: false,
    decimals: 1,
    label: '伤害减免',
  },
  {
    key: 'elemDmg',
    min: 3,
    max: 10,
    weight: 3,
    scalesWithLevel: false,
    decimals: 1,
    label: '属性伤害',
  },
  {
    key: 'lifesteal',
    min: 0.5,
    max: 2.0,
    weight: 2,
    scalesWithLevel: false,
    decimals: 1,
    label: '吸血',
  },
  {
    key: 'skillMul',
    min: 1,
    max: 4,
    weight: 2,
    scalesWithLevel: false,
    decimals: 1,
    label: '技能倍率',
  },
];

/**
 * 已有结算管线可以真实生效的职业专属词条。
 *
 * 池按职业显式分开，生成装备时必须由调用方传入当前职业，不能静默选一个默认职业。
 * 数值沿用通用池公式：基准值 × L^1.3（若成长）× 品阶系数 × ±3%。
 */
export const PROFESSION_AFFIX_POOLS: Readonly<
  Record<ClassId, readonly ProfessionAffixPoolEntry[]>
> = {
  swordsman: [
    {
      key: 'swd_guard',
      balanceRole: 'sustain',
      min: 0.59,
      max: 0.59,
      weight: 30,
      scalesWithLevel: true,
      decimals: 1,
      label: '守势',
    },
    {
      key: 'swd_heavy',
      balanceRole: 'offense',
      min: 27,
      max: 27,
      weight: 25,
      scalesWithLevel: false,
      decimals: 1,
      label: '重压',
    },
    {
      key: 'swd_force',
      balanceRole: 'offense',
      min: 0.50,
      max: 0.50,
      weight: 25,
      scalesWithLevel: true,
      decimals: 1,
      label: '剑势',
    },
  ],
  witch: [
    {
      key: 'wit_power',
      balanceRole: 'offense',
      min: 0.53,
      max: 0.53,
      weight: 30,
      scalesWithLevel: true,
      decimals: 1,
      label: '灵能',
    },
    {
      key: 'wit_elem',
      balanceRole: 'offense',
      min: 4.3,
      max: 4.3,
      weight: 25,
      scalesWithLevel: false,
      decimals: 1,
      label: '元素亲和',
    },
    {
      key: 'wit_veil',
      balanceRole: 'sustain',
      min: 0.91,
      max: 0.91,
      weight: 25,
      scalesWithLevel: true,
      decimals: 1,
      label: '星纱',
    },
    {
      key: 'wit_vitality',
      balanceRole: 'sustain',
      min: 7.8,
      max: 7.8,
      weight: 25,
      scalesWithLevel: true,
      decimals: 1,
      label: '星愈',
    },
  ],
  shaman: [
    {
      key: 'sha_vitality',
      balanceRole: 'sustain',
      min: 7.8,
      max: 7.8,
      weight: 30,
      scalesWithLevel: true,
      decimals: 1,
      label: '回响',
    },
    {
      key: 'sha_drain',
      balanceRole: 'sustain',
      min: 1.6,
      max: 1.6,
      weight: 25,
      scalesWithLevel: false,
      decimals: 1,
      label: '灵契',
    },
    {
      key: 'sha_ward',
      balanceRole: 'sustain',
      min: 2,
      max: 2,
      weight: 25,
      scalesWithLevel: false,
      decimals: 1,
      label: '庇佑',
    },
    {
      key: 'sha_spirit',
      balanceRole: 'offense',
      min: 0.68,
      max: 0.68,
      weight: 80,
      scalesWithLevel: true,
      decimals: 1,
      label: '灵击',
    },
    {
      key: 'sha_ember',
      balanceRole: 'offense',
      min: 34,
      max: 34,
      weight: 25,
      scalesWithLevel: false,
      decimals: 1,
      label: '灵刃',
    },
  ],
  catkin: [
    {
      key: 'cat_swift',
      balanceRole: 'offense',
      min: 0.044,
      max: 0.044,
      weight: 30,
      scalesWithLevel: false,
      decimals: 3,
      label: '疾风',
    },
    {
      key: 'cat_nimble',
      balanceRole: 'sustain',
      min: 0.91,
      max: 0.91,
      weight: 15,
      scalesWithLevel: true,
      decimals: 1,
      label: '灵巧',
    },
    {
      key: 'cat_tough',
      balanceRole: 'sustain',
      min: 7.2,
      max: 7.2,
      weight: 25,
      scalesWithLevel: true,
      decimals: 1,
      label: '猫缘',
    },
    {
      key: 'cat_sharp',
      balanceRole: 'offense',
      min: 0.53,
      max: 0.53,
      weight: 25,
      scalesWithLevel: true,
      decimals: 1,
      label: '猫刃',
    },
  ],
  kenshi: [
    {
      key: 'kenshi_iai',
      balanceRole: 'offense',
      min: 4.3,
      max: 4.3,
      weight: 30,
      scalesWithLevel: false,
      decimals: 1,
      label: '破甲',
    },
    {
      key: 'kenshi_blade',
      balanceRole: 'offense',
      min: 22,
      max: 22,
      weight: 25,
      scalesWithLevel: false,
      decimals: 1,
      label: '刀势',
    },
    {
      key: 'kenshi_honor',
      balanceRole: 'sustain',
      min: 7.8,
      max: 7.8,
      weight: 30,
      scalesWithLevel: true,
      decimals: 1,
      label: '樱志',
    },
    {
      key: 'kenshi_bushido',
      balanceRole: 'sustain',
      min: 2,
      max: 2,
      weight: 25,
      scalesWithLevel: false,
      decimals: 1,
      label: '武道',
    },
  ],
};

/** 词条中文名，UI 显示用 */
export const AFFIX_LABELS: Record<AffixKey, string> = {
  atk: '攻击力',
  def: '防御力',
  hp: '生命值',
  acc: '命中',
  eva: '闪避',
  critRate: '暴击率',
  critDmg: '暴击伤害',
  spd: '攻速',
  dmgReduce: '伤害减免',
  elemDmg: '属性伤害',
  lifesteal: '吸血',
  skillMul: '技能倍率',
  swd_guard: '守势',
  swd_heavy: '重压',
  swd_force: '剑势',
  wit_power: '灵能',
  wit_elem: '元素亲和',
  wit_veil: '星纱',
  wit_vitality: '星愈',
  sha_vitality: '回响',
  sha_drain: '灵契',
  sha_ward: '庇佑',
  sha_spirit: '灵击',
  sha_ember: '灵刃',
  cat_swift: '疾风',
  cat_nimble: '灵巧',
  cat_tough: '猫缘',
  cat_sharp: '猫刃',
  kenshi_iai: '破甲',
  kenshi_blade: '刀势',
  kenshi_honor: '樱志',
  kenshi_bushido: '武道',
};

/** 属性中文名 */
export const STAT_LABELS: Record<keyof Stats, string> = {
  atk: '攻击力',
  def: '防御力',
  hp: '生命值',
  acc: '命中',
  eva: '闪避',
  critRate: '暴击率',
  critDmg: '暴击伤害',
  spd: '攻速',
};

/** 品质中文名与颜色变量 */
export const QUALITY_LABELS: Record<Quality, string> = {
  common: '普通',
  fine: '精良',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
  mythic: '神话',
  prismatic: '心虹珍藏',
  divine: '圣器',
};

/** 槽位中文名 */
export const SLOT_LABELS: Record<EquipSlot, string> = {
  weapon: '武器',
  head: '头冠',
  body: '衣裙',
  necklace: '项链',
  bracelet: '手镯',
  ring: '戒指',
  belt: '腰带',
  shoes: '鞋',
};

/** 槽位顺序，UI 按这个顺序排列 */
export const SLOT_ORDER: EquipSlot[] = [
  'weapon',
  'head',
  'body',
  'necklace',
  'bracelet',
  'ring',
  'belt',
  'shoes',
];

/** 职业中文名与简介 */
export const CLASS_INFO: Record<
  ClassId,
  { name: string; role: string; desc: string; color: string }
> = {
  swordsman: {
    name: '剑姬',
    role: '高血高防 · 稳定输出',
    desc: '前排少女剑士。挂机最稳，不容易死，新手推荐。',
    color: 'var(--pink-deep)',
  },
  witch: {
    name: '魔女',
    role: '群体爆发 · 脆皮',
    desc: '范围魔法输出最高，但生存靠装备。适合愿意花心思的玩家。',
    color: 'var(--blue-deep)',
  },
  shaman: {
    name: '灵巫',
    role: '召唤 · 自愈 · 续航',
    desc: '有治疗和召唤，长时间离线挂机最不容易断。',
    color: 'var(--mint)',
  },
  catkin: {
    name: '喵喵',
    role: '高速连击 · 闪避反击',
    desc: '以猫爪印记串起高速连击，动作最灵活；血防较低，需要靠走位与爆发抢先解决敌人。',
    color: '#6d6bc8',
  },
  kenshi: {
    name: '樱酱',
    role: '均衡单体 · 破甲斩杀',
    desc: '流浪的居合剑士少女。剑意越积越利，专斩残血之敌；攻防均衡，上手顺滑。',
    color: '#7fb7e8',
  },
};

// ─────────────────────── 强化 ───────────────────────

/** v3 及更早存档使用的固定单级增幅；仅用于迁移保值与回归测试。 */
export const ENHANCE_PER_LEVEL = 0.08;

export const ENHANCE_MAX = 15;

/** 掉落装备的基础胚子随机：最低不低于旧版，2% 概率出现奇迹胚子。 */
export const EQUIPMENT_BASE_ROLL_TIERS = [
  { id: 'steady', weight: 80, min: 1000, max: 1060 },
  { id: 'refined', weight: 18, min: 1061, max: 1120 },
  { id: 'miracle', weight: 2, min: 1121, max: 1200 },
] as const;
export const EQUIPMENT_BASE_ROLL_MIN = 1000;
export const EQUIPMENT_BASE_ROLL_MAX = 1200;

/** 强化首次成功时的单级增幅；稳定档也不低于旧版每级 8%。 */
export const ENHANCE_GAIN_TIERS = [
  { id: 'stable', weight: 86, min: 80, max: 82 },
  { id: 'excellent', weight: 13, min: 83, max: 95 },
  { id: 'miracle', weight: 1, min: 110, max: 125 },
] as const;
export const ENHANCE_GAIN_MIN = 80;
export const ENHANCE_GAIN_MAX = 125;
/** 所有已生效强化增幅的硬上限：+135%，即强化倍率最多 ×2.35。 */
export const ENHANCE_TOTAL_GAIN_CAP_PERMILLE = 1350;

/** 强化阶段只改变外观表现，不改变装备的掉落品质和词条数量。 */
export const FORGE_STAGE_THRESHOLDS: readonly { minLevel: number; stage: ForgeStage }[] = [
  { minLevel: 15, stage: 'sakura' },
  { minLevel: 12, stage: 'starforged' },
  { minLevel: 9, stage: 'radiant' },
  { minLevel: 5, stage: 'gleam' },
  { minLevel: 0, stage: 'original' },
];

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

/** 强化消耗配置；石头始终为目标等级平方，金币还会乘装备需求等级。 */
export const ENHANCE_GOLD_PER_EQUIPMENT_LEVEL = 8;
export const ENHANCE_COST_TIERS = [
  { minTargetLevel: 13, ore: 20, lucky: 1 },
  { minTargetLevel: 10, ore: 5, lucky: 0 },
  { minTargetLevel: 1, ore: 0, lucky: 0 },
] as const;
export const ENHANCE_MATERIAL_IDS = {
  stone: 'stone_enhance',
  ore: 'ore_black',
  lucky: 'lucky_nine',
  protection: 'charm_protect',
} as const;

/** 分解装备所得金币 = 装备等级 × 此系数 × (1 + 强化等级)。 */
export const DECOMPOSE_GOLD_PER_LEVEL = 8;

// ─────────────────────── 挂机与体力 ───────────────────────

/** 离线时长上限（秒），初始 8 小时 */
export const OFFLINE_CAP_SECONDS = 8 * 3600;

/** 离线效率。1.0 = 不打折，见 docs/10 的设计理由 */
export const OFFLINE_EFFICIENCY = 1.0;

/** 每秒击杀数的全局上限 */
export const DEFAULT_MAX_KILLS_PER_SEC = 3.0;

/**
 * 背包装备容量上限。
 *
 * 挂机产出无限，不设上限的话装备会无限堆积 —— 实测一天能堆到 1.5 万件，
 * 存档体积、战力计算和界面渲染会被一起拖垮。
 * 超出后自动分解最不值钱的白 / 绿 / 蓝装，见 core/bag.ts 的三条保护规则。
 */
export const BAG_CAPACITY = 300;

/**
 * 等级软上限余量（docs/56 §2）。
 *
 * 玩家等级上限 = 当前可进入的最高关卡等级 + 本余量。
 * 内容只到 Lv52 而等级无上限时，30 天实测升到 Lv118 —— 等级必须追着
 * 内容走，不许反超。留 3 级让卡关的玩家仍能靠升级获得一点推力
 * （胜任感来源），但不足以碾压。超限经验不作废：累积在 exp 里，
 * 解锁新章节后由正常升级循环一次性释放。
 */
export const LEVEL_SOFT_CAP_MARGIN = 3;

/**
 * 关卡节奏系数（docs/56 §8 击杀目标重排）：普通怪波次数量的区域倍率。
 *
 * sim 逐关模型实测：原每关十几只的通关目标让典型玩家 D1 推 120 关、
 * D3 耗尽全部内容。通关耗时是「推得太快」唯一正确的刹车位 ——
 * 等级软上限管数值不管进度，章节门槛按设计只拦不养成的玩家。
 *
 * 只放大普通怪数量，精英/BOSS 保持原数：每击杀的掉落经济不变、
 * 波次构成比不变，只有「通关要打多少只」变。BOSS 掉落随波次循环
 * 变长而变稀 —— 这本身是修产能过剩的一部分（原先每两分钟一只 BOSS
 * 的材料雨正是「产能跟不上消耗」的错觉来源之一）。
 *
 * 取值由 sim 门禁校准：内容耗尽日 ≥ D25、D1 不出区域 2 前段。
 * 新区域上线必须显式登记，缺表直接抛错，逼每个区域做节奏决策。
 */
export const STAGE_PACING_FACTORS: Readonly<Record<number, number>> = {
  1: 1, // 教学区保持零压力，几分钟一关
  2: 45,
  3: 90,
  4: 110,
  5: 200,
  6: 340,
  7: 440,
};

/**
 * 关卡位倍率：BOSS 关（每章第 6 关）与精英关（第 3 关）是章节的关口，
 * 通关循环数在区域系数上再乘一档 —— 区域后期的 BOSS 关自然形成
 * 「停留一天上下」的卡点（docs/56 §8 G4 的来源），普通关保持匀速。
 */
export const STAGE_PACING_BOSS_MUL = 2.5;
export const STAGE_PACING_ELITE_MUL = 1.5;

/**
 * 章节/区域进入门槛（docs/56 §3.3）。
 *
 * 门槛 = 目标章节首关推荐战力 × 比例。推荐战力已是 expectedBuildCp × 0.85
 * 的「养一养够得着」口径，这里再乘一档，保证门槛「刚好要努力一下」：
 * 刚穿齐没强化的玩家（≈ 典型养成 ÷ 1.7）会被拦下，去强化两件就过。
 * 区域是大关口，标准更高。
 */
export const CHAPTER_GATE_CP_RATIO = 0.75;
export const REGION_GATE_CP_RATIO = 0.85;

/**
 * 老档后门：等级 ≥ 章节等级 + 此余量时直接放行。
 *
 * 历史无上限时期升到 Lv118 的存档，其战力构成可能不符合新口径假设；
 * 他们早已到过这些章节，不该被新门槛锁在门外（docs/40：不得没收已得进度）。
 */
export const GATE_LEGACY_LEVEL_MARGIN = 10;

/**
 * 挑战未通关关卡的体力消耗（docs/56 §5）。
 *
 * 唯一的主消耗端：挂机已通关关卡、离线收益、装备副本一律 0。
 * 每日自然恢复 288 点 ÷ 6 = 最多 48 次推进 —— 正常游玩永远够用，
 * 它是保险丝不是付费墙，只拦「一天肝穿三个区域」的极端行为。
 */
export const STAGE_CHALLENGE_STAMINA_COST = 6;

/**
 * 战败判定（docs/56 §4）：效率低于下限并持续一段时间 → 退回上一关。
 *
 * 不用「连续 N 场」而用累计秒数：挂机结算是分片的，没有逐场粒度；
 * 45 秒 ≈ 3~8 场战斗，效果等价且实现诚实。
 * 战败不扣任何资产（docs/40 红线），退回后在上一关照常产出。
 */
export const DEFEAT_EFFICIENCY_FLOOR = 0.5;
export const DEFEAT_LOW_EFFICIENCY_SECONDS = 45;

/** 体力 */
export const STAMINA_BASE_MAX = 120;
export const STAMINA_RECOVER_SECONDS = 300; // 5 分钟 1 点
export const SWEEP_STAMINA_COST = 5;
/** 一次扫荡等同多少秒的挂机产出 */
export const SWEEP_EQUIV_SECONDS = 30 * 60;

/** 等级达到门槛后提高体力上限，按 minLevel 从高到低排列。 */
export const STAMINA_CAPS: readonly { minLevel: number; max: number }[] = [
  { minLevel: 100, max: 240 },
  { minLevel: 70, max: 180 },
  { minLevel: 40, max: 150 },
  { minLevel: 1, max: STAMINA_BASE_MAX },
];

/**
 * M2 尚未接技能树时使用的平均技能倍率。
 * M3-4 会改为读取玩家实际装备的技能，不在 store 里硬编码数值。
 */
export const AVG_SKILL_MULTIPLIERS: readonly { minLevel: number; multiplier: number }[] = [
  { minLevel: 85, multiplier: 2.6 },
  { minLevel: 65, multiplier: 2.3 },
  { minLevel: 45, multiplier: 2 },
  { minLevel: 25, multiplier: 1.7 },
  { minLevel: 10, multiplier: 1.45 },
  { minLevel: 1, multiplier: 1.2 },
];

// ─────────────────────── 元素克制表 ───────────────────────

/** 炎 → 冰 → 雷 → 炎 */
export const ELEMENT_BEATS: Record<Element, Element | null> = {
  fire: 'ice',
  ice: 'thunder',
  thunder: 'fire',
  none: null,
};
