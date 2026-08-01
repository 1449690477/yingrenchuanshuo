/**
 * 全局类型定义。
 *
 * 这一层只放纯数据类型与稳定枚举，不含任何副作用。
 * 见 AGENTS.md 铁律 1：core 层禁止依赖 Vue / Pinia / DOM。
 */

// ─────────────────────────── 枚举类 ───────────────────────────

/** 稳定职业 ID；显示名可以改，存档里的 ID 不可随角色改名变化。 */
export const CLASS_IDS = ['swordsman', 'witch', 'shaman', 'catkin', 'kenshi'] as const;

/** 五职业。catkin 的显示名为「喵喵」；kenshi 的显示名为「樱酱」。 */
export type ClassId = (typeof CLASS_IDS)[number];

/** 精品商店换装系列。稳定 ID 会写入装备定义，新增时只能追加。 */
export type BoutiqueThemeId = 'berry-cream' | 'moon-sugar' | 'rose-night' | 'cardboard-cat';

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

/** 装备提供的独立战斗修正；百分比字段均使用“百分点”语义。 */
export interface CombatBonuses {
  /** 伤害减免，10 表示最终伤害额外乘 0.9。 */
  damageReduction: number;
  /** 吸血，10 表示按实际造成伤害回复 10%。 */
  lifesteal: number;
  /** 三系属性伤害，10 表示对应属性的克制系数额外 +0.1。 */
  elementDamage: Record<Exclude<Element, 'none'>, number>;
  /** 技能伤害加成百分点；只放大真实主动技能，不放大普攻与装备追加段。 */
  skillDamage?: number;
  /** 装备提供的破甲百分点；与技能破甲相加后由公式统一封顶。 */
  armorPenetration?: number;
}

/** 参战单位 */
export interface Combatant {
  name: string;
  level: number;
  element: Element;
  stats: Stats;
  /** 当前生命，战斗过程中变化 */
  currentHp: number;
  /** 装备等来源提供的独立战斗修正；未填写表示全部为 0。 */
  combatBonuses?: CombatBonuses;
}

// ─────────────────────────── 词条 ───────────────────────────

export type AffixTier = 1 | 2 | 3 | 4 | 5;

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
  | 'skillMul'
  | 'swd_guard'
  | 'swd_heavy'
  | 'wit_power'
  | 'wit_elem'
  | 'wit_veil'
  | 'sha_vitality'
  | 'sha_drain'
  | 'sha_ward'
  | 'sha_spirit'
  | 'cat_swift'
  | 'cat_nimble'
  | 'kenshi_iai'
  | 'kenshi_blade'
  | 'kenshi_honor'
  | 'kenshi_bushido';

/** 静态装备模板上的固定词条；不进入洗练，因此品阶仅用于可选展示。 */
export interface FixedAffix {
  key: AffixKey;
  value: number;
  /** elemDmg 专用：加成哪一系 */
  element?: Element;
  tier?: AffixTier;
}

/** 装备实例上的随机词条；品阶是实例数据的一部分，洗练时不可缺失。 */
export interface Affix extends FixedAffix {
  tier: AffixTier;
}

export type AffixChangeOperation = 'reforge' | 'temper' | 'inscribe' | 'resonate';

/**
 * 已扣除材料、等待玩家决定的洗练候选。
 *
 * 原词条在玩家点击“采用”之前不改写；候选必须进入存档，否则刷新页面会把
 * 已支付的结果吞掉，违背“先展示，再采用或保留”的产品红线。
 */
export interface PendingAffixChange {
  operation: AffixChangeOperation;
  affixIndex: number;
  candidate: Affix;
}

// ─────────────────────────── 装备 ───────────────────────────

/** 装备定义的公共字段（配置表里的静态数据）。 */
export interface EquipmentClassPresentation {
  /** 同一件共享数值装备在当前职业下的玩家可见名称。 */
  name: string;
  /** 与人物纸娃娃武器造型一致的职业专属图标。 */
  icon: string;
}

