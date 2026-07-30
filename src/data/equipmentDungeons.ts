/**
 * 装备副本配置。
 *
 * 8 个门户解决“缺哪个部位就刷哪个部位”，每个门户有蓝 / 紫 / 橙 / 红
 * 4 档，共 32 场挑战。场景与怪物造型按门户复用，数值随难度独立成长。
 */

import type {
  ClassId,
  Element,
  EquipSlot,
  LootTable,
  MonsterDef,
  Quality,
} from '@/core/types';
import { expectedFullGearCp } from './expectedPower';
import { SLOT_LABELS, SLOT_ORDER } from './constants';
import {
  EQUIPMENT_DUNGEON_TIERS,
  equipmentDungeonGearFor,
  type EquipmentDungeonTier,
  type EquipmentDungeonTierId,
} from './equipmentDungeonGear';

export interface EquipmentDungeonPortal {
  id: string;
  slot: EquipSlot;
  name: string;
  shortName: string;
  keeperName: string;
  minionName: string;
  lore: string;
  ruleCopy: string;
  accent: string;
  element: Element;
  mapAsset: string;
  minionAsset: string;
  bossAsset: string;
  objectPosition: string;
  hpMul: number;
  atkMul: number;
}

export interface EquipmentDungeonEncounter {
  role: 'minion' | 'boss';
  visualId: string;
  asset: string;
  monster: MonsterDef;
}

export interface EquipmentDungeonStage {
  id: string;
  portalId: string;
  slot: EquipSlot;
  tierId: EquipmentDungeonTierId;
  name: string;
  subtitle: string;
  quality: Extract<Quality, 'rare' | 'epic' | 'legendary' | 'mythic'>;
  level: number;
  unlockLevel: number;
  recommendCP: number;
  accent: string;
  glow: string;
  mapAsset: string;
  objectPosition: string;
  previousStageId?: string;
  encounters: readonly [EquipmentDungeonEncounter, EquipmentDungeonEncounter];
  lootTable: LootTable;
}

