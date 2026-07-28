/**
 * 装备副本专属装备。
 *
 * 数量设计：
 *   4 个品质档 ×（4 职业武器 + 4 职业礼服 + 6 个通用部位 × 2 款）= 80 件。
 *
 * 武器与礼服做职业专属，保证四名角色都有贴合职业气质的核心外观；
 * 其余部位提供「星辉 / 守护」两条搭配路线，让同品质也有取舍。
 */

import type {
  Affix,
  AffixKey,
  ClassId,
  EquipmentDef,
  EquipSlot,
  Quality,
} from '@/core/types';
import { CLASS_IDS } from '@/core/types';

export type EquipmentDungeonTierId = 'azure' | 'violet' | 'auric' | 'crimson';

export interface EquipmentDungeonTier {
  id: EquipmentDungeonTierId;
  name: string;
  shortName: string;
  quality: Extract<Quality, 'rare' | 'epic' | 'legendary' | 'mythic'>;
  level: number;
  unlockLevel: number;
  color: string;
  glow: string;
  setId: string;
  setName: string;
  effectLabel: string;
}

export const EQUIPMENT_DUNGEON_TIERS: readonly EquipmentDungeonTier[] = [
  {
    id: 'azure',
    name: '晴蓝梦匣',
    shortName: '蓝色稀有',
    quality: 'rare',
    level: 20,
    unlockLevel: 20,
    color: '#4f9fff',
    glow: '#b9e7ff',
    setId: 'set_dungeon_azure',
    setName: '晴蓝茶会',
    effectLabel: '晴蓝糖晶与细小泡泡',
  },
  {
    id: 'violet',
    name: '月紫星匣',
    shortName: '紫色史诗',
    quality: 'epic',
    level: 35,
    unlockLevel: 35,
    color: '#a96cff',
    glow: '#ead8ff',
    setId: 'set_dungeon_violet',
    setName: '月紫星宴',
    effectLabel: '月兔星砂与新月轨迹',
  },
  {
    id: 'auric',
    name: '琥珀蔷薇匣',
    shortName: '橙色传说',
    quality: 'legendary',
    level: 50,
    unlockLevel: 50,
    color: '#ffab45',
    glow: '#ffe5a8',
    setId: 'set_dungeon_auric',
    setName: '琥珀蔷薇王庭',
    effectLabel: '金色蔷薇与暖光星尘',
  },
  {
    id: 'crimson',
    name: '绯樱典藏匣',
    shortName: '红色典藏珍品',
    quality: 'mythic',
    level: 78,
    unlockLevel: 78,
    color: '#ff4f72',
    glow: '#ffd1dc',
    setId: 'set_dungeon_crimson',
    setName: '绯樱典藏',
    effectLabel: '赤金樱瓣、典藏星环与绯红辉光',
  },
] as const;

const TIER_BY_ID = Object.fromEntries(
  EQUIPMENT_DUNGEON_TIERS.map((tier) => [tier.id, tier]),
) as Record<EquipmentDungeonTierId, EquipmentDungeonTier>;

const CLASS_GEAR: Readonly<
  Record<
    ClassId,
    {
      weaponNoun: string;
      dressNoun: string;
      weaponVisualKey: string;
      bodyVisualKey: string;
      weaponAffix: AffixKey;
      bodyAffix: AffixKey;
      attackCopy: string;
      interactionCopy: string;
    }
  >
> = {
  swordsman: {
    weaponNoun: '誓约花剑',
    dressNoun: '骑士姬礼裙',
    weaponVisualKey: 'weapon-swordsman',
    bodyVisualKey: 'body-swordsman',
    weaponAffix: 'atk',
    bodyAffix: 'def',
    attackCopy: '花瓣沿剑弧逐段亮起',
    interactionCopy: '提裙行骑士礼，剑穗化成一圈小樱花',
  },
  witch: {
    weaponNoun: '星匙法杖',
    dressNoun: '魔女洛丽塔裙',
    weaponVisualKey: 'weapon-witch',
    bodyVisualKey: 'body-witch',
    weaponAffix: 'critDmg',
    bodyAffix: 'eva',
    attackCopy: '星匙展开糖晶法阵与小流星',
    interactionCopy: '轻点帽檐，裙摆下浮起一圈迷你星球',
  },
  shaman: {
    weaponNoun: '祈愿灵铃',
    dressNoun: '祈灵华礼服',
    weaponVisualKey: 'weapon-shaman',
    bodyVisualKey: 'body-shaman',
    weaponAffix: 'acc',
    bodyAffix: 'hp',
    attackCopy: '铃音化作蝴蝶与柔光波纹',
    interactionCopy: '双手祈愿，衣袖间飞出守护灵蝶',
  },
  catkin: {
    weaponNoun: '糖晶双爪',
    dressNoun: '猫耳小礼裙',
    weaponVisualKey: 'weapon-catkin',
    bodyVisualKey: 'body-catkin',
    weaponAffix: 'spd',
    bodyAffix: 'eva',
    attackCopy: '交错爪痕中央弹出猫爪星印',
    interactionCopy: '俏皮转身，尾端留下短暂心形光迹',
  },
};

