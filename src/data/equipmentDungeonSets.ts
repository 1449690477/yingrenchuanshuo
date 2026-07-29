import type { EquipmentSetDefinition } from '@/core/equipmentSets';
import type { EquipmentDungeonTierId } from './equipmentDungeonGear';

export interface EquipmentDungeonSetDefinition extends EquipmentSetDefinition {
  tierId: EquipmentDungeonTierId;
}

export const EQUIPMENT_DUNGEON_SETS: Readonly<Record<string, EquipmentDungeonSetDefinition>> = {
  set_dungeon_azure: {
    id: 'set_dungeon_azure',
    tierId: 'azure',
    name: '晴蓝茶会',
    bonuses: [
      {
        pieces: 2,
        label: '茶会序曲',
        description: '攻击 +4%',
        statPercent: { atk: 0.04 },
      },
      {
        pieces: 4,
        label: '糖晶护席',
        description: '生命 +8%',
        statPercent: { hp: 0.08 },
      },
      {
        pieces: 6,
        label: '晴空合奏',
        description: '防御 +6%，暴击率 +2%',
        statPercent: { def: 0.06 },
        statFlat: { critRate: 2 },
      },
      {
        pieces: 8,
        label: '蓝匣谢幕',
        description: '平均技能倍率 +0.05',
        skillMultiplierBonus: 0.05,
      },
    ],
  },
  set_dungeon_violet: {
    id: 'set_dungeon_violet',
    tierId: 'violet',
    name: '月紫星宴',
    bonuses: [
      {
        pieces: 2,
        label: '月兔迎宾',
        description: '攻击 +6%',
        statPercent: { atk: 0.06 },
      },
      {
        pieces: 4,
        label: '星纱帷幕',
        description: '生命 +10%',
        statPercent: { hp: 0.1 },
      },
      {
        pieces: 6,
        label: '新月共舞',
        description: '防御 +8%，暴击率 +3%',
        statPercent: { def: 0.08 },
        statFlat: { critRate: 3 },
      },
      {
        pieces: 8,
        label: '紫匣星潮',
        description: '平均技能倍率 +0.08',
        skillMultiplierBonus: 0.08,
      },
    ],
  },
  set_dungeon_auric: {
    id: 'set_dungeon_auric',
    tierId: 'auric',
    name: '琥珀蔷薇王庭',
    bonuses: [
      {
        pieces: 2,
        label: '王庭誓花',
        description: '攻击 +9%',
        statPercent: { atk: 0.09 },
      },
      {
        pieces: 4,
        label: '琥珀壁垒',
        description: '生命 +14%',
        statPercent: { hp: 0.14 },
      },
      {
        pieces: 6,
        label: '金蔷薇礼赞',
        description: '防御 +11%，暴击率 +4%',
        statPercent: { def: 0.11 },
        statFlat: { critRate: 4 },
      },
      {
        pieces: 8,
        label: '王庭加冕',
        description: '平均技能倍率 +0.12',
        skillMultiplierBonus: 0.12,
      },
    ],
  },
  set_dungeon_crimson: {
    id: 'set_dungeon_crimson',
    tierId: 'crimson',
    name: '绯樱典藏',
    bonuses: [
      {
        pieces: 2,
        label: '典藏启封',
        description: '攻击 +12%',
        statPercent: { atk: 0.12 },
      },
      {
        pieces: 4,
        label: '赤金礼装',
        description: '生命 +18%',
        statPercent: { hp: 0.18 },
      },
      {
        pieces: 6,
        label: '绯樱星环',
        description: '防御 +15%，暴击率 +5%',
        statPercent: { def: 0.15 },
        statFlat: { critRate: 5 },
      },
      {
        pieces: 8,
        label: '珍品共鸣',
        description: '平均技能倍率 +0.18',
        skillMultiplierBonus: 0.18,
      },
    ],
  },
} as const;

export function requireEquipmentDungeonSet(id: string): EquipmentDungeonSetDefinition {
  const definition = EQUIPMENT_DUNGEON_SETS[id];
  if (!definition) throw new Error(`[配置错误] 装备套装不存在：${id}`);
  return definition;
}
