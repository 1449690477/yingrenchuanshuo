/**
 * 存档版本迁移链。
 *
 * 规则（AGENTS.md 铁律 5）：
 *   - key 为「从哪个版本迁移」，函数把该版本的存档改成 key+1 版本
 *   - 迁移必须是幂等且不丢数据的
 *   - 每加一条迁移，必须在 __tests__/migrations.spec.ts 加一个测试
 *
 * v0 是开发期原型存档：与 v1 相同，但 settings 里没有 reduceMotion。
 * 保留这条真实可执行的示例，确保以后升级时有可照着做的模板。
 */

import { SAVE_VERSION, parseSave, type SaveData } from './schema';
import {
  AFFIX_POOL,
  AFFIX_TIERS,
  ENHANCE_GAIN_TIERS,
  ENHANCE_MAX,
  ENHANCE_PER_LEVEL,
  EQUIPMENT_BASE_ROLL_MAX,
  EQUIPMENT_BASE_ROLL_MIN,
  LUCK_FULL,
} from '@/data/constants';
import { createEquipmentDungeonState } from '@/core/equipmentDungeon';
import { createAffectionState } from '@/core/affection';
import { AFFECTION_RULES } from '@/data/affectionRules';
import { getEquipment } from '@/data/equipment';
import type { AffixTier, Element } from '@/core/types';

/** 迁移函数接收上一版本的存档（结构未知，故用宽类型），返回下一版本 */
export type Migration = (save: Record<string, unknown>) => Record<string, unknown>;

export const migrations: Record<number, Migration> = {
  0: (save) => {
    const settings = save.settings;
    if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
      throw new MigrationError(0, 'settings 缺失或格式错误');
    }
    return {
      ...save,
      version: 1,
      settings: {
        ...(settings as Record<string, unknown>),
        reduceMotion: (settings as Record<string, unknown>).reduceMotion ?? false,
      },
    };
  },
  1: (save) => {
    const progress = save.progress;
    if (typeof progress !== 'object' || progress === null || Array.isArray(progress)) {
      throw new MigrationError(1, 'progress 缺失或格式错误');
    }
    return {
      ...save,
      version: 2,
      progress: {
        ...(progress as Record<string, unknown>),
        stageKills: {},
      },
    };
  },
  2: (save) => ({
    ...save,
    version: 3,
    shop: {
      purchasedOfferIds: [],
    },
  }),
  3: (save) => {
    const bag = asObject(save.bag, 3, 'bag');
    if (!Array.isArray(bag.equipment)) {
      throw new MigrationError(3, 'bag.equipment 缺失或格式错误');
    }
    const equipped = asObject(save.equipped, 3, 'equipped');

    return {
      ...save,
      version: 4,
      bag: {
        ...bag,
        equipment: bag.equipment.map((instance, index) =>
          migrateEquipmentInstance(instance, `bag.equipment.${index}`),
        ),
      },
      equipped: Object.fromEntries(
        Object.entries(equipped).map(([slot, instance]) => [
          slot,
          instance === null ? null : migrateEquipmentInstance(instance, `equipped.${slot}`),
        ]),
      ),
    };
  },
  4: (save) => ({
    ...save,
    version: 5,
    encounters: { progressSec: 0, generatedCount: 0, resolvedCount: 0, pending: [] },
  }),
  // v6 扩展 classId 合法值域，旧档字段本身无需改写；仅升级版本，
  // 让包含 catkin 的新档不会被旧版程序误判成损坏存档。
  5: (save) => ({
    ...save,
    version: 6,
  }),
  6: (save) => {
    if (
      typeof save.lastActiveAt !== 'number' ||
      !Number.isFinite(save.lastActiveAt) ||
      save.lastActiveAt < 0
    ) {
      throw new MigrationError(6, 'lastActiveAt 缺失或格式错误');
    }
    return {
      ...save,
      version: 7,
      equipmentDungeon: createEquipmentDungeonState(save.lastActiveAt),
    };
  },
  7: (save) => {
    const encounters = asObject(save.encounters, 7, 'encounters');
    return {
      ...save,
      version: 8,
      encounters: {
        ...encounters,
        characters: {},
      },
    };
  },
  8: (save) => {
    if (save.version === 9) return { ...save };
    if (
      typeof save.lastActiveAt !== 'number' ||
      !Number.isFinite(save.lastActiveAt) ||
      save.lastActiveAt < 0
    ) {
      throw new MigrationError(8, 'lastActiveAt 缺失或格式错误');
    }
    const settings = asObject(save.settings, 8, 'settings');
    return {
      ...save,
      version: 9,
      settings: {
        ...settings,
        // 合法 v8 没有该字段；忽略伪造字段，统一采用产品默认值。
        haptics: true,
      },
      affection: createAffectionState(save.lastActiveAt, AFFECTION_RULES),
    };
  },
  9: (save) => {
    if (save.version === 10) return { ...save };
    const bag = asObject(save.bag, 9, 'bag');
    if (!Array.isArray(bag.equipment)) {
      throw new MigrationError(9, 'bag.equipment 缺失或格式错误');
    }
    const equipped = asObject(save.equipped, 9, 'equipped');

    return {
      ...save,
      version: 10,
      bag: {
        ...bag,
        equipment: bag.equipment.map((instance, index) =>
          migrateV9EquipmentInstance(instance, `bag.equipment.${index}`),
        ),
      },
      equipped: Object.fromEntries(
        Object.entries(equipped).map(([slot, instance]) => [
          slot,
          instance === null ? null : migrateV9EquipmentInstance(instance, `equipped.${slot}`),
        ]),
      ),
    };
  },
};

