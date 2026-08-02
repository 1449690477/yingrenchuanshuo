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
import { V10_EQUIPMENT_DEFINITION_IDS } from './v10EquipmentDefinitions';
import {
  AFFIX_POOL,
  AFFIX_TIERS,
  AFFIX_VALUE_VARIANCE,
  ENHANCE_GAIN_TIERS,
  ENHANCE_MAX,
  ENHANCE_PER_LEVEL,
  EQUIPMENT_BASE_ROLL_MAX,
  EQUIPMENT_BASE_ROLL_MIN,
  LUCK_FULL,
  QUALITY_AFFIX_COUNT,
  QUALITY_PROFESSION_AFFIX_COUNT,
  SLOT_ORDER,
  isAffixGenerationActive,
  isAffixSettlementActive,
  LEGACY_V10_AFFIX_TIER_MULTIPLIERS,
  PROFESSION_AFFIX_POOLS,
} from '@/data/constants';
import { affixValueRange, professionForAffix } from '@/core/equipment';
import { isProfessionAffixSlot } from '@/core/reforge';
import { createEquipmentDungeonState } from '@/core/equipmentDungeon';
import { createEquipmentPresetState } from '@/core/equipmentPresets';
import { createAffectionState } from '@/core/affection';
import { AFFECTION_RULES } from '@/data/affectionRules';
import { getEquipment } from '@/data/equipment';
import { CLASS_SIGIL_IDS } from '@/data/reforgeRules';
import {
  isV10RebasedAffixKey,
  type V10RebasedAffixKey,
  V10_PROFESSION_AFFIX_REBASE,
} from '@/data/legacyAffixHistory';
import type { AffixKey, AffixTier, ClassId, Element, Quality } from '@/core/types';

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
  10: (save) => migrateV10Save(save, true),
  // v12 新增周常试炼成绩簿（联机排行榜，docs/51）；旧档从未打过试炼，直接给空簿。
  11: (save) => ({
    ...save,
    version: 12,
    trial: { bests: [] },
  }),
  // v13 新增装备实例可选字段 imprintSetId（套装烙印，docs/58）。
  // 旧档没有该字段即为「未烙印」，纯版本跳，零改写。
  12: (save) => ({
    ...save,
    version: 13,
  }),
  // v14 新增登顶速度榜的达成记录（docs/51 §4 榜 4）。
  //
  // **刻意给空数组，不做任何补记。** 老档从未记录过「何时到达 Lv N」，
  // 这个事实无法从现状反推：一个 Lv67 的号，我们只知道他建号时间和现在，
  // 不知道他哪天跨过 Lv60。硬按「现在」补记会把他的用时算长，
  // 那是把猜测写成纪录 —— 榜单一旦掺进编造的数据就不值得看了。
  //
  // 代价是老档拿不到已经越过的档位；但按现有玩家分布，
  // 20 人里 18 人的 Lv60 档仍未达成，赛道并没有关上，
  // 而区域 7 上线追加 Lv80 档后连满级号也重新有份。
  13: (save) => ({
    ...save,
    version: 14,
    milestones: [],
  }),
  // v15 新增各关首次通关时刻（进度榜「同关按最早达成排」，docs/51 §4 榜 3）。
  //
  // 同样不补记：老档只有「通关了哪些关」，没有「哪天通的」。
  // 按当下时间补记会让所有老档并列在同一个时刻，既不真实也毫无区分度。
  // 缺条目的关卡在榜上排在有时刻的之后 —— 没有证据就不能主张更早。
  //
  // 这个字段抢在区域 7 上线前落地：那 30 个新关卡的开荒竞速由此可被记录，
  // 而前 180 关的时刻已经永久丢失（docs/63 §一）。
  14: (save) => {
    const progress = asObject(save.progress, 14, 'progress');
    return {
      ...save,
      version: 15,
      progress: { ...progress, stageFirstClearedAt: {} },
    };
  },
  /*
   * v16：装备副本引入「深度」，取代等级门槛（docs/66）。
   *
   * 两处改动，都不丢老档数据：
   *   1. records 的 key 从 `关卡id` 变成 `关卡id_d深度` —— 旧记录一律映射到
   *      **_d1**，因为改造前的每一场就相当于新体系的第 1 层。
   *   2. 新增 depth：该档只要有任意部位的首通记录，就认定 depth = 1。
   *
   * **不伪造更高深度。** 玩家的深度是打出来的，迁移只承认「他确实通过了
   * 这一档」这一个事实 —— 与 v15 不补记首通时刻是同一条原则：
   * 没有证据就不能替玩家主张更多。
   */
  15: (save) => {
    const dungeon = asObject(save.equipmentDungeon, 15, 'equipmentDungeon');
    const oldRecords = asObject(dungeon.records ?? {}, 15, 'equipmentDungeon.records');

    const records: Record<string, unknown> = {};
    const depth: Record<string, number> = {};
    for (const [stageId, record] of Object.entries(oldRecords)) {
      records[`${stageId}_d1`] = record;
      // 关卡 id 形如 equipment_{部位}_{档位}，档位是最后一段
      const tierId = stageId.split('_').pop();
      if (tierId) depth[tierId] = 1;
    }

    return {
      ...save,
      version: 16,
      equipmentDungeon: { ...dungeon, records, depth },
    };
  },
  /*
   * v17：装备永久图鉴（docs/63 §4.2）。
   *
   * 为什么要单独存一份而不是从背包推：背包上限 300 且会强制裁剪，分解又是
   * 常规操作 —— 按背包推导的话，玩家每分解一件，图鉴进度就当场倒退一次
   * （docs/40 红线）。口径同好感线的 discoveredGearIds：只增不删。
   *
   * **回填当前持有（背包 + 穿戴），不回填历史。**
   * 与 v15 不补记首通时刻、v16 不伪造更高深度是同一条原则的两面：
   * 那两条拒绝的是**无法证明的历史**；而「你此刻背包里有这件装备」是
   * 当下就能验证的事实，记下来不是捏造。已经分解掉的确实找不回来 ——
   * 账本从这次迁移开始才完整，这一点在 docs/63 §4.2 里写明。
   */
  16: (save) => {
    const bag = asObject(save.bag, 16, 'bag');
    const equipped = asObject(save.equipped, 16, 'equipped');

    const defIds: string[] = [];
    const collect = (entry: unknown) => {
      const defId = (entry as { defId?: unknown } | null)?.defId;
      if (typeof defId === 'string' && defId) defIds.push(defId);
    };
    if (Array.isArray(bag.equipment)) bag.equipment.forEach(collect);
    Object.values(equipped).forEach(collect);

    return {
      ...save,
      version: 17,
      equipmentCodex: { discoveredDefIds: [...new Set(defIds)] },
    };
  },
  /** v18：新增三套装备预设；旧档没有可证明的玩家选择，因此只建立空状态。 */
  17: (save) => ({
    ...save,
    version: 18,
    equipmentPresets: createEquipmentPresetState(),
  }),
  /** v19：新增第五职业樱酱，并为旧档建立她独立的空好感进度。 */
  18: (save) => {
    if (
      typeof save.lastActiveAt !== 'number' ||
      !Number.isFinite(save.lastActiveAt) ||
      save.lastActiveAt < 0
    ) {
      throw new MigrationError(18, 'lastActiveAt 缺失或格式错误');
    }
    const affection = asObject(save.affection, 18, 'affection');
    const characters = asObject(affection.characters, 18, 'affection.characters');
    const initialKenshi = createAffectionState(save.lastActiveAt, AFFECTION_RULES).characters.kenshi;
    return {
      ...save,
      version: 19,
      affection: {
        ...affection,
        characters: {
          ...characters,
          kenshi: initialKenshi,
        },
      },
    };
  },
  /**
   * v20：试炼纪录增加公式版本。
   *
   * 五职业真实技能把试炼公式从 v1 升到 v2；同一周里两把尺算出的 damage
   * 不能直接比较。历史本地纪录只能确认为旧公式 v1，不能猜成当前版本。
   */
  19: (save) => {
    const trial = asObject(save.trial, 19, 'trial');
    if (!Array.isArray(trial.bests)) {
      throw new MigrationError(19, 'trial.bests 缺失或格式错误');
    }
    return {
      ...save,
      version: 20,
      trial: {
        ...trial,
        bests: trial.bests.map((entry, index) => ({
          ...asObject(entry, 19, `trial.bests.${index}`),
          formulaVersion: 1,
        })),
      },
    };
  },
  /**
   * v21：技能栏（M3-5）。**故意不写入任何字段。**
   *
   * ── 为什么什么都不写 ──
   * `player.activeSkillIds` 的语义是「玩家自己编排过的技能栏」。老存档的玩家
   * **确实从没编排过**，所以诚实的表示就是**字段不存在**。
   *
   * 不能写成 `[]`：那是「玩家明确清空了技能栏」，会让老玩家一次更新之后
   * 上场不带任何主动技。也不能把默认顺序**物化**进存档：那样玩家会被钉死在
   * 迁移当天的默认表上，日后默认顺序调整、或他升级解锁了新技能，都不会再跟着变。
   *
   * 两种写法都会**改变老存档的行为**，而这正是本次迁移唯一要保证不发生的事。
   * 留空之后，`resolveActiveSkillSlots(classId, level, undefined)` 走默认分支，
   * 与 M3-5 上线前逐字一致。参照 v20 的同一个原则：历史数据只登记它**确实是**
   * 的状态，不猜成当前状态。
   *
   * ── 那为什么还要 +1 ──
   * 因为存档 schema 是 `.strict()` 的。若不升版本号，新客户端写出的存档
   * 带着旧客户端不认识的 `activeSkillIds`，旧客户端会抛 `SaveValidationError`
   * ——一串 issue 列表，**看起来像存档损坏**。升到 21 之后，旧客户端拿到的是
   * `SaveTooNewError`：「存档版本 21 高于当前程序支持的 20，可能是用了更新版本
   * 的游戏。」**同样进不去，但玩家看得懂发生了什么。**
   * 这个游戏是 PWA 且更新需要玩家确认，旧包会在线上存活一段时间，
   * 所以这条差别是真会被玩家碰到的。
   */
  20: (save) => ({ ...save, version: 21 }),
  /**
   * v22：每日免费领取体力（M3-6）。
   *
   * 新增 player.staminaClaimDay（日切 key）。旧档没有可证明的领取历史，
   * 迁移填 null = “从未领过”，首次打开当天即可领取（与新号行为一致）。
   */
  21: (save) => ({
    ...save,
    version: 22,
    player: {
      ...(save.player as Record<string, unknown> | null | undefined),
      staminaClaimDay: null,
      staminaClaimCount: 0,
    },
  }),
  /**
   * v23：每日免费领取改为 3 次×30（合 docs/10 §3.4）。
   * 新增 player.staminaClaimCount；v22 仅在当天存在（未发布给玩家），
   * 迁移填 0 = 今天还没领，行为与新号一致。
   */
  22: (save) => ({
    ...save,
    version: 23,
    player: {
      ...(save.player as Record<string, unknown> | null | undefined),
      staminaClaimCount: 0,
    },
  }),
};

