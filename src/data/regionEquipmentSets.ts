import type { EquipmentSetDefinition } from '@/core/equipmentSets';

export const REGION_CRIMSON_SET_ID = 'set_region_crimson';
export const REGION_CRIMSON_FLAMEBURST_TRIGGER_ID = `${REGION_CRIMSON_SET_ID}:flameburst`;
export const REGION_SHADOW_SET_ID = 'set_region_shadow';
export const REGION_SHADOW_SURVIVAL_TRIGGER_ID = `${REGION_SHADOW_SET_ID}:survival`;

/**
 * 区域 5「绯焰套」的权威战斗定义。
 *
 * 六件装备本体由 R5 内容表接入；这里先锁住槽位与 2 / 4 / 6 件真实结算，
 * 避免关卡数据或 UI 复制一套数值。
 */
export const REGION_EQUIPMENT_SETS: Readonly<Record<string, EquipmentSetDefinition>> = {
  [REGION_CRIMSON_SET_ID]: {
    id: REGION_CRIMSON_SET_ID,
    name: '绯焰套',
    pieceSlots: ['weapon', 'head', 'body', 'necklace', 'ring', 'bracelet'],
    bonuses: [
      {
        pieces: 2,
        label: '赤金火纹',
        description: '攻击 +8%',
        statPercent: { atk: 0.08 },
      },
      {
        pieces: 4,
        label: '祭火誓约',
        description: '暴击率 +6%，炎属性伤害 +12%',
        statFlat: { critRate: 6 },
        combatBonuses: { elementDamage: { fire: 12 } },
      },
      {
        pieces: 6,
        label: '绯焰',
        description: '每次直接命中有 15% 概率追加 120% 攻击力的炎爆伤害',
        onHitTriggers: [
          {
            id: REGION_CRIMSON_FLAMEBURST_TRIGGER_ID,
            kind: 'elemental-damage',
            chance: 0.15,
            atkMultiplier: 1.2,
            element: 'fire',
          },
        ],
      },
    ],
  },
  [REGION_SHADOW_SET_ID]: {
    id: REGION_SHADOW_SET_ID,
    name: '幽影套',
    pieceSlots: [
      'weapon',
      'head',
      'body',
      'necklace',
      'bracelet',
      'ring',
      'belt',
      'shoes',
    ],
    bonuses: [
      {
        pieces: 2,
        label: '石影护身',
        description: '生命 +10%',
        statPercent: { hp: 0.1 },
      },
      {
        pieces: 4,
        label: '幽幕',
        description: '伤害减免 +6%',
        combatBonuses: { damageReduction: 6 },
      },
      {
        pieces: 6,
        label: '虚空祷词',
        description: '攻击 +12%，暴击伤害 +20%',
        statPercent: { atk: 0.12 },
        statFlat: { critDmg: 20 },
      },
      {
        pieces: 8,
        label: '幽影',
        description: '每场战斗首次受到致命伤害时免于倒下，并回复 30% 最大生命',
        onLethalTriggers: [
          {
            id: REGION_SHADOW_SURVIVAL_TRIGGER_ID,
            kind: 'lethal-recovery',
            healRatio: 0.3,
            activationsPerFight: 1,
          },
        ],
      },
    ],
  },
} as const;

export const REGION_CRIMSON_SET = REGION_EQUIPMENT_SETS[REGION_CRIMSON_SET_ID]!;
export const REGION_SHADOW_SET = REGION_EQUIPMENT_SETS[REGION_SHADOW_SET_ID]!;