const PORTAL_SPECS: readonly Omit<EquipmentDungeonPortal, 'id'>[] = [
  {
    slot: 'weapon',
    name: '星刃铸梦炉',
    shortName: '武器炉',
    keeperName: '誓刃锻造姬·芙蕾雅',
    minionName: '线轴剑灵',
    lore: '会把每一次挥击缝进星光钢里的小小铸造王庭。',
    ruleCopy: '剑灵攻击更凶，优先检查防御与生命。',
    accent: '#ff718c',
    element: 'fire',
    mapAsset: 'assets/dungeons/equipment/weapon-battle.webp',
    minionAsset: 'assets/monsters/equipment-dungeon/weapon-minion.webp',
    bossAsset: 'assets/monsters/equipment-dungeon/weapon-boss.webp',
    objectPosition: '52% 58%',
    hpMul: 0.96,
    atkMul: 1.12,
  },
  {
    slot: 'head',
    name: '花冠云端帽坊',
    shortName: '头冠坊',
    keeperName: '星冠裁帽师·米蕾',
    minionName: '帽针精灵',
    lore: '漂在云海上的帽坊，所有花冠都要先通过星风的试戴。',
    ruleCopy: '帽针精灵闪避较高，命中不足时会拖长战斗。',
    accent: '#8f8cff',
    element: 'thunder',
    mapAsset: 'assets/dungeons/equipment/head-battle.webp',
    minionAsset: 'assets/monsters/equipment-dungeon/head-minion.webp',
    bossAsset: 'assets/monsters/equipment-dungeon/head-boss.webp',
    objectPosition: '50% 52%',
    hpMul: 0.9,
    atkMul: 0.94,
  },
  {
    slot: 'body',
    name: '洛丽塔幻衣厅',
    shortName: '幻衣厅',
    keeperName: '礼装人偶师·露西亚',
    minionName: '蕾丝布偶',
    lore: '蕾丝、裙撑和魔法丝线会自己跳舞的华丽礼装展厅。',
    ruleCopy: '人偶师拥有更厚的护盾，是八座门户里最耐打的一位。',
    accent: '#ed75c4',
    element: 'ice',
    mapAsset: 'assets/dungeons/equipment/body-battle.webp',
    minionAsset: 'assets/monsters/equipment-dungeon/body-minion.webp',
    bossAsset: 'assets/monsters/equipment-dungeon/body-boss.webp',
    objectPosition: '49% 55%',
    hpMul: 1.18,
    atkMul: 0.86,
  },
  {
    slot: 'necklace',
    name: '月链天象馆',
    shortName: '天象馆',
    keeperName: '月相珠宝姬·赛蕾',
    minionName: '坠星小灵',
    lore: '项链像星轨一样悬在穹顶，月相会替宝石挑选主人。',
    ruleCopy: '月相会强化暴击，持续承伤比面板战力更重要。',
    accent: '#6da9ff',
    element: 'ice',
    mapAsset: 'assets/dungeons/equipment/necklace-battle.webp',
    minionAsset: 'assets/monsters/equipment-dungeon/necklace-minion.webp',
    bossAsset: 'assets/monsters/equipment-dungeon/necklace-boss.webp',
    objectPosition: '52% 50%',
    hpMul: 0.94,
    atkMul: 1.03,
  },
  {
    slot: 'bracelet',
    name: '蝶翼水晶温室',
    shortName: '晶蝶温室',
    keeperName: '晶蝶园艺师·芙洛拉',
    minionName: '腕花蝶灵',
    lore: '水晶藤蔓结出手环，蝴蝶负责把微光授粉到每颗宝石。',
    ruleCopy: '蝶灵攻速很快，适合用高防御或更快爆发压制。',
    accent: '#63d8bf',
    element: 'none',
    mapAsset: 'assets/dungeons/equipment/bracelet-battle.webp',
    minionAsset: 'assets/monsters/equipment-dungeon/bracelet-minion.webp',
    bossAsset: 'assets/monsters/equipment-dungeon/bracelet-boss.webp',
    objectPosition: '48% 57%',
    hpMul: 0.88,
    atkMul: 1.08,
  },
  {
    slot: 'ring',
    name: '誓约宝戒书库',
    shortName: '宝戒书库',
    keeperName: '誓戒典藏官·诺雅',
    minionName: '戒页书灵',
    lore: '每一枚戒指都夹着一页誓言，只有战胜典藏官才能借走。',
    ruleCopy: '书灵擅长精准反击，闪避路线会更舒服。',
    accent: '#b67cff',
    element: 'thunder',
    mapAsset: 'assets/dungeons/equipment/ring-battle.webp',
    minionAsset: 'assets/monsters/equipment-dungeon/ring-minion.webp',
    bossAsset: 'assets/monsters/equipment-dungeon/ring-boss.webp',
    objectPosition: '54% 50%',
    hpMul: 0.92,
    atkMul: 1.06,
  },
  {
    slot: 'belt',
    name: '星缎织梦工房',
    shortName: '织梦工房',
    keeperName: '织梦裁缝师·佩妮',
    minionName: '缎带团子',
    lore: '整座工房由会自己打结的星缎驱动，蝴蝶结是这里的通行证。',
    ruleCopy: '缎带会削弱节奏，稳定命中比赌暴击更可靠。',
    accent: '#ff9fbe',
    element: 'fire',
    mapAsset: 'assets/dungeons/equipment/belt-battle.webp',
    minionAsset: 'assets/monsters/equipment-dungeon/belt-minion.webp',
    bossAsset: 'assets/monsters/equipment-dungeon/belt-boss.webp',
    objectPosition: '48% 52%',
    hpMul: 1.04,
    atkMul: 0.92,
  },
  {
    slot: 'shoes',
    name: '星步舞会回廊',
    shortName: '舞会回廊',
    keeperName: '午夜舞姬·可可',
    minionName: '舞鞋精灵',
    lore: '不会停下的月夜舞会，走完回廊才能带走一双星步舞鞋。',
    ruleCopy: '舞姬闪避与速度最高，命中、攻速和爆发都很关键。',
    accent: '#75b9ff',
    element: 'none',
    mapAsset: 'assets/dungeons/equipment/shoes-battle.webp',
    minionAsset: 'assets/monsters/equipment-dungeon/shoes-minion.webp',
    bossAsset: 'assets/monsters/equipment-dungeon/shoes-boss.webp',
    objectPosition: '50% 60%',
    hpMul: 0.86,
    atkMul: 1.02,
  },
];