function migrateV10Save(
  save: Record<string, unknown>,
  validateExternalV10: boolean,
): Record<string, unknown> {
  // 已越过 v11 的存档（含未来的 v12+）对本次迁移是幂等的，原样返回。
  // 终端版本每次 +1 都会让既有的「迁移幂等」测试再跑一次本函数，
  // 用 >= 判断而不是 === 11，否则旧用例会在每个新版本下假失败。
  if (typeof save.version === 'number' && save.version >= 11) return { ...save };
  const bag = asObject(save.bag, 10, 'bag');
  if (!Array.isArray(bag.equipment)) {
    throw new MigrationError(10, 'bag.equipment 缺失或格式错误');
  }
  const items = asObject(bag.items, 10, 'bag.items');
  const equipped = asObject(save.equipped, 10, 'equipped');
  const player = asObject(save.player, 10, 'player');
  if (typeof player.classId !== 'string' || !(player.classId in PROFESSION_AFFIX_POOLS)) {
    throw new MigrationError(10, 'player.classId 缺失或格式错误');
  }
  const classId = player.classId as ClassId;

  if (validateExternalV10) {
    // v11 会重排职业槽、转换超额职业词条并重标数值；这些步骤都可能把原本
    // 非法的 v10 数据“洗”成合法结构。外部直接进入 v10 边界时必须先按
    // 发布规则校验。更早版本由本模块迁出的可信中间态则保留原值，不二次误杀。
    for (const [index, instance] of bag.equipment.entries()) {
      assertValidV10EquipmentInstance(instance, `bag.equipment.${index}`);
    }
    for (const [slot, instance] of Object.entries(equipped)) {
      if (instance !== null) {
        assertValidV10EquipmentInstance(instance, `equipped.${slot}`);
      }
    }
    assertOnlyV10Fields(equipped, new Set(SLOT_ORDER), 'equipped');
  }

  const sigilRefunds: Partial<Record<ClassId, number>> = {};
  const migrateInstance = (instance: unknown, path: string): Record<string, unknown> => {
    const result = migrateV10EquipmentInstance(instance, classId, path);
    for (const [classId, count] of Object.entries(result.sigilRefunds) as [ClassId, number][]) {
      sigilRefunds[classId] = (sigilRefunds[classId] ?? 0) + count;
    }
    return result.instance;
  };
  const migratedBagEquipment = bag.equipment.map((instance, index) =>
    migrateInstance(instance, `bag.equipment.${index}`),
  );
  const migratedMisplacedEquipment: Record<string, unknown>[] = [];
  const migratedEquipped = Object.fromEntries(
    SLOT_ORDER.map((slot) => {
      const instance = equipped[slot];
      if (instance === null) return [slot, null];
      const rawInstance = asObject(instance, 10, `equipped.${slot}`);
      if (typeof rawInstance.defId !== 'string') {
        throw new MigrationError(10, `equipped.${slot}.defId 缺失或格式错误`);
      }
      const definition = getEquipment(rawInstance.defId);
      if (!definition) {
        throw new MigrationError(
          10,
          `equipped.${slot}.defId 对应装备定义不存在：${rawInstance.defId}`,
        );
      }
      const migrated = migrateInstance(instance, `equipped.${slot}`);
      if (definition.slot === slot) return [slot, migrated];
      migratedMisplacedEquipment.push(migrated);
      return [slot, null];
    }),
  );

  return {
    ...save,
    version: 11,
    bag: {
      ...bag,
      items: applyV10SigilRefunds(items, sigilRefunds),
      equipment: [...migratedBagEquipment, ...migratedMisplacedEquipment],
    },
    equipped: migratedEquipped,
  };
}

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
    // v0~v9 的迁移会有意保留早期版本已经接受的最终词条 value；它们是本模块
    // 刚生成的可信中间态，不应被“外部 v10 输入”门禁反向判坏。
    cur = version === 10 && (rawVersion as number) < 10 ? migrateV10Save(cur, false) : fn(cur);
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