const TIER_CLASS_PREFIX: Readonly<
  Record<EquipmentDungeonTierId, Record<ClassId, string>>
> = {
  azure: {
    swordsman: '晴蓝茶会',
    witch: '晴蓝糖星',
    shaman: '晴蓝祈愿',
    catkin: '晴蓝猫糖',
  },
  violet: {
    swordsman: '月紫誓约',
    witch: '月紫星仪',
    shaman: '月紫祷歌',
    catkin: '月紫兔影',
  },
  auric: {
    swordsman: '琥珀王庭',
    witch: '琥珀天穹',
    shaman: '琥珀圣歌',
    catkin: '琥珀蔷薇',
  },
  crimson: {
    swordsman: '绯樱典藏',
    witch: '绯樱秘藏',
    shaman: '绯樱圣藏',
    catkin: '绯樱珍藏',
  },
};

type SharedSlot = Exclude<EquipSlot, 'weapon' | 'body'>;

interface SharedVariant {
  suffix: string;
  visualKey: string;
  affix: AffixKey;
  effect: string;
}

const SHARED_VARIANTS: Readonly<Record<SharedSlot, readonly [SharedVariant, SharedVariant]>> = {
  head: [
    {
      suffix: '星纱花冠',
      visualKey: 'head-starlace',
      affix: 'critRate',
      effect: '花冠上依次点亮三颗小星',
    },
    {
      suffix: '守梦小礼帽',
      visualKey: 'head-dreamhat',
      affix: 'hp',
      effect: '帽檐垂下柔软的守护光纱',
    },
  ],
  necklace: [
    {
      suffix: '心锁项链',
      visualKey: 'necklace-heart',
      affix: 'atk',
      effect: '心锁随攻击节奏闪出细小光点',
    },
    {
      suffix: '守护月坠',
      visualKey: 'necklace-moon',
      affix: 'hp',
      effect: '月坠在受击时泛起一圈柔光',
    },
  ],
  bracelet: [
    {
      suffix: '蝶翼手环',
      visualKey: 'bracelet-butterfly',
      affix: 'acc',
      effect: '手边动作会带出两只短暂光蝶',
    },
    {
      suffix: '蔷薇护腕',
      visualKey: 'bracelet-rose',
      affix: 'def',
      effect: '护腕边缘绽开一朵迷你蔷薇',
    },
  ],
  ring: [
    {
      suffix: '星愿宝戒',
      visualKey: 'ring-star',
      affix: 'critDmg',
      effect: '暴击演出会多出一颗拖尾星',
    },
    {
      suffix: '守梦晶戒',
      visualKey: 'ring-guard',
      affix: 'eva',
      effect: '闪避时留下晶莹的环形残光',
    },
  ],
  belt: [
    {
      suffix: '宴会蝴蝶腰封',
      visualKey: 'belt-bow',
      affix: 'def',
      effect: '大蝴蝶结随角色动作轻轻摆动',
    },
    {
      suffix: '星幕束带',
      visualKey: 'belt-starlight',
      affix: 'hp',
      effect: '腰间星幕随呼吸明暗变化',
    },
  ],
  shoes: [
    {
      suffix: '星屑舞鞋',
      visualKey: 'shoes-stardust',
      affix: 'spd',
      effect: '脚步留下短暂的星屑与小花',
    },
    {
      suffix: '守梦圆头鞋',
      visualKey: 'shoes-ribbon',
      affix: 'eva',
      effect: '鞋跟落地时弹出柔软丝带光斑',
    },
  ],
};

const TIER_SHARED_PREFIX: Readonly<Record<EquipmentDungeonTierId, string>> = {
  azure: '晴蓝',
  violet: '月紫',
  auric: '琥珀',
  crimson: '绯樱典藏',
};

const PERCENT_AFFIX_BASE: Readonly<Record<'critRate' | 'critDmg' | 'spd', number[]>> = {
  critRate: [1.2, 1.8, 2.4, 3],
  critDmg: [5, 8, 11, 14],
  spd: [0.02, 0.03, 0.04, 0.05],
};

function tierRank(tier: EquipmentDungeonTier): number {
  return EQUIPMENT_DUNGEON_TIERS.findIndex((candidate) => candidate.id === tier.id);
}

