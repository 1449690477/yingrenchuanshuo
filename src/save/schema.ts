/**
 * 存档结构定义。
 *
 * ⚠ 见 AGENTS.md 铁律 5：改动这里的结构必须
 *   1. SAVE_VERSION +1
 *   2. 在 migrations.ts 加迁移函数
 *   3. 加迁移测试
 *
 * 玩家的存档就是他的全部资产，一次更新废掉存档等于永久流失玩家。
 */

import { getEquipmentSet } from '@/data/equipmentSets';
import { z } from 'zod';
import { createEncounterState, type EncounterState } from '@/core/encounters';
import { createEquipmentDungeonState, type EquipmentDungeonState } from '@/core/equipmentDungeon';
import { createAffectionState, type AffectionState } from '@/core/affection';
import { createDailyTaskState, type DailyTaskState } from '@/core/dailyTasks';
import { createMonsterCodexLedger, type MonsterCodexLedger } from '@/core/monsterCodex';
import { createMailState, type MailState } from '@/core/mail';
import { skillLevelRecordIssues } from '@/core/skillUpgrade';
import { DAILY_TASKS, type DailyTaskId } from '@/data/dailyTasks';
import { isRolledAffixValue } from '@/core/equipment';
import { isProfessionAffixSlot, promoteAffix } from '@/core/reforge';
import {
  CLASS_IDS,
  type AffixKey,
  type ClassId,
  type EquipmentInstance,
  type EquipSlot,
  type Quality,
} from '@/core/types';
import {
  AFFIX_POOL,
  AFFIX_RUNTIME_RULES,
  CLASS_BASE_STATS,
  ENHANCE_GAIN_TIERS,
  ENHANCE_MAX,
  EQUIPMENT_BASE_ROLL_MAX,
  EQUIPMENT_BASE_ROLL_MIN,
  LUCK_FULL,
  isAffixGenerationActive,
  isAffixSettlementActive,
  PROFESSION_AFFIX_POOLS,
  QUALITY_AFFIX_COUNT,
  QUALITY_ORDER,
  SLOT_ORDER,
  STAMINA_BASE_MAX,
} from '@/data/constants';
import { ENCOUNTERS } from '@/data/encounters';
import { FIRST_STAGE_ID } from '@/data/stages';
import { EQUIPMENT_DUNGEON_RULES } from '@/data/equipmentDungeonRules';
import { EQUIPMENT_DUNGEON_STAGES, EQUIPMENT_DUNGEON_STAGE_LIST } from '@/data/equipmentDungeons';
import { EQUIPMENT_DUNGEON_TIERS } from '@/data/equipmentDungeonGear';
import { DEPTH_PER_TIER } from '@/data/equipmentDungeonDepthRules';

const EQUIPMENT_DUNGEON_TIER_IDS = new Set<string>(EQUIPMENT_DUNGEON_TIERS.map((tier) => tier.id));

const DAILY_TASK_ID_ENUM = z.enum(
  DAILY_TASKS.map((task) => task.id) as [DailyTaskId, ...DailyTaskId[]],
);
import { AFFECTION_CHARACTERS } from '@/data/affection';
import { affectionEquipmentIdsForClass } from '@/data/affectionEquipment';
import { AFFECTION_RULES } from '@/data/affectionRules';
import { LEGACY_TRIAL_BRACKET_IDS, TRIAL_BEST_KEEP, TRIAL_BRACKETS } from '@/data/trialRules';
import { MILESTONE_LEVELS, isMilestoneLevel } from '@/data/milestoneRules';
import { getEquipment } from '@/data/equipment';
import { createEquipmentCodexLedger, type EquipmentCodexLedger } from '@/core/equipmentCodex';
import {
  createEquipmentPresetState,
  EQUIPMENT_PRESET_IDS,
  type EquipmentPresetState,
} from '@/core/equipmentPresets';

export type { EquipmentCodexLedger } from '@/core/equipmentCodex';
export type { EquipmentPresetState } from '@/core/equipmentPresets';

/** 当前存档版本。加字段就 +1。 */
export const SAVE_VERSION = 27;

export const SAVE_KEY = 'main';

export interface PlayerSave {
  name: string;
  classId: ClassId;
  level: number;
  /** 当前等级内已累积的经验 */
  exp: number;
  gold: number;
  stamina: number;
  /** 体力恢复的计时基准（毫秒时间戳） */
  staminaRecoverAt: number;
  /** 每日免费领取的日切 key（'YYYY-MM-DD'）；null = 从未领过。 */
  staminaClaimDay: string | null;
  /** 当日已领取次数（0~3）。 */
  staminaClaimCount: number;
  /**
   * 玩家自己编排的主动技能栏（M3-5）。
   *
   * ⚠ **「字段不存在」与「空数组」是两件不同的事**，别把它们合并：
   * · **不存在（undefined）** = 玩家从没编排过 ⇒ 回落职业默认顺序。
   *   **所有 v20 及更早的存档迁移后都是这个状态**，因此行为与 M3-5 上线前逐字一致。
   * · **`[]`** = 玩家**明确清空**了技能栏 ⇒ 尊重它，本次不带任何主动技。
   *
   * 合并两者就没法在「不改变老玩家行为」的前提下让新玩家清栏。
   * 判定逻辑不在这里：一律走 `core/skillSlots.ts` 的 `resolveActiveSkillSlots`，
   * 客户端与服务端共用同一个判定点。
   *
   * 这里**不限制长度、不校验技能 id 是否存在**，是刻意的：存档校验一旦拒绝，
   * 玩家会连游戏都进不去；而技能表改名/删除导致旧 id 失效，在这个项目里
   * 比伪造常见得多。非法项由 `resolveActiveSkillSlots` **过滤**并给出原因，
   * 不由存档层**拒绝**。
   */
  activeSkillIds?: string[];
  /**
   * 真正升过级的技能 id → 等级；未登记即 1 级。
   *
   * 未知 id 不在存档层拒绝：技能表将来改名或删除时，旧条目可以安全保留，
   * 战斗构建只读取当前职业仍存在且已解锁的技能。数值本身必须是合法等级，
   * 并且不能超过角色等级允许的上限。
   */
  skillLevels: Record<string, number>;
  /**
   * M4-2 签到：最近一次签到的日切 key（'YYYY-MM-DD'，北京 04:00 日切）；null = 从未签过。
   */
  signInDay: string | null;
  /** 签到累计次数（只增不减；七日循环奖励位置 = 本值 % 7，断签不重置）。 */
  signInCycleClaimed: number;
  /** signInMonthCount 所属自然月（'YYYY-MM'）；null = 从未签过。 */
  signInMonth: string | null;
  /** 所属自然月内的累计签到天数（跨月归零，用于 7/14/21/28 里程碑）。 */
  signInMonthCount: number;
}

