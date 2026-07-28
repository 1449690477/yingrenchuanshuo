/**
 * 区域 3～4 美术资产门禁。
 *
 * 除运行时尺寸外，同时检查源图、提示词、透明角、脚底锚点、残留绿幕、
 * 精确数量与像素重复，避免缺图被路径存在检查掩盖。
 */

import { createHash } from 'node:crypto';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  REGION34_BATTLEFIELDS,
  REGION34_COUNTS,
  REGION34_EQUIPMENT,
  REGION34_ITEMS,
  REGION34_MAPS,
  REGION34_MODULAR_LAYERS,
  REGION34_MONSTERS,
  REGION34_REGIONS,
  REGION34_SLOTS,
} from './region34-assets-manifest.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const errors = [];
const pixelHashes = new Map();
const sourcePixelHashes = new Map();

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

async function exactFilenames(directory, expected, label) {
  if (!(await requirePath(directory, `${label}目录`))) return;
  const discovered = (await readdir(directory))
    .filter((filename) => expected.some((candidate) => extname(candidate) === extname(filename)))
    .sort();
  const sortedExpected = [...expected].sort();
  const missing = sortedExpected.filter((filename) => !discovered.includes(filename));
  const unexpected = discovered.filter((filename) => !sortedExpected.includes(filename));
  if (missing.length > 0) errors.push(`${label}缺少：${missing.join(', ')}`);
  if (unexpected.length > 0) errors.push(`${label}多出：${unexpected.join(', ')}`);
}

async function registerPixelHash(path, label) {
  const raw = await sharp(path).ensureAlpha().raw().toBuffer();
  const hash = createHash('sha256').update(raw).digest('hex');
  const duplicate = pixelHashes.get(hash);
  if (duplicate) {
    errors.push(`${label}与 ${duplicate} 像素完全重复：${path}`);
  } else {
    pixelHashes.set(hash, label);
  }
}

async function validateIndependentSource(path, label) {
  if (!(await requirePath(path, label))) return;
  const raw = await sharp(path).ensureAlpha().raw().toBuffer();
  const hash = createHash('sha256').update(raw).digest('hex');
  const duplicate = sourcePixelHashes.get(hash);
  if (duplicate) {
    errors.push(`${label}与 ${duplicate} 源图像素完全重复：${path}`);
  } else {
    sourcePixelHashes.set(hash, label);
  }
}

async function validateOpaque(path, label, width, height, maxBytes) {
  if (!(await requirePath(path, label))) return;
  const metadata = await sharp(path).metadata();
  if (metadata.format !== 'webp' || metadata.width !== width || metadata.height !== height) {
    errors.push(
      `${label}规格错误：应为 ${width}×${height} WebP，实际 ${metadata.width}×${metadata.height} ${metadata.format}`,
    );
  }
  const bytes = (await stat(path)).size;
  if (bytes > maxBytes) {
    errors.push(`${label}体积超限：${(bytes / 1024).toFixed(1)}KiB`);
  }
  await registerPixelHash(path, label);
}

async function validateTransparent(
  path,
  label,
  width,
  height,
  maxBytes,
  expectedBottomY,
) {
  if (!(await requirePath(path, label))) return;
  const metadata = await sharp(path).metadata();
  if (
    metadata.width !== width ||
    metadata.height !== height ||
    metadata.channels !== 4 ||
    !metadata.hasAlpha
  ) {
    errors.push(
      `${label}规格错误：应为 ${width}×${height} RGBA，实际 ${metadata.width}×${metadata.height} channels=${metadata.channels}`,
    );
    return;
  }
  const bytes = (await stat(path)).size;
  if (bytes > maxBytes) {
    errors.push(`${label}体积超限：${(bytes / 1024).toFixed(1)}KiB`);
  }

  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const corners = [
    0,
    info.width - 1,
    (info.height - 1) * info.width,
    info.height * info.width - 1,
  ];
  if (corners.some((pixel) => data[pixel * info.channels + 3] !== 0)) {
    errors.push(`${label}四角必须完全透明`);
  }

  let visible = 0;
  let chromaResidue = 0;
  let bottomY = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const alpha = data[offset + 3];
      if (alpha <= 8) continue;
      visible += 1;
      bottomY = y;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      if (green >= 248 && red <= 16 && blue <= 16) chromaResidue += 1;
    }
  }
  if (visible === 0) errors.push(`${label}没有可见主体`);
  if (visible > 0 && chromaResidue / visible > 0.0005) {
    errors.push(`${label}仍有明显纯绿幕残留：${chromaResidue}/${visible}`);
  }
  if (expectedBottomY !== undefined && bottomY !== expectedBottomY) {
    errors.push(`${label}脚底锚点应为 y=${expectedBottomY}，实际 y=${bottomY}`);
  }
  await registerPixelHash(path, label);
}

