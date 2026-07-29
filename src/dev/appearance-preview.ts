import { createApp } from 'vue';
import AppearancePreview from './AppearancePreview.vue';
import {
  CHARACTER_BASE_ASSETS,
  CHARACTER_BASE_NOSHOES_ASSETS,
  EQUIPMENT_APPEARANCES,
} from '@/data/characterAppearance';

/**
 * 截图前必须保证全部图层已落入 HTTP 缓存，否则 Chrome 的
 * --virtual-time-budget 会在大图（剑士/萨满底模 400KB+）尚未载完时提前
 * 触发截图，出现"固定职业空格"的假阳性。
 */
function collectAssetUrls(): string[] {
  const urls = new Set<string>();
  const base = import.meta.env.BASE_URL;
  for (const asset of Object.values(CHARACTER_BASE_ASSETS)) urls.add(`${base}${asset}`);
  for (const asset of Object.values(CHARACTER_BASE_NOSHOES_ASSETS)) urls.add(`${base}${asset}`);
  for (const appearance of Object.values(EQUIPMENT_APPEARANCES)) {
    if (appearance.renderMode === 'slot-only') continue;
    for (const asset of Object.values(appearance.assets)) urls.add(`${base}${asset}`);
  }
  return [...urls];
}

async function preloadAll(urls: string[]): Promise<void> {
  await Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => {
            console.warn('[预览页] 素材加载失败：', url);
            resolve();
          };
          img.src = url;
        }),
    ),
  );
}

const app = createApp(AppearancePreview);
await preloadAll(collectAssetUrls());
app.mount('#app');
