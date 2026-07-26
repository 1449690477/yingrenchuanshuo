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
import type { ClassId, EquipmentInstance, EquipSlot, Quality } from '@/core/types';
import { CLASS_BASE_STATS, STAMINA_BASE_MAX } from '@/data/constants';
import { FIRST_STAGE_ID } from '@/data/stages';

/** 当前存档版本。加字段就 +1。 */
export const SAVE_VERSION = 2;

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
  /** 降低动画以省电 */
  reduceMotion: boolean;
}

export interface StatsSave {
  totalKills: number;
  totalPlaySec: number;
  /** BOSS 累计击杀数，key 为怪物 id。套装保底用。 */
  bossKills: Record<string, number>;
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
      reduceMotion: false,
    },
    stats: { totalKills: 0, totalPlaySec: 0, bossKills: {} },
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
const classIdSchema = z.enum(['swordsman', 'witch', 'shaman']);
const qualitySchema = z.enum(['common', 'fine', 'rare', 'epic', 'legendary', 'mythic', 'divine']);
const elementSchema = z.enum(['fire', 'ice', 'thunder', 'none']);
const affixKeySchema = z.enum([
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
]);

const finiteNumber = z.number().finite();
const nonNegativeNumber = finiteNumber.nonnegative();
const nonNegativeInteger = z.number().int().nonnegative();
const timestamp = nonNegativeInteger;

const affixSchema = z
  .object({
    key: affixKeySchema,
    value: finiteNumber,
    element: elementSchema.optional(),
  })
  .strict();

const equipmentInstanceSchema = z
  .object({
    uid: z.string().min(1),
    defId: z.string().min(1),
    enhance: z.number().int().min(0).max(15),
    affixes: z.array(affixSchema),
    locked: z.boolean(),
  })
  .strict();

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
  })
  .strict();

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