export class SaveTooNewError extends Error {
  constructor(saveVersion: number) {
    super(`存档版本 ${saveVersion} 高于当前程序支持的 ${SAVE_VERSION}，可能是用了更新版本的游戏。`);
    this.name = 'SaveTooNewError';
  }
}

export class MigrationError extends Error {
  constructor(fromVersion: number, reason: string) {
    super(`无法把 v${fromVersion} 存档迁移到 v${fromVersion + 1}：${reason}`);
    this.name = 'MigrationError';
  }
}

/**
 * 把任意旧版本存档升级到当前版本。
 *
 * @throws SaveTooNewError 存档版本比程序还新时抛出 ——
 *         这种情况绝不能静默降级，会丢玩家数据。
 */
export function migrate(raw: Record<string, unknown>): SaveData {
  let cur = { ...raw };
  const rawVersion = cur.version ?? 0;
  if (!Number.isInteger(rawVersion) || (rawVersion as number) < 0) {
    throw new MigrationError(0, 'version 必须是非负整数');
  }
  let version = rawVersion as number;

  if (version > SAVE_VERSION) throw new SaveTooNewError(version);

  while (version < SAVE_VERSION) {
    const fn = migrations[version];
    if (!fn) {
      throw new MigrationError(version, '缺少对应迁移函数');
    }
    cur = fn(cur);
    const expectedVersion = version + 1;
    if (cur.version !== expectedVersion) {
      throw new MigrationError(version, `迁移结果 version 应为 ${expectedVersion}`);
    }
    version = expectedVersion;
  }

  return parseSave(cur);
}

function asObject(value: unknown, fromVersion: number, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new MigrationError(fromVersion, `${path} 缺失或格式错误`);
  }
  return value as Record<string, unknown>;
}

function migrateEquipmentInstance(value: unknown, path: string): Record<string, unknown> {
  const instance = asObject(value, 3, path);
  const enhance = instance.enhance;
  if (!Number.isInteger(enhance) || (enhance as number) < 0 || (enhance as number) > ENHANCE_MAX) {
    throw new MigrationError(3, `${path}.enhance 必须在 0~${ENHANCE_MAX}`);
  }

  const legacyGain = ENHANCE_PER_LEVEL * 1000;
  return {
    ...instance,
    // 合法 v3 不存在这些字段，必须无条件写入旧版等价值，不能信任注入字段。
    baseRollPermille: 1000,
    enhanceGainPermille: Array.from({ length: ENHANCE_MAX }, (_, index) =>
      index < (enhance as number) ? legacyGain : 0,
    ),
    enhanceLuck: {},
  };
}