export interface BagSave {
  /** 未穿戴的装备实例 */
  equipment: EquipmentInstance[];
  /** 材料与消耗品：itemId → 数量 */
  items: Record<string, number>;
}

export interface ProgressSave {
  /** 当前挂机的关卡 */
  currentStageId: string;
  /** 已通关的关卡 id */
  clearedStageIds: string[];
  /**
   * 各关首次通关时刻（毫秒时间戳）。
   *
   * 进度榜「同关按最早达成排」的依据（docs/51 §4 榜 3）——
   * 没有它，那个榜就退化成又一张进度快照，而它的定位是「开荒者的荣誉」。
   *
   * v15 之前通关的关卡在这里**没有条目且不补记**：从现状反推不出「哪天打的」，
   * 按当下补记就是把猜测写成纪录（同 docs/62 §4.1）。
   * 缺条目的关卡在并列里排在有时刻的之后 —— 不是惩罚，
   * 而是「没有证据就不能主张更早」。
   */
  stageFirstClearedAt: Record<string, number>;
  /** 各关已累计的击杀数，中途关闭页面也不能丢进度 */
  stageKills: Record<string, number>;
  /**
   * 掉落保底计数器。
   * 单品 key 为 `${tableId}:${itemId}`，品质组 key 为
   * `${tableId}:@pity-group:${groupId}`。
   */
  pity: Record<string, number>;
  /** 已看过教学提示的章节 id，避免重复弹 */
  seenTutorials: string[];
}

export interface SettingsSave {
  /** 自动分解该品质及以下的装备（门槛含该品质）。'none' = 不自动分解 */
  autoDecomposeBelow: Quality | 'none';
  bgm: boolean;
  sfx: boolean;
  /** 好感互动的设备短震反馈；不支持振动的设备会自然忽略。 */
  haptics: boolean;
  /** 降低动画以省电 */
  reduceMotion: boolean;
  /** 画质档：'standard' = 完整特效；'lite' = 关闭战斗粒子 / 动态背景（M4-12B）。 */
  visualQuality: 'standard' | 'lite';
}

export interface StatsSave {
  totalKills: number;
  totalPlaySec: number;
  /** BOSS 累计击杀数，key 为怪物 id。套装保底用。 */
  bossKills: Record<string, number>;
  /** M4-7 成就计数（只增不减，v27）：累计强化次数。 */
  enhanceCount: number;
  /** M4-7 成就计数（只增不减，v27）：累计洗练词条次数。 */
  reforgeCount: number;
  /** M4-7 成就计数（只增不减，v27）：累计扫荡次数。 */
  sweepCount: number;
  /** M4-7 成就计数（只增不减，v27）：累计好感互动次数。 */
  affectionCount: number;
  /** M4-7 成就计数（只增不减，v27）：累计竞技场挑战次数。 */
  arenaCount: number;
  /** M4-7 成就计数（只增不减，v27）：累计装备副本挑战次数。 */
  dungeonCount: number;
}

export interface ShopSave {
  /** 珍品每件限购一次，防止连续点击重复扣款与背包刷副本。 */
  purchasedOfferIds: string[];
}

/**
 * 一周试炼的最好成绩（docs/51 联机排行榜）。
 *
 * 永不倒退、永不清空：只记录每周的最高伤害，即便之后打得更差或不上线，
 * 已写下的纪录也不会被覆盖。这是方案「不上线也不损失」红线在存档层的落地。
 */
export interface TrialBest {
  seasonId: string;
  weekIndex: number;
  bracketId: string;
  classId: ClassId;
  /** 算出这条伤害的试炼公式版本；不同版本的纪录不能互相压制。 */
  formulaVersion: number;
  /** 60 秒总伤害（本地挑战与服务端复算逐点一致的确定性成绩） */
  damage: number;
  /** 达成时刻（毫秒时间戳） */
  at: number;
  /** 是否已成功上传服务端复核并入榜 */
  submitted: boolean;
}

export interface TrialSave {
  /** 每周最好成绩，新纪录在前；最多保留 TRIAL_BEST_KEEP 条（约半年）。 */
  bests: TrialBest[];
}

/**
 * 登顶速度榜的一条首次达成记录（docs/51 §4 榜 4）。
 *
 * **不可变**：里程碑是「第一次到达 Lv N 用了多久」这一历史事实，
 * 和试炼的「本周最好成绩」不同 —— 后者会被更好的成绩刷新，
 * 前者一旦写下就永不改动、永不重算。重复达成不产生新记录。
 *
 * 为什么把 elapsedMs 存下来而不是每次用 `at - createdAt` 现算：
 * 它是达成那一刻的**声明值**。存下来意味着日后 createdAt 若因迁移或
 * 修档变动，已提交的成绩不会跟着漂移。
 */
export interface MilestoneRecord {
  /** 档位等级（MILESTONE_LEVELS 之一） */
  level: number;
  /** 首次达成时刻（毫秒时间戳） */
  at: number;
  /** 从建号到达成的用时（毫秒） */
  elapsedMs: number;
  /** 是否已成功上传服务端复核 */
  submitted: boolean;
}

export interface SaveData {
  version: number;
  createdAt: number;
  /** 上次活跃时间，离线结算的基准 */
  lastActiveAt: number;
  /** 主随机种子 */
  seed: number;
  /** RNG 状态，保证重开游戏后随机序列不重置 */
  rngState: number;
  /** 装备实例 uid 自增计数器 */
  nextUid: number;

