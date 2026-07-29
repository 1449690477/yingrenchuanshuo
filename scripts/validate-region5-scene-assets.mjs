/**
 * 区域 5 场景资产门禁。
 *
 * 默认只校验主仓可提交物；传入 --with-sources 时，还会从独立美术源目录
 * 逐项核对 ImageGen 原图 SHA256。缺源时不会以运行图替代。
 */

import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
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
const CHECK_SOURCES = process.argv.includes('--with-sources');
const LOCK_PATH = resolve(
  ROOT,
  'art-source/regions/r5/SOURCE-SHA256.json',
);
const PROMPTS_PATH = resolve(ROOT, 'art-source/regions/r5/PROMPTS.md');
const CONTACT_PATH = resolve(ROOT, 'art-source/qa/r5-scenes-contact.webp');

const lock = JSON.parse(await readFile(LOCK_PATH, 'utf8'));
const prompts = await readFile(PROMPTS_PATH, 'utf8');
const errors = [];
const runtimePixelHashes = new Map();
const sourceHashes = new Map();

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function recordUnique(map, hash, key, kind) {
  const previous = map.get(hash);
  if (previous) {
    errors.push(`${kind} 像素重复：${previous} 与 ${key}`);
  } else {
    map.set(hash, key);
  }
}

const assets = [
  ...REGION5_MAPS.map((asset) => ({
    stableKey: asset.id,
    source: resolve(SOURCE_ROOT, 'maps', `${asset.id}-source.png`),
    runtime: resolve(ROOT, `public/assets/maps/${asset.id}.webp`),
    width: 768,
    height: 1024,
    maxBytes: 450 * 1024,
  })),
  ...REGION5_BATTLEFIELDS.map((asset) => ({
    stableKey: `battlefield:${asset.id}`,
    source: resolve(
      SOURCE_ROOT,
      'battlefields',
      `${asset.id}-source.png`,
    ),
    runtime: resolve(
      ROOT,
      `public/assets/battlefields/${asset.id}.webp`,
    ),
    width: 1536,
    height: 1024,
    maxBytes: 520 * 1024,
  })),
];

const expectedKeys = assets.map((asset) => asset.stableKey).sort();
const lockKeys = Object.keys(lock.assets ?? {}).sort();
if (JSON.stringify(expectedKeys) !== JSON.stringify(lockKeys)) {
  errors.push(
    `源锁 stable key 不匹配：expected=${expectedKeys.join(',')} actual=${lockKeys.join(',')}`,
  );
}

for (const asset of assets) {
  const entry = lock.assets?.[asset.stableKey];
  if (!entry) continue;

  if (!/^([a-f0-9]{64})$/.test(entry.sourceSha256 ?? '')) {
    errors.push(`${asset.stableKey} 缺少合法 sourceSha256`);
  }
  if (!/^([a-f0-9]{64})$/.test(entry.runtimeSha256 ?? '')) {
    errors.push(`${asset.stableKey} 缺少合法 runtimeSha256`);
  }
  if (!entry.callId || !prompts.includes(entry.callId)) {
    errors.push(`${asset.stableKey} 的 callId 未进入 PROMPTS：${entry.callId}`);
  }
  if (!prompts.includes(`\`${asset.stableKey}\``)) {
    errors.push(`${asset.stableKey} 缺少详细提示词记录`);
  }

  let runtimeBuffer;
  try {
    runtimeBuffer = await readFile(asset.runtime);
  } catch {
    errors.push(`${asset.stableKey} 运行图不存在：${asset.runtime}`);
    continue;
  }

  const metadata = await sharp(runtimeBuffer).metadata();
  const fileStat = await stat(asset.runtime);
  if (
    metadata.width !== asset.width ||
    metadata.height !== asset.height ||
    metadata.format !== 'webp'
  ) {
    errors.push(
      `${asset.stableKey} 规格错误：${metadata.width}x${metadata.height} ${metadata.format}`,
    );
  }
  if (metadata.hasAlpha) {
    errors.push(`${asset.stableKey} 场景必须是不透明 WebP`);
  }
  if (fileStat.size > asset.maxBytes) {
    errors.push(
      `${asset.stableKey} 超出体积：${fileStat.size} > ${asset.maxBytes}`,
    );
  }
  if (sha256(runtimeBuffer) !== entry.runtimeSha256) {
    errors.push(`${asset.stableKey} 运行图 SHA256 与锁不一致`);
  }

  const { data, info } = await sharp(runtimeBuffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== asset.width || info.height !== asset.height) {
    errors.push(`${asset.stableKey} 解码尺寸异常`);
  }
  recordUnique(
    runtimePixelHashes,
    sha256(data),
    asset.stableKey,
    '运行图',
  );
  const stats = await sharp(runtimeBuffer).stats();
  if (stats.entropy < 3) {
    errors.push(`${asset.stableKey} 图像熵过低，疑似空白 / 占位图`);
  }

  if (CHECK_SOURCES) {
    let sourceBuffer;
    try {
      sourceBuffer = await readFile(asset.source);
    } catch {
      errors.push(`${asset.stableKey} 独立源图不存在：${asset.source}`);
      continue;
    }
    if (sha256(sourceBuffer) !== entry.sourceSha256) {
      errors.push(`${asset.stableKey} 源图 SHA256 与锁不一致`);
    }
    const sourceMetadata = await sharp(sourceBuffer).metadata();
    if (sourceMetadata.format !== 'png' || sourceMetadata.hasAlpha) {
      errors.push(`${asset.stableKey} 源图必须是不透明 PNG`);
    }
    const sourcePixels = await sharp(sourceBuffer)
      .resize({ width: 192, height: 128, fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer();
    recordUnique(
      sourceHashes,
      sha256(sourcePixels),
      asset.stableKey,
      '独立源图',
    );
  }
}

const committedSourceDir = resolve(ROOT, 'art-source/regions/r5');
for (const filename of await readdir(committedSourceDir)) {
  if (filename.toLowerCase().endsWith('.png')) {
    errors.push(`主仓禁止提交 R5 ImageGen 原图：${filename}`);
  }
}

try {
  const contactMeta = await sharp(CONTACT_PATH).metadata();
  const contactStat = await stat(CONTACT_PATH);
  if (
    contactMeta.format !== 'webp' ||
    contactMeta.hasAlpha ||
    (contactMeta.width ?? 0) < 900 ||
    (contactMeta.height ?? 0) < 1500
  ) {
    errors.push('R5 场景联系表格式 / 尺寸 / 不透明性错误');
  }
  if (contactStat.size > 900 * 1024) {
    errors.push(`R5 场景联系表超过 900KiB：${contactStat.size}`);
  }
} catch {
  errors.push(`R5 场景联系表不存在：${CONTACT_PATH}`);
}

if (errors.length > 0) {
  console.error('区域 5 场景资产门禁失败：');
  for (const error of errors) console.error(`  ✘ ${error}`);
  process.exit(1);
}

console.log(
  `区域 5 场景资产门禁通过：${REGION5_MAPS.length} 张地图 + ${REGION5_BATTLEFIELDS.length} 张战场${CHECK_SOURCES ? '，独立源图 SHA 已复核' : ''}。`,
);