const V9_EQUIPMENT_KEYS = new Set([
  'uid',
  'defId',
  'enhance',
  'baseRollPermille',
  'enhanceGainPermille',
  'enhanceLuck',
  'affixes',
  'locked',
  // v9 严格结构中不存在；迁移仍需明确忽略导入档伪造的新版本字段。
  'reforgeResonance',
  'pendingAffixChange',
]);
const V9_AFFIX_KEYS = new Set(['key', 'value', 'element', 'tier']);
const LEGACY_DAMAGE_ELEMENTS = ['fire', 'ice', 'thunder'] as const;
const LEGACY_AFFIX_ELEMENTS = new Set<Element>([...LEGACY_DAMAGE_ELEMENTS, 'none']);

function migrateV9EquipmentInstance(value: unknown, path: string): Record<string, unknown> {
  const instance = asObject(value, 9, path);
  assertOnlyKeys(instance, V9_EQUIPMENT_KEYS, 9, path);

  const uid = instance.uid;
  if (typeof uid !== 'string' || uid.length === 0) {
    throw new MigrationError(9, `${path}.uid 缺失或格式错误`);
  }
  const defId = instance.defId;
  if (typeof defId !== 'string' || defId.length === 0) {
    throw new MigrationError(9, `${path}.defId 缺失或格式错误`);
  }
  const definition = getEquipment(defId);
  if (!definition) {
    throw new MigrationError(9, `${path}.defId 对应装备定义不存在：${defId}`);
  }
  if (!Number.isFinite(definition.level) || definition.level <= 0) {
    throw new MigrationError(9, `${path}.defId 对应装备等级不合法：${defId}`);
  }

  assertV9EnhancementFields(instance, path);
  if (typeof instance.locked !== 'boolean') {
    throw new MigrationError(9, `${path}.locked 缺失或格式错误`);
  }
  if (!Array.isArray(instance.affixes)) {
    throw new MigrationError(9, `${path}.affixes 缺失或格式错误`);
  }

  const migrated: Record<string, unknown> = {
    ...instance,
    affixes: instance.affixes.map((affix, index) =>
      migrateV9Affix(affix, uid, index, definition.level, `${path}.affixes.${index}`),
    ),
    // 共鸣和待决候选都是 v10 新语义，绝不能信任旧档注入值。
    reforgeResonance: 0,
  };
  delete migrated.pendingAffixChange;
  return migrated;
}

function assertV9EnhancementFields(instance: Record<string, unknown>, path: string): void {
  const enhance = instance.enhance;
  if (!Number.isInteger(enhance) || (enhance as number) < 0 || (enhance as number) > ENHANCE_MAX) {
    throw new MigrationError(9, `${path}.enhance 必须在 0~${ENHANCE_MAX}`);
  }

  const baseRollPermille = instance.baseRollPermille;
  if (
    !Number.isInteger(baseRollPermille) ||
    (baseRollPermille as number) < EQUIPMENT_BASE_ROLL_MIN ||
    (baseRollPermille as number) > EQUIPMENT_BASE_ROLL_MAX
  ) {
    throw new MigrationError(
      9,
      `${path}.baseRollPermille 必须在 ${EQUIPMENT_BASE_ROLL_MIN}~${EQUIPMENT_BASE_ROLL_MAX}`,
    );
  }

  const gains = instance.enhanceGainPermille;
  if (!Array.isArray(gains) || gains.length !== ENHANCE_MAX) {
    throw new MigrationError(9, `${path}.enhanceGainPermille 必须有 ${ENHANCE_MAX} 格`);
  }
  for (const [index, gain] of gains.entries()) {
    const valid =
      Number.isInteger(gain) &&
      (gain === 0 ||
        ENHANCE_GAIN_TIERS.some(
          (tier) => (gain as number) >= tier.min && (gain as number) <= tier.max,
        ));
    if (!valid || (index < (enhance as number) && gain === 0)) {
      throw new MigrationError(9, `${path}.enhanceGainPermille.${index} 格式错误`);
    }
  }

  const luck = asObject(instance.enhanceLuck, 9, `${path}.enhanceLuck`);
  for (const [target, amount] of Object.entries(luck)) {
    if (
      !/^(?:[1-9]|1[0-5])$/.test(target) ||
      !Number.isInteger(amount) ||
      (amount as number) < 1 ||
      (amount as number) > LUCK_FULL
    ) {
      throw new MigrationError(9, `${path}.enhanceLuck.${target} 格式错误`);
    }
  }
}