/**
 * v10 发布后四条职业词条调整了基准，T5 的全局系数也由 1.54 调到 1.64。
 * 旧档已经保存的是最终 value，因而只能组合应用新旧比例；重新掷骰会改变
 * 玩家资产，也会消耗 RNG。共鸣候选最后从已迁移 target 精确复算，消除
 * “旧公式先四舍五入、再缩放”可能产生的末位误差。
 */
/**
 * v10 发布包实际能够持久化的词条键快照。v11 新增的延后词条不能因为当前
 * 常量表已经认识它们，就反向成为“合法 v10 数据”。
 */
const V10_PERSISTED_AFFIX_KEYS = new Set<AffixKey>([
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
]);
const V10_GENERAL_AFFIX_KEYS = new Set<AffixKey>(AFFIX_POOL.map((entry) => entry.key));
const V10_PROFESSION_AFFIX_KEYS = new Set<AffixKey>(
  [...V10_PERSISTED_AFFIX_KEYS].filter((key) => professionForAffix(key) !== null),
);
const V10_EQUIPMENT_FIELDS = new Set([
  'uid',
  'defId',
  'enhance',
  'baseRollPermille',
  'enhanceGainPermille',
  'enhanceLuck',
  'affixes',
  'reforgeResonance',
  'pendingAffixChange',
  'locked',
]);
const V10_AFFIX_FIELDS = new Set(['key', 'value', 'element', 'tier']);
const V10_PENDING_FIELDS = new Set(['operation', 'affixIndex', 'candidate']);

interface V10EquipmentMigrationResult {
  instance: Record<string, unknown>;
  sigilRefunds: Partial<Record<ClassId, number>>;
}

