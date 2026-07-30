import { describe, expect, it } from 'vitest';
import { SLOT_ORDER } from '../constants';
import {
  REGION_6,
  REGION_6_EQUIPMENT_THEME,
  REGION_6_FRAGMENT_COST,
  REGION_6_FRAGMENT_ID,
  REGION_6_MATERIALS,
  REGION_6_MONSTER_MOTIONS,
  REGION_6_SET_ID,
  REGION_6_SET_LEVEL,
  REGION_6_SET_NAMES,
  REGION_6_SET_SLOTS,
  REGION_6_STATUE_MONSTER_IDS,
  region6SetEquipmentId,
} from '../region6';

function region6MonsterIds(): string[] {
  return REGION_6.chapters.flatMap((chapter) => [
    ...chapter.normals.map((_, index) => `mon_${chapter.id}_${index}`),
    ...(chapter.elite ? [`mon_${chapter.id}_elite`] : []),
    ...(chapter.boss ? [`mon_${chapter.id}_boss`] : []),
  ]);
}

describe('区域 6 原子内容清单', () => {
  it('锁定五章、30 关与 Lv52～65，全部为显式雷属性敌人', () => {
    expect(REGION_6.id).toBe('r6');
    expect(REGION_6.levelFrom).toBe(52);
    expect(REGION_6.levelTo).toBe(65);
    expect(REGION_6.chapters.map((chapter) => chapter.id)).toEqual([
      '6-1',
      '6-2',
      '6-3',
      '6-4',
      '6-5',
    ]);
    expect(REGION_6.chapters.length * 6).toBe(30);
    expect(REGION_6.chapters.every((chapter) => chapter.element === 'thunder')).toBe(true);
  });

  it('精确包含 20 普通、3 精英、1 BOSS，并逐只登记动作身份', () => {
    expect(REGION_6.chapters.every((chapter) => chapter.normals.length === 4)).toBe(true);
    const ids = region6MonsterIds();
    expect(ids).toHaveLength(24);
    expect(ids.filter((id) => id.endsWith('_elite'))).toEqual([
      'mon_6-2_elite',
      'mon_6-4_elite',
      'mon_6-5_elite',
    ]);
    expect(ids.filter((id) => id.endsWith('_boss'))).toEqual(['mon_6-5_boss']);
    expect(Object.keys(REGION_6_MONSTER_MOTIONS).sort()).toEqual(ids.sort());
    expect(REGION_6_STATUE_MONSTER_IDS.every((id) => ids.includes(id))).toBe(true);
  });

  it('五种材料按真实怪物档位开放，碎片不混入章节材料', () => {
    expect(REGION_6.chapters.map((chapter) => chapter.materials)).toEqual([
      ['dust_statue', 'scroll_faded'],
      ['dust_statue', 'scroll_faded', 'wisp_shadow'],
      ['dust_statue', 'scroll_faded'],
      ['dust_statue', 'scroll_faded', 'wisp_shadow'],
      ['dust_statue', 'scroll_faded', 'wisp_shadow', 'stone_void'],
    ]);
    expect(REGION_6.chapters.every((chapter) => !chapter.materials.includes('frag_shadow'))).toBe(
      true,
    );
    expect(REGION_6_MATERIALS.find((item) => item.id === REGION_6_FRAGMENT_ID)).toMatchObject({
      kind: 'fragment',
      tier: 'rare',
      source: 'set-special',
    });
    expect(REGION_6_MATERIALS.find((item) => item.id === 'stone_void')).toMatchObject({
      source: 'boss',
      pityCount: 12,
    });
  });

  it('普通装备为八槽三品质，幽影套为 55 碎片自选八件', () => {
    expect(REGION_6_EQUIPMENT_THEME.qualities).toEqual(['rare', 'epic', 'legendary']);
    expect(Object.keys(REGION_6_EQUIPMENT_THEME.names).sort()).toEqual([...SLOT_ORDER].sort());
    expect(REGION_6_EQUIPMENT_THEME.level).toBe(56);
    expect(REGION_6_SET_ID).toBe('set_region_shadow');
    expect(REGION_6_SET_LEVEL).toBe(62);
    expect(REGION_6_FRAGMENT_COST).toBe(55);
    expect(REGION_6_SET_SLOTS).toEqual(SLOT_ORDER);
    expect(Object.keys(REGION_6_SET_NAMES).sort()).toEqual([...SLOT_ORDER].sort());
    expect(REGION_6_SET_SLOTS.map(region6SetEquipmentId)).toHaveLength(8);
  });

  it('区域图、五张章节图和五张战场图均为独立正式路径', () => {
    expect(REGION_6.mapAsset).toBe('assets/maps/r6.webp');
    for (const chapter of REGION_6.chapters) {
      expect(chapter.mapAsset).toBe(`assets/maps/chapter-${chapter.id}.webp`);
      expect(chapter.battleAsset).toBe(`assets/battlefields/chapter-${chapter.id}.webp`);
      expect(chapter.mapAsset).not.toBe(chapter.battleAsset);
    }
  });
});