  player: PlayerSave;
  /** 已穿戴装备，8 个槽位 */
  equipped: Record<EquipSlot, EquipmentInstance | null>;
  bag: BagSave;
  progress: ProgressSave;
  settings: SettingsSave;
  stats: StatsSave;
  shop: ShopSave;
  /** 不打断挂机的待处理奇遇与累计进度。 */
  encounters: EncounterState;
  /** 8 个定向装备副本共享的日次数与永久通关记录。 */
  equipmentDungeon: EquipmentDungeonState;
  /** 五位可玩角色彼此独立的好感、剧情、保底与心虹图鉴。 */
  affection: AffectionState;
  /** 周常试炼个人最好成绩（联机排行榜的本地纪录）。 */
  trial: TrialSave;
  /** 登顶速度榜的首次达成记录（docs/51 §4 榜 4）。 */
  milestones: MilestoneRecord[];
  /**
   * 装备永久图鉴：曾经获得过哪些装备定义（docs/63 §4.2）。
   *
   * 与背包分离的理由：背包上限 300 且会强制裁剪，分解也是常规操作 ——
   * 若图鉴按背包推导，玩家每分解一件进度就倒退一次（docs/40 红线）。
   * 口径同好感线的 discoveredGearIds：**只增不删**。
   */
  equipmentCodex: EquipmentCodexLedger;
  /** 三套可复用的完整装备快照与按关卡自动切换开关。 */
  equipmentPresets: EquipmentPresetState;
  /** M4-1 日常任务：日切 key + 当日进度 + 已领活跃度档位。 */
  dailyTasks: DailyTaskState;
  /** M4-8 怪物永久图鉴：只增不删的发现记录。 */
  monsterCodex: MonsterCodexLedger;
  /** M4-5 邮箱：系统邮件列表（永不过期，templateId 幂等入箱，上限 50 条）。 */
  mail: MailState;
}

export function emptyEquipped(): Record<EquipSlot, EquipmentInstance | null> {
  return {
    weapon: null,
    head: null,
    body: null,
    necklace: null,
    bracelet: null,
    ring: null,
    belt: null,
    shoes: null,
  };
}

/** 新建存档 */
export function createSave(name: string, classId: ClassId, seed: number, now: number): SaveData {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastActiveAt: now,
    seed,
    rngState: seed,
    nextUid: 1,
    player: {
      name,
      classId,
      level: 1,
      exp: 0,
      gold: 0,
      stamina: STAMINA_BASE_MAX,
      staminaRecoverAt: now,
      staminaClaimDay: null,
      staminaClaimCount: 0,
      skillLevels: {},
      signInDay: null,
      signInCycleClaimed: 0,
      signInMonth: null,
      signInMonthCount: 0,
    },
    equipped: emptyEquipped(),
    bag: { equipment: [], items: {} },
    progress: {
      currentStageId: FIRST_STAGE_ID,
      clearedStageIds: [],
      stageFirstClearedAt: {},
      stageKills: {},
      pity: {},
      seenTutorials: [],
    },
    settings: {
      autoDecomposeBelow: 'rare',
      bgm: false,
      sfx: true,
      haptics: true,
      reduceMotion: false,
      visualQuality: 'standard',
    },
    stats: {
      totalKills: 0,
      totalPlaySec: 0,
      bossKills: {},
      enhanceCount: 0,
      reforgeCount: 0,
      sweepCount: 0,
      affectionCount: 0,
      arenaCount: 0,
      dungeonCount: 0,
    },
    shop: { purchasedOfferIds: [] },
    encounters: createEncounterState(),
    equipmentDungeon: createEquipmentDungeonState(now),
    affection: createAffectionState(now, AFFECTION_RULES),
    trial: createTrialSave(),
    milestones: [],
    equipmentCodex: createEquipmentCodexLedger(),
    equipmentPresets: createEquipmentPresetState(),
    dailyTasks: createDailyTaskState(now),
    monsterCodex: createMonsterCodexLedger(),
    mail: createMailState(),
  };
}

/** 新建试炼成绩簿 */
export function createTrialSave(): TrialSave {
  return { bests: [] };
}

/** 职业初始属性存在，说明 classId 合法 */
export function isValidClass(id: string): id is ClassId {
  return id in CLASS_BASE_STATS;
}

/**
 * 存档运行时校验。
 *
 * TypeScript 只能检查开发时的代码，不能证明玩家导入的 JSON 或
 * IndexedDB 里的对象真的符合 SaveData。这里用 Zod 做完整校验，
 * 缺字段、类型错误和非法枚举都会直接报错，不能拿默认值掩盖坏档。
 */
const classIdSchema = z.enum(CLASS_IDS);
const qualitySchema = z.enum(QUALITY_ORDER);
const affectionMoodSchema = z.enum(['calm', 'bright', 'shy', 'moved', 'playful']);
const elementSchema = z.enum(['fire', 'ice', 'thunder', 'none']);
/**
 * 随机词条持久化键直接派生自发布状态表。
 *
 * active / deferred 都必须能读取既有存档；能否生成和继续投入仍由同一张
 * AFFIX_RUNTIME_RULES 控制，避免类型、存档白名单与实际发布状态三处漂移。
 */
const persistedAffixKeys = Object.keys(AFFIX_RUNTIME_RULES) as [AffixKey, ...AffixKey[]];
const affixKeySchema = z.enum(persistedAffixKeys);
const generalAffixKeys = new Set<AffixKey>(AFFIX_POOL.map((entry) => entry.key));
const professionAffixKeys = new Set<AffixKey>(
  Object.values(PROFESSION_AFFIX_POOLS)
    .flat()
    .map((entry) => entry.key),
);
const affixTierSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
const affixChangeOperationSchema = z.enum(['reforge', 'temper', 'inscribe', 'resonate']);

const finiteNumber = z.number().finite();
const nonNegativeNumber = finiteNumber.nonnegative();
const nonNegativeInteger = z.number().int().nonnegative();
const timestamp = nonNegativeInteger;
const equipmentDungeonStageIds = new Set(EQUIPMENT_DUNGEON_STAGE_LIST.map((stage) => stage.id));
/**
 * 通关记录的 key（v16 起）：`${关卡id}_d${深度}`（docs/66 §五）。
 *
 * 深度进 key 而不是另起一张表 —— 秘境榜读的就是这份 records，
 * 两处实现分叉过一次（docs/61 §2.2），不再制造第二个真相源。
 */
const equipmentDungeonRecordKeySchema = z.string().refine((key) => {
  const matched = key.match(/^(.+)_d(\d+)$/);
  if (!matched) return false;
  const depth = Number(matched[2]);
  return (
    equipmentDungeonStageIds.has(matched[1]!) &&
    Number.isInteger(depth) &&
    depth >= 1 &&
    depth <= DEPTH_PER_TIER
  );
}, '装备副本通关记录 key 非法（应为 关卡id_d深度）');

