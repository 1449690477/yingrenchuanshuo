/**
 * 区域 6 全资产门禁。
 *
 * 默认只检查主仓运行时资源，CI 可直接执行；传入 --with-sources 时额外复核
 * 仓库外 chroma/alpha 母版及 SHA 来源锁。
 */

import { createHash } from 'node:crypto';
import { access, readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  REGION6_ALL_ASSETS,
  REGION6_BATTLEFIELDS,
  REGION6_COUNTS,
  REGION6_EQUIPMENT,
  REGION6_ITEMS,
  REGION6_MAPS,
  REGION6_MODULAR_LAYERS,
  REGION6_MONSTERS,
  REGION6_SET_EQUIPMENT,
  REGION6_SET_MODULAR_LAYERS,
} from './region6-assets-manifest.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_ROOT = process.env.REGION6_ART_SOURCE_ROOT?.trim()
  ? resolve(process.env.REGION6_ART_SOURCE_ROOT)
  : resolve(ROOT, '..', 'yingrenchuanshuo-art-source-r6');
const WITH_SOURCES = process.argv.includes('--with-sources');
const REPO_SOURCES_ONLY = process.argv.includes('--repo-sources-only');
const CHECK_SOURCES = WITH_SOURCES || REPO_SOURCES_ONLY;
const LOCK_PATH = resolve(ROOT, 'art-source/regions/r6/SOURCE-SHA256.json');
const PROMPTS_PATH = resolve(ROOT, 'art-source/regions/r6/PROMPTS.md');
const CONTACT_PATH = resolve(ROOT, 'art-source/qa/r6-assets-contact.webp');
const APPEARANCE_CONTACT_PATH = resolve(ROOT, 'art-source/qa/r6-appearance-contact.webp');
const errors = [];
const runtimeHashes = new Map();

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function lockedSourcePath(relativePath) {
  const repositoryPrefix = 'repo:';
  return relativePath.startsWith(repositoryPrefix)
    ? resolve(ROOT, relativePath.slice(repositoryPrefix.length))
    : resolve(SOURCE_ROOT, relativePath);
}

function runtimeEntries() {
  return [
    ...REGION6_MAPS.map((asset) => ({
      key: `map:${asset.id}`,
      path: resolve(ROOT, 'public/assets/maps', `${asset.id}.webp`),
      width: 768,
      height: 1024,
      format: 'webp',
      maxBytes: 260 * 1024,
      alpha: false,
    })),
    ...REGION6_BATTLEFIELDS.map((asset) => ({
      key: `battlefield:${asset.id}`,
      path: resolve(ROOT, 'public/assets/battlefields', `${asset.id}.webp`),
      width: 1536,
      height: 1024,
      format: 'webp',
      maxBytes: 380 * 1024,
      alpha: false,
    })),
    ...REGION6_MONSTERS.map((asset) => ({
      key: `monster:${asset.id}`,
      path: resolve(ROOT, 'public/assets/monsters/r6', `${asset.id}.webp`),
      width: 512,
      height: 512,
      format: 'webp',
      maxBytes: 160 * 1024,
      alpha: true,
    })),
    ...REGION6_ITEMS.map((asset) => ({
      key: `item:${asset.id}`,
      path: resolve(ROOT, 'public/assets/items', `${asset.id}.png`),
      width: 256,
      height: 256,
      format: 'png',
      maxBytes: 120 * 1024,
      alpha: true,
    })),
    ...REGION6_EQUIPMENT.map((asset) => ({
      key: `equipment:${asset.id}`,
      path: resolve(ROOT, 'public/assets/equipment/r6', `${asset.slot}.png`),
      width: 256,
      height: 256,
      format: 'png',
      maxBytes: 120 * 1024,
      alpha: true,
    })),
    ...REGION6_SET_EQUIPMENT.map((asset) => ({
      key: `set-equipment:${asset.id}`,
      path: resolve(ROOT, 'public/assets/equipment/sets/r6-shadow', `${asset.slot}.png`),
      width: 256,
      height: 256,
      format: 'png',
      maxBytes: 120 * 1024,
      alpha: true,
    })),
    ...[...REGION6_MODULAR_LAYERS, ...REGION6_SET_MODULAR_LAYERS].map((asset) => ({
      key: `${asset.family === 'r6' ? 'layer' : 'set-layer'}:${asset.id}`,
      path: resolve(
        ROOT,
        'public/assets/characters/modular',
        asset.classId,
        `${asset.family}-${asset.slot}.png`,
      ),
      width: 640,
      height: 960,
      format: 'png',
      maxBytes: 300 * 1024,
      alpha: true,
    })),
  ];
}