function fixedAffix(key: AffixKey, tier: EquipmentDungeonTier): Affix {
  const rank = tierRank(tier);
  const levelScale = Math.pow(tier.level, 1.3);
  let value: number;

  switch (key) {
    case 'atk':
      value = Math.round(levelScale * (0.5 + rank * 0.05));
      break;
    case 'def':
      value = Math.round(levelScale * (0.38 + rank * 0.04));
      break;
    case 'hp':
      value = Math.round(levelScale * (4.5 + rank * 0.45));
      break;
    case 'acc':
      value = Math.round(levelScale * (0.65 + rank * 0.05));
      break;
    case 'eva':
      value = Math.round(levelScale * (0.55 + rank * 0.05));
      break;
    case 'critRate':
    case 'critDmg':
    case 'spd':
      value = PERCENT_AFFIX_BASE[key][rank]!;
      break;
    default:
      throw new Error(`[配置错误] 装备副本固定词条不支持 ${key}`);
  }

  return { key, value };
}

function iconPath(tierId: EquipmentDungeonTierId, visualKey: string): string {
  return `assets/equipment/dungeon/${tierId}/${visualKey}.png`;
}

export function equipmentDungeonAppearanceId(
  tierId: EquipmentDungeonTierId,
  slot: EquipSlot,
): string {
  return `dungeon-${tierId}-${slot}`;
}

function buildClassGear(
  tier: EquipmentDungeonTier,
  classId: ClassId,
  slot: 'weapon' | 'body',
): EquipmentDef {
  const classSpec = CLASS_GEAR[classId];
  const visualKey =
    slot === 'weapon' ? classSpec.weaponVisualKey : classSpec.bodyVisualKey;
  const affixKey = slot === 'weapon' ? classSpec.weaponAffix : classSpec.bodyAffix;
  const noun = slot === 'weapon' ? classSpec.weaponNoun : classSpec.dressNoun;
  const effect = slot === 'weapon' ? classSpec.attackCopy : classSpec.interactionCopy;

  return {
    id: `eq_dungeon_${tier.id}_${slot}_${classId}`,
    name: `${TIER_CLASS_PREFIX[tier.id][classId]}·${noun}`,
    slot,
    quality: tier.quality,
    level: tier.level,
    setId: tier.setId,
    classId,
    icon: iconPath(tier.id, visualKey),
    appearanceId: equipmentDungeonAppearanceId(tier.id, slot),
    fixedAffixes: [fixedAffix(affixKey, tier)],
    uniqueEffect: `专属视觉：${effect}，并伴随${tier.effectLabel}。`,
  };
}

function buildSharedGear(
  tier: EquipmentDungeonTier,
  slot: SharedSlot,
  variant: SharedVariant,
  index: number,
): EquipmentDef {
  return {
    id: `eq_dungeon_${tier.id}_${slot}_${index + 1}`,
    name: `${TIER_SHARED_PREFIX[tier.id]}·${variant.suffix}`,
    slot,
    quality: tier.quality,
    level: tier.level,
    setId: tier.setId,
    icon: iconPath(tier.id, variant.visualKey),
    appearanceId: equipmentDungeonAppearanceId(tier.id, slot),
    fixedAffixes: [fixedAffix(variant.affix, tier)],
    uniqueEffect: `专属视觉：${variant.effect}，并伴随${tier.effectLabel}。`,
  };
}

function buildEquipmentDungeonGear(): Record<string, EquipmentDef> {
  const out: Record<string, EquipmentDef> = {};
  for (const tier of EQUIPMENT_DUNGEON_TIERS) {
    for (const classId of CLASS_IDS) {
      for (const slot of ['weapon', 'body'] as const) {
        const definition = buildClassGear(tier, classId, slot);
        out[definition.id] = definition;
      }
    }
    for (const [slot, variants] of Object.entries(SHARED_VARIANTS) as [
      SharedSlot,
      readonly [SharedVariant, SharedVariant],
    ][]) {
      variants.forEach((variant, index) => {
        const definition = buildSharedGear(tier, slot, variant, index);
        out[definition.id] = definition;
      });
    }
  }
  return out;
}

export const EQUIPMENT_DUNGEON_GEAR: Readonly<Record<string, EquipmentDef>> =
  buildEquipmentDungeonGear();

export const EQUIPMENT_DUNGEON_GEAR_LIST: readonly EquipmentDef[] =
  Object.values(EQUIPMENT_DUNGEON_GEAR);

export function requireEquipmentDungeonTier(
  tierId: EquipmentDungeonTierId,
): EquipmentDungeonTier {
  const tier = TIER_BY_ID[tierId];
  if (!tier) throw new Error(`[配置错误] 装备副本品质档不存在：${tierId}`);
  return tier;
}

export function equipmentDungeonGearFor(
  tierId: EquipmentDungeonTierId,
  slot: EquipSlot,
  classId?: ClassId,
): EquipmentDef[] {
  return EQUIPMENT_DUNGEON_GEAR_LIST.filter(
    (definition) =>
      definition.quality === requireEquipmentDungeonTier(tierId).quality &&
      definition.slot === slot &&
      (classId === undefined ||
        definition.classId === undefined ||
        definition.classId === classId),
  );
}