function assertValidV10EquipmentInstance(value: unknown, path: string): void {
  const instance = asObject(value, 10, path);
  assertOnlyV10Fields(instance, V10_EQUIPMENT_FIELDS, path);

  if (typeof instance.uid !== 'string' || instance.uid.length === 0) {
    throw new MigrationError(10, `${path}.uid 缺失或格式错误`);
  }
  if (typeof instance.defId !== 'string') {
    throw new MigrationError(10, `${path}.defId 缺失或格式错误`);
  }
  if (!V10_EQUIPMENT_DEFINITION_IDS.has(instance.defId)) {
    throw new MigrationError(10, `${path}.defId 不存在于发布版 v10：${instance.defId}`);
  }
  const definition = getEquipment(instance.defId);
  if (!definition) {
    throw new MigrationError(10, `${path}.defId 对应装备定义不存在：${instance.defId}`);
  }
  if (
    !Number.isInteger(instance.enhance) ||
    (instance.enhance as number) < 0 ||
    (instance.enhance as number) > ENHANCE_MAX
  ) {
    throw new MigrationError(10, `${path}.enhance 必须在 0~${ENHANCE_MAX}`);
  }
  if (
    !Number.isInteger(instance.baseRollPermille) ||
    (instance.baseRollPermille as number) < EQUIPMENT_BASE_ROLL_MIN ||
    (instance.baseRollPermille as number) > EQUIPMENT_BASE_ROLL_MAX
  ) {
    throw new MigrationError(10, `${path}.baseRollPermille 超出 v10 合法范围`);
  }
  if (
    !Array.isArray(instance.enhanceGainPermille) ||
    instance.enhanceGainPermille.length !== ENHANCE_MAX
  ) {
    throw new MigrationError(10, `${path}.enhanceGainPermille 格式错误`);
  }
  for (const [index, gain] of instance.enhanceGainPermille.entries()) {
    if (
      !Number.isInteger(gain) ||
      (gain !== 0 && !ENHANCE_GAIN_TIERS.some((tier) => gain >= tier.min && gain <= tier.max)) ||
      (index < (instance.enhance as number) && gain === 0)
    ) {
      throw new MigrationError(10, `${path}.enhanceGainPermille.${index} 不符合 v10 强化档位`);
    }
  }
  const enhanceLuck = asObject(instance.enhanceLuck, 10, `${path}.enhanceLuck`);
  for (const [level, luck] of Object.entries(enhanceLuck)) {
    if (
      !/^(?:[1-9]|1[0-5])$/.test(level) ||
      !Number.isInteger(luck) ||
      (luck as number) < 1 ||
      (luck as number) > LUCK_FULL
    ) {
      throw new MigrationError(10, `${path}.enhanceLuck.${level} 不符合 v10 幸运桶`);
    }
  }
  if (
    !Number.isInteger(instance.reforgeResonance) ||
    (instance.reforgeResonance as number) < 0 ||
    (instance.reforgeResonance as number) > 20
  ) {
    throw new MigrationError(10, `${path}.reforgeResonance 必须在 0~20`);
  }
  if (typeof instance.locked !== 'boolean') {
    throw new MigrationError(10, `${path}.locked 缺失或格式错误`);
  }
  if (!Array.isArray(instance.affixes)) {
    throw new MigrationError(10, `${path}.affixes 缺失或格式错误`);
  }

  const fixedAffixes = definition.fixedAffixes ?? [];
  const remainingCapacity =
    QUALITY_AFFIX_COUNT[definition.quality] +
    (definition.extraAffixSlots ?? 0) -
    fixedAffixes.length;
  if (remainingCapacity < 0) {
    throw new MigrationError(10, `${path}.defId 的固定词条超过品质容量`);
  }
  if (definition.fixedTemplate && instance.affixes.length > (definition.extraAffixSlots ?? 0)) {
    throw new MigrationError(10, `${path}.affixes 超过完整固定模板的额外槽位`);
  }
  if (instance.affixes.length > remainingCapacity) {
    throw new MigrationError(
      10,
      `${path}.affixes 超过 ${definition.quality} 品质剩余容量 ${remainingCapacity}`,
    );
  }

  const fixedKeys = new Set<AffixKey>();
  for (const fixedAffix of fixedAffixes) {
    if (fixedKeys.has(fixedAffix.key)) {
      throw new MigrationError(10, `${path}.defId 的固定词条键重复：${fixedAffix.key}`);
    }
    fixedKeys.add(fixedAffix.key);
  }
  const randomKeys = new Set<AffixKey>();
  const affixes = instance.affixes.map((affix, index) =>
    // 发布版 v10 只要求既有词条值为有限数字；roll 范围与小数精度门禁
    // 仅作用于待决随机候选。尤其 v9→v10 会合法产出 skillMul=3.125
    // 这类非当前掷骰网格值，不能在玩家已经用 v10 持久化后反向判坏。
    assertValidV10Affix(affix, definition.level, `${path}.affixes.${index}`, false),
  );
  for (const [index, affix] of affixes.entries()) {
    if (fixedKeys.has(affix.key) || randomKeys.has(affix.key)) {
      throw new MigrationError(10, `${path}.affixes.${index}.key 与现有词条重复：${affix.key}`);
    }
    randomKeys.add(affix.key);
  }

  if (instance.pendingAffixChange === undefined) return;
  const pendingPath = `${path}.pendingAffixChange`;
  const pending = asObject(instance.pendingAffixChange, 10, pendingPath);
  assertOnlyV10Fields(pending, V10_PENDING_FIELDS, pendingPath);
  if (
    !['reforge', 'temper', 'inscribe', 'resonate'].includes(
      typeof pending.operation === 'string' ? pending.operation : '',
    )
  ) {
    throw new MigrationError(10, `${pendingPath}.operation 格式错误`);
  }
  if (
    !Number.isInteger(pending.affixIndex) ||
    (pending.affixIndex as number) < 0 ||
    (pending.affixIndex as number) >= affixes.length
  ) {
    throw new MigrationError(10, `${pendingPath}.affixIndex 必须指向现有随机词条`);
  }
  const targetIndex = pending.affixIndex as number;
  const target = affixes[targetIndex]!;
  const candidate = assertValidV10Affix(
    pending.candidate,
    definition.level,
    `${pendingPath}.candidate`,
    pending.operation !== 'resonate',
  );
  const occupiedAfterReplace = new Set<AffixKey>([
    ...fixedKeys,
    ...affixes.filter((_, index) => index !== targetIndex).map((affix) => affix.key),
  ]);
  if (occupiedAfterReplace.has(candidate.key)) {
    throw new MigrationError(
      10,
      `${pendingPath}.candidate.key 与其他随机或固定词条重复：${candidate.key}`,
    );
  }
  if (
    (pending.operation === 'temper' || pending.operation === 'resonate') &&
    !isAffixSettlementActive(target.key)
  ) {
    throw new MigrationError(10, `${pendingPath}.candidate.key 不能继续养成延后结算词条`);
  }
  if (!isAffixGenerationActive(candidate.key)) {
    throw new MigrationError(10, `${pendingPath}.candidate.key 尚未开放生成`);
  }
  if (pending.operation === 'reforge') {
    const professionSlot = isProfessionAffixSlot(definition.quality, affixes.length, targetIndex);
    const expectedPool = professionSlot ? V10_PROFESSION_AFFIX_KEYS : V10_GENERAL_AFFIX_KEYS;
    if (!expectedPool.has(candidate.key)) {
      throw new MigrationError(
        10,
        `${pendingPath}.candidate.key 不属于目标${professionSlot ? '职业' : '通用'}词条槽`,
      );
    }
  }
  if (pending.operation === 'inscribe' && !V10_PROFESSION_AFFIX_KEYS.has(candidate.key)) {
    throw new MigrationError(10, `${pendingPath}.candidate.key 不是 v10 职业词条`);
  }
  if (
    (pending.operation === 'reforge' || pending.operation === 'inscribe') &&
    candidate.key === target.key
  ) {
    throw new MigrationError(10, `${pendingPath}.candidate.key 必须更换词条类型`);
  }
  if (
    pending.operation === 'temper' &&
    (candidate.key !== target.key || candidate.element !== target.element)
  ) {
    throw new MigrationError(10, `${pendingPath}.candidate 不是合法的 v10 淬炼候选`);
  }
  if (pending.operation === 'resonate') {
    assertValidV10ResonatePending(instance.affixes, pending, candidate, path);
  }
}

function assertValidV10Affix(
  value: unknown,
  equipmentLevel: number,
  path: string,
  enforceRolledValue = true,
): Record<string, unknown> & { key: AffixKey; value: number; tier: AffixTier } {
  const affix = asObject(value, 10, path);
  assertOnlyV10Fields(affix, V10_AFFIX_FIELDS, path);
  if (typeof affix.key !== 'string' || !V10_PERSISTED_AFFIX_KEYS.has(affix.key as AffixKey)) {
    throw new MigrationError(10, `${path}.key 不属于 v10 持久化词条池`);
  }
  if (!Number.isInteger(affix.tier) || (affix.tier as number) < 1 || (affix.tier as number) > 5) {
    throw new MigrationError(10, `${path}.tier 必须在 1~5`);
  }
  if (typeof affix.value !== 'number' || !Number.isFinite(affix.value)) {
    throw new MigrationError(10, `${path}.value 必须是有限数字`);
  }
  const requiresElement = affix.key === 'elemDmg' || affix.key === 'wit_elem';
  if (requiresElement ? !isLegacyDamageElement(affix.element) : affix.element !== undefined) {
    throw new MigrationError(
      10,
      `${path}.element 不符合 v10 ${requiresElement ? '属性词条' : '非属性词条'}结构`,
    );
  }
  if (
    enforceRolledValue &&
    !isV10RolledAffixValue(
      affix.key as AffixKey,
      equipmentLevel,
      affix.tier as AffixTier,
      affix.value,
    )
  ) {
    throw new MigrationError(10, `${path}.value 不符合 v10 等级、品阶或精度范围`);
  }
  return affix as Record<string, unknown> & {
    key: AffixKey;
    value: number;
    tier: AffixTier;
  };
}