export const EQUIPMENT_DUNGEON_PORTALS: readonly EquipmentDungeonPortal[] =
  PORTAL_SPECS.map((portal) => ({
    ...portal,
    id: `equipment-${portal.slot}`,
  }));

const PORTAL_BY_SLOT = Object.fromEntries(
  EQUIPMENT_DUNGEON_PORTALS.map((portal) => [portal.slot, portal]),
) as Record<EquipSlot, EquipmentDungeonPortal>;

/**
 * 入场装备按“上一档全套的稳定强化阶段”校准。
 *
 * 蓝、紫阶段的装备生命池尚未随品质拉开，必须压低敌方攻击，避免玩家
 * 明明战力达标却被第二波两下带走；橙、红阶段装备生存成长更快，则把
 * 难度主要放在血量与限时输出上。详见 balance 脚本的四职业 15,360 场模拟。
 */
const TIER_ENCOUNTER_SCALE: Readonly<
  Record<EquipmentDungeonTierId, { hp: number; atk: number }>
> = {
  // 2026-07-30 按 codex 平衡模拟修订（docs/56 停更修基配套）：
  // 苍蓝原 8 秒即结束、入场战力比 2.4~2.7，副本毫无仪式感 —— 血量翻倍
  // 把入场套装战斗拉到 15~25 秒；攻击不动，低生命职业的容错保持不变。
  azure: { hp: 2.4, atk: 0.58 },
  // 绛紫 21~24 秒尚可，小幅上调与苍蓝形成递进
  violet: { hp: 0.85, atk: 0.24 },
  // 辉金 weapon 入口对魔女胜率仅 47.5%（喵喵 61.7%）：败因是被打死
  // 而不是打不动，砍攻击救低生命职业，时长几乎不变
  auric: { hp: 1.5, atk: 0.85 },
  crimson: { hp: 2.6, atk: 1.4 },
};

function stageId(slot: EquipSlot, tierId: EquipmentDungeonTierId): string {
  return `equipment_${slot}_${tierId}`;
}

function lootTableFor(
  slot: EquipSlot,
  tier: EquipmentDungeonTier,
): LootTable {
  const definitions = equipmentDungeonGearFor(tier.id, slot);
  if (definitions.length === 0) {
    throw new Error(`[配置错误] ${tier.id} ${slot} 没有装备副本掉落`);
  }
  return {
    id: `loot_equipment_${slot}_${tier.id}`,
    rolls: 1,
    entries: definitions.map((definition) => ({
      itemId: definition.id,
      ...(definition.classId ? { classId: definition.classId } : {}),
      weight: 1,
      minCount: 1,
      maxCount: 1,
      // 通用部位有两款；连续两次没见到其中一款，下一次会保底并额外正常 roll，
      // 形成一次“补偿双掉”，避免定向本仍被重复件拖垮体验。
      ...(definition.classId ? {} : { pityCount: 2 }),
    })),
  };
}

/**
 * 副本推荐战力 = 该等级主线满配战力 × 0.9 × 门户难度。
 *
 * 旧写法是「裸属性战力 × 手填系数」，与玩家实际战力脱节 ——
 * 四档里三档的门槛高于同级玩家满配，最低档高出 39%，
 * 玩家必须越级才能打，而越级期间副本奖励又在贬值，两头落空（docs/47）。
 *
 * 0.9 的那 10% 余量刻意留给强化与词条：玩家得先把装备养一养才够门槛，
 * 这正是洗练系统的短期消耗目标。**不要调到 1.0 以上** ——
 * 高于同级满配就等于要求越级。
 *
 * 门户难度用 sqrt(hpMul × atkMul)，各部位在 0.9~1.1 之间浮动，
 * 保留「有的门户偏难」的手感，但不改变整体档位定位。
 */
/** 推荐战力占同级满配的比例。留 10% 给强化与词条，见 docs/47 规则二。 */
const RECOMMEND_CP_RATIO = 0.9;

