import { describe, expect, it } from 'vitest';
import { SLOT_ORDER } from '../constants';
import {
  REGION_7,
  REGION_7_EQUIPMENT_THEME,
  REGION_7_FRAGMENT_COST,
  REGION_7_FRAGMENT_ID,
  REGION_7_MATERIALS,
  REGION_7_MONSTER_MOTIONS,
  REGION_7_SET_ID,
  REGION_7_SET_LEVEL,
  REGION_7_SET_NAMES,
  REGION_7_SET_SLOTS,
  region7SetEquipmentId,
} from '../region7';

function region7MonsterIds(): string[] {
  return REGION_7.chapters.flatMap((chapter) => [
    ...chapter.normals.map((_, index) => `mon_${chapter.id}_${index}`),
    ...(chapter.elite ? [`mon_${chapter.id}_elite`] : []),
    ...(chapter.boss ? [`mon_${chapter.id}_boss`] : []),
  ]);
}

describe('区域 7 原子内容清单', () => {
  it('锁定五章、30 关与 Lv65～78，全部为显式炎属性敌人', () => {
    expect(REGION_7.id).toBe('r7');
    expect(REGION_7.levelFrom).toBe(65);
    expect(REGION_7.levelTo).toBe(78);
    expect(REGION_7.chapters.map((chapter) => chapter.id)).toEqual([
      '7-1',
      '7-2',
      '7-3',
      '7-4',
      '7-5',
    ]);
    expect(REGION_7.chapters.length * 6).toBe(30);
    expect(REGION_7.chapters.every((chapter) => chapter.element === 'fire')).toBe(true);
  });

  it('精确包含 20 普通、3 精英、1 BOSS，并逐只登记动作身份', () => {
    expect(REGION_7.chapters.every((chapter) => chapter.normals.length === 4)).toBe(true);
    const ids = region7MonsterIds();
    expect(ids).toHaveLength(24);
    expect(ids.filter((id) => id.endsWith('_elite'))).toEqual([
      'mon_7-2_elite',
      'mon_7-4_elite',
      'mon_7-5_elite',
    ]);
    expect(ids.filter((id) => id.endsWith('_boss'))).toEqual(['mon_7-5_boss']);
    expect(Object.keys(REGION_7_MONSTER_MOTIONS).sort()).toEqual(ids.sort());
  });

  it('五种材料按真实怪物档位开放，碎片不混入章节材料', () => {
    expect(REGION_7.chapters.map((chapter) => chapter.materials)).toEqual([
      ['dew_bloodmist', 'herb_soulbreak'],
      ['dew_bloodmist', 'herb_soulbreak', 'horn_demon'],
      ['dew_bloodmist', 'herb_soulbreak'],
      ['dew_bloodmist', 'herb_soulbreak', 'horn_demon'],
      ['dew_bloodmist', 'herb_soulbreak', 'horn_demon', 'eye_bloodmoon'],
    ]);
    expect(
      REGION_7.chapters.every((chapter) => !chapter.materials.includes('frag_bloodmoon')),
    ).toBe(true);
    expect(REGION_7_MATERIALS.find((item) => item.id === REGION_7_FRAGMENT_ID)).toMatchObject({
      kind: 'fragment',
      tier: 'rare',
      source: 'set-special',
    });
    expect(REGION_7_MATERIALS.find((item) => item.id === 'eye_bloodmoon')).toMatchObject({
      source: 'boss',
      pityCount: 12,
    });
  });

  it('普通装备为八槽两品质，血月套为 55 碎片自选八件', () => {
    expect(REGION_7_EQUIPMENT_THEME.qualities).toEqual(['epic', 'legendary']);
    expect(Object.keys(REGION_7_EQUIPMENT_THEME.names).sort()).toEqual([...SLOT_ORDER].sort());
    expect(REGION_7_EQUIPMENT_THEME.level).toBe(69);
    expect(REGION_7_SET_ID).toBe('set_region_bloodmoon');
    expect(REGION_7_SET_LEVEL).toBe(76);
    expect(REGION_7_FRAGMENT_COST).toBe(55);
    expect(REGION_7_SET_SLOTS).toEqual(SLOT_ORDER);
    expect(Object.keys(REGION_7_SET_NAMES).sort()).toEqual([...SLOT_ORDER].sort());
    expect(REGION_7_SET_SLOTS.map(region7SetEquipmentId)).toHaveLength(8);
  });

  it('区域图、五张章节图和五张战场图均为独立正式路径', () => {
    expect(REGION_7.mapAsset).toBe('assets/maps/r7.webp');
    for (const chapter of REGION_7.chapters) {
      expect(chapter.mapAsset).toBe(`assets/maps/chapter-${chapter.id}.webp`);
      expect(chapter.battleAsset).toBe(`assets/battlefields/chapter-${chapter.id}.webp`);
      expect(chapter.mapAsset).not.toBe(chapter.battleAsset);
    }
  });
});