function isV10RolledAffixValue(
  key: AffixKey,
  equipmentLevel: number,
  tier: AffixTier,
  value: number,
): boolean {
  const spec = requireV11AffixSpec(key, `v10.affix.${key}`);
  const baselineRule = isV10RebasedAffixKey(key) ? V10_PROFESSION_AFFIX_REBASE[key] : undefined;
  const baseline =
    (baselineRule?.oldBaseline ?? (spec.min + spec.max) / 2) *
    (spec.scalesWithLevel ? Math.pow(equipmentLevel, 1.3) : 1);
  const precision = 10 ** spec.decimals;
  const multiplier = LEGACY_V10_AFFIX_TIER_MULTIPLIERS[tier];
  const min =
    Math.round(baseline * multiplier * (1 - AFFIX_VALUE_VARIANCE) * precision) / precision;
  const max =
    Math.round(baseline * multiplier * (1 + AFFIX_VALUE_VARIANCE) * precision) / precision;
  const scaled = value * precision;
  return (
    Math.abs(scaled - Math.round(scaled)) <= 1e-8 &&
    value >= min - Number.EPSILON &&
    value <= max + Number.EPSILON
  );
}

function assertOnlyV10Fields(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
): void {
  const unknown = Object.keys(value).find((key) => !allowed.has(key));
  if (unknown) {
    throw new MigrationError(10, `${path}.${unknown} 不是 v10 允许字段`);
  }
}

function migrateV10EquipmentInstance(
  value: unknown,
  classId: ClassId,
  path: string,
): V10EquipmentMigrationResult {
  const instance = asObject(value, 10, path);
  if (!Array.isArray(instance.affixes)) {
    throw new MigrationError(10, `${path}.affixes 缺失或格式错误`);
  }
  if (typeof instance.defId !== 'string') {
    throw new MigrationError(10, `${path}.defId 缺失或格式错误`);
  }
  const definition = getEquipment(instance.defId);
  if (!definition) {
    throw new MigrationError(10, `${path}.defId 对应装备定义不存在：${instance.defId}`);
  }

  const originalAffixes = instance.affixes;
  const migrated: Record<string, unknown> = {
    ...instance,
    affixes: originalAffixes.map((affix, index) =>
      rebaseV10Affix(affix, `${path}.affixes.${index}`),
    ),
  };

  if (instance.pendingAffixChange !== undefined) {
    const pending = asObject(instance.pendingAffixChange, 10, `${path}.pendingAffixChange`);
    const originalCandidate = asObject(
      pending.candidate,
      10,
      `${path}.pendingAffixChange.candidate`,
    );
    const resonateTargetIndex =
      pending.operation === 'resonate'
        ? assertValidV10ResonatePending(originalAffixes, pending, originalCandidate, path)
        : undefined;
    const candidatePath = `${path}.pendingAffixChange.candidate`;
    let migratedCandidate =
      pending.operation === 'resonate'
        ? rebaseV10Affix(originalCandidate, candidatePath)
        : projectV10RandomCandidateToV11(
            rebaseV10Affix(originalCandidate, candidatePath),
            definition.level,
            candidatePath,
          );
    if (resonateTargetIndex !== undefined) {
      const migratedAffixes = migrated.affixes as Record<string, unknown>[];
      migratedCandidate = normalizeV11ResonateCandidate(
        migratedAffixes[resonateTargetIndex],
        migratedCandidate,
        `${path}.affixes.${resonateTargetIndex}`,
        `${path}.pendingAffixChange.candidate`,
      );
    }
    migrated.pendingAffixChange = {
      ...pending,
      candidate: migratedCandidate,
    };
  }

  return normalizeV11AffixSlots(migrated, definition.level, definition.quality, classId, path);
}

function rebaseV10Affix(value: unknown, path: string): Record<string, unknown> {
  const affix = asObject(value, 10, path);
  const key = affix.key;
  const baselineRule =
    typeof key === 'string' && isV10RebasedAffixKey(key as AffixKey)
      ? V10_PROFESSION_AFFIX_REBASE[key]
      : undefined;
  const tierMultiplier = affix.tier === 5 ? 1.64 / 1.54 : 1;
  if (!baselineRule && tierMultiplier === 1) return { ...affix };

  if (typeof affix.value !== 'number' || !Number.isFinite(affix.value)) {
    throw new MigrationError(10, `${path}.value 必须是有限数字`);
  }

  if (typeof key !== 'string') {
    throw new MigrationError(10, `${path}.key 缺失或格式错误`);
  }
  const baselineMultiplier = baselineRule ? baselineRule.newBaseline / baselineRule.oldBaseline : 1;
  const rebased = roundV11AffixValue(affix.value * baselineMultiplier * tierMultiplier, key, path);
  return {
    ...affix,
    value: rebased,
  };
}

/**
 * v10 已落袋词条沿发布版 schema 只要求有限数，因此迁移时绝不能把历史成品
 * 夹回后来才定义的掷骰区间。随机待决候选不同：发布版已经约束它必须来自旧
 * 掷骰区间，比例重标后也必须投影到 v11 当前可生成的离散边界。
 */
function projectV10RandomCandidateToV11(
  value: Record<string, unknown>,
  equipmentLevel: number,
  path: string,
): Record<string, unknown> {
  const key = requireV11AffixKey(value, path);
  const tier = requireV11AffixTier(value, path);
  if (typeof value.value !== 'number' || !Number.isFinite(value.value)) {
    throw new MigrationError(10, `${path}.value 必须是有限数字`);
  }
  const range = affixValueRange(key, equipmentLevel, tier);
  return {
    ...value,
    value: Math.min(range.max, Math.max(range.min, value.value)),
  };
}