async function validateRuntime(entry) {
  if (!(await exists(entry.path))) {
    errors.push(`${entry.key} 缺少运行时文件：${entry.path}`);
    return;
  }
  const [metadata, fileStat] = await Promise.all([
    sharp(entry.path).metadata(),
    stat(entry.path),
  ]);
  if (
    metadata.width !== entry.width ||
    metadata.height !== entry.height ||
    metadata.format !== entry.format
  ) {
    errors.push(
      `${entry.key} 规格错误：${metadata.width}×${metadata.height} ${metadata.format}`,
    );
    return;
  }
  if (fileStat.size > entry.maxBytes) {
    errors.push(
      `${entry.key} 体积 ${(fileStat.size / 1024).toFixed(1)} KiB 超过 ${Math.round(entry.maxBytes / 1024)} KiB`,
    );
  }
  const pixels = await sharp(entry.path).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const hash = sha256(pixels.data);
  const duplicate = runtimeHashes.get(hash);
  if (duplicate) errors.push(`${entry.key} 与 ${duplicate} 像素完全重复`);
  else runtimeHashes.set(hash, entry.key);

  if (!entry.alpha) return;
  if (!metadata.hasAlpha || metadata.channels !== 4) {
    errors.push(`${entry.key} 必须具有 RGBA 透明通道`);
    return;
  }
  const { data, info } = pixels;
  const cornerPixels = [
    0,
    info.width - 1,
    (info.height - 1) * info.width,
    info.width * info.height - 1,
  ];
  if (cornerPixels.some((pixel) => data[pixel * info.channels + 3] !== 0)) {
    errors.push(`${entry.key} 四角必须完全透明`);
  }
  let visible = 0;
  let pureGreen = 0;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    if (data[offset + 3] <= 8) continue;
    visible += 1;
    if (data[offset + 1] >= 245 && data[offset] <= 18 && data[offset + 2] <= 18) {
      pureGreen += 1;
    }
  }
  if (visible < 600) errors.push(`${entry.key} 有效像素过少：${visible}`);
  if (visible > 0 && pureGreen / visible > 0.0005) {
    errors.push(`${entry.key} 仍有明显纯绿残留：${pureGreen}/${visible}`);
  }
}

const entries = runtimeEntries();
if (
  REGION6_ALL_ASSETS.length !== REGION6_COUNTS.runtimeTotal ||
  entries.length !== REGION6_COUNTS.runtimeTotal ||
  new Set(entries.map((entry) => entry.key)).size !== entries.length ||
  new Set(entries.map((entry) => entry.path)).size !== entries.length
) {
  errors.push(
    `R6 清单必须恰好包含 ${REGION6_COUNTS.runtimeTotal} 个唯一原子资产，实际 manifest/runtime=${REGION6_ALL_ASSETS.length}/${entries.length}`,
  );
}

const callIds = REGION6_ALL_ASSETS.map((asset) => asset.callId);
if (
  callIds.some(
    (callId) => !/^(?:exec-[a-f0-9-]+|contract-kenshi-r6-[a-z0-9-]+)$/.test(callId),
  )
) {
  errors.push('R6 manifest 存在无效 ImageGen call ID');
}
if (new Set(callIds).size !== callIds.length) {
  errors.push(`R6 每个独立资产必须来自唯一 ImageGen 调用，实际 ${new Set(callIds).size}/${callIds.length}`);
}

for (const entry of entries) await validateRuntime(entry);