for (const region of REGION34_REGIONS) {
  const promptPath = resolve(ROOT, `art-source/regions/${region}/PROMPTS.md`);
  if (await requirePath(promptPath, `${region} 提示词`)) {
    const promptText = await readFile(promptPath, 'utf8');
    const requiredIds = [
      ...REGION34_MAPS.filter((asset) => asset.region === region).map((asset) => asset.id),
      ...REGION34_BATTLEFIELDS.filter((asset) => asset.region === region).map(
        (asset) => `battlefield:${asset.id}`,
      ),
      ...REGION34_ITEMS.filter((asset) => asset.region === region).map((asset) => asset.id),
      ...REGION34_SLOTS,
      ...REGION34_MONSTERS.filter((asset) => asset.region === region).map((asset) => asset.id),
    ];
    const undocumented = requiredIds.filter((id) => !promptText.includes(id));
    if (undocumented.length > 0) {
      errors.push(`${region} 提示词未登记：${undocumented.join(', ')}`);
    }
  }
}

for (const asset of REGION34_MAPS) {
  await validateIndependentSource(
    resolve(ROOT, `art-source/regions/${asset.region}/maps/${asset.id}-source.png`),
    `${asset.id} 地图母版`,
  );
  await validateOpaque(
    resolve(ROOT, `public/assets/maps/${asset.id}.webp`),
    `${asset.id} 地图`,
    768,
    1024,
    450 * 1024,
  );
}

for (const asset of REGION34_BATTLEFIELDS) {
  await validateIndependentSource(
    resolve(
      ROOT,
      `art-source/regions/${asset.region}/battlefields/${asset.id}-source.png`,
    ),
    `${asset.id} 战场母版`,
  );
  await validateOpaque(
    resolve(ROOT, `public/assets/battlefields/${asset.id}.webp`),
    `${asset.id} 战场`,
    1536,
    1024,
    520 * 1024,
  );
}

for (const asset of REGION34_ITEMS) {
  await validateIndependentSource(
    resolve(ROOT, `art-source/regions/${asset.region}/items/${asset.id}-chroma.png`),
    `${asset.id} chroma 母版`,
  );
  await requirePath(
    resolve(ROOT, `art-source/regions/${asset.region}/items/${asset.id}-alpha.png`),
    `${asset.id} alpha 母版`,
  );
  await validateTransparent(
    resolve(ROOT, `public/assets/items/${asset.id}.png`),
    `${asset.id} 材料图标`,
    256,
    256,
    120 * 1024,
  );
}

for (const asset of REGION34_EQUIPMENT) {
  await validateIndependentSource(
    resolve(
      ROOT,
      `art-source/regions/${asset.region}/equipment/${asset.slot}-chroma.png`,
    ),
    `${asset.id} chroma 母版`,
  );
  await requirePath(
    resolve(
      ROOT,
      `art-source/regions/${asset.region}/equipment/${asset.slot}-alpha.png`,
    ),
    `${asset.id} alpha 母版`,
  );
  await validateTransparent(
    resolve(ROOT, `public/assets/equipment/${asset.region}/${asset.slot}.png`),
    `${asset.id} 装备图标`,
    256,
    256,
    120 * 1024,
  );
}

