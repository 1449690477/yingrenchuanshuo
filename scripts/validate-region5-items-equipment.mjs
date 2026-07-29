/**
 * 区域 5 物品与装备图标资产门禁。
 *
 * 同时验证仓库外 chroma/alpha 母版、仓库内提示词与 SHA 锁、运行时文件集、
 * 透明边缘、留白、绿幕残留、体积和像素唯一性，防止路径存在掩盖缺图或占位图。
 */

import { createHash } from 'node:crypto';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  REGION5_COUNTS,
  REGION5_EQUIPMENT,
  REGION5_ITEMS,
  REGION5_SET_EQUIPMENT,
} from './region5-assets-manifest.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const SOURCE_ROOT = resolve(ROOT, '..', 'yingrenchuanshuo-art-source-r5', 'items-equipment');
const PROMPTS_PATH = resolve(ROOT, 'art-source', 'regions', 'r5', 'PROMPTS-ITEMS-EQUIPMENT.md');
const SHA_PATH = resolve(ROOT, 'art-source', 'regions', 'r5', 'ITEMS-EQUIPMENT-SHA256.txt');
const CONTACT_PATH = resolve(ROOT, 'art-source', 'qa', 'r5-items-equipment-contact.webp');
const MAX_BYTES = 120 * 1024;
const errors = [];
const chromaPixelHashes = new Map();
const alphaPixelHashes = new Map();
const runtimePixelHashes = new Map();

const assets = [
  ...REGION5_ITEMS.map(({ id }) => ({
    key: `item:${id}`,
    promptId: id,
    relativeSource: `items/${id}.png`,
    output: resolve(ROOT, 'public', 'assets', 'items', `${id}.png`),
  })),
  ...REGION5_EQUIPMENT.map(({ slot }) => ({
    key: `equipment:r5:${slot}`,
    promptId: `r5-${slot}`,
    relativeSource: `equipment/r5/${slot}.png`,
    output: resolve(ROOT, 'public', 'assets', 'equipment', 'r5', `${slot}.png`),
  })),
  ...REGION5_SET_EQUIPMENT.map(({ slot }) => ({
    key: `equipment:r5-crimson:${slot}`,
    promptId: `r5-crimson-${slot}`,
    relativeSource: `equipment/r5-crimson/${slot}.png`,
    output: resolve(ROOT, 'public', 'assets', 'equipment', 'sets', 'r5-crimson', `${slot}.png`),
  })),
];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function requirePath(path, label) {
  if (!(await exists(path))) {
    errors.push(`${label}不存在：${path}`);
    return false;
  }
  return true;
}

async function exactPngFilenames(directory, expected, label) {
  if (!(await requirePath(directory, `${label}目录`))) return;
  const discovered = (await readdir(directory))
    .filter((filename) => extname(filename).toLowerCase() === '.png')
    .sort();
  const sortedExpected = [...expected].sort();
  const missing = sortedExpected.filter((filename) => !discovered.includes(filename));
  const unexpected = discovered.filter((filename) => !sortedExpected.includes(filename));
  if (missing.length > 0) errors.push(`${label}缺少：${missing.join(', ')}`);
  if (unexpected.length > 0) errors.push(`${label}多出：${unexpected.join(', ')}`);
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function fileSha256(path) {
  return sha256(await readFile(path));
}

async function registerPixelHash(path, label, registry) {
  const raw = await sharp(path).ensureAlpha().raw().toBuffer();
  const hash = sha256(raw);
  const duplicate = registry.get(hash);
  if (duplicate) {
    errors.push(`${label}与 ${duplicate} 像素完全重复：${path}`);
  } else {
    registry.set(hash, label);
  }
}

async function validateChroma(path, label) {
  if (!(await requirePath(path, label))) return;
  const metadata = await sharp(path).metadata();
  if (
    metadata.format !== 'png' ||
    !metadata.width ||
    !metadata.height ||
    metadata.width < 1024 ||
    metadata.height < 1024
  ) {
    errors.push(
      `${label}应为至少 1024×1024 的 PNG，实际 ${metadata.width}×${metadata.height} ${metadata.format}`,
    );
    return;
  }

  const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const corners = [0, info.width - 1, (info.height - 1) * info.width, info.width * info.height - 1];
  for (const pixel of corners) {
    const offset = pixel * info.channels;
    if (
      data[offset] > 32 ||
      data[offset + 1] < 224 ||
      data[offset + 2] > 32 ||
      data[offset + 1] - Math.max(data[offset], data[offset + 2]) < 192
    ) {
      errors.push(`${label}四角必须处于 #00ff00 官方色键的有效范围`);
      break;
    }
  }
  await registerPixelHash(path, label, chromaPixelHashes);
}

async function validateAlpha(path, label) {
  if (!(await requirePath(path, label))) return;
  const metadata = await sharp(path).metadata();
  if (metadata.format !== 'png' || metadata.channels !== 4 || !metadata.hasAlpha) {
    errors.push(`${label}必须是 RGBA PNG`);
    return;
  }

  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const corners = [0, info.width - 1, (info.height - 1) * info.width, info.width * info.height - 1];
  if (corners.some((pixel) => data[pixel * info.channels + 3] !== 0)) {
    errors.push(`${label}四角必须完全透明`);
  }

  let visible = 0;
  let pureGreen = 0;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    if (data[offset + 3] <= 8) continue;
    visible += 1;
    if (data[offset + 1] >= 248 && data[offset] <= 16 && data[offset + 2] <= 16) {
      pureGreen += 1;
    }
  }
  if (visible === 0) errors.push(`${label}没有可见主体`);
  if (visible > 0 && pureGreen / visible > 0.0005) {
    errors.push(`${label}仍有明显纯绿残留：${pureGreen}/${visible}`);
  }
  await registerPixelHash(path, label, alphaPixelHashes);
}

