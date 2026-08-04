import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const serviceWorkerPath = resolve(root, 'dist/sw.js');

function fail(message) {
  throw new Error(`[PWA 缓存门禁] ${message}`);
}

if (!existsSync(serviceWorkerPath)) {
  fail('dist/sw.js 不存在，请先运行 vite build');
}

const serviceWorker = readFileSync(serviceWorkerPath, 'utf8');
const r5CacheName = 'region-content-r5-v1';
const r5SetCacheName = 'region-set-r5-v1';
const r6CacheName = 'region-content-r6-v1';
const r6SetCacheName = 'region-set-r6-v1';
const r7CacheName = 'region-content-r7-v1';
const r7SetCacheName = 'region-set-r7-v1';
// 2026-08-04：冰雪热修事故后 v1→v2（CacheFirst 会把修复前旧图钉死 30 天，
// 改 SWR 并升名让 SW 更新后首屏即拉新图），见 vite.config.ts 同日注释。
const genericAppearanceCacheName = 'character-appearance-v2';
const r5Index = serviceWorker.indexOf(r5CacheName);
const r5SetIndex = serviceWorker.indexOf(r5SetCacheName);
const r6Index = serviceWorker.indexOf(r6CacheName);
const r6SetIndex = serviceWorker.indexOf(r6SetCacheName);
const r7Index = serviceWorker.indexOf(r7CacheName);
const r7SetIndex = serviceWorker.indexOf(r7SetCacheName);
const genericAppearanceIndex = serviceWorker.indexOf(genericAppearanceCacheName);

if (r5Index < 0) fail(`产物缺少 ${r5CacheName}`);
if (r5SetIndex < 0) fail(`产物缺少 ${r5SetCacheName}`);
if (r6Index < 0) fail(`产物缺少 ${r6CacheName}`);
if (r6SetIndex < 0) fail(`产物缺少 ${r6SetCacheName}`);
if (r7Index < 0) fail(`产物缺少 ${r7CacheName}`);
if (r7SetIndex < 0) fail(`产物缺少 ${r7SetCacheName}`);
if (genericAppearanceIndex < 0) fail(`产物缺少 ${genericAppearanceCacheName}`);
if (
  [r5Index, r5SetIndex, r6Index, r6SetIndex, r7Index, r7SetIndex].some(
    (regionIndex) => regionIndex >= genericAppearanceIndex,
  )
) {
  fail('R5 / R6 / R7 区域与套装路由必须注册在通用 modular 路由之前，否则换装层会被先截走');
}
if (
  serviceWorker.includes('isRegion5RuntimeAssetPath') ||
  serviceWorker.includes('isRegion6RuntimeAssetPath') ||
  serviceWorker.includes('isRegion7RuntimeAssetPath')
) {
  fail('GenerateSW 产物引用了未序列化的 matcher 函数');
}
if (
  !/StaleWhileRevalidate\(\{cacheName:"region-content-r5-v1",.{0,600}?maxEntries:64/.test(
    serviceWorker,
  )
) {
  fail('R5 缓存必须使用 StaleWhileRevalidate 且 maxEntries=64');
}
if (
  !/StaleWhileRevalidate\(\{cacheName:"region-set-r5-v1",.{0,600}?maxEntries:24/.test(
    serviceWorker,
  )
) {
  fail('R5 套装缓存必须使用 StaleWhileRevalidate 且 maxEntries=24');
}
if (
  !/StaleWhileRevalidate\(\{cacheName:"region-content-r6-v1",.{0,600}?maxEntries:64/.test(
    serviceWorker,
  )
) {
  fail('R6 缓存必须使用 StaleWhileRevalidate 且 maxEntries=64');
}
if (
  !/StaleWhileRevalidate\(\{cacheName:"region-set-r6-v1",.{0,600}?maxEntries:24/.test(
    serviceWorker,
  )
) {
  fail('R6 套装缓存必须使用 StaleWhileRevalidate 且 maxEntries=24');
}
if (
  !/StaleWhileRevalidate\(\{cacheName:"region-content-r7-v1",.{0,600}?maxEntries:64/.test(
    serviceWorker,
  )
) {
  fail('R7 缓存必须使用 StaleWhileRevalidate 且 maxEntries=64');
}
if (
  !/StaleWhileRevalidate\(\{cacheName:"region-set-r7-v1",.{0,600}?maxEntries:24/.test(
    serviceWorker,
  )
) {
  fail('R7 套装缓存必须使用 StaleWhileRevalidate 且 maxEntries=24');
}

if (
  !/StaleWhileRevalidate\(\{cacheName:"character-appearance-v2",.{0,600}?maxEntries:160/.test(
    serviceWorker,
  )
) {
  fail('通用换装层缓存必须使用 StaleWhileRevalidate 且 maxEntries=160——CacheFirst 会让资产热修到不了老客户端');
}

const precacheStart = serviceWorker.indexOf('precacheAndRoute([');
const precacheEnd = serviceWorker.indexOf('],{})', precacheStart);
if (precacheStart < 0 || precacheEnd < 0) {
  fail('无法定位 Workbox precache 清单');
}
const precache = serviceWorker.slice(precacheStart, precacheEnd);
const forbiddenHeavyFragments = [
  '"assets/maps/r5.webp"',
  '"assets/maps/chapter-5-',
  '"assets/battlefields/chapter-5-',
  '"assets/monsters/r5/',
  '"assets/equipment/r5/',
  '"assets/equipment/sets/r5-crimson/',
  '"assets/maps/r6.webp"',
  '"assets/maps/chapter-6-',
  '"assets/battlefields/chapter-6-',
  '"assets/monsters/r6/',
  '"assets/equipment/r6/',
  '"assets/equipment/sets/r6-shadow/',
  '"assets/maps/r7.webp"',
  '"assets/maps/chapter-7-',
  '"assets/battlefields/chapter-7-',
  '"assets/monsters/r7/',
  '"assets/equipment/r7/',
  '"assets/equipment/sets/r7-bloodmoon/',
  '"assets/characters/modular/',
];
for (const fragment of forbiddenHeavyFragments) {
  if (fragment === '"assets/characters/modular/') {
    // 全部 modular 都应由运行时缓存接管，不只 R5。
    if (precache.includes(fragment)) fail('换装层误入首次预缓存');
    continue;
  }
  if (precache.includes(fragment)) fail(`区域重资产误入首次预缓存：${fragment}`);
}

const r5MaterialIds = [
  'slag_lava',
  'shard_scorched',
  'ember_ritual',
  'core_moltenheart',
  'frag_crimson',
];
const r6MaterialIds = [
  'dust_statue',
  'scroll_faded',
  'wisp_shadow',
  'stone_void',
  'frag_shadow',
];
const r7MaterialIds = [
  'dew_bloodmist',
  'herb_soulbreak',
  'horn_demon',
  'eye_bloodmoon',
  'frag_bloodmoon',
];
for (const itemId of [...r5MaterialIds, ...r6MaterialIds, ...r7MaterialIds]) {
  const relativePath = `assets/items/${itemId}.png`;
  if (existsSync(resolve(root, 'public', relativePath)) && !precache.includes(`"${relativePath}"`)) {
    fail(`已存在的区域材料小图未进入首次预缓存：${relativePath}`);
  }
}

console.log(
  `✓ PWA 缓存门禁通过：R5 / R6 / R7 基础区均 SWR/64、套装区均 SWR/24，路由顺序正确，重资产未预缓存`,
);