for (const asset of REGION34_MONSTERS) {
  await validateIndependentSource(
    resolve(ROOT, `art-source/regions/${asset.region}/monsters/${asset.id}-chroma.png`),
    `${asset.id} 绿幕母版`,
  );
  await requirePath(
    resolve(ROOT, `art-source/monsters/${asset.region}/${asset.id}.png`),
    `${asset.id} Alpha 母版`,
  );
  await validateTransparent(
    resolve(ROOT, `public/assets/monsters/${asset.region}/${asset.id}.webp`),
    `${asset.id} 怪物`,
    512,
    512,
    120 * 1024,
    503,
  );
}

const modularPrompt = resolve(ROOT, 'art-source/characters/modular/PROMPTS-R34.md');
if (await requirePath(modularPrompt, '区域 3/4 换装提示词')) {
  const promptText = await readFile(modularPrompt, 'utf8');
  const undocumented = REGION34_MODULAR_LAYERS.filter(
    ({ classId, region, slot }) =>
      !promptText.includes(`${classId}/${region}-${slot}`) &&
      !promptText.includes(`${classId}-${region}-${slot}`),
  );
  if (undocumented.length > 0) {
    errors.push(
      `换装提示词未登记：${undocumented
        .map(({ classId, region, slot }) => `${classId}/${region}-${slot}`)
        .join(', ')}`,
    );
  }
}

for (const asset of REGION34_MODULAR_LAYERS) {
  await validateIndependentSource(
    resolve(
      ROOT,
      `art-source/characters/modular/${asset.classId}/r34-source/${asset.region}-${asset.slot}-chroma.png`,
    ),
    `${asset.classId}/${asset.region}-${asset.slot} chroma 母版`,
  );
  await requirePath(
    resolve(
      ROOT,
      `art-source/characters/modular/${asset.classId}/r34-source/${asset.region}-${asset.slot}-alpha.png`,
    ),
    `${asset.classId}/${asset.region}-${asset.slot} alpha 母版`,
  );
  await validateTransparent(
    resolve(
      ROOT,
      `public/assets/characters/modular/${asset.classId}/${asset.region}-${asset.slot}.png`,
    ),
    `${asset.classId}/${asset.region}-${asset.slot} 换装层`,
    640,
    960,
    600 * 1024,
  );
}

for (const region of REGION34_REGIONS) {
  await exactFilenames(
    resolve(ROOT, `public/assets/monsters/${region}`),
    REGION34_MONSTERS.filter((asset) => asset.region === region).map(
      (asset) => `${asset.id}.webp`,
    ),
    `${region} 怪物运行目录`,
  );
  await exactFilenames(
    resolve(ROOT, `public/assets/equipment/${region}`),
    REGION34_SLOTS.map((slot) => `${slot}.png`),
    `${region} 装备运行目录`,
  );
}

const expectedRuntimeCount =
  REGION34_MAPS.length +
  REGION34_BATTLEFIELDS.length +
  REGION34_MONSTERS.length +
  REGION34_ITEMS.length +
  REGION34_EQUIPMENT.length +
  REGION34_MODULAR_LAYERS.length;
if (expectedRuntimeCount !== REGION34_COUNTS.runtimeTotal) {
  errors.push(
    `资产清单计数错误：实际声明 ${expectedRuntimeCount}，目标 ${REGION34_COUNTS.runtimeTotal}`,
  );
}

if (errors.length > 0) {
  console.error(`区域 3/4 资产校验失败（${errors.length} 项）：`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `区域 3/4 资产校验通过：${sourcePixelHashes.size} 张独立源图、${REGION34_COUNTS.runtimeTotal} 项运行时资产（含 ${REGION34_COUNTS.modularLayers} 张换装层）。`,
  );
}
