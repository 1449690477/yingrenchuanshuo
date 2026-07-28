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

import { z } from 'zod';
import { createEncounterState, type EncounterState } from '@/core/encounters';
import { createEquipmentDungeonState, type EquipmentDungeonState } from '@/core/equipmentDungeon';
import { createAffectionState, type AffectionState } from '@/core/affection';
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
  STAMINA_BASE_MAX,
} from '@/data/constants';
import { ENCOUNTERS } from '@/data/encounters';
import { FIRST_STAGE_ID } from '@/data/stages';
import { EQUIPMENT_DUNGEON_RULES } from '@/data/equipmentDungeonRules';
import { EQUIPMENT_DUNGEON_STAGES, EQUIPMENT_DUNGEON_STAGE_LIST } from '@/data/equipmentDungeons';
import { AFFECTION_CHARACTERS } from '@/data/affection';
import { affectionEquipmentIdsForClass } from '@/data/affectionEquipment';
import { AFFECTION_RULES } from '@/data/affectionRules';
import { getEquipment } from '@/data/equipment';

/** 当前存档版本。加字段就 +1。 */
export const SAVE_VERSION = 10;

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
  /** 各关已累计的击杀数，中途关闭页面也不能丢进度 */
  stageKills: Record<string, number>;
  /** 掉落保底计数器，key 为 `${tableId}:${itemId}` */
  pity: Record<string, number>;
  /** 已看过教学提示的章节 id，避免重复弹 */
  seenTutorials: string[];
}

export interface SettingsSave {
  /** 自动分解低于该品质的装备。'none' = 不自动分解 */
  autoDecomposeBelow: Quality | 'none';
  bgm: boolean;
  sfx: boolean;
  /** 好感互动的设备短震反馈；不支持振动的设备会自然忽略。 */
  haptics: boolean;
  /** 降低动画以省电 */
  reduceMotion: boolean;
}

export interface StatsSave {
  totalKills: number;
  totalPlaySec: number;
  /** BOSS 累计击杀数，key 为怪物 id。套装保底用。 */
  bossKills: Record<string, number>;
}

export interface ShopSave {
  /** 珍品每件限购一次，防止连续点击重复扣款与背包刷副本。 */
  purchasedOfferIds: string[];
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
  /** 四位可玩角色彼此独立的好感、剧情、保底与心虹图鉴。 */
  affection: AffectionState;
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
    },
    equipped: emptyEquipped(),
    bag: { equipment: [], items: {} },
    progress: {
      currentStageId: FIRST_STAGE_ID,
      clearedStageIds: [],
      stageKills: {},
      pity: {},
      seenTutorials: [],
    },
    settings: {
      autoDecomposeBelow: 'none',
      bgm: false,
      sfx: true,
      haptics: true,
      reduceMotion: false,
    },
    stats: { totalKills: 0, totalPlaySec: 0, bossKills: {} },
    shop: { purchasedOfferIds: [] },
    encounters: createEncounterState(),
    equipmentDungeon: createEquipmentDungeonState(now),
    affection: createAffectionState(now, AFFECTION_RULES),
  };
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
 * 已接入真实结算的随机词条持久化白名单。
 *
 * 依赖后续战斗状态机的专属词条不会提前加入：这样存档校验与实际可生成池保持一致，
 * 避免把尚未生效的展示字段写进玩家存档。
 */
const persistedAffixKeys = [
  'atk',
  'def',
  'hp',
  'acc',
  'eva',
  'critRate',
  'critDmg',
  'spd',
  'dmgReduce',
  'elemDmg',
  'lifesteal',
  'skillMul',
  'swd_guard',
  'swd_heavy',
  'wit_power',
  'wit_elem',
  'sha_vitality',
  'sha_drain',
  'sha_ward',
  'cat_swift',
  'cat_nimble',
] as const satisfies readonly AffixKey[];
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
const equipmentDungeonStageIdSchema = z
  .string()
  .refine((stageId) => equipmentDungeonStageIds.has(stageId), '装备副本关卡不存在');

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
    if (
      requiresElement &&
      !['fire', 'ice', 'thunder'].includes(affix.element ?? '')
    ) {
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

const equipmentInstanceSchema = z
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
    const remainingCapacity = QUALITY_AFFIX_COUNT[definition.quality] - fixedAffixes.length;
    if (remainingCapacity < 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['defId'],
        message: `装备定义 ${definition.id} 的固定词条超过品质容量`,
      });
      return;
    }
    if (definition.fixedTemplate && instance.affixes.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['affixes'],
        message: '完整固定模板不能保存随机词条',
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
      })
      .strict(),
    stats: z
      .object({
        totalKills: nonNegativeInteger,
        totalPlaySec: nonNegativeNumber,
        bossKills: z.record(z.string(), nonNegativeInteger),
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
        records: z.record(
          equipmentDungeonStageIdSchema,
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
          })
          .strict(),
      })
      .strict(),
  })
  .strict()
  .superRefine((save, ctx) => {
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

    for (const { instance, path } of instances) {
      if (seenUids.has(instance.uid)) {
        ctx.addIssue({
          code: 'custom',
          path: [...path, 'uid'],
          message: `装备 UID 重复：${instance.uid}`,
        });
      }
      seenUids.add(instance.uid);

      const match = /^e(\d+)$/.exec(instance.uid);
      if (match) maxNumericUid = Math.max(maxNumericUid, Number(match[1]));
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
    for (const stageId of Object.keys(save.equipmentDungeon.records)) {
      const previousStageId = EQUIPMENT_DUNGEON_STAGES[stageId]?.previousStageId;
      if (previousStageId && !save.equipmentDungeon.records[previousStageId]) {
        ctx.addIssue({
          code: 'custom',
          path: ['equipmentDungeon', 'records', stageId],
          message: `缺少前置关卡记录 ${previousStageId}`,
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
