/**
 * 全局类型定义。
 *
 * 这一层只放纯数据类型与稳定枚举，不含任何副作用。
 * 见 AGENTS.md 铁律 1：core 层禁止依赖 Vue / Pinia / DOM。
 */

// ─────────────────────────── 枚举类 ───────────────────────────

/** 稳定职业 ID；显示名可以改，存档里的 ID 不可随角色改名变化。 */
export const CLASS_IDS = ['swordsman', 'witch', 'shaman', 'catkin'] as const;

/** 四职业。catkin 的暂定显示名为「喵喵」。 */
export type ClassId = (typeof CLASS_IDS)[number];

/** 精品商店换装系列。稳定 ID 会写入装备定义，新增时只能追加。 */
export type BoutiqueThemeId =
  | 'berry-cream'
  | 'moon-sugar'
  | 'rose-night'
  | 'cardboard-cat';

/** 属性克制三角：炎 → 冰 → 雷 → 炎 */
export type Element = 'fire' | 'ice' | 'thunder' | 'none';

/** 装备品质，见 docs/12-装备体系.md */
export type Quality =
  'common' | 'fine' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'prismatic' | 'divine';

/** 强化里程碑对应的锻造外观阶段；不改变装备本身品质。 */
export type ForgeStage = 'original' | 'gleam' | 'radiant' | 'starforged' | 'sakura';

/** 8 个装备槽位 */
export type EquipSlot =
  'weapon' | 'head' | 'body' | 'necklace' | 'bracelet' | 'ring' | 'belt' | 'shoes';

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
  /**
   * 静态外观索引。品质不同但造型相同的装备共用一个 appearanceId。
   * 存档仍只保存 defId，因此新增外观素材不需要迁移旧存档。
   */
  appearanceId: string;
  /** 职业专属装备；未填写表示全职业通用。 */
  classId?: ClassId;
  /** 精品换装系列，用于统一人物光环、攻击换肤和互动。 */
  boutiqueTheme?: BoutiqueThemeId;
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
  /** 基础胚子倍率，千分数；1000 表示定义基础属性的 100%。 */
  baseRollPermille: number;
  /**
   * +1～+15 每一级首次成功时固定下来的强化增幅，千分数。
   *
   * 未到达且从未成功过的等级为 0；掉级后保留原值，重新升回时不得重掷。
   */
  enhanceGainPermille: number[];
  /** 目标强化等级字符串 → 幸运值；只保存非零桶。 */
  enhanceLuck: Record<string, number>;
  /** 随机词条，数量由品质决定 */
  affixes: Affix[];
  /** 是否锁定（防止被一键分解） */
  locked: boolean;
}

export type ShopOfferCategory = 'weapon' | 'dress' | 'armor' | 'accessory';

/** 商店静态商品配置。价格只允许由数据表读取，UI 不得传入。 */
export interface ShopOffer {
  id: string;
  defId: string;
  price: number;
  unlockLevel: number;
  unlockStageId: string;
  category: ShopOfferCategory;
  featured: boolean;
}

// ─────────────────────────── 技能 ───────────────────────────

/** 随技能等级成长的数值；ratio 一律使用 0.2=20% 的小数语义。 */
export interface LevelScalar {
  base: number;
  perLevel?: number;
  max?: number;
}

export type SkillTarget =
  | { kind: 'self' }
  | { kind: 'primary-enemy' }
  /** 触发器事件的来源单位，例如 on-dodge 时刚刚攻击自己的敌人。 */
  | { kind: 'event-source' }
  | { kind: 'hit-enemies' }
  | { kind: 'enemies'; count: number | 'all' }
  | { kind: 'all-allies' };

export type SkillCondition =
  | { kind: 'self-hp-at-most'; ratio: number }
  | { kind: 'target-hp-at-most'; ratio: number }
  | { kind: 'monster-type'; types: readonly MonsterType[] }
  | { kind: 'status-stacks-at-least'; statusId: string; stacks: number }
  | { kind: 'has-status'; statusId: string };

/**
 * 属性修正显式区分三种单位，防止把「闪避率 +20 个百分点」
 * 误写成 eva +20 或相对乘 1.2。
 */