const equipmentDungeonDepthSchema = z.record(
  z.string().refine((tierId) => EQUIPMENT_DUNGEON_TIER_IDS.has(tierId), '装备副本档位不存在'),
  z.number().int().min(1).max(DEPTH_PER_TIER),
);

const affixSchema = z
  .object({
    key: affixKeySchema,
    value: finiteNumber,
    element: elementSchema.optional(),
    tier: affixTierSchema,
  })
  .strict()
  .superRefine((affix, ctx) => {
    const requiresElement = affix.key === 'elemDmg' || affix.key === 'wit_elem';
    if (requiresElement && !['fire', 'ice', 'thunder'].includes(affix.element ?? '')) {
      ctx.addIssue({
        code: 'custom',
        path: ['element'],
        message: '属性伤害类词条必须绑定 fire、ice 或 thunder',
      });
    }
    if (!requiresElement && affix.element !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['element'],
        message: '非属性伤害词条不能携带元素',
      });
    }
  });

const pendingAffixChangeSchema = z
  .object({
    operation: affixChangeOperationSchema,
    affixIndex: nonNegativeInteger,
    candidate: affixSchema,
  })
  .strict();

const enhanceGainSchema = z
  .array(
    z
      .number()
      .int()
      .refine(
        (gain) =>
          gain === 0 || ENHANCE_GAIN_TIERS.some((tier) => gain >= tier.min && gain <= tier.max),
        '强化增幅不在配置档位内',
      ),
  )
  .length(ENHANCE_MAX);
const enhanceLuckKeySchema = z.string().regex(/^(?:[1-9]|1[0-5])$/);

/**
 * 单件装备实例的完整结构与取值校验。
 *
 * 导出给 Supabase Edge Function 复用（docs/51 §6.3 L2）：
 * 客户端提交的搭配快照在服务端用同一份 schema 过一遍，
 * 强化 ≤15、词条数 ≤ 品质容量、品阶 ≤5、数值在 affixValueRange 内才会进入复算。
 */
export const equipmentInstanceSchema = z
  .object({
    uid: z.string().min(1),
    defId: z.string().min(1),
    enhance: z.number().int().min(0).max(ENHANCE_MAX),
    baseRollPermille: z.number().int().min(EQUIPMENT_BASE_ROLL_MIN).max(EQUIPMENT_BASE_ROLL_MAX),
    enhanceGainPermille: enhanceGainSchema,
    enhanceLuck: z.record(enhanceLuckKeySchema, z.number().int().min(1).max(LUCK_FULL)),
    affixes: z.array(affixSchema),
    reforgeResonance: z.number().int().min(0).max(20),
    pendingAffixChange: pendingAffixChangeSchema.optional(),
    // 套装烙印（docs/58 v13）：必须指向已登记套装，防止悬空引用进档
    imprintSetId: z
      .string()
      .min(1)
      .refine((setId) => getEquipmentSet(setId) !== undefined, {
        message: '烙印引用了未登记的套装',
      })
      .optional(),
    locked: z.boolean(),
  })
  .strict()
  .superRefine((instance, ctx) => {
    for (let index = 0; index < instance.enhance; index++) {
      if (instance.enhanceGainPermille[index] === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['enhanceGainPermille', index],
          message: `已强化到 +${instance.enhance}，前 ${instance.enhance} 格增幅必须存在`,
        });
      }
    }
    const definition = getEquipment(instance.defId);
    if (!definition) {
      ctx.addIssue({
        code: 'custom',
        path: ['defId'],
        message: `装备定义不存在：${instance.defId}`,
      });
      return;
    }

    const fixedAffixes = definition.fixedAffixes ?? [];
    // 额外槽位是品质容量之外单独开的可洗练位（心虹珍藏用），必须计入剩余容量，
    // 否则这类装备一存盘就会被判「随机词条超容量」而整件丢失。
    const extraSlots = definition.extraAffixSlots ?? 0;
    const remainingCapacity =
      QUALITY_AFFIX_COUNT[definition.quality] + extraSlots - fixedAffixes.length;
    if (remainingCapacity < 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['defId'],
        message: `装备定义 ${definition.id} 的固定词条超过品质容量`,
      });
      return;
    }
    // 固定模板只约束品质容量内的部分；额外槽位本就是给它开的可洗位。
    if (definition.fixedTemplate && instance.affixes.length > extraSlots) {
      ctx.addIssue({
        code: 'custom',
        path: ['affixes'],
        message: `完整固定模板的随机词条不得超过额外槽位 ${extraSlots}`,
      });
    }
    if (instance.affixes.length > remainingCapacity) {
      ctx.addIssue({
        code: 'custom',
        path: ['affixes'],
        message: `随机词条超过 ${definition.quality} 品质剩余容量 ${remainingCapacity}`,
      });
    }

    const fixedKeys = new Set<AffixKey>();
    for (const fixedAffix of fixedAffixes) {
      if (fixedKeys.has(fixedAffix.key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['defId'],
          message: `装备定义 ${definition.id} 的固定词条键重复：${fixedAffix.key}`,
        });
      }
      fixedKeys.add(fixedAffix.key);
    }

    const randomKeys = new Set<AffixKey>();
    for (const [index, affix] of instance.affixes.entries()) {
      if (fixedKeys.has(affix.key) || randomKeys.has(affix.key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['affixes', index, 'key'],
          message: `随机词条键与现有词条重复：${affix.key}`,
        });
      }
      randomKeys.add(affix.key);
      if (
        professionAffixKeys.has(affix.key) &&
        !isProfessionAffixSlot(definition.quality, instance.affixes.length, index)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['affixes', index, 'key'],
          message: `职业词条 ${affix.key} 只能位于品质预留的职业槽`,
        });
      }
    }

    const pending = instance.pendingAffixChange;
    if (pending && pending.affixIndex >= instance.affixes.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['pendingAffixChange', 'affixIndex'],
        message: '待处理词条索引必须指向装备现有随机词条',
      });
      return;
    }
    if (!pending) return;

    const target = instance.affixes[pending.affixIndex]!;
    const candidate = pending.candidate;
    const occupiedAfterReplace = new Set<AffixKey>([
      ...fixedKeys,
      ...instance.affixes
        .filter((_, index) => index !== pending.affixIndex)
        .map((affix) => affix.key),
    ]);
    if (occupiedAfterReplace.has(candidate.key)) {
      ctx.addIssue({
        code: 'custom',
        path: ['pendingAffixChange', 'candidate', 'key'],
        message: `洗练候选与其他随机或固定词条重复：${candidate.key}`,
      });
    }

    if (
      (pending.operation === 'temper' || pending.operation === 'resonate') &&
      !isAffixSettlementActive(target.key)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['pendingAffixChange', 'candidate', 'key'],
        message: `${pending.operation === 'temper' ? '淬炼' : '同调'}不能继续养成延后结算词条`,
      });
    }

    if (!isAffixGenerationActive(candidate.key)) {
      ctx.addIssue({
        code: 'custom',
        path: ['pendingAffixChange', 'candidate', 'key'],
        message: `待处理候选词条尚未开放生成：${candidate.key}`,
      });
    }

    if (pending.operation === 'reforge') {
      const professionSlot = isProfessionAffixSlot(
        definition.quality,
        instance.affixes.length,
        pending.affixIndex,
      );
      const expectedPool = professionSlot ? professionAffixKeys : generalAffixKeys;
      if (!expectedPool.has(candidate.key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['pendingAffixChange', 'candidate', 'key'],
          message: `重铸候选不属于目标${professionSlot ? '职业' : '通用'}词条槽`,
        });
      }
    }
    if (pending.operation === 'inscribe' && !professionAffixKeys.has(candidate.key)) {
      ctx.addIssue({
        code: 'custom',
        path: ['pendingAffixChange', 'candidate', 'key'],
        message: '铭刻候选必须属于职业专属词条池',
      });
    }
    if (
      pending.operation === 'inscribe' &&
      !isProfessionAffixSlot(definition.quality, instance.affixes.length, pending.affixIndex)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['pendingAffixChange', 'affixIndex'],
        message: '铭刻只能作用于品质预留的职业槽',
      });
    }

    if (
      (pending.operation === 'reforge' || pending.operation === 'inscribe') &&
      candidate.key === target.key
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['pendingAffixChange', 'candidate', 'key'],
        message: `${pending.operation === 'reforge' ? '重铸' : '铭刻'}候选必须更换词条类型`,
      });
    }
    if (
      pending.operation !== 'resonate' &&
      !isRolledAffixValue(candidate.key, definition.level, candidate.tier, candidate.value)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['pendingAffixChange', 'candidate', 'value'],
        message: '随机洗练候选数值不符合装备等级、品阶、浮动范围或小数精度',
      });
    }
    if (
      pending.operation === 'temper' &&
      (candidate.key !== target.key || candidate.element !== target.element)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['pendingAffixChange', 'candidate'],
        message: '淬炼候选必须保持原词条类型与元素',
      });
    }
    if (
      pending.operation === 'resonate' &&
      (candidate.key !== target.key ||
        candidate.element !== target.element ||
        candidate.tier !== target.tier + 1)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['pendingAffixChange', 'candidate'],
        message: '同调候选必须保持类型与元素，并且品阶恰好提升一级',
      });
    }
    if (pending.operation === 'resonate' && target.tier < 5) {
      const expected = promoteAffix(target);
      if (candidate.value !== expected.value) {
        ctx.addIssue({
          code: 'custom',
          path: ['pendingAffixChange', 'candidate', 'value'],
          message: `同调候选数值必须精确提升为 ${expected.value}`,
        });
      }
    }
  });