function migrateV9Affix(
  value: unknown,
  uid: string,
  affixIndex: number,
  equipmentLevel: number,
  path: string,
): Record<string, unknown> {
  const affix = asObject(value, 9, path);
  assertOnlyKeys(affix, V9_AFFIX_KEYS, 9, path);

  const key = affix.key;
  if (typeof key !== 'string') {
    throw new MigrationError(9, `${path}.key 缺失或格式错误`);
  }
  const poolEntry = AFFIX_POOL.find((entry) => entry.key === key);
  if (!poolEntry) {
    throw new MigrationError(9, `${path}.key 不存在于词条池：${key}`);
  }
  const affixValue = affix.value;
  if (typeof affixValue !== 'number' || !Number.isFinite(affixValue)) {
    throw new MigrationError(9, `${path}.value 必须是有限数字`);
  }

  const migrated: Record<string, unknown> = {
    key,
    value: affixValue,
    tier: inferLegacyAffixTier(
      affixValue,
      equipmentLevel,
      poolEntry.min,
      poolEntry.max,
      poolEntry.scalesWithLevel,
      path,
    ),
  };

  if (key === 'elemDmg') {
    migrated.element = isLegacyDamageElement(affix.element)
      ? affix.element
      : stableLegacyDamageElement(uid, affixIndex);
  } else if (affix.element !== undefined) {
    if (typeof affix.element !== 'string' || !LEGACY_AFFIX_ELEMENTS.has(affix.element as Element)) {
      throw new MigrationError(9, `${path}.element 格式错误`);
    }
    // v9 曾允许任意词条携带 element；非属性伤害词条从未消费该字段。
    // v10 收紧为语义结构，迁移时删除这个无效展示字段，不改变任何战斗数值。
  }

  return migrated;
}

function inferLegacyAffixTier(
  value: number,
  equipmentLevel: number,
  min: number,
  max: number,
  scalesWithLevel: boolean,
  path: string,
): AffixTier {
  const midpoint = (min + max) / 2;
  const baseline = midpoint * (scalesWithLevel ? equipmentLevel ** 1.3 : 1);
  if (!Number.isFinite(baseline) || baseline <= 0) {
    throw new MigrationError(9, `${path} 无法计算合法词条基准值`);
  }
  const ratio = value / baseline;
  const firstTier = AFFIX_TIERS[0];
  if (!firstTier) {
    throw new MigrationError(9, '词条品阶配置为空');
  }

  let nearest = firstTier;
  let nearestDistance = Math.abs(ratio - firstTier.multiplier);
  for (const tier of AFFIX_TIERS.slice(1)) {
    const distance = Math.abs(ratio - tier.multiplier);
    // 精确落在中点时保留较低品阶，规则固定后迁移结果不受遍历实现影响。
    if (distance < nearestDistance) {
      nearest = tier;
      nearestDistance = distance;
    }
  }
  return nearest.tier;
}

function stableLegacyDamageElement(
  uid: string,
  affixIndex: number,
): (typeof LEGACY_DAMAGE_ELEMENTS)[number] {
  let hash = 0x811c9dc5;
  const source = `${uid}:${affixIndex}`;
  for (let index = 0; index < source.length; index++) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  const element = LEGACY_DAMAGE_ELEMENTS[(hash >>> 0) % LEGACY_DAMAGE_ELEMENTS.length];
  if (!element) throw new MigrationError(9, '属性伤害元素映射配置为空');
  return element;
}

function isLegacyDamageElement(value: unknown): value is (typeof LEGACY_DAMAGE_ELEMENTS)[number] {
  return (
    typeof value === 'string' &&
    LEGACY_DAMAGE_ELEMENTS.includes(value as (typeof LEGACY_DAMAGE_ELEMENTS)[number])
  );
}

function assertOnlyKeys(
  object: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  fromVersion: number,
  path: string,
): void {
  const unknownKey = Object.keys(object).find((key) => !allowed.has(key));
  if (unknownKey) {
    throw new MigrationError(fromVersion, `${path}.${unknownKey} 是未知字段`);
  }
}
