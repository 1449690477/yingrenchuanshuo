/**
 * 从已归档的区域 3～4 无损母版重建运行时素材。
 *
 * ImageGen 原始输出和官方绿幕脚本生成的 Alpha 中间件都保存在 art-source；
 * 本脚本只做确定性的裁切、缩放和压缩，不生成或补齐缺失内容。
 */

import { spawnSync } from 'node:child_process';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  REGION34_BATTLEFIELDS,
  REGION34_EQUIPMENT,
  REGION34_ITEMS,
  REGION34_MAPS,
  REGION34_MODULAR_LAYERS,
} from './region34-assets-manifest.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');

async function requireFile(path) {
  try {
    await access(path);
  } catch {
    throw new Error(`区域 3/4 资产母版不存在：${path}`);
  }
}

async function renderOpaque(source, output, width, height, maxBytes) {
  await requireFile(source);
  await mkdir(dirname(output), { recursive: true });
  const pipeline = sharp(source)
    .rotate()
    .resize(width, height, {
      fit: 'cover',
      position: 'attention',
      withoutEnlargement: false,
    });

  let rendered;
  for (const quality of [86, 82, 78, 74, 70]) {
    const candidate = await pipeline
      .clone()
      .webp({
        quality,
        effort: 6,
        smartSubsample: true,
        preset: 'picture',
      })
      .toBuffer();
    rendered = candidate;
    if (candidate.length <= maxBytes) break;
  }
  if (!rendered || rendered.length > maxBytes) {
    throw new Error(
      `场景母版无法在质量下限内压到 ${(maxBytes / 1024).toFixed(0)}KiB：${source}`,
    );
  }
  await writeFile(output, rendered);

  const metadata = await sharp(output).metadata();
  if (metadata.width !== width || metadata.height !== height || metadata.format !== 'webp') {
    throw new Error(`场景输出规格异常：${output}`);
  }
}

async function renderIcon(source, output) {
  await requireFile(source);
  await mkdir(dirname(output), { recursive: true });
  const { data, info } = await sharp(source)
    .rotate()
    .ensureAlpha()
    .trim({
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      threshold: 8,
    })
    .resize({
      width: 224,
      height: 224,
      fit: 'inside',
      withoutEnlargement: false,
    })
    .png()
    .toBuffer({ resolveWithObject: true });
  const left = Math.floor((256 - info.width) / 2);
  const top = Math.floor((256 - info.height) / 2);

  await sharp({
    create: {
      width: 256,
      height: 256,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: data, left, top }])
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
    .toFile(output);
}

async function renderAlignedLayer(source, output) {
  await requireFile(source);
  const metadata = await sharp(source).metadata();
  if (
    !metadata.width ||
    !metadata.height ||
    Math.abs(metadata.width / metadata.height - 2 / 3) > 0.005
  ) {
    throw new Error(
      `换装 Alpha 母版必须保持 2:3 同画布，禁止拉伸补齐：${source} (${metadata.width}×${metadata.height})`,
    );
  }
  await mkdir(dirname(output), { recursive: true });
  await sharp(source)
    .rotate()
    .ensureAlpha()
    .resize(640, 960, {
      fit: 'fill',
      withoutEnlargement: false,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
    .toFile(output);
}

await Promise.all(
  REGION34_MAPS.map(({ id, region }) =>
    renderOpaque(
      resolve(ROOT, `art-source/regions/${region}/maps/${id}-source.png`),
      resolve(ROOT, `public/assets/maps/${id}.webp`),
      768,
      1024,
      450 * 1024,
    ),
  ),
);

await Promise.all(
  REGION34_BATTLEFIELDS.map(({ id, region }) =>
    renderOpaque(
      resolve(ROOT, `art-source/regions/${region}/battlefields/${id}-source.png`),
      resolve(ROOT, `public/assets/battlefields/${id}.webp`),
      1536,
      1024,
      520 * 1024,
    ),
  ),
);

await Promise.all(
  REGION34_ITEMS.map(({ id, region }) =>
    renderIcon(
      resolve(ROOT, `art-source/regions/${region}/items/${id}-alpha.png`),
      resolve(ROOT, `public/assets/items/${id}.png`),
    ),
  ),
);

await Promise.all(
  REGION34_EQUIPMENT.map(({ region, slot }) =>
    renderIcon(
      resolve(ROOT, `art-source/regions/${region}/equipment/${slot}-alpha.png`),
      resolve(ROOT, `public/assets/equipment/${region}/${slot}.png`),
    ),
  ),
);

await Promise.all(
  REGION34_MODULAR_LAYERS.map(({ classId, region, slot }) =>
    renderAlignedLayer(
      resolve(
        ROOT,
        `art-source/characters/modular/${classId}/r34-source/${region}-${slot}-alpha.png`,
      ),
      resolve(
        ROOT,
        `public/assets/characters/modular/${classId}/${region}-${slot}.png`,
      ),
    ),
  ),
);

const monsterBuild = spawnSync(
  process.execPath,
  [resolve(SCRIPT_DIR, 'gen-battle-monsters.mjs'), '--regions=r3,r4'],
  {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
  },
);
if (monsterBuild.status !== 0) {
  throw new Error(`区域 3/4 怪物构建失败，退出码 ${monsterBuild.status ?? 'unknown'}`);
}

console.log('区域 3/4 运行时资产已从归档母版完整重建。');