function assertValidV10ResonatePending(
  originalAffixes: unknown[],
  pending: Record<string, unknown>,
  candidate: Record<string, unknown>,
  path: string,
): number {
  const index = pending.affixIndex;
  if (
    !Number.isInteger(index) ||
    (index as number) < 0 ||
    (index as number) >= originalAffixes.length
  ) {
    throw new MigrationError(10, `${path}.pendingAffixChange.affixIndex 格式错误`);
  }
  const target = asObject(
    originalAffixes[index as number],
    10,
    `${path}.affixes.${index as number}`,
  );
  if (
    typeof target.key !== 'string' ||
    candidate.key !== target.key ||
    candidate.element !== target.element ||
    typeof target.value !== 'number' ||
    !Number.isFinite(target.value) ||
    !Number.isInteger(target.tier) ||
    (target.tier as number) < 1 ||
    (target.tier as number) >= 5 ||
    candidate.tier !== (target.tier as number) + 1 ||
    typeof candidate.value !== 'number' ||
    !Number.isFinite(candidate.value)
  ) {
    throw new MigrationError(10, `${path}.pendingAffixChange 不是合法的 v10 同调候选`);
  }

  const currentMultiplier = LEGACY_V10_AFFIX_TIER_MULTIPLIERS[target.tier as AffixTier];
  const nextMultiplier = LEGACY_V10_AFFIX_TIER_MULTIPLIERS[candidate.tier as AffixTier];
  const expected = roundV11AffixValue(
    target.value * (nextMultiplier / currentMultiplier),
    target.key,
    `${path}.pendingAffixChange.candidate`,
  );
  if (candidate.value !== expected) {
    throw new MigrationError(10, `${path}.pendingAffixChange.candidate.value 不符合 v10 同调结果`);
  }
  return index as number;
}

function normalizeV11ResonateCandidate(
  targetValue: unknown,
  candidate: Record<string, unknown>,
  targetPath: string,
  candidatePath: string,
): Record<string, unknown> {
  const target = asObject(targetValue, 10, targetPath);
  const currentTier = AFFIX_TIERS.find((tier) => tier.tier === target.tier);
  const nextTier = AFFIX_TIERS.find((tier) => tier.tier === candidate.tier);
  if (
    typeof target.key !== 'string' ||
    typeof target.value !== 'number' ||
    !Number.isFinite(target.value) ||
    !currentTier ||
    !nextTier
  ) {
    throw new MigrationError(10, `${candidatePath} 无法复算 v11 同调结果`);
  }
  return {
    ...candidate,
    value: roundV11AffixValue(
      target.value * (nextTier.multiplier / currentTier.multiplier),
      target.key,
      candidatePath,
    ),
  };
}

function roundV11AffixValue(value: number, key: string, path: string): number {
  const spec = requireV11AffixSpec(key, path);
  const precision = 10 ** spec.decimals;
  const rounded = Math.round(value * precision) / precision;
  if (!Number.isFinite(rounded)) {
    throw new MigrationError(10, `${path}.value 按 v11 比例重标后超出有限数范围`);
  }
  return rounded;
}

function requireV11AffixSpec(key: string, path: string) {
  const spec =
    AFFIX_POOL.find((entry) => entry.key === key) ??
    Object.values(PROFESSION_AFFIX_POOLS)
      .flat()
      .find((entry) => entry.key === key);
  if (!spec) throw new MigrationError(10, `${path}.key 不存在于当前词条池：${key}`);
  return spec;
}

const V11_PROFESSION_GENERAL_TARGET: Readonly<Partial<Record<AffixKey, AffixKey>>> = {
  swd_guard: 'def',
  swd_heavy: 'critDmg',
  wit_power: 'atk',
  wit_elem: 'elemDmg',
  wit_veil: 'eva',
  sha_vitality: 'hp',
  sha_drain: 'lifesteal',
  sha_ward: 'dmgReduce',
  sha_spirit: 'atk',
  cat_swift: 'spd',
  cat_nimble: 'eva',
};

const V11_ACTIVE_GENERAL_KEYS = AFFIX_POOL.filter((entry) =>
  isAffixGenerationActive(entry.key),
).map((entry) => entry.key);

interface IndexedV11Affix {
  affix: Record<string, unknown>;
  originalIndex: number;
}

function normalizeV11AffixSlots(
  instance: Record<string, unknown>,
  equipmentLevel: number,
  quality: Quality,
  classId: ClassId,
  path: string,
): V10EquipmentMigrationResult {
  if (!Array.isArray(instance.affixes)) {
    throw new MigrationError(10, `${path}.affixes 缺失或格式错误`);
  }
  const entries: IndexedV11Affix[] = instance.affixes.map((value, originalIndex) => ({
    affix: asObject(value, 10, `${path}.affixes.${originalIndex}`),
    originalIndex,
  }));
  const reservedCount = Math.min(QUALITY_PROFESSION_AFFIX_COUNT[quality], entries.length);
  const reservedStart = entries.length - reservedCount;
  const professionEntries = entries.filter(
    (entry) =>
      professionOwnerOfV10Affix(entry.affix, `${path}.affixes.${entry.originalIndex}`) !== null,
  );
  const retainedOriginalIndices = new Set(
    [...professionEntries]
      .sort((left, right) =>
        compareV11ProfessionRetention(left, right, equipmentLevel, reservedStart, path),
      )
      .slice(0, reservedCount)
      .map((entry) => entry.originalIndex),
  );
  const pending =
    instance.pendingAffixChange === undefined
      ? undefined
      : asObject(instance.pendingAffixChange, 10, `${path}.pendingAffixChange`);
  const occupiedKeys = collectV11OccupiedKeys(instance, entries, path);
  if (pending) {
    const candidate = asObject(pending.candidate, 10, `${path}.pendingAffixChange.candidate`);
    occupiedKeys.add(requireV11AffixKey(candidate, `${path}.pendingAffixChange.candidate`));
  }
  const convertedTargetKeys = new Map<number, AffixKey>();
  const sigilRefunds: Partial<Record<ClassId, number>> = {};

  for (const entry of [...professionEntries].sort(
    (left, right) => left.originalIndex - right.originalIndex,
  )) {
    if (retainedOriginalIndices.has(entry.originalIndex)) continue;
    const sourcePath = `${path}.affixes.${entry.originalIndex}`;
    const sourceKey = requireV11AffixKey(entry.affix, sourcePath);
    occupiedKeys.delete(sourceKey);
    const targetKey = chooseV11GeneralConversionKey(entry.affix, occupiedKeys, sourcePath);
    const owner = professionOwnerOfV10Affix(entry.affix, sourcePath);
    if (!owner) {
      throw new MigrationError(10, `${sourcePath}.key 不是职业词条`);
    }
    entry.affix = convertV11AffixToKey(entry.affix, targetKey, equipmentLevel, sourcePath);
    convertedTargetKeys.set(entry.originalIndex, targetKey);
    occupiedKeys.add(targetKey);
    sigilRefunds[owner] = (sigilRefunds[owner] ?? 0) + 1;
  }

  const normalizedEntries = [...entries];
  const retainedOutsidePositions = normalizedEntries
    .map((entry, index) => ({ entry, index }))
    .filter(
      ({ entry, index }) =>
        index < reservedStart && retainedOriginalIndices.has(entry.originalIndex),
    );
  const replaceableReservedPositions = normalizedEntries
    .map((entry, index) => ({ entry, index }))
    .filter(
      ({ entry, index }) =>
        index >= reservedStart && !retainedOriginalIndices.has(entry.originalIndex),
    );
  if (retainedOutsidePositions.length > replaceableReservedPositions.length) {
    throw new MigrationError(10, `${path}.affixes 无法把保留职业词条放入预留槽`);
  }
  for (const [offset, outside] of retainedOutsidePositions.entries()) {
    const reserved = replaceableReservedPositions[offset]!;
    [normalizedEntries[outside.index], normalizedEntries[reserved.index]] = [
      normalizedEntries[reserved.index]!,
      normalizedEntries[outside.index]!,
    ];
  }

  const newIndexByOriginal = new Map(
    normalizedEntries.map((entry, index) => [entry.originalIndex, index]),
  );
  const migratedPending = pending
    ? normalizeV11PendingChange(
        instance,
        pending,
        normalizedEntries,
        newIndexByOriginal,
        convertedTargetKeys,
        equipmentLevel,
        classId,
        reservedStart,
        reservedCount,
        sigilRefunds,
        path,
      )
    : undefined;

  return {
    instance: {
      ...instance,
      affixes: normalizedEntries.map((entry) => entry.affix),
      ...(migratedPending ? { pendingAffixChange: migratedPending } : {}),
    },
    sigilRefunds,
  };
}