async function validateRuntime(path, label) {
  if (!(await requirePath(path, label))) return;
  const [metadata, fileStat] = await Promise.all([sharp(path).metadata(), stat(path)]);
  if (
    metadata.format !== 'png' ||
    metadata.width !== 256 ||
    metadata.height !== 256 ||
    metadata.channels !== 4 ||
    !metadata.hasAlpha
  ) {
    errors.push(
      `${label}应为 256×256 RGBA PNG，实际 ${metadata.width}×${metadata.height} channels=${metadata.channels} ${metadata.format}`,
    );
    return;
  }
  if (fileStat.size > MAX_BYTES) {
    errors.push(`${label}体积超过 120KiB：${(fileStat.size / 1024).toFixed(1)}KiB`);
  }

  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const corners = [0, info.width - 1, (info.height - 1) * info.width, info.width * info.height - 1];
  if (corners.some((pixel) => data[pixel * info.channels + 3] !== 0)) {
    errors.push(`${label}四角必须完全透明`);
  }

  let visible = 0;
  let pureGreen = 0;
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      if (data[offset + 3] <= 8) continue;
      visible += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      if (data[offset + 1] >= 248 && data[offset] <= 16 && data[offset + 2] <= 16) {
        pureGreen += 1;
      }
    }
  }

  if (visible === 0) {
    errors.push(`${label}没有可见主体`);
  } else {
    const margins = [minX, minY, 255 - maxX, 255 - maxY];
    if (Math.min(...margins) < 12) {
      errors.push(`${label}主体安全留白不足 12px：${margins.join('/')}`);
    }
    const coverage = visible / (256 * 256);
    if (coverage < 0.04 || coverage > 0.75) {
      errors.push(`${label}可见像素覆盖率异常：${(coverage * 100).toFixed(1)}%`);
    }
    if (pureGreen / visible > 0.0005) {
      errors.push(`${label}仍有明显纯绿残留：${pureGreen}/${visible}`);
    }
  }

  await registerPixelHash(path, label, runtimePixelHashes);
}

if (
  REGION5_ITEMS.length !== 5 ||
  REGION5_EQUIPMENT.length !== 8 ||
  REGION5_SET_EQUIPMENT.length !== 6 ||
  assets.length !== 19 ||
  REGION5_COUNTS.items !== 5 ||
  REGION5_COUNTS.equipment !== 8 ||
  REGION5_COUNTS.setEquipment !== 6
) {
  errors.push(
    `R5 清单计数必须是物品 5 / 普通装备 8 / 套装 6，实际 ${REGION5_ITEMS.length}/${REGION5_EQUIPMENT.length}/${REGION5_SET_EQUIPMENT.length}`,
  );
}
if (
  new Set(assets.map(({ key }) => key)).size !== assets.length ||
  new Set(assets.map(({ output }) => output)).size !== assets.length
) {
  errors.push('R5 物品与装备清单存在重复 key 或重复运行时路径');
}

await exactPngFilenames(
  resolve(ROOT, 'public', 'assets', 'equipment', 'r5'),
  REGION5_EQUIPMENT.map(({ slot }) => `${slot}.png`),
  'R5 普通装备运行时目录',
);
await exactPngFilenames(
  resolve(ROOT, 'public', 'assets', 'equipment', 'sets', 'r5-crimson'),
  REGION5_SET_EQUIPMENT.map(({ slot }) => `${slot}.png`),
  '绯焰套装运行时目录',
);

