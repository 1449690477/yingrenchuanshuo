/**
 * 区域 5 场景运行图构建器。
 *
 * ImageGen 原图只从独立美术源仓读取；本脚本绝不把原图复制回主游戏仓。
 * 默认源目录与主仓同级，也可通过 REGION5_ART_SOURCE_ROOT 显式指定。
 */

import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  REGION5_BATTLEFIELDS,
  REGION5_MAPS,
} from './region5-assets-manifest.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const SOURCE_ROOT = process.env.REGION5_ART_SOURCE_ROOT?.trim()
  ? resolve(process.env.REGION5_ART_SOURCE_ROOT)
  : resolve(ROOT, '..', 'yingrenchuanshuo-art-source-r5', 'scenes');

const MAP_OUTPUT_ROOT = resolve(ROOT, 'public/assets/maps');
const BATTLEFIELD_OUTPUT_ROOT = resolve(ROOT, 'public/assets/battlefields');

await mkdir(MAP_OUTPUT_ROOT, { recursive: true });
await mkdir(BATTLEFIELD_OUTPUT_ROOT, { recursive: true });

async function buildScene({
  source,
  output,
  width,
  height,
  quality,
}) {
  await sharp(source)
    .rotate()
    .resize({
      width,
      height,
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
    })
    .flatten({ background: '#ffffff' })
    .removeAlpha()
    .webp({
      quality,
      alphaQuality: 100,
      effort: 6,
      smartSubsample: true,
      preset: 'picture',
    })
    .toFile(output);
  console.log(`✔ ${output}`);
}

for (const asset of REGION5_MAPS) {
  await buildScene({
    source: resolve(SOURCE_ROOT, 'maps', `${asset.id}-source.png`),
    output: resolve(MAP_OUTPUT_ROOT, `${asset.id}.webp`),
    width: 768,
    height: 1024,
    quality: 82,
  });
}

for (const asset of REGION5_BATTLEFIELDS) {
  await buildScene({
    source: resolve(
      SOURCE_ROOT,
      'battlefields',
      `${asset.id}-source.png`,
    ),
    output: resolve(BATTLEFIELD_OUTPUT_ROOT, `${asset.id}.webp`),
    width: 1536,
    height: 1024,
    quality: 80,
  });
}

console.log(`区域 5 场景运行图已从独立源目录构建：${SOURCE_ROOT}`);