const equippedSchema = z
  .object({
    weapon: equipmentInstanceSchema.nullable(),
    head: equipmentInstanceSchema.nullable(),
    body: equipmentInstanceSchema.nullable(),
    necklace: equipmentInstanceSchema.nullable(),
    bracelet: equipmentInstanceSchema.nullable(),
    ring: equipmentInstanceSchema.nullable(),
    belt: equipmentInstanceSchema.nullable(),
    shoes: equipmentInstanceSchema.nullable(),
  })
  .strict();

const affectionCharacterProgressSchema = z
  .object({
    points: nonNegativeInteger.max(AFFECTION_RULES.maxPoints),
    mood: affectionMoodSchema,
    dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    interactionsToday: z.number().int().min(0).max(AFFECTION_RULES.dailyInteractionLimit),
    totalInteractions: nonNegativeInteger,
    gearPity: z
      .number()
      .int()
      .min(0)
      .max(AFFECTION_RULES.gearHardPity - 1),
    discoveredGearIds: z
      .array(z.string().min(1))
      .refine((ids) => new Set(ids).size === ids.length, '心虹图鉴不能重复'),
    completedStoryIds: z
      .array(z.string().min(1))
      .refine((ids) => new Set(ids).size === ids.length, '好感剧情完成记录不能重复'),
    choiceHistory: z.record(z.string().min(1), z.string().min(1)),
  })
  .strict()
  .refine(
    (progress) => progress.totalInteractions >= progress.interactionsToday,
    '总互动次数不能少于今日互动次数',
  );

/**
 * 分段校验白名单 = 当前分段 ∪ 已废弃分段。
 *
 * 2026-07-30 分段按新曲线重划并换了 id（docs/64 §一）。玩家存档里的历史
 * TrialBest 带着旧 id，若白名单只认当前分段，老档会直接读不出来 ——
 * 那是「一次更新废掉存档」（铁律 5）。历史记录必须能通过校验，
 * 它们只是不再出现在任何榜单查询里。
 */
const trialBracketIds = new Set<string>([
  ...TRIAL_BRACKETS.map((b) => b.id),
  ...LEGACY_TRIAL_BRACKET_IDS,
]);
const trialBestSchema = z
  .object({
    seasonId: z.string().min(1).max(16),
    weekIndex: nonNegativeInteger,
    bracketId: z.string().refine((id) => trialBracketIds.has(id), '试炼分段不存在'),
    classId: classIdSchema,
    formulaVersion: z.number().int().positive(),
    damage: nonNegativeInteger,
    at: timestamp,
    submitted: z.boolean(),
  })
  .strict();

