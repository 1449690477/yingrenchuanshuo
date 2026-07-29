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
const genericAppearanceCacheName = 'character-appearance-v1';
const r5Index = serviceWorker.indexOf(r5CacheName);
const r5SetIndex = serviceWorker.indexOf(r5SetCacheName);
const genericAppearanceIndex = serviceWorker.indexOf(genericAppearanceCacheName);

if (r5Index < 0) fail(`产物缺少 ${r5CacheName}`);
if (r5SetIndex < 0) fail(`产物缺少 ${r5SetCacheName}`);
if (genericAppearanceIndex < 0) fail(`产物缺少 ${genericAppearanceCacheName}`);
if (r5Index >= genericAppearanceIndex || r5SetIndex >= genericAppearanceIndex) {
  fail('R5 区域 / 套装路由必须注册在通用 modular 路由之前，否则换装层会被先截走');
}
if (serviceWorker.includes('isRegion5RuntimeAssetPath')) {
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
  '"assets/characters/modular/',
];
for (const fragment of forbiddenHeavyFragments) {
  if (fragment === '"assets/characters/modular/') {
    // 全部 modular 都应由运行时缓存接管，不只 R5。
    if (precache.includes(fragment)) fail('换装层误入首次预缓存');
    continue;
  }
  if (precache.includes(fragment)) fail(`R5 重资产误入首次预缓存：${fragment}`);
}

const r5MaterialIds = [
  'slag_lava',
  'shard_scorched',
  'ember_ritual',
  'core_moltenheart',
  'frag_crimson',
];
for (const itemId of r5MaterialIds) {
  const relativePath = `assets/items/${itemId}.png`;
  if (existsSync(resolve(root, 'public', relativePath)) && !precache.includes(`"${relativePath}"`)) {
    fail(`已存在的 R5 材料小图未进入首次预缓存：${relativePath}`);
  }
}

console.log(
  `✓ PWA 缓存门禁通过：${r5CacheName} SWR/64 + ${r5SetCacheName} SWR/24，路由顺序正确，R5 重资产未预缓存`,
);
