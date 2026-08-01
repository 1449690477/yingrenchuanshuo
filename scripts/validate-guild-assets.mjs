/** 公会场景美术门禁。独立运行：node scripts/validate-guild-assets.mjs */
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const ROOT = resolve(import.meta.dirname, '..');
const assets = [
  {
    name: '公会团本战场',
    source: 'art-source/guild/guild-expedition-arena.png',
    runtime: 'public/assets/guild/guild-expedition-arena.webp',
  },
  {
    name: '公会主庭院',
    source: 'art-source/guild/guild-home-courtyard-source.png',
    runtime: 'public/assets/guild/guild-home-courtyard.webp',
  },
  {
    name: '赛季据点建设场',
    source: 'art-source/guild/guild-stronghold-source.png',
    runtime: 'public/assets/guild/guild-stronghold-courtyard.webp',
  },
];
const errors = [];

for (const asset of assets) {
  const sourcePath = resolve(ROOT, asset.source);
  const runtimePath = resolve(ROOT, asset.runtime);

  try {
    const source = await sharp(sourcePath).metadata();
    if (!source.width || !source.height || source.width / source.height < 1.45) {
      errors.push(`${asset.name}母版必须是可裁成 3:2 的横版场景`);
    }
  } catch {
    errors.push(`缺少 ${asset.source}`);
  }

  try {
    const runtime = await sharp(runtimePath).metadata();
    const bytes = (await stat(runtimePath)).size;
    if (runtime.width !== 1536 || runtime.height !== 1024 || runtime.format !== 'webp') {
      errors.push(`${asset.runtime} 必须是 1536×1024 WebP`);
    }
    if (bytes > 520 * 1024) {
      errors.push(`${asset.runtime} 超过 520KB：${Math.ceil(bytes / 1024)}KB`);
    }
  } catch {
    errors.push(`缺少 ${asset.runtime}`);
  }
}

if (errors.length > 0) throw new Error(`公会场景资产校验失败：\n- ${errors.join('\n- ')}`);
console.log(`公会场景资产校验通过：${assets.length} 张 1536×1024 WebP 格式与体积合格。`);