const milestoneRecordSchema = z
  .object({
    // 白名单校验：档位是固定常量，不在表里的等级不该能进存档
    level: z.number().refine(isMilestoneLevel, '里程碑档位不存在'),
    at: timestamp,
    // 与数据库的 `elapsed_ms > 0` 约束对齐；不合理的用时由服务端判 verified=false，
    // 但「≤ 0」是结构性非法，直接在存档层拒绝
    elapsedMs: z.number().int().positive(),
    submitted: z.boolean(),
  })
  .strict();

const equipmentPresetUidSchema = z.string().min(1).nullable();
const equipmentPresetUidsSchema = z
  .object({
    weapon: equipmentPresetUidSchema,
    head: equipmentPresetUidSchema,
    body: equipmentPresetUidSchema,
    necklace: equipmentPresetUidSchema,
    bracelet: equipmentPresetUidSchema,
    ring: equipmentPresetUidSchema,
    belt: equipmentPresetUidSchema,
    shoes: equipmentPresetUidSchema,
  })
  .strict();
const equipmentPresetStateSchema = z
  .object({
    presets: z
      .array(
        z
          .object({
            id: z.enum(EQUIPMENT_PRESET_IDS),
            classId: classIdSchema,
            equipmentUids: equipmentPresetUidsSchema,
          })
          .strict(),
      )
      .max(EQUIPMENT_PRESET_IDS.length)
      .refine(
        (presets) => new Set(presets.map((preset) => preset.id)).size === presets.length,
        '装备预设编号不能重复',
      ),
    autoSwitch: z.boolean(),
  })
  .strict();

