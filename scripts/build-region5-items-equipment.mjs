/**
 * 区域 5 物品与装备图标构建器。
 *
 * ImageGen 原图和官方绿幕脚本生成的 Alpha 母版只保存在仓库外美术源目录；
 * 本脚本只从 Alpha 母版执行确定性的裁切、等比缩放、居中和无损 PNG 压缩。
 */

import { access, mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  REGION5_EQUIPMENT,
  REGION5_ITEMS,
  REGION5_SET_EQUIPMENT,
} from './region5-assets-manifest.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const SOURCE_ROOT = resolve(ROOT, '..', 'yingrenchuanshuo-art-source-r5', 'items-equipment');
const ICON_SIZE = 256;
const SUBJECT_SIZE = 232;
const MAX_BYTES = 120 * 1024;

const assets = [
  ...REGION5_ITEMS.map(({ id }) => ({
    key: `item:${id}`,
    source: resolve(SOURCE_ROOT, 'alpha', 'items', `${id}.png`),
    output: resolve(ROOT, 'public', 'assets', 'items', `${id}.png`),
  })),
  ...REGION5_EQUIPMENT.map(({ slot }) => ({
    key: `equipment:r5:${slot}`,
    source: resolve(SOURCE_ROOT, 'alpha', 'equipment', 'r5', `${slot}.png`),
    output: resolve(ROOT, 'public', 'assets', 'equipment', 'r5', `${slot}.png`),
  })),
  ...REGION5_SET_EQUIPMENT.map(({ slot }) => ({
    key: `equipment:r5-crimson:${slot}`,
    source: resolve(SOURCE_ROOT, 'alpha', 'equipment', 'r5-crimson', `${slot}.png`),
    output: resolve(ROOT, 'public', 'assets', 'equipment', 'sets', 'r5-crimson', `${slot}.png`),
  })),
];

if (assets.length !== 19 || new Set(assets.map(({ key }) => key)).size !== 19) {
  throw new Error(`R5 物品与装备清单必须恰好包含 19 个唯一资产，实际 ${assets.length}`);
}

async function requireFile(path) {
  try {
    await access(path);
  } catch {
    throw new Error(`R5 Alpha 母版不存在：${path}`);
  }
}

async function renderIcon({ key, source, output }) {
  await requireFile(source);
  await mkdir(dirname(output), { recursive: true });

  const sourceMetadata = await sharp(source).metadata();
  if (!sourceMetadata.hasAlpha || sourceMetadata.channels !== 4) {
    throw new Error(`${key} 必须使用官方脚本生成的 RGBA Alpha 母版：${source}`);
  }

  const { data, info } = await sharp(source)
    .rotate()
    .ensureAlpha()
    .trim({
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      threshold: 8,
    })
    .resize({
      width: SUBJECT_SIZE,
      height: SUBJECT_SIZE,
      fit: 'inside',
      withoutEnlargement: false,
    })
    .png()
    .toBuffer({ resolveWithObject: true });

  if (info.width <= 0 || info.height <= 0) {
    throw new Error(`${key} Alpha 母版没有可见主体：${source}`);
  }

  const left = Math.floor((ICON_SIZE - info.width) / 2);
  const top = Math.floor((ICON_SIZE - info.height) / 2);

  await sharp({
    create: {
      width: ICON_SIZE,
      height: ICON_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: data, left, top }])
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
    .toFile(output);

  const [metadata, fileStat] = await Promise.all([sharp(output).metadata(), stat(output)]);
  if (
    metadata.format !== 'png' ||
    metadata.width !== ICON_SIZE ||
    metadata.height !== ICON_SIZE ||
    metadata.channels !== 4 ||
    !metadata.hasAlpha
  ) {
    throw new Error(`${key} 运行时输出不是 256×256 RGBA PNG：${output}`);
  }
  if (fileStat.size > MAX_BYTES) {
    throw new Error(`${key} 运行时输出超过 120KiB：${(fileStat.size / 1024).toFixed(1)}KiB`);
  }

  console.log(`✓ ${key} -> ${output} (${(fileStat.size / 1024).toFixed(1)}KiB)`);
}

for (const asset of assets) {
  await renderIcon(asset);
}

console.log(
  `区域 5 物品与装备图标构建完成：5 件物品、8 件普通装备、6 件绯焰套装，共 ${assets.length} 件。`,
);