let promptText = '';
if (await requirePath(PROMPTS_PATH, 'R5 物品装备提示词')) {
  promptText = await readFile(PROMPTS_PATH, 'utf8');
  const undocumented = assets
    .map(({ promptId }) => promptId)
    .filter((id) => !promptText.includes(id));
  if (undocumented.length > 0) {
    errors.push(`提示词未登记：${undocumented.join(', ')}`);
  }
  const callIds = [...promptText.matchAll(/\bcall_[A-Za-z0-9]+\b/g)].map(([callId]) => callId);
  if (callIds.length !== 19 || new Set(callIds).size !== 19) {
    errors.push(
      `提示词必须登记 19 个唯一 ImageGen call ID，实际 ${callIds.length}/${new Set(callIds).size}`,
    );
  }
}

const expectedShaPaths = new Set(
  assets.flatMap(({ relativeSource }) => [`chroma/${relativeSource}`, `alpha/${relativeSource}`]),
);
const lockedHashes = new Map();
if (await requirePath(SHA_PATH, 'R5 物品装备 SHA 锁')) {
  const lines = (await readFile(SHA_PATH, 'utf8'))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length !== 38) {
    errors.push(`SHA 锁必须恰好包含 38 行，实际 ${lines.length}`);
  }
  for (const line of lines) {
    const match = /^([a-f0-9]{64}) {2}(.+)$/.exec(line);
    if (!match) {
      errors.push(`SHA 锁格式错误：${line}`);
      continue;
    }
    const [, hash, relativePath] = match;
    if (lockedHashes.has(relativePath)) {
      errors.push(`SHA 锁重复路径：${relativePath}`);
    }
    lockedHashes.set(relativePath, hash);
  }
  const missing = [...expectedShaPaths].filter((path) => !lockedHashes.has(path));
  const unexpected = [...lockedHashes.keys()].filter((path) => !expectedShaPaths.has(path));
  if (missing.length > 0) errors.push(`SHA 锁缺少：${missing.join(', ')}`);
  if (unexpected.length > 0) errors.push(`SHA 锁多出：${unexpected.join(', ')}`);
}

for (const asset of assets) {
  const chromaRelative = `chroma/${asset.relativeSource}`;
  const alphaRelative = `alpha/${asset.relativeSource}`;
  const chromaPath = resolve(SOURCE_ROOT, ...chromaRelative.split('/'));
  const alphaPath = resolve(SOURCE_ROOT, ...alphaRelative.split('/'));

  await validateChroma(chromaPath, `${asset.key} chroma 母版`);
  await validateAlpha(alphaPath, `${asset.key} alpha 母版`);
  await validateRuntime(asset.output, `${asset.key} 运行时图标`);

  for (const [relativePath, absolutePath] of [
    [chromaRelative, chromaPath],
    [alphaRelative, alphaPath],
  ]) {
    if (!(await exists(absolutePath)) || !lockedHashes.has(relativePath)) continue;
    const actualHash = await fileSha256(absolutePath);
    if (actualHash !== lockedHashes.get(relativePath)) {
      errors.push(`${relativePath} 与 SHA 锁不一致`);
    }
  }
}

if (await requirePath(CONTACT_PATH, 'R5 物品装备联系表')) {
  const [metadata, fileStat] = await Promise.all([
    sharp(CONTACT_PATH).metadata(),
    stat(CONTACT_PATH),
  ]);
  if (
    metadata.format !== 'webp' ||
    metadata.width !== 1090 ||
    !metadata.height ||
    metadata.height < 1200
  ) {
    errors.push(
      `R5 物品装备联系表规格错误：${metadata.width}×${metadata.height} ${metadata.format}`,
    );
  }
  if (fileStat.size > 600 * 1024) {
    errors.push(`R5 物品装备联系表超过 600KiB：${(fileStat.size / 1024).toFixed(1)}KiB`);
  }
}

if (errors.length > 0) {
  console.error(`区域 5 物品与装备资产校验失败（${errors.length} 项）：`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `区域 5 物品与装备资产校验通过：${chromaPixelHashes.size} 张独立 chroma、${alphaPixelHashes.size} 张独立 alpha、${runtimePixelHashes.size} 张独立运行时图标；5 物品 / 8 普通装备 / 6 绯焰套装。`,
  );
}
