import { describe, expect, it } from 'vitest';
import { SLOT_ORDER } from '../constants';
import {
  REGION_5,
  REGION_5_EQUIPMENT_THEME,
  REGION_5_FRAGMENT_COST,
  REGION_5_FRAGMENT_ID,
  REGION_5_MATERIALS,
  REGION_5_MONSTER_MOTIONS,
  REGION_5_SET_ID,
  REGION_5_SET_LEVEL,
  REGION_5_SET_NAMES,
  REGION_5_SET_SLOTS,
  region5SetEquipmentId,
} from '../region5';

function region5MonsterIds(): string[] {
  return REGION_5.chapters.flatMap((chapter) => [
    ...chapter.normals.map((_, index) => `mon_${chapter.id}_${index}`),
    ...(chapter.elite ? [`mon_${chapter.id}_elite`] : []),
    ...(chapter.boss ? [`mon_${chapter.id}_boss`] : []),
  ]);
}

describe('区域 5 原子内容清单', () => {
  it('锁定五章、30 关与 Lv40～52，全章均为显式炎属性', () => {
    expect(REGION_5.id).toBe('r5');
    expect(REGION_5.levelFrom).toBe(40);
    expect(REGION_5.levelTo).toBe(52);
    expect(REGION_5.chapters.map((chapter) => chapter.id)).toEqual([
      '5-1',
      '5-2',
      '5-3',
      '5-4',
      '5-5',
    ]);
    expect(REGION_5.chapters).toHaveLength(5);
    expect(REGION_5.chapters.length * 6).toBe(30);
    expect(REGION_5.chapters.every((chapter) => chapter.element === 'fire')).toBe(true);
  });

  it('恰好包含 20 普通、3 精英、1 BOSS，并逐个登记动作身份', () => {
    expect(REGION_5.chapters.every((chapter) => chapter.normals.length === 4)).toBe(true);
    const ids = region5MonsterIds();
    expect(ids).toHaveLength(24);
    expect(ids.filter((id) => id.endsWith('_elite'))).toEqual([
      'mon_5-2_elite',
      'mon_5-4_elite',
      'mon_5-5_elite',
    ]);
    expect(ids.filter((id) => id.endsWith('_boss'))).toEqual(['mon_5-5_boss']);
    expect(Object.keys(REGION_5_MONSTER_MOTIONS).sort()).toEqual(ids.sort());
  });

  it('四种章节材料按真实怪物档位开放，碎片不混入 ChapterSpec.materials', () => {
    expect(REGION_5.chapters.map((chapter) => chapter.materials)).toEqual([
      ['slag_lava', 'shard_scorched'],
      ['slag_lava', 'shard_scorched', 'ember_ritual'],
      ['slag_lava', 'shard_scorched'],
      ['slag_lava', 'shard_scorched', 'ember_ritual'],
      ['slag_lava', 'shard_scorched', 'ember_ritual', 'core_moltenheart'],
    ]);
    expect(REGION_5.chapters.every((chapter) => !chapter.materials.includes('frag_crimson'))).toBe(
      true,
    );

    const fragment = REGION_5_MATERIALS.find((material) => material.id === REGION_5_FRAGMENT_ID);
    expect(fragment).toMatchObject({
      kind: 'fragment',
      tier: 'rare',
      source: 'set-special',
    });
    expect(REGION_5_MATERIALS.find((material) => material.id === 'core_moltenheart')).toMatchObject({
      kind: 'material',
      tier: 'rare',
      source: 'boss',
      pityCount: 12,
    });
  });

  it('普通装备为八槽三品质，武器元素在接入表中单独硬锁', () => {
    expect(REGION_5_EQUIPMENT_THEME.qualities).toEqual(['rare', 'epic', 'legendary']);
    expect(Object.keys(REGION_5_EQUIPMENT_THEME.names).sort()).toEqual([...SLOT_ORDER].sort());
    expect(new Set(Object.values(REGION_5_EQUIPMENT_THEME.names))).toHaveLength(8);
    expect(REGION_5_EQUIPMENT_THEME.level).toBe(46);
  });

  it('绯焰只允许固定六槽，40 通用碎片自选一件', () => {
    expect(REGION_5_SET_ID).toBe('set_region_crimson');
    expect(REGION_5_SET_LEVEL).toBe(50);
    expect(REGION_5_FRAGMENT_COST).toBe(40);
    expect(REGION_5_SET_SLOTS).toEqual([
      'weapon',
      'head',
      'body',
      'necklace',
      'ring',
      'bracelet',
    ]);
    expect(REGION_5_SET_SLOTS).not.toContain('belt');
    expect(REGION_5_SET_SLOTS).not.toContain('shoes');
    expect(Object.keys(REGION_5_SET_NAMES).sort()).toEqual([...REGION_5_SET_SLOTS].sort());
    expect(REGION_5_SET_SLOTS.map(region5SetEquipmentId)).toEqual([
      'eq_set_region_crimson_weapon',
      'eq_set_region_crimson_head',
      'eq_set_region_crimson_body',
      'eq_set_region_crimson_necklace',
      'eq_set_region_crimson_ring',
      'eq_set_region_crimson_bracelet',
    ]);
  });

  it('地图和战场使用 R5 正式路径，不允许一图两用', () => {
    expect(REGION_5.mapAsset).toBe('assets/maps/r5.webp');
    for (const chapter of REGION_5.chapters) {
      expect(chapter.mapAsset).toBe(`assets/maps/chapter-${chapter.id}.webp`);
      expect(chapter.battleAsset).toBe(`assets/battlefields/chapter-${chapter.id}.webp`);
      expect(chapter.mapAsset).not.toBe(chapter.battleAsset);
    }
  });
});
