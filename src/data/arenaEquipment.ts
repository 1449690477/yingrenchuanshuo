/**
 * 圣痕装备（竞技场专属套装，docs/53 §一）。
 *
 * 数据铁律（docs/53 §五）：本文件只出现名称、slug、部位、职业、setId，
 * **不写任何数值常量** —— 裸数值全部由 divine 品质表推导
 * （baseEquipStats：ITEM_BASE × L^1.35 × QUALITY_MUL.divine(15.0) × ITEM_SCALE），
 * 与「主线圣器」完全同一条公式，天然满足「裸数值一致」验收。
 *
 * 命名口径（docs/53 §1.4）：前缀「圣痕·」来自 QUALITY_PREFIX.divine；
 * QUALITY_PREFIX 私有于 equipment.ts，为避免 equipment.ts ↔ arenaEquipment.ts
 * 循环依赖，这里直接写出最终显示名，并有测试锁定前缀与 QUALITY_PREFIX 一致。
 *
 * 套装效果只在竞技场内生效（docs/53 §六 验收红线）：
 *   - 挂机 / 主线 / 试炼管线走 data/equipmentSets.ts 的 getFieldEquipmentSet，
 *     拿到的是剥离效果的同 id 定义（件数照数、加成恒 0）；
 *   - 对决管线（core/duel.ts buildArenaDuelSide）才使用本文件的完整定义。
 * 换装层是第二批工作（docs/53 §2.4）：当前四槽全部注册为 slot-only 外观，
 * 图标完整显示在装备槽里，人物立绘不变。
 */

import type { ClassId, EquipmentDef, EquipmentInstance } from '@/core/types';
import type { EquipmentSetDefinition } from '@/core/equipmentSets';
import { REGION_5_SET_LEVEL } from './region5';

export const ARENA_SET_ID = 'set_arena_stigma';

/**
 * 等级不是手填数值：对齐区域 5 套装基底 + divine 品质等级偏移
 * （QUALITY_LEVEL_OFFSET.divine = +10，见 equipment.ts），与主线品质开放节奏同源。
 */
export const ARENA_EQUIPMENT_LEVEL = REGION_5_SET_LEVEL + 10;

type ArenaGearSlot = 'weapon' | 'head' | 'body' | 'ring';

/** 套装的权威战斗定义；只有对决管线会用到它（见文件头说明）。 */
export const ARENA_EQUIPMENT_SET: EquipmentSetDefinition = {
  id: ARENA_SET_ID,
  name: '圣痕套',
  pieceSlots: ['weapon', 'head', 'body', 'ring'],
  bonuses: [
    {
      pieces: 2,
      label: '裁决圣印',
      description: '攻击 +8%（仅竞技场内生效）',
      statPercent: { atk: 0.08 },
    },
    {
      pieces: 4,
      label: '冠冕圣域',
      description: '攻击 +8%、减伤 +10%（仅竞技场内生效；防守方额外 +5% 减伤）',
      statPercent: { atk: 0.08 },
      combatBonuses: { damageReduction: 10 },
    },
  ],
};

interface ArenaGearSpec {
  classId: ClassId;
  slot: ArenaGearSlot;
  /** 最终显示名（含「圣痕·」前缀，见文件头命名口径） */
  name: string;
  slug: string;
  series: string;
}

