/**
 * 图鉴集齐加成（M4-8 P3）契约测试。
 *
 * 口径来自数值线裁定（小衡 2026-08-03）：战斗乘区、不进 CP、
 * 每区域集齐 +0.5%、总上限 5%、仅本地 PvE 生效。
 */

import { describe, expect, it } from 'vitest';
import {
  GALLERY_BONUS_CAP_PERCENT,
  GALLERY_REGION_BONUS_PERCENT,
  galleryDamageBonusPercent,
  isRegionGalleryComplete,
} from '../galleryBonuses';
import { MONSTERS } from '@/data/monsters';
import { REGIONS } from '@/data/regions';

function allMonsterIdsOfRegion(regionId: string): string[] {
  const region = REGIONS.find((r) => r.id === regionId)!;
  return region.chapters.flatMap((chapter) =>
    Object.values(MONSTERS)
      .filter((m) => m.id.startsWith(`mon_${chapter.id}_`))
      .map((m) => m.id),
  );
}

describe('集齐判定', () => {
  it('空账本：任何区域都不集齐，加成 0', () => {
    expect(galleryDamageBonusPercent([])).toBe(0);
    for (const region of REGIONS) {
      expect(isRegionGalleryComplete(new Set(), region.id)).toBe(false);
    }
  });

  it('区域全部怪物都在账本里才算集齐，缺一只都不算', () => {
    const region = REGIONS[0]!;
    const ids = allMonsterIdsOfRegion(region.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(isRegionGalleryComplete(new Set(ids), region.id)).toBe(true);

    const missingOne = ids.slice(0, -1);
    expect(isRegionGalleryComplete(new Set(missingOne), region.id)).toBe(false);
  });

  it('未知区域 id 永远不算集齐（防空转）', () => {
    expect(isRegionGalleryComplete(new Set(['mon_anything']), 'r_not_exist')).toBe(false);
  });
});

describe('加成幅值（数值线裁定）', () => {
  it('每集齐一区 +0.5%，全区域集齐 = 区数 × 0.5%（r1~r7 现为 3.5%，r8 后自动 4%）', () => {
    expect(GALLERY_REGION_BONUS_PERCENT).toBe(0.5);
    const allIds = Object.keys(MONSTERS);
    const bonus = galleryDamageBonusPercent(allIds);
    expect(bonus).toBe(REGIONS.length * GALLERY_REGION_BONUS_PERCENT);
    expect(bonus).toBeLessThanOrEqual(GALLERY_BONUS_CAP_PERCENT);
  });

  it('部分区域集齐只加对应档位（两区=1%）', () => {
    const twoRegions = REGIONS.slice(0, 2).flatMap((r) => allMonsterIdsOfRegion(r.id));
    expect(galleryDamageBonusPercent(twoRegions)).toBe(1);
  });

  it('总上限 5% 恒成立（保险丝）', () => {
    expect(GALLERY_BONUS_CAP_PERCENT).toBe(5);
    const allIds = Object.keys(MONSTERS);
    expect(galleryDamageBonusPercent(allIds)).toBeLessThanOrEqual(GALLERY_BONUS_CAP_PERCENT);
  });
});
