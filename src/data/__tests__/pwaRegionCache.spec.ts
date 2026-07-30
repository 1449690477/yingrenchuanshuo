import { describe, expect, it } from 'vitest';
import {
  createRegion5RuntimeCacheRule,
  createRegion5SetCacheRule,
  isRegion5RuntimeAssetPath,
  REGION_5_RUNTIME_CACHE_MAX_ENTRIES,
  REGION_5_RUNTIME_CACHE_NAME,
  REGION_5_RUNTIME_HEAVY_ASSET_COUNT,
  REGION_5_SET_CACHE_MAX_ENTRIES,
  REGION_5_SET_CACHE_NAME,
  REGION_5_SET_RUNTIME_ASSET_COUNT,
  REGION_5_SET_URL_PATTERN,
  createRegion6RuntimeCacheRule,
  createRegion6SetCacheRule,
  isRegion6RuntimeAssetPath,
  REGION_6_RUNTIME_CACHE_MAX_ENTRIES,
  REGION_6_RUNTIME_CACHE_NAME,
  REGION_6_RUNTIME_HEAVY_ASSET_COUNT,
  REGION_6_SET_CACHE_MAX_ENTRIES,
  REGION_6_SET_CACHE_NAME,
  REGION_6_SET_RUNTIME_ASSET_COUNT,
  REGION_6_SET_URL_PATTERN,
  createRegion7RuntimeCacheRule,
  createRegion7SetCacheRule,
  isRegion7RuntimeAssetPath,
  REGION_7_RUNTIME_CACHE_MAX_ENTRIES,
  REGION_7_RUNTIME_CACHE_NAME,
  REGION_7_RUNTIME_HEAVY_ASSET_COUNT,
  REGION_7_SET_CACHE_MAX_ENTRIES,
  REGION_7_SET_CACHE_NAME,
  REGION_7_SET_RUNTIME_ASSET_COUNT,
  REGION_7_SET_URL_PATTERN,
} from '../../../pwa-region-cache';

describe('区域 5 PWA 分区缓存', () => {
  it.each([
    '/yingrenchuanshuo/assets/maps/r5.webp',
    '/yingrenchuanshuo/assets/maps/chapter-5-1.webp',
    '/yingrenchuanshuo/assets/battlefields/chapter-5-5.webp',
    '/yingrenchuanshuo/assets/monsters/r5/mon_5-5_boss.webp',
    '/yingrenchuanshuo/assets/equipment/r5/weapon.png',
    '/yingrenchuanshuo/assets/characters/modular/catkin/r5-body.png',
    '/yingrenchuanshuo/assets/characters/modular/swordsman/r5-head.png',
    '/yingrenchuanshuo/assets/characters/modular/witch/r5-weapon.png',
  ])('R5 重资产进入独立缓存：%s', (pathname) => {
    expect(isRegion5RuntimeAssetPath(pathname)).toBe(true);
  });

  it.each([
    '/yingrenchuanshuo/assets/maps/r4.webp',
    '/yingrenchuanshuo/assets/maps/r6.webp',
    '/yingrenchuanshuo/assets/maps/chapter-50-1.webp',
    '/yingrenchuanshuo/assets/monsters/r4/mon_4-5_boss.webp',
    '/yingrenchuanshuo/assets/equipment/r6/weapon.png',
    '/yingrenchuanshuo/assets/items/core_moltenheart.png',
    '/yingrenchuanshuo/assets/characters/modular/catkin/r6-body.png',
  ])('其他区域与材料小图不误入 R5 重资产缓存：%s', (pathname) => {
    expect(isRegion5RuntimeAssetPath(pathname)).toBe(false);
  });

  it('55 项真实需求低于 64 项硬上限，并使用可后台更新的独立缓存', () => {
    expect(REGION_5_RUNTIME_HEAVY_ASSET_COUNT).toBe(55);
    expect(REGION_5_RUNTIME_CACHE_MAX_ENTRIES).toBe(64);
    expect(REGION_5_RUNTIME_HEAVY_ASSET_COUNT).toBeLessThanOrEqual(
      REGION_5_RUNTIME_CACHE_MAX_ENTRIES,
    );

    const rule = createRegion5RuntimeCacheRule();
    expect(rule.handler).toBe('StaleWhileRevalidate');
    expect(rule.options.cacheName).toBe(REGION_5_RUNTIME_CACHE_NAME);
    expect(rule.options.expiration).toEqual({ maxEntries: 64 });
  });

  it.each([
    '/yingrenchuanshuo/assets/equipment/sets/r5-crimson/weapon.png',
    '/yingrenchuanshuo/assets/equipment/sets/r5-crimson/shoes.png',
    '/yingrenchuanshuo/assets/characters/modular/catkin/r5-crimson-body.png',
    '/yingrenchuanshuo/assets/characters/modular/swordsman/r5-crimson-head.png',
    '/yingrenchuanshuo/assets/characters/modular/witch/r5-crimson-weapon.png',
  ])('绯焰套重资产进入独立套装缓存：%s', (pathname) => {
    expect(REGION_5_SET_URL_PATTERN.test(pathname)).toBe(true);
    expect(isRegion5RuntimeAssetPath(pathname)).toBe(false);
  });

  it('18 项绯焰套资产使用独立 SWR/24 缓存，不挤占区域基础内容', () => {
    expect(REGION_5_SET_RUNTIME_ASSET_COUNT).toBe(18);
    expect(REGION_5_SET_CACHE_MAX_ENTRIES).toBe(24);
    const rule = createRegion5SetCacheRule();
    expect(rule.handler).toBe('StaleWhileRevalidate');
    expect(rule.options.cacheName).toBe(REGION_5_SET_CACHE_NAME);
    expect(rule.options.expiration).toEqual({ maxEntries: 24 });
  });
});

