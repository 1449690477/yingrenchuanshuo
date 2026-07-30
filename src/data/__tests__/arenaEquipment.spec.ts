/**
 * 圣痕装备（竞技场专属套装）的数据验收。
 *
 * 锁定 docs/53 §六 验收红线：
 *   - 新增品质 0：全部复用 divine，不新增品质
 *   - 存档 schema / 迁移改动 0：圣痕装备走既有 EquipmentInstance
 *   - 裸数值与主线圣器完全一致：baseEquipStats 由 divine 品质表推导，
 *     这里与同等级同部位的「假设主线圣器」逐点对比
 *   - 套装效果在挂机 / 主线 / 试炼生效必须为 0（getFieldEquipmentSet 空效果），
 *     只在对决管线（buildArenaDuelSide / getEquipmentSet）生效
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { EquipmentInstance, Stats } from '@/core/types';
import { CLASS_IDS } from '@/core/types';
import { baseEquipStats } from '@/core/equipment';
import { resolveEquipmentSetBonuses } from '@/core/equipmentSets';
import { buildArenaDuelSide } from '@/core/duel';
import { requireEquipmentAppearance } from '@/data/characterAppearance';
import { ENHANCE_MAX } from '@/data/constants';
import { getEquipment, requireEquipment } from '@/data/equipment';
import { getEquipmentSet, getFieldEquipmentSet } from '@/data/equipmentSets';
import { REGION_5_SET_LEVEL } from '@/data/region5';
import { ARENA_SET_DEFENDER_DR_BONUS } from '@/data/arenaRules';
import {
  ARENA_EQUIPMENT,
  ARENA_EQUIPMENT_LEVEL,
  ARENA_EQUIPMENT_LIST,
  ARENA_EQUIPMENT_SET,
  ARENA_SET_ID,
  arenaSetPieceCount,
} from '../arenaEquipment';

function instance(defId: string, uid: string): EquipmentInstance {
  return {
    uid,
    defId,
    enhance: 0,
    baseRollPermille: 1000,
    // 强化增幅记录固定 15 格；未强化时全 0（core/equipment.ts 的实例契约）
    enhanceGainPermille: new Array(ENHANCE_MAX).fill(0),
    enhanceLuck: {},
    affixes: [],
    reforgeResonance: 0,
    locked: false,
  };
}

const SLOTS = ['weapon', 'head', 'body', 'ring'] as const;

function arenaIdsFor(classId: (typeof CLASS_IDS)[number]): string[] {
  return ARENA_EQUIPMENT_LIST.filter((d) => d.classId === classId).map((d) => d.id);
}

describe('圣痕装备定义', () => {
  it('16 件：4 职业 × 武器/头冠/衣装/戒指，全部 divine 品质', () => {
    expect(ARENA_EQUIPMENT_LIST).toHaveLength(16);
    for (const classId of CLASS_IDS) {
      const pieces = ARENA_EQUIPMENT_LIST.filter((d) => d.classId === classId);
      expect(pieces.map((d) => d.slot).sort()).toEqual([...SLOTS].sort());
    }
    for (const def of ARENA_EQUIPMENT_LIST) {
      expect(def.quality).toBe('divine');
      expect(def.setId).toBe(ARENA_SET_ID);
      expect(def.name.startsWith('圣痕·')).toBe(true);
    }
  });

  it('等级由区域 5 套装基底 + divine 偏移推导，不手填', () => {
    expect(ARENA_EQUIPMENT_LEVEL).toBe(REGION_5_SET_LEVEL + 10);
    for (const def of ARENA_EQUIPMENT_LIST) {
      expect(def.level).toBe(ARENA_EQUIPMENT_LEVEL);
    }
  });

  it('全部注册进装备总表，且 id 与 slug 一一对应', () => {
    for (const def of ARENA_EQUIPMENT_LIST) {
      expect(getEquipment(def.id)).toBeDefined();
      expect(ARENA_EQUIPMENT[def.id]?.id).toBe(def.id);
    }
  });

  it('图标文件全部存在且互不重复（codex 已交付 16 张）', () => {
    const icons = new Set<string>();
    for (const def of ARENA_EQUIPMENT_LIST) {
      expect(icons.has(def.icon)).toBe(false);
      icons.add(def.icon);
      expect(existsSync(resolve('public', def.icon))).toBe(true);
    }
    expect(icons.size).toBe(16);
  });

  it('四槽外观全部注册（当前 slot-only，立绘不崩）', () => {
    for (const def of ARENA_EQUIPMENT_LIST) {
      const appearance = requireEquipmentAppearance(def.appearanceId);
      expect(appearance.slot).toBe(def.slot);
      expect(appearance.renderMode).toBe('slot-only');
    }
  });

  it('不含任何手填固定词条：数值完全由品质表推导', () => {
    for (const def of ARENA_EQUIPMENT_LIST) {
      expect(def.fixedAffixes ?? []).toHaveLength(0);
    }
  });
});

describe('裸数值与主线圣器一致', () => {
  it('与同等级同部位的假设主线 divine 装备逐点一致', () => {
    const sample = requireEquipment(arenaIdsFor('swordsman')[0]!);
    const mainlineDivine = { ...sample, id: 'eq_hypothetical_mainline_divine', setId: undefined };
    expect(baseEquipStats(sample)).toEqual(baseEquipStats(mainlineDivine));
  });

  it('divine 基础数值高于同部位 mythic（品质系数 15.0 > 9.2）', () => {
    const arenaWeapon = ARENA_EQUIPMENT_LIST.find(
      (d) => d.classId === 'swordsman' && d.slot === 'weapon',
    )!;
    const divineStats: Stats = baseEquipStats({ ...arenaWeapon, quality: 'divine' });
    const mythicStats: Stats = baseEquipStats({ ...arenaWeapon, quality: 'mythic' });
    expect(divineStats.atk).toBeGreaterThan(mythicStats.atk);
    expect(divineStats.atk / mythicStats.atk).toBeCloseTo(15.0 / 9.2, 5);
  });
});

describe('套装效果的场地门控（验收红线）', () => {
  const equipped4 = () => arenaIdsFor('swordsman').map((id, i) => instance(id, `u${i}`));

  it('挂机/主线/试炼管线：4 件穿戴，套装加成恒为 0', () => {
    const resolution = resolveEquipmentSetBonuses(equipped4(), requireEquipment, (id) =>
      getFieldEquipmentSet(id),
    );
    const arena = resolution.sets.find((s) => s.definition.id === ARENA_SET_ID);
    // 件数照数（UI 进度展示正常），但没有任何激活效果
    expect(arena?.equippedPieces).toBe(4);
    expect(arena?.activeBonuses).toHaveLength(0);
    expect(resolution.statPercent.atk).toBe(0);
    expect(resolution.combatBonuses.damageReduction).toBe(0);
  });

  it('对决管线：2 件激活攻击 +8%，4 件再叠加攻击 +8% 与减伤 +10', () => {
    const full = resolveEquipmentSetBonuses(equipped4(), requireEquipment, (id) =>
      getEquipmentSet(id),
    );
    expect(full.statPercent.atk).toBeCloseTo(0.16, 10);
    expect(full.combatBonuses.damageReduction).toBeCloseTo(10, 10);

    const two = resolveEquipmentSetBonuses(equipped4().slice(0, 2), requireEquipment, (id) =>
      getEquipmentSet(id),
    );
    expect(two.statPercent.atk).toBeCloseTo(0.08, 10);
    expect(two.combatBonuses.damageReduction).toBe(0);
  });

  it('buildArenaDuelSide：防守方 4 件额外 +5 减伤，挑战方没有', () => {
    const input = {
      name: '测试',
      classId: 'swordsman' as const,
      level: 60,
      equipped: [
        ...equipped4(),
        null,
        null,
        null,
        null,
      ] as (EquipmentInstance | null)[],
    };
    const defender = buildArenaDuelSide(input, 'defender');
    const attacker = buildArenaDuelSide(input, 'attacker');
    expect(defender.arenaSetPieces).toBe(4);
    expect(attacker.arenaSetPieces).toBe(4);
    // 双方都吃到 4 件的 +10；防守方再多 +5
    expect(defender.combatant.combatBonuses?.damageReduction).toBeCloseTo(
      10 + ARENA_SET_DEFENDER_DR_BONUS,
      10,
    );
    expect(attacker.combatant.combatBonuses?.damageReduction).toBeCloseTo(10, 10);
  });

  it('圣痕套定义本身合法：4 槽、2/4 件两档、无逐击触发', () => {
    expect(ARENA_EQUIPMENT_SET.pieceSlots).toEqual(['weapon', 'head', 'body', 'ring']);
    expect(ARENA_EQUIPMENT_SET.bonuses.map((b) => b.pieces)).toEqual([2, 4]);
    for (const bonus of ARENA_EQUIPMENT_SET.bonuses) {
      expect(bonus.onHitTriggers ?? []).toHaveLength(0);
    }
    expect(arenaSetPieceCount(equipped4())).toBe(4);
    expect(arenaSetPieceCount([null, null, null, null])).toBe(0);
  });
});