interface EquipmentDefBase {
  id: string;
  name: string;
  quality: Quality;
  /** 需求等级，同时也是属性基准 */
  level: number;
  setId?: string;
  icon: string;
  /**
   * 静态外观索引。品质不同但造型相同的装备共用一个 appearanceId。
   * 存档仍只保存 defId，因此新增外观素材不需要迁移旧存档。
   */
  appearanceId: string;
  /** 职业专属装备；未填写表示全职业通用。 */
  classId?: ClassId;
  /**
   * 全职业共享装备的职业外观。
   *
   * 当前只用于区域武器：存档和数值仍共用同一个 defId，但剑士 / 魔女 /
   * 灵巫 / 喵喵分别展示剑、杖、扇、爪，避免通用武器图标冒充纸娃娃实装。
   */
  classPresentations?: Partial<Record<ClassId, EquipmentClassPresentation>>;
  /** 精品换装系列，用于统一人物光环、攻击换肤和互动。 */
  boutiqueTheme?: BoutiqueThemeId;
  /** 固定词条，套装件常用；不参与实例洗练。 */
  fixedAffixes?: FixedAffix[];
  /**
   * 完整固定模板。为 true 时不生成随机词条，且 fixedAffixes 必须写满品质容量。
   * 未填写时即便带有部分固定词条，剩余槽位仍正常随机。
   */
  fixedTemplate?: boolean;
  /**
   * 品质容量之外额外开出的**可洗练**槽位数。
   *
   * 给好感「心虹珍藏」这类固定模板装备用：它们的固定词条本身就是身份，
   * 一条都不该被洗掉；但如果完全不能洗练，玩家在好感上的长期投入
   * 会随着装备过时而作废 —— 这正是《上瘾》里「投入」环节最忌讳的事
   * （见 docs/40 与 docs/44 装备继承一节的同源结论）。
   *
   * 额外槽位与 fixedTemplate 可以并存：固定部分保持完整，
   * 额外槽位照常参与重铸 / 淬炼 / 定契。
   */
  extraAffixSlots?: number;
  /** 金色装备的专属效果描述 */
  uniqueEffect?: string;
}

/**
 * 装备定义。
 *
 * 武器是基础攻击属性的唯一装备来源，因此必须显式填写 element；
 * 非武器禁止携带 element，避免把首饰词条或关卡属性误当成攻击属性。
 */
export type EquipmentDef =
  | (EquipmentDefBase & {
      slot: 'weapon';
      element: Element;
    })
  | (EquipmentDefBase & {
      slot: Exclude<EquipSlot, 'weapon'>;
      element?: never;
    });

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
  /** 洗练共鸣值，满 20 后下一次随机洗练必定出现 T4 或 T5。 */
  reforgeResonance: number;
  /** 已支付且尚未选择“采用 / 保留”的候选；刷新页面后仍必须存在。 */
  pendingAffixChange?: PendingAffixChange;
  /**
   * 套装烙印（docs/58）：把普通装备烙上某个副本套装的归属。
   * 只赋予套装身份，品质/胚子/词条/强化全部保持原样；
   * 结算时优先于定义级 setId（core/equipmentSets）。
   */
  imprintSetId?: string;
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
  | {
      kind: 'status-stacks-at-least';
      statusId: string;
      stacks: number;
      target?: 'self' | 'primary-enemy';
    }
  | { kind: 'has-status'; statusId: string; target?: 'self' | 'primary-enemy' };

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
        | 'acc'
        | 'eva'
        | 'spd'
        | 'armorPenetration'
        | 'damageDone'
        | 'damageTaken'
        /** 仅放大施加该状态的来源单位造成的伤害。 */
        | 'damageTakenFromSource'
        | 'dotDamage';
      ratio: LevelScalar;
    }
  | {
      unit: 'percentage-points';
      stat:
        | 'critRate'
        | 'critDmg'
        | 'hitChance'
        | 'dodgeChance'
        | 'defenseIgnore'
        | 'lifesteal';
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
      /** 斩杀线在本伤害前求值；升级被动存在时用 upgrade 完整替换基础档。 */
      execute?: {
        targetHpRatioAtMost: number;
        bonusDamageRatio: LevelScalar;
        upgrade?: {
          passiveSkillId: string;
          targetHpRatioAtMost: number;
          bonusDamageRatio: LevelScalar;
        };
      };
      statusScaling?: {
        statusId: string;
        /** 必须由新数据显式填写；core 不得根据技能 ID 猜状态在谁身上。 */
        statusTarget?: 'self' | 'damage-target';
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
    }
  | {
      /** 只允许放在 on-damage-taken 触发器内，按本次实际承伤反射。 */
      kind: 'reflect-trigger-damage';
      target: Extract<SkillTarget, { kind: 'event-source' }>;
      damageRatio: LevelScalar;
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

/**
 * 同一掉落表内共享计数的品质组保底。
 *
 * 候选必须引用 entries 中的物品；强制命中时沿用各 LootEntry.weight，
 * 只选择其中一件。任一候选在正常掷骰中提前掉出，也会重置整组计数。
 */
export interface LootPityGroup {
  id: string;
  /** 累计 N 次整组都未命中后，下次结算强制命中组内一件。 */
  pityCount: number;
  /** 至少两个、不重复的 entries.itemId。 */
  itemIds: readonly string[];
}

export interface LootTable {
  id: string;
  /** 每次击杀 roll 几次 */
  rolls: number;
  entries: LootEntry[];
  /** 多个候选共享一次保底；组成员不能同时配置单物品 pityCount。 */
  pityGroups?: readonly LootPityGroup[];
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
  /**
   * 首通需要打满的完整波次循环数（docs/56 §8 节奏重排）。
   * 波次本身保持原样 —— BOSS/精英掉落节奏与每小时经济不变，
   * 变的只有「通关要打多少轮」。通关目标 = 波次怪物总数 × clearCycles。
   */
  clearCycles: number;
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