const SPECS: readonly ArenaGearSpec[] = [
  // ── 剑姬 · 凯旋 ──
  { classId: 'swordsman', slot: 'weapon', name: '圣痕·凯旋·裁决之剑', slug: 'triumph-verdict-blade', series: '凯旋' },
  { classId: 'swordsman', slot: 'head', name: '圣痕·凯旋·荣冠', slug: 'triumph-laurel-crown', series: '凯旋' },
  { classId: 'swordsman', slot: 'body', name: '圣痕·凯旋·战披', slug: 'triumph-battle-mantle', series: '凯旋' },
  { classId: 'swordsman', slot: 'ring', name: '圣痕·凯旋·誓约指环', slug: 'triumph-oath-ring', series: '凯旋' },
  // ── 魔女 · 裁星 ──
  { classId: 'witch', slot: 'weapon', name: '圣痕·裁星·天平法杖', slug: 'starjudge-scale-staff', series: '裁星' },
  { classId: 'witch', slot: 'head', name: '圣痕·裁星·观星冠', slug: 'starjudge-observatory-crown', series: '裁星' },
  { classId: 'witch', slot: 'body', name: '圣痕·裁星·星轨长袍', slug: 'starjudge-orbit-robe', series: '裁星' },
  { classId: 'witch', slot: 'ring', name: '圣痕·裁星·恒星指环', slug: 'starjudge-fixedstar-ring', series: '裁星' },
  // ── 灵巫 · 神谕 ──
  { classId: 'shaman', slot: 'weapon', name: '圣痕·神谕·灵铃杖', slug: 'oracle-spirit-bell-staff', series: '神谕' },
  { classId: 'shaman', slot: 'head', name: '圣痕·神谕·祭冠', slug: 'oracle-rite-crown', series: '神谕' },
  { classId: 'shaman', slot: 'body', name: '圣痕·神谕·巫祝礼衣', slug: 'oracle-ritual-vestment', series: '神谕' },
  { classId: 'shaman', slot: 'ring', name: '圣痕·神谕·契灵指环', slug: 'oracle-pact-ring', series: '神谕' },
  // ── 喵喵 · 疾影 ──
  { classId: 'catkin', slot: 'weapon', name: '圣痕·疾影·双弦爪', slug: 'swiftshadow-twin-claws', series: '疾影' },
  { classId: 'catkin', slot: 'head', name: '圣痕·疾影·夜猎耳饰', slug: 'swiftshadow-nighthunt-ears', series: '疾影' },
  { classId: 'catkin', slot: 'body', name: '圣痕·疾影·潜行战衣', slug: 'swiftshadow-stalker-suit', series: '疾影' },
  { classId: 'catkin', slot: 'ring', name: '圣痕·疾影·迅捷指环', slug: 'swiftshadow-agile-ring', series: '疾影' },
] as const;

/** 圣痕外观 id：四槽统一 slot-only，第二批换装层落地后再升级为 layer。 */
export function arenaAppearanceId(classId: ClassId, slot: ArenaGearSlot): string {
  return `arena-${classId}-${slot}`;
}

function buildDefinition(spec: ArenaGearSpec): EquipmentDef {
  const common = {
    id: `eq_arena_${spec.classId}_${spec.slug}`,
    name: spec.name,
    quality: 'divine' as const,
    level: ARENA_EQUIPMENT_LEVEL,
    setId: ARENA_SET_ID,
    classId: spec.classId,
    icon: `assets/equipment/arena/${spec.classId}/${spec.slug}.png`,
    appearanceId: arenaAppearanceId(spec.classId, spec.slot),
    uniqueEffect: `圣痕套装（${spec.series}系列）：集齐 2 / 4 件在竞技场内激活套装效果；竞技场之外套装效果不生效。`,
  };
  return spec.slot === 'weapon'
    ? { ...common, slot: spec.slot, element: 'none' as const }
    : { ...common, slot: spec.slot };
}

export const ARENA_EQUIPMENT_LIST: readonly EquipmentDef[] = SPECS.map(buildDefinition);

export const ARENA_EQUIPMENT: Readonly<Record<string, EquipmentDef>> = Object.fromEntries(
  ARENA_EQUIPMENT_LIST.map((definition) => [definition.id, definition]),
);

export function arenaEquipmentForClass(classId: ClassId): readonly EquipmentDef[] {
  return ARENA_EQUIPMENT_LIST.filter((definition) => definition.classId === classId);
}

export function requireArenaEquipment(id: string): EquipmentDef {
  const definition = ARENA_EQUIPMENT[id];
  if (!definition) throw new Error(`[配置错误] 圣痕装备不存在：${id}`);
  return definition;
}

/**
 * 统计当前穿戴中的圣痕套件数（0~4）。
 * 对决管线用它判定防守方额外减伤（docs/53 §1.3）。
 */
export function arenaSetPieceCount(equipped: readonly (EquipmentInstance | null)[]): number {
  let count = 0;
  for (const instance of equipped) {
    if (!instance) continue;
    if (ARENA_EQUIPMENT[instance.defId]) count++;
  }
  return count;
}