export const saveDataSchema = z
  .object({
    version: z.literal(SAVE_VERSION),
    createdAt: timestamp,
    lastActiveAt: timestamp,
    seed: z.number().int(),
    rngState: z.number().int(),
    nextUid: z.number().int().positive(),
    player: z
      .object({
        name: z.string().min(1).max(20),
        classId: classIdSchema,
        level: z.number().int().positive(),
        exp: nonNegativeInteger,
        gold: nonNegativeInteger,
        stamina: nonNegativeInteger,
        staminaRecoverAt: timestamp,
        /** 每日免费领取日切 key（'YYYY-MM-DD'）；null = 从未领过（今天可领）。 */
        staminaClaimDay: z.string().nullable(),
        /** 当日已领取次数（0~3）。 */
        staminaClaimCount: z.number().int().min(0).max(3),
        // 可选：不存在 = 从没编排过（老存档与新号都是这个状态）。
        // 不设长度上限、不校验 id 是否存在 —— 见 PlayerSave.activeSkillIds 注释：
        // 存档层拒绝会让玩家进不去游戏，非法项交给 resolveActiveSkillSlots 过滤。
        // 无上限也与本文件既有先例一致（如 progress.clearedStageIds）。
        activeSkillIds: z.array(z.string().min(1)).optional(),
        skillLevels: z.record(z.string().min(1), z.number().int().positive()),
        /** M4-2 签到日切 key（'YYYY-MM-DD'）；null = 从未签过。 */
        signInDay: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable(),
        /** 签到累计次数（奖励位置 = 本值 % 7）。 */
        signInCycleClaimed: z.number().int().min(0),
        /** 签到月度计数所属自然月（'YYYY-MM'）；null = 从未签过。 */
        signInMonth: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .nullable(),
        /** 自然月内累计签到天数。 */
        signInMonthCount: z.number().int().min(0).max(31),
      })
      .strict(),
    equipped: equippedSchema,
    bag: z
      .object({
        equipment: z.array(equipmentInstanceSchema),
        items: z.record(z.string(), nonNegativeInteger),
      })
      .strict(),
    progress: z
      .object({
        currentStageId: z.string().min(1),
        clearedStageIds: z.array(z.string().min(1)),
        stageFirstClearedAt: z.record(z.string(), timestamp),
        stageKills: z.record(z.string(), nonNegativeInteger),
        pity: z.record(z.string(), nonNegativeInteger),
        seenTutorials: z.array(z.string().min(1)),
      })
      .strict(),
    settings: z
      .object({
        autoDecomposeBelow: z.union([qualitySchema, z.literal('none')]),
        bgm: z.boolean(),
        sfx: z.boolean(),
        haptics: z.boolean(),
        reduceMotion: z.boolean(),
        visualQuality: z.enum(['standard', 'lite']),
      })
      .strict(),
    stats: z
      .object({
        totalKills: nonNegativeInteger,
        totalPlaySec: nonNegativeNumber,
        bossKills: z.record(z.string(), nonNegativeInteger),
        enhanceCount: nonNegativeInteger,
        reforgeCount: nonNegativeInteger,
        sweepCount: nonNegativeInteger,
        affectionCount: nonNegativeInteger,
        arenaCount: nonNegativeInteger,
        dungeonCount: nonNegativeInteger,
      })
      .strict(),
    shop: z
      .object({
        purchasedOfferIds: z.array(z.string().min(1)),
      })
      .strict(),
    encounters: z
      .object({
        progressSec: nonNegativeNumber,
        generatedCount: nonNegativeInteger,
        resolvedCount: nonNegativeInteger,
        pending: z
          .array(
            z
              .object({
                uid: z.string().min(1),
                encounterId: z.string().min(1),
                regionId: z.string().min(1),
                storyChoiceId: z.string().min(1).optional(),
              })
              .strict(),
          )
          .max(3),
        characters: z.record(
          z.string().min(1),
          z
            .object({
              bond: nonNegativeInteger,
              completedEncounterIds: z
                .array(z.string().min(1))
                .refine((ids) => new Set(ids).size === ids.length, '已完成篇章不能重复'),
              choiceHistory: z.record(z.string().min(1), z.string().min(1)),
            })
            .strict(),
        ),
      })
      .strict(),
    equipmentDungeon: z
      .object({
        dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        clearsToday: z.number().int().min(0).max(EQUIPMENT_DUNGEON_RULES.dailyClears),
        totalClears: nonNegativeInteger,
        depth: equipmentDungeonDepthSchema,
        records: z.record(
          equipmentDungeonRecordKeySchema,
          z
            .object({
              clears: z.number().int().positive(),
              firstClearedAt: timestamp,
              bestDurationMs: z.number().int().positive(),
            })
            .strict(),
        ),
      })
      .strict(),
    affection: z
      .object({
        characters: z
          .object({
            swordsman: affectionCharacterProgressSchema,
            witch: affectionCharacterProgressSchema,
            shaman: affectionCharacterProgressSchema,
            catkin: affectionCharacterProgressSchema,
            kenshi: affectionCharacterProgressSchema,
          })
          .strict(),
      })
      .strict(),
    trial: z
      .object({
        bests: z.array(trialBestSchema).max(TRIAL_BEST_KEEP),
      })
      .strict(),
    // 上界取档位数：每个档位最多一条，改档存档塞不进第四条。
    milestones: z.array(milestoneRecordSchema).max(MILESTONE_LEVELS.length),
    // 装备永久图鉴：只增不删的定义 id 集合（docs/63 §4.2）。
    // 不校验 id 是否存在于 EQUIPMENT —— 绝版装备（如烙印改版后的 80 件副本装）
    // 的定义会长期保留，但将来若真的删掉某个定义，老玩家的收集史不该因此
    // 整档读不出来。展示层查不到定义时跳过即可。
    equipmentCodex: z.object({ discoveredDefIds: z.array(z.string().min(1)) }).strict(),
    equipmentPresets: equipmentPresetStateSchema,
    dailyTasks: z
      .object({
        day: z.string(),
        progress: z.record(DAILY_TASK_ID_ENUM, nonNegativeInteger),
        claimedTiers: z.array(z.number().int().min(0)),
      })
      .strict(),
    monsterCodex: z
      .object({ discoveredMonsterIds: z.array(z.string().min(1)) })
      .strict(),
    // templateId 不校验存在性（与 skillLevels 同口径）：模板改名/删除时
    // 旧邮件仍可读取，core 按空件降级处理；存档层只拦结构伪造。
    mail: z
      .object({
        messages: z.array(
          z
            .object({
              id: z.string().min(1),
              templateId: z.string().min(1),
              deliveredAt: nonNegativeInteger,
              claimed: z.boolean(),
            })
            .strict(),
        ),
      })
      .strict(),
  })
  .strict()
  .superRefine((save, ctx) => {
    for (const issue of skillLevelRecordIssues(save.player.skillLevels, save.player.level)) {
      ctx.addIssue({
        code: 'custom',
        path: ['player', 'skillLevels', ...(issue.skillId ? [issue.skillId] : [])],
        message: issue.message,
      });
    }
    for (const [index, entry] of save.encounters.pending.entries()) {
      if (!entry.storyChoiceId) continue;
      const storyChoices = ENCOUNTERS[entry.encounterId]?.storyArc?.storyChoices;
      if (!storyChoices?.some((choice) => choice.id === entry.storyChoiceId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['encounters', 'pending', index, 'storyChoiceId'],
          message: `剧情回答 ${entry.storyChoiceId} 不属于奇遇 ${entry.encounterId}`,
        });
      }
    }

    for (const [characterId, progress] of Object.entries(save.encounters.characters)) {
      for (const [encounterId, choiceId] of Object.entries(progress.choiceHistory)) {
        const arc = ENCOUNTERS[encounterId]?.storyArc;
        if (
          arc?.characterId !== characterId ||
          !arc.storyChoices.some((choice) => choice.id === choiceId)
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['encounters', 'characters', characterId, 'choiceHistory', encounterId],
            message: `剧情记忆 ${encounterId}/${choiceId} 与角色 ${characterId} 不匹配`,
          });
        }
      }
    }

    for (const classId of CLASS_IDS) {
      const progress = save.affection.characters[classId];
      const character = AFFECTION_CHARACTERS[classId];
      const storyById = new Map(character.stories.map((story) => [story.id, story]));
      const completed = new Set(progress.completedStoryIds);
      const validGearIds = new Set(affectionEquipmentIdsForClass(classId));

      for (const [index, gearId] of progress.discoveredGearIds.entries()) {
        if (!validGearIds.has(gearId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['affection', 'characters', classId, 'discoveredGearIds', index],
            message: `${gearId} 不是 ${classId} 的心虹珍藏`,
          });
        }
      }

      for (const [index, storyId] of progress.completedStoryIds.entries()) {
        const story = storyById.get(storyId);
        if (!story) {
          ctx.addIssue({
            code: 'custom',
            path: ['affection', 'characters', classId, 'completedStoryIds', index],
            message: `${classId} 的好感剧情不存在：${storyId}`,
          });
          continue;
        }
        for (const requiredId of story.requiredStoryIds) {
          if (!completed.has(requiredId)) {
            ctx.addIssue({
              code: 'custom',
              path: ['affection', 'characters', classId, 'completedStoryIds', index],
              message: `${storyId} 缺少前置好感剧情 ${requiredId}`,
            });
          }
        }
      }
      for (const [storyId, choiceId] of Object.entries(progress.choiceHistory)) {
        const story = storyById.get(storyId);
        if (!story || !completed.has(storyId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['affection', 'characters', classId, 'choiceHistory', storyId],
            message: `未完成的好感剧情不能保存回答：${storyId}`,
          });
          continue;
        }
        if (!story.choices.some((choice) => choice.id === choiceId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['affection', 'characters', classId, 'choiceHistory', storyId],
            message: `${storyId} 不存在回答：${choiceId}`,
          });
        }
      }
      for (const storyId of completed) {
        if (!(storyId in progress.choiceHistory)) {
          ctx.addIssue({
            code: 'custom',
            path: ['affection', 'characters', classId, 'choiceHistory'],
            message: `已完成剧情缺少回答记录：${storyId}`,
          });
        }
      }
    }

    const seenUids = new Set<string>();
    let maxNumericUid = 0;
    for (const [slot, instance] of Object.entries(save.equipped)) {
      if (!instance) continue;
      const definition = getEquipment(instance.defId);
      // equipmentInstanceSchema 已负责拒绝未知定义；这里只校验穿戴位置，
      // 不把错槽装备静默挪回背包，避免坏档继续污染运行时状态。
      if (definition && definition.slot !== slot) {
        ctx.addIssue({
          code: 'custom',
          path: ['equipped', slot, 'defId'],
          message: `装备 ${definition.id} 属于 ${definition.slot} 槽，不能穿戴在 ${slot} 槽`,
        });
      }
    }

    const instances: { instance: EquipmentInstance; path: (string | number)[] }[] = [
      ...save.bag.equipment.map((instance, index) => ({
        instance,
        path: ['bag', 'equipment', index] as (string | number)[],
      })),
      ...Object.entries(save.equipped).flatMap(([slot, instance]) =>
        instance
          ? [
              {
                instance,
                path: ['equipped', slot] as (string | number)[],
              },
            ]
          : [],
      ),
    ];

    const ownedByUid = new Map<string, EquipmentInstance>();
    for (const { instance, path } of instances) {
      if (seenUids.has(instance.uid)) {
        ctx.addIssue({
          code: 'custom',
          path: [...path, 'uid'],
          message: `装备 UID 重复：${instance.uid}`,
        });
      }
      seenUids.add(instance.uid);
      ownedByUid.set(instance.uid, instance);

      const match = /^e(\d+)$/.exec(instance.uid);
      if (match) maxNumericUid = Math.max(maxNumericUid, Number(match[1]));
    }

    for (const [presetIndex, preset] of save.equipmentPresets.presets.entries()) {
      const presetUids = new Set<string>();
      for (const slot of SLOT_ORDER) {
        const uid = preset.equipmentUids[slot];
        if (!uid) continue;
        const path = ['equipmentPresets', 'presets', presetIndex, 'equipmentUids', slot];
        if (presetUids.has(uid)) {
          ctx.addIssue({
            code: 'custom',
            path,
            message: `装备预设 ${preset.id} 重复引用 ${uid}`,
          });
          continue;
        }
        presetUids.add(uid);

        const instance = ownedByUid.get(uid);
        if (!instance) {
          ctx.addIssue({
            code: 'custom',
            path,
            message: `装备预设 ${preset.id} 引用了不存在的装备 ${uid}`,
          });
          continue;
        }
        if (!instance.locked) {
          ctx.addIssue({
            code: 'custom',
            path,
            message: `装备预设 ${preset.id} 引用的 ${uid} 必须锁定`,
          });
        }
        const definition = getEquipment(instance.defId);
        if (definition?.slot !== slot) {
          ctx.addIssue({
            code: 'custom',
            path,
            message: `装备预设 ${preset.id} 的 ${slot} 槽不能引用 ${definition?.slot ?? '未知'} 装备`,
          });
        }
        if (definition?.classId && definition.classId !== preset.classId) {
          ctx.addIssue({
            code: 'custom',
            path,
            message: `装备 ${uid} 不属于预设职业 ${preset.classId}`,
          });
        }
      }
    }

    if (save.nextUid <= maxNumericUid) {
      ctx.addIssue({
        code: 'custom',
        path: ['nextUid'],
        message: `nextUid 必须大于现有最大装备编号 e${maxNumericUid}`,
      });
    }

    const recordedClears = Object.values(save.equipmentDungeon.records).reduce(
      (sum, record) => sum + record.clears,
      0,
    );
    if (save.equipmentDungeon.totalClears !== recordedClears) {
      ctx.addIssue({
        code: 'custom',
        path: ['equipmentDungeon', 'totalClears'],
        message: `totalClears 应为通关记录合计 ${recordedClears}`,
      });
    }
    if (save.equipmentDungeon.clearsToday > save.equipmentDungeon.totalClears) {
      ctx.addIssue({
        code: 'custom',
        path: ['equipmentDungeon', 'clearsToday'],
        message: '今日通关次数不能超过历史总通关次数',
      });
    }
    /*
     * 深度链自洽（v16 起，取代旧的「档位链」，docs/66）。
     *
     * 两条不变量，都是防篡改守卫，不是格式检查：
     *   1. 有第 d 层记录，就必须有同档第 1..d-1 层的记录 —— 深度只能一层层打上去
     *   2. depth[档位] 必须等于该档记录里的最深层 —— 两处不能各说各话
     *
     * 第 2 条尤其重要：depth 是玩法门槛的依据，records 是榜单的依据，
     * 若允许它们分叉，改一个就能绕过另一个（docs/61 §2.2 的分叉事故教训）。
     */
    const deepestByTier = new Map<string, number>();
    const seenByTier = new Map<string, Set<number>>();
    for (const recordKey of Object.keys(save.equipmentDungeon.records)) {
      const matched = recordKey.match(/^(.+)_d(\d+)$/);
      if (!matched) continue;
      const tierId = EQUIPMENT_DUNGEON_STAGES[matched[1]!]?.tierId;
      if (!tierId) continue;
      const depth = Number(matched[2]);
      deepestByTier.set(tierId, Math.max(deepestByTier.get(tierId) ?? 0, depth));
      if (!seenByTier.has(tierId)) seenByTier.set(tierId, new Set());
      seenByTier.get(tierId)!.add(depth);
    }

    for (const [tierId, deepest] of deepestByTier) {
      const seen = seenByTier.get(tierId)!;
      for (let depth = 1; depth < deepest; depth++) {
        if (!seen.has(depth)) {
          ctx.addIssue({
            code: 'custom',
            path: ['equipmentDungeon', 'records'],
            message: `${tierId} 有第 ${deepest} 层记录却缺少第 ${depth} 层 —— 深度不能跳级`,
          });
        }
      }
      const declared = save.equipmentDungeon.depth[tierId] ?? 0;
      if (declared !== deepest) {
        ctx.addIssue({
          code: 'custom',
          path: ['equipmentDungeon', 'depth', tierId],
          message: `depth 声明 ${declared} 与通关记录最深层 ${deepest} 不一致`,
        });
      }
    }

    for (const [tierId, declared] of Object.entries(save.equipmentDungeon.depth)) {
      if (declared > 0 && !deepestByTier.has(tierId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['equipmentDungeon', 'depth', tierId],
          message: `${tierId} 声明了深度 ${declared} 却没有任何通关记录`,
        });
      }
    }
  });

export class SaveValidationError extends Error {
  constructor(readonly issues: z.core.$ZodIssue[]) {
    const first = issues[0];
    const path = first?.path.length ? first.path.join('.') : 'root';
    super(`存档字段 ${path} 不合法：${first?.message ?? '未知结构错误'}`);
    this.name = 'SaveValidationError';
  }
}

/** 校验并返回一份不含 Vue Proxy 的普通对象，可安全写入 IndexedDB。 */
export function parseSave(value: unknown): SaveData {
  const result = saveDataSchema.safeParse(value);
  if (!result.success) throw new SaveValidationError(result.error.issues);
  return result.data as SaveData;
}

export function looksLikeSave(value: unknown): value is SaveData {
  return saveDataSchema.safeParse(value).success;
}