if (!(await exists(PROMPTS_PATH))) {
  errors.push(`缺少 R6 提示词说明：${PROMPTS_PATH}`);
}
if (!(await exists(CONTACT_PATH))) {
  errors.push(`缺少 R6 资产联系表：${CONTACT_PATH}`);
} else {
  const metadata = await sharp(CONTACT_PATH).metadata();
  if (
    metadata.format !== 'webp' ||
    metadata.width !== 1100 ||
    metadata.height !== 3240
  ) {
    errors.push(
      `R6 联系表规格错误：${metadata.width}×${metadata.height} ${metadata.format}`,
    );
  }
}
if (!(await exists(APPEARANCE_CONTACT_PATH))) {
  errors.push(`缺少 R6 五职业纸娃娃联系表：${APPEARANCE_CONTACT_PATH}`);
} else {
  const metadata = await sharp(APPEARANCE_CONTACT_PATH).metadata();
  if (
    metadata.format !== 'webp' ||
    metadata.width !== 1800 ||
    metadata.height !== 1160
  ) {
    errors.push(
      `R6 五职业纸娃娃联系表规格错误：${metadata.width}×${metadata.height} ${metadata.format}`,
    );
  }
}

let lock;
if (!(await exists(LOCK_PATH))) {
  errors.push(`缺少 R6 来源锁：${LOCK_PATH}`);
} else {
  lock = JSON.parse(await readFile(LOCK_PATH, 'utf8'));
  if (Object.keys(lock.runtime ?? {}).length !== REGION6_COUNTS.runtimeTotal) {
    errors.push(`R6 来源锁 runtime 必须是 ${REGION6_COUNTS.runtimeTotal} 项`);
  }
  if (Object.keys(lock.sources ?? {}).length !== 161) {
    errors.push(`R6 来源锁 sources 必须是 161 项`);
  }
  for (const record of Object.values(lock.runtime ?? {})) {
    const path = resolve(ROOT, record.path);
    if (!(await exists(path))) {
      errors.push(`来源锁指向缺失运行时文件：${record.path}`);
      continue;
    }
    if (sha256(await readFile(path)) !== record.sha256) {
      errors.push(`运行时文件与来源锁不一致：${record.path}`);
    }
  }
}

if (CHECK_SOURCES && lock) {
  const sourcePixelHashes = new Map();
  for (const record of Object.values(lock.sources ?? {})) {
    if (REPO_SOURCES_ONLY && !record.path.startsWith('repo:')) continue;
    const path = lockedSourcePath(record.path);
    if (!(await exists(path))) {
      errors.push(`来源锁指向缺失母版：${record.path}`);
      continue;
    }
    if (sha256(await readFile(path)) !== record.sha256) {
      errors.push(`母版与来源锁不一致：${record.path}`);
    }
    const metadata = await sharp(path).metadata();
    if (!metadata.width || !metadata.height || metadata.width < 1024 || metadata.height < 1024) {
      errors.push(`母版尺寸不足 1024：${record.path}`);
    }
    const raw = await sharp(path).ensureAlpha().raw().toBuffer();
    const pixelHash = sha256(raw);
    const duplicate = sourcePixelHashes.get(pixelHash);
    if (duplicate) errors.push(`母版像素重复：${record.path} / ${duplicate}`);
    else sourcePixelHashes.set(pixelHash, record.path);
    if (record.path.endsWith('-alpha.png') || record.path.includes('/alpha/')) {
      const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({
        resolveWithObject: true,
      });
      const corners = [
        0,
        info.width - 1,
        (info.height - 1) * info.width,
        info.width * info.height - 1,
      ];
      if (corners.some((pixel) => data[pixel * info.channels + 3] !== 0)) {
        errors.push(`Alpha 母版四角不透明：${record.path}`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`区域 6 资产门禁失败（${errors.length} 项）：`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `✓ 区域 6 全资产门禁通过：${REGION6_COUNTS.runtimeTotal}/${REGION6_COUNTS.runtimeTotal} 独立运行时资源${WITH_SOURCES ? '，161/161 来源母版与 SHA 同步通过' : REPO_SOURCES_ONLY ? '，12/12 仓内樱酱母版与 SHA 同步通过' : ''}。`,
  );
}
