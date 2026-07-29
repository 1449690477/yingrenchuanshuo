/**
 * 区域 5 重资产的 PWA 缓存契约。
 *
 * 单独导出 matcher 与容量，让 Vite 配置和专项测试读取同一份真相。R5 的
 * 6 地图 + 5 战场 + 24 怪物 + 8 普通装备图 + 12 换装层共 55 项，
 * 不能继续塞进已经容纳 R3/R4 的共享 128 项缓存。
 */

export const REGION_5_RUNTIME_HEAVY_ASSET_COUNT = 55;
export const REGION_5_RUNTIME_CACHE_MAX_ENTRIES = 64;
export const REGION_5_RUNTIME_CACHE_NAME = 'region-content-r5-v1';
export const REGION_5_RUNTIME_URL_PATTERN =
  /\/assets\/(?:maps\/(?:r5|chapter-5-\d+)\.webp|battlefields\/chapter-5-\d+\.webp|(?:monsters|equipment)\/r5\/.+|characters\/modular\/(?:swordsman|witch|shaman|catkin)\/r5-(?:body|head|weapon)\.png)$/;
export const REGION_5_SET_RUNTIME_ASSET_COUNT = 18;
export const REGION_5_SET_CACHE_MAX_ENTRIES = 24;
export const REGION_5_SET_CACHE_NAME = 'region-set-r5-v1';
export const REGION_5_SET_URL_PATTERN =
  /\/assets\/(?:equipment\/sets\/r5-crimson\/.+|characters\/modular\/(?:swordsman|witch|shaman|catkin)\/r5-crimson-(?:body|head|weapon)\.png)$/;

export function isRegion5RuntimeAssetPath(pathname: string): boolean {
  return REGION_5_RUNTIME_URL_PATTERN.test(pathname);
}

export function createRegion5RuntimeCacheRule() {
  if (REGION_5_RUNTIME_HEAVY_ASSET_COUNT > REGION_5_RUNTIME_CACHE_MAX_ENTRIES) {
    throw new Error(
      `[PWA 配置错误] R5 重资产 ${REGION_5_RUNTIME_HEAVY_ASSET_COUNT} 项超过缓存上限 ${REGION_5_RUNTIME_CACHE_MAX_ENTRIES}`,
    );
  }
  return {
    // GenerateSW 会序列化 RegExp；回调若闭包引用本文件函数，产物里会变成未定义符号。
    urlPattern: REGION_5_RUNTIME_URL_PATTERN,
    // 路径没有内容哈希；先回缓存、后台刷新，避免重绘后旧图被锁 30 天。
    handler: 'StaleWhileRevalidate' as const,
    options: {
      cacheName: REGION_5_RUNTIME_CACHE_NAME,
      cacheableResponse: { statuses: [0, 200] },
      expiration: {
        maxEntries: REGION_5_RUNTIME_CACHE_MAX_ENTRIES,
      },
    },
  };
}

export function createRegion5SetCacheRule() {
  if (REGION_5_SET_RUNTIME_ASSET_COUNT > REGION_5_SET_CACHE_MAX_ENTRIES) {
    throw new Error(
      `[PWA 配置错误] R5 套装重资产 ${REGION_5_SET_RUNTIME_ASSET_COUNT} 项超过缓存上限 ${REGION_5_SET_CACHE_MAX_ENTRIES}`,
    );
  }
  return {
    urlPattern: REGION_5_SET_URL_PATTERN,
    handler: 'StaleWhileRevalidate' as const,
    options: {
      cacheName: REGION_5_SET_CACHE_NAME,
      cacheableResponse: { statuses: [0, 200] },
      expiration: {
        maxEntries: REGION_5_SET_CACHE_MAX_ENTRIES,
      },
    },
  };
}
