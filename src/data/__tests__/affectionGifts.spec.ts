import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '@/core/types';
import { requireItem } from '@/data/items';
import { REGIONS } from '@/data/regions';
import {
  AFFECTION_GIFT_LIST,
  AFFECTION_GIFTS,
  affectionGiftsForClass,
  requireAffectionGift,
} from '../affectionGifts';
import { requireAffectionStory } from '../affection';

const COMPLETE_AFFECTION_CLASS_IDS = CLASS_IDS.filter((classId) => classId !== 'kenshi');

describe('好感第三批礼物偏好', () => {
  it('四位角色各有偏爱、喜欢、普通三档正向礼物', () => {
    expect(AFFECTION_GIFT_LIST).toHaveLength(12);
    expect(new Set(AFFECTION_GIFT_LIST.map((entry) => entry.id)).size).toBe(12);

    for (const classId of COMPLETE_AFFECTION_CLASS_IDS) {
      const gifts = affectionGiftsForClass(classId);
      expect(gifts).toHaveLength(3);
      expect(gifts.map((entry) => entry.preference)).toEqual([
        'favorite',
        'liked',
        'regular',
      ]);
      expect(gifts.map((entry) => entry.points)).toEqual([18, 14, 10]);

      for (const gift of gifts) {
        expect(gift.classId).toBe(classId);
        expect(gift.responseLines).toHaveLength(2);
        expect(gift.cost.count).toBeGreaterThan(0);
        expect(requireItem(gift.cost.itemId).kind).toBe('material');
        expect(requireAffectionStory(classId, gift.requiredStoryId).episode).toBe(6);
        expect(requireAffectionGift(classId, gift.id)).toBe(gift);
      }
    }
    expect(AFFECTION_GIFTS.kenshi).toEqual([]);
  });

  it('礼物成本只使用前两章真实掉落材料，不占用强化成长材料', () => {
    const earlyDropMaterials = new Set(
      REGIONS.filter((region) => region.index <= 2).flatMap((region) =>
        region.chapters.flatMap((chapter) => chapter.materials),
      ),
    );
    for (const gift of AFFECTION_GIFT_LIST) {
      expect(earlyDropMaterials.has(gift.cost.itemId), gift.id).toBe(true);
    }
  });

  it('十二张礼物图标使用独立本地透明素材', async () => {
    const iconPaths = AFFECTION_GIFT_LIST.map((entry) => entry.iconAsset);
    expect(new Set(iconPaths).size).toBe(12);

    for (const iconAsset of iconPaths) {
      expect(iconAsset).toMatch(/^assets\/affection\/gifts\/gift_[a-z0-9_]+\.png$/);
      const file = resolve('public', iconAsset);
      expect(existsSync(file), iconAsset).toBe(true);
      const metadata = await sharp(file).metadata();
      expect(metadata.format, iconAsset).toBe('png');
      expect(metadata.width, iconAsset).toBe(256);
      expect(metadata.height, iconAsset).toBe(256);
      expect(metadata.hasAlpha, iconAsset).toBe(true);
    }
  });

  it('错误职业或不存在的礼物会直接报配置错误', () => {
    const swordGift = AFFECTION_GIFTS.swordsman[0]!;
    expect(() => requireAffectionGift('witch', swordGift.id)).toThrow(
      '[配置错误] witch 的好感礼物不存在',
    );
    expect(() => requireAffectionGift('catkin', 'gift_missing')).toThrow(
      '[配置错误] catkin 的好感礼物不存在',
    );
  });
});
