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
import { ALL_CHAPTERS } from './regions';
// docs/73 A3 批 2-1：typicalQualityAt 已迁往 qualitySchedule（持有口径）。
// 模块级初始化调用必须从 qualitySchedule 直取 —— 经 expectedPower re-export
// 会形成 expectedPower → core/equipment → data/equipment → arenaEquipment
// → expectedPower 的初始化循环（TDZ：绑定尚未完成即被调用）。
import { typicalQualityAt } from './qualitySchedule';

export const ARENA_SET_ID = 'set_arena_stigma';

/**
 * 圣痕套装的等级与品质：**跟随当期主线顶，用公式推导，不手填**。
 *
 * docs/53 §零.3 定的红线是「竞技场的更强不在裸数值上，而在套装效果上，
 * 且该效果只在竞技场内生效」。原实现钉死为 R5 套装等级 +10 的 divine，
 * 实测基础值 2263，而同期主线最强（Lv65 传说）只有 975 —— **强 2.3 倍**，
 * 等于「最强装备只能 PvP 拿」，正是那条红线要避免的死法。
 *
 * 而这在数学上无法靠调等级解决：divine 系数 15.0，与主线的比值
 * 恒为 15 / 当期主线品质系数 —— 传说段 2.59 倍、神话段 1.63 倍，
 * 只有主线本身也出圣器（区域 9，Lv110 段）时才回到 1.00。
 * 所以圣器必须等区域 9；在那之前竞技场装备的品质就该是主线同期品质。
 *
 * 用公式绑定后，区域 7/8/9 上线时竞技场装备会自动跟着抬 ——
 * 等主线真正出圣器那天，这里自然就变成 divine，无需再改一行。
 */
const MAX_CONTENT_LEVEL = Math.max(...ALL_CHAPTERS.map((chapter) => chapter.levelTo));

export const ARENA_EQUIPMENT_LEVEL = MAX_CONTENT_LEVEL;

/** 与主线同期品质一致 —— 竞技场的回报是外观与场内套装效果，不是裸数值。 */
export const ARENA_EQUIPMENT_QUALITY = typicalQualityAt(MAX_CONTENT_LEVEL);

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
  // ── 樱酱 · 瞬樱 ──
  { classId: 'kenshi', slot: 'weapon', name: '圣痕·瞬樱·断界太刀', slug: 'blinkbloom-boundary-katana', series: '瞬樱' },
  { classId: 'kenshi', slot: 'head', name: '圣痕·瞬樱·雪耳剑冠', slug: 'blinkbloom-snowear-crown', series: '瞬樱' },
  { classId: 'kenshi', slot: 'body', name: '圣痕·瞬樱·白羽战衣', slug: 'blinkbloom-whitefeather-garb', series: '瞬樱' },
  { classId: 'kenshi', slot: 'ring', name: '圣痕·瞬樱·归鞘指环', slug: 'blinkbloom-return-ring', series: '瞬樱' },
] as const;

/** 圣痕外观 id：樱酱四槽已接真实可穿层，其余职业暂按既有 slot-only 展示。 */
export function arenaAppearanceId(classId: ClassId, slot: ArenaGearSlot): string {
  return `arena-${classId}-${slot}`;
}

function buildDefinition(spec: ArenaGearSpec): EquipmentDef {
  const common = {
    id: `eq_arena_${spec.classId}_${spec.slug}`,
    name: spec.name,
    quality: ARENA_EQUIPMENT_QUALITY,
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