export type SkillStatModifier =
  | {
      unit: 'flat';
      stat: 'atk' | 'def' | 'hp' | 'acc' | 'eva' | 'spd';
      amount: LevelScalar;
    }
  | {
      unit: 'ratio';
      stat:
        | 'atk'
        | 'def'
        | 'hp'
        | 'spd'
        | 'damageDone'
        | 'damageTaken'
        /** 仅放大施加该状态的来源单位造成的伤害。 */
        | 'damageTakenFromSource'
        | 'dotDamage';
      ratio: LevelScalar;
    }
  | {
      unit: 'percentage-points';
      stat: 'critRate' | 'critDmg' | 'hitChance' | 'dodgeChance';
      points: LevelScalar;
    };

export type SkillEffect =
  | {
      kind: 'damage';
      target: SkillTarget;
      /** 一次完整施法的总倍率；多段权重不会重复放大此倍率。 */
      multiplier: LevelScalar;
      /**
       * 决定段数和每段相对伤害权重；执行器归一化后总倍率不变。
       * 视觉命中时序由表现层的 hitOffsetsMs 控制。
       */
      hitWeights?: readonly number[];
      element?: Element;
      defenseIgnoreRatio?: number;
      statusScaling?: {
        statusId: string;
        /**
         * 线性叠层：总伤害 = 基础总伤害 × (1 + 快照层数 × damageRatioPerStack)。
         * AoE 对每个目标分别快照其层数，全部伤害结算后再消费。
         */
        damageRatioPerStack: number;
        consume: 'none' | 'all' | number;
      };
    }
  | {
      kind: 'periodic-damage';
      target: SkillTarget;
      totalMultiplier: LevelScalar;
      ticks: number;
      durationSec: number;
      element?: Element;
      maxStacks?: number;
    }
  | {
      kind: 'heal';
      target: SkillTarget;
      maxHpRatio: LevelScalar;
    }
  | {
      kind: 'shield';
      target: SkillTarget;
      maxHpRatio: LevelScalar;
      durationSec: number;
    }
  | {
      kind: 'modifier';
      target: SkillTarget;
      modifier: SkillStatModifier;
      durationSec?: number;
    }
  | {
      kind: 'apply-status';
      target: SkillTarget;
      statusId: string;
      stacks: number;
      maxStacks: number;
      durationSec: number;
      refresh: 'duration' | 'replace' | 'add-duration';
      /** true 表示状态每层各自应用一次 modifiers。 */
      modifiersPerStack?: boolean;
      modifiers?: readonly SkillStatModifier[];
    }
  | {
      kind: 'consume-status';
      target: SkillTarget;
      statusId: string;
      stacks: number | 'all';
    }
  | {
      kind: 'control';
      target: SkillTarget;
      control: 'stun' | 'freeze' | 'slow' | 'knockback';
      chance: number;
      durationSec: number;
      /** slow/knockback 强度；0.2 表示 20%。 */
      strengthRatio?: number;
    }
  | {
      kind: 'trigger';
      event:
        | 'after-skill-resolved'
        | 'on-hit'
        | 'on-crit'
        | 'on-dodge'
        | 'on-damage-taken'
        | 'on-low-hp';
      chance?: number;
      durationSec?: number;
      maxTriggers?: number;
      when?: SkillCondition;
      effects: readonly SkillEffect[];
    }
  | {
      kind: 'conditional';
      when: SkillCondition;
      effects: readonly SkillEffect[];
    }
  | {
      kind: 'avoid-next-hit';
      durationSec: number;
      count: number;
    }
  | {
      kind: 'summon';
      summonId: string;
      durationSec: number;
    }
  | {
      kind: 'dispel';
      target: SkillTarget;
      polarity: 'buff' | 'debuff';
      count: number | 'all';
    };

interface SkillBase {
  id: string;
  name: string;
  class: ClassId;
  element: Element;
  unlockLevel: number;
  icon: string;
  desc: string;
}

export interface ActiveSkill extends SkillBase {
  type: 'active';
  cooldownSec: number;
  /** 自动释放优先级，越大越优先。 */
  priority: number;
  /** 条件不满足时跳过该技能，继续检查下一优先级。 */
  castWhen?: SkillCondition;
  effects: readonly SkillEffect[];
}

export interface PassiveSkill extends SkillBase {
  type: 'passive';
  effects: readonly SkillEffect[];
}

export type Skill = ActiveSkill | PassiveSkill;

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
  /** 职业专属掉落；未填写表示所有职业都可进入该掉落池。 */
  classId?: ClassId;
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
  firstClearRewards: LootResult[];
  lootTableId: string;
  /** 每秒击杀上限，防止高战玩家无限刷低级图 */
  maxKillsPerSec: number;
  element: Element;
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