describe('区域 6 PWA 分区缓存', () => {
  it.each([
    '/yingrenchuanshuo/assets/maps/r6.webp',
    '/yingrenchuanshuo/assets/maps/chapter-6-1.webp',
    '/yingrenchuanshuo/assets/battlefields/chapter-6-5.webp',
    '/yingrenchuanshuo/assets/monsters/r6/mon_6-5_boss.webp',
    '/yingrenchuanshuo/assets/equipment/r6/weapon.png',
    '/yingrenchuanshuo/assets/characters/modular/catkin/r6-body.png',
    '/yingrenchuanshuo/assets/characters/modular/witch/r6-weapon.png',
  ])('R6 重资产进入独立缓存：%s', (pathname) => {
    expect(isRegion6RuntimeAssetPath(pathname)).toBe(true);
  });

  it('55 项基础资产使用独立 SWR/64 缓存', () => {
    expect(REGION_6_RUNTIME_HEAVY_ASSET_COUNT).toBe(55);
    expect(REGION_6_RUNTIME_CACHE_MAX_ENTRIES).toBe(64);
    const rule = createRegion6RuntimeCacheRule();
    expect(rule.options.cacheName).toBe(REGION_6_RUNTIME_CACHE_NAME);
    expect(rule.options.expiration).toEqual({ maxEntries: 64 });
  });

  it.each([
    '/yingrenchuanshuo/assets/equipment/sets/r6-shadow/weapon.png',
    '/yingrenchuanshuo/assets/equipment/sets/r6-shadow/shoes.png',
    '/yingrenchuanshuo/assets/characters/modular/catkin/r6-shadow-body.png',
    '/yingrenchuanshuo/assets/characters/modular/shaman/r6-shadow-weapon.png',
  ])('幽影套重资产进入独立套装缓存：%s', (pathname) => {
    expect(REGION_6_SET_URL_PATTERN.test(pathname)).toBe(true);
    expect(isRegion6RuntimeAssetPath(pathname)).toBe(false);
  });

  it('20 项幽影套资产使用独立 SWR/24 缓存', () => {
    expect(REGION_6_SET_RUNTIME_ASSET_COUNT).toBe(20);
    expect(REGION_6_SET_CACHE_MAX_ENTRIES).toBe(24);
    const rule = createRegion6SetCacheRule();
    expect(rule.options.cacheName).toBe(REGION_6_SET_CACHE_NAME);
    expect(rule.options.expiration).toEqual({ maxEntries: 24 });
  });
});

describe('区域 7 PWA 分区缓存', () => {
  it.each([
    '/yingrenchuanshuo/assets/maps/r7.webp',
    '/yingrenchuanshuo/assets/maps/chapter-7-1.webp',
    '/yingrenchuanshuo/assets/battlefields/chapter-7-5.webp',
    '/yingrenchuanshuo/assets/monsters/r7/mon_7-5_boss.webp',
    '/yingrenchuanshuo/assets/equipment/r7/weapon.png',
    '/yingrenchuanshuo/assets/characters/modular/catkin/r7-body.png',
    '/yingrenchuanshuo/assets/characters/modular/witch/r7-weapon.png',
  ])('R7 重资产进入独立缓存：%s', (pathname) => {
    expect(isRegion7RuntimeAssetPath(pathname)).toBe(true);
  });

  it('55 项基础资产使用独立 SWR/64 缓存', () => {
    expect(REGION_7_RUNTIME_HEAVY_ASSET_COUNT).toBe(55);
    expect(REGION_7_RUNTIME_CACHE_MAX_ENTRIES).toBe(64);
    const rule = createRegion7RuntimeCacheRule();
    expect(rule.options.cacheName).toBe(REGION_7_RUNTIME_CACHE_NAME);
    expect(rule.options.expiration).toEqual({ maxEntries: 64 });
  });

  it.each([
    '/yingrenchuanshuo/assets/equipment/sets/r7-bloodmoon/weapon.png',
    '/yingrenchuanshuo/assets/equipment/sets/r7-bloodmoon/badge.png',
    '/yingrenchuanshuo/assets/characters/modular/catkin/r7-bloodmoon-body.png',
    '/yingrenchuanshuo/assets/characters/modular/shaman/r7-bloodmoon-weapon.png',
  ])('血月套重资产进入独立套装缓存：%s', (pathname) => {
    expect(REGION_7_SET_URL_PATTERN.test(pathname)).toBe(true);
    expect(isRegion7RuntimeAssetPath(pathname)).toBe(false);
  });

  it('21 项血月套资产使用独立 SWR/24 缓存', () => {
    expect(REGION_7_SET_RUNTIME_ASSET_COUNT).toBe(21);
    expect(REGION_7_SET_CACHE_MAX_ENTRIES).toBe(24);
    const rule = createRegion7SetCacheRule();
    expect(rule.options.cacheName).toBe(REGION_7_SET_CACHE_NAME);
    expect(rule.options.expiration).toEqual({ maxEntries: 24 });
  });
});