function compareV11ProfessionRetention(
  left: IndexedV11Affix,
  right: IndexedV11Affix,
  equipmentLevel: number,
  reservedStart: number,
  path: string,
): number {
  const leftTier = requireV11AffixTier(left.affix, `${path}.affixes.${left.originalIndex}`);
  const rightTier = requireV11AffixTier(right.affix, `${path}.affixes.${right.originalIndex}`);
  if (leftTier !== rightTier) return rightTier - leftTier;

  const leftPercentile = v11AffixRollPercentile(
    left.affix,
    equipmentLevel,
    `${path}.affixes.${left.originalIndex}`,
  );
  const rightPercentile = v11AffixRollPercentile(
    right.affix,
    equipmentLevel,
    `${path}.affixes.${right.originalIndex}`,
  );
  if (leftPercentile !== rightPercentile) return rightPercentile - leftPercentile;

  const leftReserved = left.originalIndex >= reservedStart;
  const rightReserved = right.originalIndex >= reservedStart;
  if (leftReserved !== rightReserved) return leftReserved ? -1 : 1;
  return left.originalIndex - right.originalIndex;
}

function collectV11OccupiedKeys(
  instance: Record<string, unknown>,
  entries: IndexedV11Affix[],
  path: string,
  excludedEntryIndex?: number,
): Set<AffixKey> {
  const keys = new Set<AffixKey>();
  if (typeof instance.defId !== 'string') {
    throw new MigrationError(10, `${path}.defId 缺失或格式错误`);
  }
  const definition = getEquipment(instance.defId);
  if (!definition) {
    throw new MigrationError(10, `${path}.defId 对应装备定义不存在：${instance.defId}`);
  }
  for (const affix of definition.fixedAffixes ?? []) keys.add(affix.key);
  for (const [index, entry] of entries.entries()) {
    if (index === excludedEntryIndex) continue;
    keys.add(requireV11AffixKey(entry.affix, `${path}.affixes.${entry.originalIndex}`));
  }
  return keys;
}

function normalizeV11PendingChange(
  instance: Record<string, unknown>,
  pending: Record<string, unknown>,
  normalizedEntries: IndexedV11Affix[],
  newIndexByOriginal: ReadonlyMap<number, number>,
  convertedTargetKeys: ReadonlyMap<number, AffixKey>,
  equipmentLevel: number,
  classId: ClassId,
  reservedStart: number,
  reservedCount: number,
  sigilRefunds: Partial<Record<ClassId, number>>,
  path: string,
): Record<string, unknown> {
  const originalIndex = pending.affixIndex;
  if (
    !Number.isInteger(originalIndex) ||
    (originalIndex as number) < 0 ||
    (originalIndex as number) >= normalizedEntries.length
  ) {
    throw new MigrationError(10, `${path}.pendingAffixChange.affixIndex 格式错误`);
  }
  const mappedIndex = newIndexByOriginal.get(originalIndex as number);
  if (mappedIndex === undefined) {
    throw new MigrationError(10, `${path}.pendingAffixChange.affixIndex 无法跟随目标迁移`);
  }
  const candidatePath = `${path}.pendingAffixChange.candidate`;
  let candidate = asObject(pending.candidate, 10, candidatePath);
  let operation = pending.operation;
  let targetIndex = mappedIndex;
  if (operation === 'inscribe' && reservedCount > 0 && targetIndex < reservedStart) {
    targetIndex = reservedStart;
  }
  const occupiedKeys = collectV11OccupiedKeys(instance, normalizedEntries, path, targetIndex);

  if (operation === 'inscribe') {
    if (reservedCount === 0) {
      const owner = professionOwnerOfV10Affix(candidate, candidatePath);
      if (!owner) {
        throw new MigrationError(10, `${candidatePath}.key 不是职业词条`);
      }
      const selectionOccupiedKeys = new Set(occupiedKeys);
      selectionOccupiedKeys.add(
        requireV11AffixKey(normalizedEntries[targetIndex]!.affix, `${path}.affixes.${targetIndex}`),
      );
      const targetKey = chooseV11GeneralConversionKey(
        candidate,
        selectionOccupiedKeys,
        candidatePath,
      );
      candidate = convertV11AffixToKey(candidate, targetKey, equipmentLevel, candidatePath);
      occupiedKeys.add(targetKey);
      sigilRefunds[owner] = (sigilRefunds[owner] ?? 0) + 1;
      operation = 'reforge';
    }
  } else {
    const convertedTargetKey = convertedTargetKeys.get(originalIndex as number);
    if (convertedTargetKey && (operation === 'temper' || operation === 'resonate')) {
      candidate = convertV11AffixToKey(
        candidate,
        convertedTargetKey,
        equipmentLevel,
        candidatePath,
      );
      if (operation === 'resonate') {
        candidate = normalizeV11ResonateCandidate(
          normalizedEntries[targetIndex]!.affix,
          candidate,
          `${path}.affixes.${targetIndex}`,
          candidatePath,
        );
      }
    }
    const originalWasProfessionSlot =
      reservedCount > 0 && (originalIndex as number) >= reservedStart;
    const targetIsProfessionSlot = reservedCount > 0 && targetIndex >= reservedStart;
    if (operation === 'reforge' && originalWasProfessionSlot !== targetIsProfessionSlot) {
      const selectionOccupiedKeys = new Set(occupiedKeys);
      selectionOccupiedKeys.add(
        requireV11AffixKey(normalizedEntries[targetIndex]!.affix, `${path}.affixes.${targetIndex}`),
      );
      const targetKey = targetIsProfessionSlot
        ? chooseV11ProfessionCandidateKey(
            candidate,
            classId,
            selectionOccupiedKeys,
            `${path}.affixes.${targetIndex}`,
            candidatePath,
          )
        : chooseV11GeneralConversionKey(candidate, selectionOccupiedKeys, candidatePath);
      candidate = convertV11AffixToKey(candidate, targetKey, equipmentLevel, candidatePath);
    }
  }

  return {
    ...pending,
    operation,
    affixIndex: targetIndex,
    candidate,
  };
}