function recommendCpFor(
  tier: EquipmentDungeonTier,
  portal: EquipmentDungeonPortal,
): number {
  const portalDifficulty = Math.sqrt(portal.hpMul * portal.atkMul);
  return Math.round(expectedFullGearCp(tier.level) * RECOMMEND_CP_RATIO * portalDifficulty);
}

function encounterFor(
  portal: EquipmentDungeonPortal,
  tier: EquipmentDungeonTier,
  role: 'minion' | 'boss',
  lootTableId: string,
): EquipmentDungeonEncounter {
  const isBoss = role === 'boss';
  const asset = isBoss ? portal.bossAsset : portal.minionAsset;
  const name = isBoss ? portal.keeperName : portal.minionName;
  const visualId = `equipment-${portal.slot}-${role}`;
  const tierScale = TIER_ENCOUNTER_SCALE[tier.id];
  const monster: MonsterDef = {
    id: `monster_${portal.slot}_${tier.id}_${role}`,
    name: `${tier.name}·${name}`,
    level: Math.max(1, tier.level - (isBoss ? 0 : 2)),
    type: isBoss ? 'boss' : 'elite',
    element: portal.element,
    hpMul: (isBoss ? 0.065 : 0.18) * portal.hpMul * tierScale.hp,
    atkMul: (isBoss ? 0.18 : 0.2) * portal.atkMul * tierScale.atk,
    lootTableId,
    sprite: asset,
  };
  return { role, visualId, asset, monster };
}

function buildStages(): Record<string, EquipmentDungeonStage> {
  const out: Record<string, EquipmentDungeonStage> = {};
  for (const slot of SLOT_ORDER) {
    const portal = PORTAL_BY_SLOT[slot];
    EQUIPMENT_DUNGEON_TIERS.forEach((tier, index) => {
      const id = stageId(slot, tier.id);
      const lootTable = lootTableFor(slot, tier);
      out[id] = {
        id,
        portalId: portal.id,
        slot,
        tierId: tier.id,
        name: `${portal.shortName}·${tier.name}`,
        subtitle: `定向掉落 ${tier.shortName}${SLOT_LABELS[slot]}`,
        quality: tier.quality,
        level: tier.level,
        unlockLevel: tier.unlockLevel,
        recommendCP: recommendCpFor(tier, portal),
        accent: portal.accent,
        glow: tier.glow,
        mapAsset: portal.mapAsset,
        objectPosition: portal.objectPosition,
        ...(index > 0
          ? { previousStageId: stageId(slot, EQUIPMENT_DUNGEON_TIERS[index - 1]!.id) }
          : {}),
        encounters: [
          encounterFor(portal, tier, 'minion', lootTable.id),
          encounterFor(portal, tier, 'boss', lootTable.id),
        ],
        lootTable,
      };
    });
  }
  return out;
}

export const EQUIPMENT_DUNGEON_STAGES: Readonly<Record<string, EquipmentDungeonStage>> =
  buildStages();

export const EQUIPMENT_DUNGEON_STAGE_LIST: readonly EquipmentDungeonStage[] =
  Object.values(EQUIPMENT_DUNGEON_STAGES);

export function getEquipmentDungeonStage(
  id: string,
): EquipmentDungeonStage | undefined {
  return EQUIPMENT_DUNGEON_STAGES[id];
}

export function requireEquipmentDungeonStage(id: string): EquipmentDungeonStage {
  const stage = getEquipmentDungeonStage(id);
  if (!stage) throw new Error(`[配置错误] 装备副本关卡不存在：${id}`);
  return stage;
}

export function equipmentDungeonStagesForSlot(
  slot: EquipSlot,
): EquipmentDungeonStage[] {
  return EQUIPMENT_DUNGEON_TIERS.map((tier) =>
    requireEquipmentDungeonStage(stageId(slot, tier.id)),
  );
}

export function equipmentDungeonDropsForClass(
  stage: EquipmentDungeonStage,
  classId: ClassId,
): string[] {
  return stage.lootTable.entries
    .filter((entry) => entry.classId === undefined || entry.classId === classId)
    .map((entry) => entry.itemId);
}
