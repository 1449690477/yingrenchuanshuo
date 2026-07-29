import { describe, expect, it } from 'vitest';
import {
  REGION_3,
  REGION_4,
  REGION_34,
  REGION_34_EQUIPMENT_THEMES,
  REGION_34_MATERIALS,
  REGION_34_MONSTER_MOTIONS,
} from '../region34';
import { regionIdForChapterId } from '../regions';
import { REGION_34_MONSTER_VISUALS } from '../monsterVisuals';

function monsterIdsForRegion(region: (typeof REGION_34)[number]): string[] {
  return region.chapters.flatMap((chapter) => [
    ...chapter.normals.map((_, index) => `mon_${chapter.id}_${index}`),
    ...(chapter.elite ? [`mon_${chapter.id}_elite`] : []),
    ...(chapter.boss ? [`mon_${chapter.id}_boss`] : []),
  ]);
}

describe('区域 3/4 独立内容清单', () => {
  it('覆盖 Lv20～40 的十章且每章保留六关生成边界', () => {
    expect(REGION_34.map((region) => region.id)).toEqual(['r3', 'r4']);
    expect(REGION_34.flatMap((region) => region.chapters)).toHaveLength(10);
    expect(REGION_3.chapters.map((chapter) => chapter.id)).toEqual([
      '3-1',
      '3-2',
      '3-3',
      '3-4',
      '3-5',
    ]);
    expect(REGION_4.chapters.map((chapter) => chapter.id)).toEqual([
      '4-1',
      '4-2',
      '4-3',
      '4-4',
      '4-5',
    ]);
    expect(REGION_3.levelFrom).toBe(20);
    expect(REGION_3.levelTo).toBe(30);
    expect(REGION_4.levelFrom).toBe(30);
    expect(REGION_4.levelTo).toBe(40);
    expect(REGION_34.reduce((count, region) => count + region.chapters.length * 6, 0)).toBe(
      60,
    );
  });

  it('每章四只普通怪，精英与 BOSS 数量严格匹配 docs/42 波次', () => {
    for (const chapter of REGION_34.flatMap((region) => region.chapters)) {
      expect(chapter.normals).toHaveLength(4);
      expect(new Set(chapter.normals).size).toBe(4);
    }

    const r3MonsterIds = monsterIdsForRegion(REGION_3);
    const r4MonsterIds = monsterIdsForRegion(REGION_4);
    expect(r3MonsterIds).toHaveLength(23);
    expect(r4MonsterIds).toHaveLength(24);
    expect(r3MonsterIds).toContain('mon_3-5_elite');
    expect(r3MonsterIds).toContain('mon_3-5_boss');
    expect(r4MonsterIds).toContain('mon_4-5_elite');
    expect(r4MonsterIds).toContain('mon_4-5_boss');
    expect(Object.keys(REGION_34_MONSTER_MOTIONS).sort()).toEqual(
      [...r3MonsterIds, ...r4MonsterIds].sort(),
    );
    expect(Object.keys(REGION_34_MONSTER_VISUALS).sort()).toEqual(
      [...r3MonsterIds, ...r4MonsterIds].sort(),
    );
    for (const id of [...r3MonsterIds, ...r4MonsterIds]) {
      const regionId = id.startsWith('mon_3-') ? 'r3' : 'r4';
      expect(REGION_34_MONSTER_VISUALS[id]).toEqual({
        asset: `assets/monsters/${regionId}/${id}.webp`,
        motion: REGION_34_MONSTER_MOTIONS[id],
      });
    }
  });

  it('区域材料按 common / fine / rare 的章节来源逐层开放', () => {
    expect(REGION_3.chapters.map((chapter) => chapter.materials)).toEqual([
      ['chitin_wing', 'moss_cave'],
      ['chitin_wing', 'moss_cave', 'silk_spider'],
      ['chitin_wing', 'moss_cave'],
      ['chitin_wing', 'moss_cave'],
      ['chitin_wing', 'moss_cave', 'silk_spider', 'egg_broodmother'],
    ]);
    expect(REGION_4.chapters.map((chapter) => chapter.materials)).toEqual([
      ['dust_bone', 'herb_moonlit'],
      ['dust_bone', 'herb_moonlit', 'rubbing_epitaph'],
      ['dust_bone', 'herb_moonlit'],
      ['dust_bone', 'herb_moonlit', 'rubbing_epitaph'],
      ['dust_bone', 'herb_moonlit', 'rubbing_epitaph', 'tear_eternal'],
    ]);
  });

  it('八种材料的档位、售价与真实怪物来源显式分离', () => {
    expect(REGION_34_MATERIALS).toHaveLength(8);
    expect(new Set(REGION_34_MATERIALS.map((material) => material.id)).size).toBe(8);
    for (const material of REGION_34_MATERIALS) {
      if (material.tier === 'common') expect(material.source).toBe('normal');
      if (material.tier === 'fine') expect(material.source).toBe('elite');
      if (material.tier === 'rare') expect(material.source).toBe('boss');
      expect(material.sellPrice).toBeGreaterThan(0);
      expect(material.desc.length).toBeGreaterThanOrEqual(12);
    }
    expect(
      REGION_34_MATERIALS.map(({ id, sellPrice }) => [id, sellPrice]),
    ).toEqual([
      ['chitin_wing', 8],
      ['moss_cave', 7],
      ['silk_spider', 45],
      ['egg_broodmother', 320],
      ['dust_bone', 11],
      ['herb_moonlit', 10],
      ['rubbing_epitaph', 62],
      ['tear_eternal', 480],
    ]);
  });

  it('所有地图与战场路径使用正式区域目录且没有占位资源', () => {
    for (const region of REGION_34) {
      expect(region.mapAsset).toBe(`assets/maps/${region.id}.webp`);
      for (const chapter of region.chapters) {
        expect(chapter.mapAsset).toBe(`assets/maps/chapter-${chapter.id}.webp`);
        expect(chapter.battleAsset).toBe(
          `assets/battlefields/chapter-${chapter.id}.webp`,
        );
      }
    }
  });

  it('两套装备主题完整覆盖八部位且名称不复用', () => {
    expect(REGION_34_EQUIPMENT_THEMES.map((theme) => theme.regionId)).toEqual([
      'r3',
      'r4',
    ]);
    for (const theme of REGION_34_EQUIPMENT_THEMES) {
      expect(Object.keys(theme.names).sort()).toEqual(
        [
          'weapon',
          'head',
          'body',
          'necklace',
          'bracelet',
          'ring',
          'belt',
          'shoes',
        ].sort(),
      );
      expect(new Set(Object.values(theme.names)).size).toBe(8);
      expect(theme.visualKeywords).toHaveLength(4);
    }
    expect(
      new Set(
        REGION_34_EQUIPMENT_THEMES.flatMap((theme) => Object.values(theme.names)),
      ).size,
    ).toBe(16);
  });

  it('虫娘区统一为冰属性，属性教学只写入真实计划中的首章', () => {
    expect(REGION_3.chapters.every((chapter) => chapter.element === 'ice')).toBe(true);
    expect(REGION_3.chapters[0]?.tutorial).toContain('炎属性武器');
    expect(REGION_3.chapters.slice(1).every((chapter) => chapter.tutorial === undefined)).toBe(
      true,
    );
    expect(REGION_4.chapters.every((chapter) => chapter.element === 'none')).toBe(true);
  });

  it('关卡选择能从任意后续章节推导真实区域，而不是全部落回 r2', () => {
    expect(regionIdForChapterId('1-5')).toBe('r1');
    expect(regionIdForChapterId('3-1')).toBe('r3');
    expect(regionIdForChapterId('4-5')).toBe('r4');
    expect(regionIdForChapterId('9-12')).toBe('r9');
    expect(() => regionIdForChapterId('chapter-3-1')).toThrow('章节编号格式错误');
  });
});