function chooseV11GeneralConversionKey(
  source: Record<string, unknown>,
  occupiedKeys: ReadonlySet<AffixKey>,
  path: string,
): AffixKey {
  const sourceKey = requireV11AffixKey(source, path);
  const preferred = V11_PROFESSION_GENERAL_TARGET[sourceKey];
  if (
    preferred &&
    isAffixGenerationActive(preferred) &&
    !occupiedKeys.has(preferred) &&
    isV11ElementCompatibleTarget(source, preferred)
  ) {
    return preferred;
  }
  const fallback = V11_ACTIVE_GENERAL_KEYS.find(
    (key) => !occupiedKeys.has(key) && isV11ElementCompatibleTarget(source, key),
  );
  if (!fallback) {
    throw new MigrationError(10, `${path} 没有未占用且可生成的通用词条可供转换`);
  }
  return fallback;
}

function chooseV11ProfessionCandidateKey(
  source: Record<string, unknown>,
  classId: ClassId,
  occupiedKeys: ReadonlySet<AffixKey>,
  targetPath: string,
  candidatePath: string,
): AffixKey {
  const candidate = PROFESSION_AFFIX_POOLS[classId].find(
    (entry) =>
      isAffixGenerationActive(entry.key) &&
      !occupiedKeys.has(entry.key) &&
      isV11ElementCompatibleTarget(source, entry.key),
  );
  if (!candidate) {
    throw new MigrationError(
      10,
      `${candidatePath} 无法为迁移到 ${targetPath} 的目标找到 ${classId} 未占用职业候选`,
    );
  }
  return candidate.key;
}

function isV11ElementCompatibleTarget(
  source: Record<string, unknown>,
  targetKey: AffixKey,
): boolean {
  return targetKey !== 'elemDmg' || isLegacyDamageElement(source.element);
}

function convertV11AffixToKey(
  source: Record<string, unknown>,
  targetKey: AffixKey,
  equipmentLevel: number,
  path: string,
): Record<string, unknown> {
  const tier = requireV11AffixTier(source, path);
  const percentile = v11AffixRollPercentile(source, equipmentLevel, path);
  const targetRange = affixValueRange(targetKey, equipmentLevel, tier);
  const rawValue = targetRange.min + (targetRange.max - targetRange.min) * percentile;
  const precision = 10 ** targetRange.decimals;
  const value = Math.round(rawValue * precision) / precision;
  if (!Number.isFinite(value)) {
    throw new MigrationError(10, `${path}.value 按百分位转换后超出有限数范围`);
  }
  return {
    key: targetKey,
    value,
    tier,
    ...(targetKey === 'elemDmg' && isLegacyDamageElement(source.element)
      ? { element: source.element }
      : {}),
  };
}

function v11AffixRollPercentile(
  affix: Record<string, unknown>,
  equipmentLevel: number,
  path: string,
): number {
  const key = requireV11AffixKey(affix, path);
  const tier = requireV11AffixTier(affix, path);
  if (typeof affix.value !== 'number' || !Number.isFinite(affix.value)) {
    throw new MigrationError(10, `${path}.value 必须是有限数字`);
  }
  const range = affixValueRange(key, equipmentLevel, tier);
  if (range.max === range.min) return 0.5;
  return (affix.value - range.min) / (range.max - range.min);
}

function requireV11AffixKey(affix: Record<string, unknown>, path: string): AffixKey {
  if (typeof affix.key !== 'string') {
    throw new MigrationError(10, `${path}.key 缺失或格式错误`);
  }
  requireV11AffixSpec(affix.key, path);
  return affix.key as AffixKey;
}

function requireV11AffixTier(affix: Record<string, unknown>, path: string): AffixTier {
  if (!Number.isInteger(affix.tier) || (affix.tier as number) < 1 || (affix.tier as number) > 5) {
    throw new MigrationError(10, `${path}.tier 必须在 1~5`);
  }
  return affix.tier as AffixTier;
}

function professionOwnerOfV10Affix(affix: Record<string, unknown>, path: string): ClassId | null {
  return professionForAffix(requireV11AffixKey(affix, path));
}

function applyV10SigilRefunds(
  items: Record<string, unknown>,
  refunds: Readonly<Partial<Record<ClassId, number>>>,
): Record<string, unknown> {
  const migrated = { ...items };
  for (const [classId, count] of Object.entries(refunds) as [ClassId, number][]) {
    const itemId = CLASS_SIGIL_IDS[classId];
    const current = migrated[itemId] ?? 0;
    if (!Number.isInteger(current) || (current as number) < 0) {
      throw new MigrationError(10, `bag.items.${itemId} 格式错误`);
    }
    migrated[itemId] = (current as number) + count;
  }
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
  const v10Tiers = ([1, 2, 3, 4, 5] as const).map((tier) => ({
    tier,
    multiplier: LEGACY_V10_AFFIX_TIER_MULTIPLIERS[tier],
  }));
  const firstTier = v10Tiers[0]!;

  let nearest = firstTier;
  let nearestDistance = Math.abs(ratio - firstTier.multiplier);
  for (const tier of v10Tiers.slice(1)) {
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
