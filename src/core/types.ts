/**
 * 全局类型定义。
 *
 * 这一层是纯类型，不含任何运行时逻辑。
 * 见 AGENTS.md 铁律 1：core 层禁止依赖 Vue / Pinia / DOM。
 */

// ─────────────────────────── 枚举类 ───────────────────────────

/** 三职业。剑姬=战士，魔女=法师，灵巫=道士 */
export type ClassId = 'swordsman' | 'witch' | 'shaman';

/** 属性克制三角：炎 → 冰 → 雷 → 炎 */
export type Element = 'fire' | 'ice' | 'thunder' | 'none';

/** 装备品质，见 docs/12-装备体系.md */
export type Quality = 'common' | 'fine' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'divine';

/** 8 个装备槽位 */
export type EquipSlot =
  | 'weapon'
  | 'head'
  | 'body'
  | 'necklace'
  | 'bracelet'
  | 'ring'
  | 'belt'
  | 'shoes';

/** 怪物类型，决定属性系数 */
export type MonsterType = 'normal' | 'elite' | 'boss';

// ─────────────────────────── 属性 ───────────────────────────

/** 八项基础属性，见 docs/10-数值与战斗.md */
export interface Stats {
  /** 攻击力 */
  atk: number;
  /** 防御力 */
  def: number;
  /** 生命值上限 */
  hp: number;
  /** 命中 */
  acc: number;
  /** 闪避 */
  eva: number;
  /** 暴击率，百分比数值（5 表示 5%） */
  critRate: number;
  /** 暴击伤害加成，百分比数值（50 表示 +50%） */
  critDmg: number;
  /** 攻速，每秒攻击次数 */
  spd: number;
}

/** 参战单位 */
export interface Combatant {
  name: string;
  level: number;
  element: Element;
  stats: Stats;
  /** 当前生命，战斗过程中变化 */
  currentHp: number;
}

// ─────────────────────────── 词条 ───────────────────────────

export type AffixKey =
  | 'atk'
  | 'def'
  | 'hp'
  | 'acc'
  | 'eva'
  | 'critRate'
  | 'critDmg'
  | 'spd'
  | 'dmgReduce'
  | 'elemDmg'
  | 'lifesteal'
  | 'skillMul';

export interface Affix {
  key: AffixKey;
  value: number;
  /** elemDmg 专用：加成哪一系 */
  element?: Element;
}

// ─────────────────────────── 装备 ───────────────────────────

/** 装备定义（配置表里的静态数据） */
export interface EquipmentDef {
  id: string;
  name: string;
  slot: EquipSlot;
  quality: Quality;
  /** 需求等级，同时也是属性基准 */
  level: number;
  element?: Element;
  setId?: string;
  icon: string;
  /** 固定词条，套装件常用 */
  fixedAffixes?: Affix[];
  /** 金色装备的专属效果描述 */
  uniqueEffect?: string;
}

/** 装备实例（玩家背包里那一件，带随机词条与强化等级） */
export interface EquipmentInstance {
  uid: string;
  defId: string;
  /** 强化等级 0~15 */
  enhance: number;
  /** 随机词条，数量由品质决定 */
  affixes: Affix[];
  /** 是否锁定（防止被一键分解） */
  locked: boolean;
}

// ─────────────────────────── 技能 ───────────────────────────

export interface Skill {
  id: string;
  name: string;
  class: ClassId;
  type: 'active' | 'passive';
  element: Element;
  unlockLevel: number;
  /** 主动技能倍率；被动填 0 */
  baseMultiplier: number;
  /** 每级增幅，通常 0.06 */
  perLevelMultiplier: number;
  /** 冷却秒数；被动填 0 */
  cooldown: number;
  /** 1=单体，0=全体，N=N 个目标 */
  targets: number;
  /** 自动释放优先级，越大越优先 */
  priority: number;
  passiveEffect?: Affix[];
  icon: string;
  desc: string;
}

// ─────────────────────────── 怪物 ───────────────────────────

export interface MonsterDef {
  id: string;
  name: string;
  level: number;
  type: MonsterType;
  element: Element;
  /** 类型系数之上的微调，默认 1.0 */
  hpMul?: number;
  atkMul?: number;
  expMul?: number;
  lootTableId: string;
  sprite: string;
  skills?: string[];
  desc?: string;
}

// ─────────────────────────── 掉落 ───────────────────────────

export interface LootEntry {
  itemId: string;
  /** 权重，不是概率。实际概率 = weight / 总weight */
  weight: number;
  minCount: number;
  maxCount: number;
  /** 保底：累计 N 次未掉则必掉 */
  pityCount?: number;
}

export interface LootTable {
  id: string;
  /** 每次击杀 roll 几次 */
  rolls: number;
  entries: LootEntry[];
  /** 必掉项 */
  guaranteed?: LootEntry[];
}

export interface LootResult {
  itemId: string;
  count: number;
}

// ─────────────────────────── 关卡 ───────────────────────────

export interface Wave {
  monsters: { id: string; count: number }[];
}

export interface Stage {
  id: string;
  chapterId: string;
  name: string;
  level: number;
  waves: Wave[];
  bossId?: string;
  /** 由 scripts/simulate.ts 生成，不要手填 */
  recommendCP: number;
  lootTableId: string;
  /** 每秒击杀上限，防止高战玩家无限刷低级图 */
  maxKillsPerSec: number;
  element: Element;
  bg: string;
}

// ─────────────────────────── 战斗结果 ───────────────────────────

export interface DamageResult {
  /** 最终伤害 */
  damage: number;
  /** 是否命中 */
  hit: boolean;
  /** 是否暴击 */
  crit: boolean;
}

export interface CombatResult {
  /** 是否获胜 */
  win: boolean;
  /** 战斗耗时（秒） */
  duration: number;
  /** 玩家造成的总伤害 */
  damageDealt: number;
  /** 玩家承受的总伤害 */
  damageTaken: number;
  /** 击杀数 */
  kills: number;
}

// ─────────────────────────── 挂机 ───────────────────────────

export interface IdleYield {
  exp: number;
  gold: number;
  kills: number;
  loot: LootResult[];
}
