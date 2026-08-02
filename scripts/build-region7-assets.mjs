/**
 * 区域 7「血月峡谷」全资产确定性构建器。
 *
 * 原始大图和 Alpha 母版只从仓库外美术源目录读取；主仓仅保存压缩后的
 * 地图、战场、怪物、物品、装备与 640×960 纸娃娃层。
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  REGION7_ALL_ASSETS,
  REGION7_BADGE,
  REGION7_BATTLEFIELDS,
  REGION7_EQUIPMENT,
  REGION7_ITEMS,
  REGION7_MAPS,
  REGION7_MODULAR_LAYERS,
  REGION7_MONSTERS,
  REGION7_SET_EQUIPMENT,
  REGION7_SET_MODULAR_LAYERS,
} from './region7-assets-manifest.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const SOURCE_ROOT = process.env.REGION7_ART_SOURCE_ROOT?.trim()
  ? resolve(process.env.REGION7_ART_SOURCE_ROOT)
  : resolve(ROOT, '..', 'yingrenchuanshuo-art-source-r7');
const LOCK_PATH = resolve(ROOT, 'art-source/regions/r7/SOURCE-SHA256.json');
const CONTACT_PATH = resolve(ROOT, 'art-source/qa/r7-assets-contact.webp');
const CONTACT_ONLY = process.argv.includes('--contact-only');
const CHECK_KENSHI_REBUILD = process.argv.includes('--check-kenshi-rebuild');
const REBUILD_KENSHI_ONLY = process.argv.includes('--rebuild-kenshi-only');

const CANVAS = Object.freeze({ width: 640, height: 960 });

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function fileSha256(path) {
  return sha256(await readFile(path));
}

async function mkdirFor(path) {
  await mkdir(dirname(path), { recursive: true });
}

async function buildScene(source, output, width, height, quality) {
  await mkdirFor(output);
  await sharp(source)
    .rotate()
    .resize({ width, height, fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .flatten({ background: '#ffffff' })
    .removeAlpha()
    .webp({ quality, effort: 6, smartSubsample: true, preset: 'picture' })
    .toFile(output);
}

async function trimmedBuffer(source, width, height, fit = 'inside') {
  return sharp(source)
    .rotate()
    .ensureAlpha()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
    .resize({
      width,
      height,
      fit,
      withoutEnlargement: false,
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();
}

async function transparentCanvas(width, height, composites) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

function alphaBounds(data, info, threshold = 20) {
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] <= threshold) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return { left, top, right, bottom };
}

function kenshiSourcePath(entry, suffix) {
  return resolve(
    ROOT,
    'art-source/characters/kenshi/regions',
    `${entry.family}-${entry.slot}-${suffix}.png`,
  );
}

async function buildKenshiLayerCanvas(entry) {
  const resized = await sharp(kenshiSourcePath(entry, 'alpha'))
    .ensureAlpha()
    .resize({ width: CANVAS.width, height: CANVAS.height, fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  if (entry.slot === 'weapon') return carryKenshiWeaponLayer(resized);
  if (entry.slot !== 'body') return resized;
  const pixels = await sharp(resized).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bounds = alphaBounds(pixels.data, pixels.info);
  if (bounds.bottom < 0) throw new Error(`樱酱整身母版为空：${entry.family}`);
  const offsetY = 925 - bounds.bottom;
  return transparentCanvas(CANVAS.width, CANVAS.height, [
    { input: resized, left: 0, top: offsetY },
  ]);
}

async function carryKenshiWeaponLayer(source) {
  const resized = await sharp(source)
    .ensureAlpha()
    .resize(544, 816, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const targetLeft = Math.round((CANVAS.width - 544) / 2 - 110);
  const targetTop = Math.round((CANVAS.height - 816) / 2 + 150);
  const sourceLeft = Math.max(0, -targetLeft);
  const sourceTop = Math.max(0, -targetTop);
  const width = Math.min(544 - sourceLeft, CANVAS.width - Math.max(0, targetLeft));
  const height = Math.min(816 - sourceTop, CANVAS.height - Math.max(0, targetTop));
  const visible = await sharp(resized)
    .extract({ left: sourceLeft, top: sourceTop, width, height })
    .png()
    .toBuffer();
  return transparentCanvas(CANVAS.width, CANVAS.height, [
    { input: visible, left: Math.max(0, targetLeft), top: Math.max(0, targetTop) },
  ]);
}

async function encodeKenshiLayer(canvas) {
  const truecolor = await sharp(canvas)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  if (truecolor.length <= 300 * 1024) return truecolor;

  // libvips/libimagequant is the same mature, deterministic encoder already used by
  // the regional item and equipment builders. Only use it when true-colour PNG
  // exceeds the runtime budget; smaller head/weapon layers remain lossless RGBA.
  for (const colours of [256, 224, 192]) {
    const indexed = await sharp(canvas)
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: true,
        colours,
        dither: 0.65,
      })
      .toBuffer();
    if (indexed.length <= 300 * 1024) return indexed;
  }
  throw new Error(`樱酱纸娃娃层无法压到 300KiB：${truecolor.length} bytes`);
}

function visibleMeanAbsoluteError(left, right) {
  if (left.length !== right.length) return Number.POSITIVE_INFINITY;
  let total = 0;
  for (let index = 0; index < left.length; index += 4) {
    const leftAlpha = left[index + 3] / 255;
    const rightAlpha = right[index + 3] / 255;
    total += Math.abs(left[index] * leftAlpha - right[index] * rightAlpha);
    total += Math.abs(left[index + 1] * leftAlpha - right[index + 1] * rightAlpha);
    total += Math.abs(left[index + 2] * leftAlpha - right[index + 2] * rightAlpha);
    total += Math.abs(left[index + 3] - right[index + 3]);
  }
  return total / left.length;
}

async function centeredTransparent(source, canvasSize, subjectSize) {
  const subject = await trimmedBuffer(source, subjectSize, subjectSize);
  const metadata = await sharp(subject).metadata();
  return transparentCanvas(canvasSize, canvasSize, [
    {
      input: subject,
      left: Math.floor((canvasSize - (metadata.width ?? subjectSize)) / 2),
      top: Math.floor((canvasSize - (metadata.height ?? subjectSize)) / 2),
    },
  ]);
}

async function bottomAnchoredMonster(source) {
  const subject = await trimmedBuffer(source, 480, 480);
  const metadata = await sharp(subject).metadata();
  const width = metadata.width ?? 480;
  const height = metadata.height ?? 480;
  return transparentCanvas(512, 512, [
    {
      input: subject,
      left: Math.floor((512 - width) / 2),
      top: 504 - height,
    },
  ]);
}

async function writeBudgetWebp(canvas, output, maxBytes = 160 * 1024) {
  await mkdirFor(output);
  for (let quality = 88; quality >= 64; quality -= 2) {
    const encoded = await sharp(canvas)
      .webp({
        quality,
        alphaQuality: 100,
        effort: 6,
        smartSubsample: true,
        preset: 'picture',
      })
      .toBuffer();
    if (encoded.length <= maxBytes) {
      await writeFile(output, encoded);
      return;
    }
  }
  throw new Error(`${output} 无法压到 ${Math.round(maxBytes / 1024)} KiB 内`);
}

async function writeBudgetPng(canvas, output, maxBytes) {
  await mkdirFor(output);
  for (const colours of [256, 192, 128, 96, 64]) {
    const encoded = await sharp(canvas)
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: true,
        colours,
        dither: 0.65,
      })
      .toBuffer();
    if (encoded.length <= maxBytes) {
      await writeFile(output, encoded);
      return;
    }
  }
  throw new Error(`${output} 无法压到 ${Math.round(maxBytes / 1024)} KiB 内`);
}

const PLACEMENTS = {
  'swordsman:r7:body': { x: 140, y: 145, width: 360, height: 520 },
  'swordsman:r7:head': { x: 220, y: 40, width: 200, height: 100 },
  // 剑柄锁到左手（约 x=195 / y=420），剑刃自然垂向左下；禁止只在人物身后“飘着”。
  'swordsman:r7:weapon': { x: 35, y: 370, width: 185, height: 305 },
  'swordsman:r7-bloodmoon:body': { x: 125, y: 140, width: 390, height: 560 },
  'swordsman:r7-bloodmoon:head': { x: 190, y: 10, width: 260, height: 150 },
  'swordsman:r7-bloodmoon:weapon': { x: 15, y: 345, width: 225, height: 350 },
  'witch:r7:body': { x: 140, y: 145, width: 360, height: 430 },
  'witch:r7:head': { x: 230, y: 30, width: 180, height: 95 },
  // 杖身贴进左手手掌，留出右手施法动作，不盖住脸。
  // 2026-07 手位适配复核：缠纹握柄右移 55 / 下移 70，让握柄正落入左拳（265,368）。
  'witch:r7:weapon': { x: 190, y: 185, width: 160, height: 245, flip: true },
  'witch:r7-bloodmoon:body': { x: 110, y: 150, width: 420, height: 560 },
  'witch:r7-bloodmoon:head': { x: 225, y: 8, width: 190, height: 85 },
  // 套装法器的星盘体积较大，下移避开眼睛；杖身仍穿过左手锚点。
  'witch:r7-bloodmoon:weapon': { x: 90, y: 115, width: 230, height: 340, flip: true },
  'shaman:r7:body': { x: 145, y: 155, width: 350, height: 470 },
  'shaman:r7:head': { x: 220, y: 35, width: 200, height: 90 },
  // 2026-07 手位适配复核：扇面下移 70，让扇骨左缘从宽袖中的左拳（312,360）伸出。
  'shaman:r7:weapon': { x: 300, y: 255, width: 170, height: 150 },
  'shaman:r7-bloodmoon:body': { x: 115, y: 150, width: 410, height: 570 },
  'shaman:r7-bloodmoon:head': { x: 205, y: 5, width: 230, height: 110 },
  'shaman:r7-bloodmoon:weapon': { x: 190, y: 195, width: 180, height: 160 },
  'catkin:r7:body': { x: 140, y: 160, width: 360, height: 455 },
  'catkin:r7:head': { x: 260, y: 70, width: 120, height: 50 },
  'catkin:r7:weapon': [
    { side: 'left', x: 125, y: 350, width: 115, height: 130 },
    { side: 'right', x: 455, y: 270, width: 135, height: 130 },
  ],
  'catkin:r7-bloodmoon:body': { x: 115, y: 125, width: 410, height: 560 },
  'catkin:r7-bloodmoon:head': { x: 235, y: 55, width: 170, height: 90 },
  'catkin:r7-bloodmoon:weapon': [
    { side: 'left', x: 90, y: 330, width: 155, height: 170 },
    { side: 'right', x: 435, y: 240, width: 165, height: 170 },
  ],
};

async function splitAtCenter(source, side) {
  const metadata = await sharp(source).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`无法读取双爪母版尺寸：${source}`);
  }
  const center = Math.floor(metadata.width / 2);
  return sharp(source)
    .extract({
      left: side === 'left' ? 0 : center,
      top: 0,
      width: side === 'left' ? center : metadata.width - center,
      height: metadata.height,
    })
    .png()
    .toBuffer();
}

async function buildLayer(entry) {
  const key = `${entry.classId}:${entry.family}:${entry.slot}`;
  if (entry.classId === 'kenshi') {
    const output = resolve(
      ROOT,
      'public/assets/characters/modular/kenshi',
      `${entry.family}-${entry.slot}.png`,
    );
    await mkdirFor(output);
    await writeFile(output, await encodeKenshiLayer(await buildKenshiLayerCanvas(entry)));
    return output;
  }
  const placement = PLACEMENTS[key];
  if (!placement) throw new Error(`缺少纸娃娃对位：${key}`);
  const source = resolve(
    SOURCE_ROOT,
    'modular',
    entry.classId,
    entry.family,
    `${entry.slot}-alpha.png`,
  );
  const placements = Array.isArray(placement) ? placement : [placement];
  const composites = [];
  for (const target of placements) {
    const input = target.side ? await splitAtCenter(source, target.side) : source;
    let pipeline = sharp(input)
      .ensureAlpha()
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 });
    if (target.flip) pipeline = pipeline.flop();
    const fitted = await pipeline
      .resize({
        width: target.width,
        height: target.height,
        fit: 'fill',
        kernel: sharp.kernel.lanczos3,
      })
      .png()
      .toBuffer();
    composites.push({ input: fitted, left: target.x, top: target.y });
  }
  const output = resolve(
    ROOT,
    'public/assets/characters/modular',
    entry.classId,
    `${entry.family}-${entry.slot}.png`,
  );
  await writeBudgetPng(
    await transparentCanvas(CANVAS.width, CANVAS.height, composites),
    output,
    300 * 1024,
  );
  return output;
}

const runtimeRecords = [];
const sourceRecords = [];

function record(asset, runtimePath, sources) {
  runtimeRecords.push({ key: `${asset.category}:${asset.id}`, path: runtimePath });
  for (const source of sources) {
    sourceRecords.push({ key: `${asset.category}:${asset.id}`, callId: asset.callId, path: source });
  }
}

if (CHECK_KENSHI_REBUILD || REBUILD_KENSHI_ONLY) {
  for (const entry of [...REGION7_MODULAR_LAYERS, ...REGION7_SET_MODULAR_LAYERS].filter(
    ({ classId, slot }) => classId === 'kenshi' && (!REBUILD_KENSHI_ONLY || slot === 'weapon'),
  )) {
    const encoded = await encodeKenshiLayer(await buildKenshiLayerCanvas(entry));
    const rebuilt = await sharp(encoded).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const rebuiltBounds = alphaBounds(rebuilt.data, rebuilt.info);
    if (entry.slot === 'body' && rebuiltBounds.bottom !== 925) {
      throw new Error(`${entry.family}-body 脚底未对齐 925：${rebuiltBounds.bottom}`);
    }
    const currentPath = resolve(
      ROOT,
      'public/assets/characters/modular/kenshi',
      `${entry.family}-${entry.slot}.png`,
    );
    if (REBUILD_KENSHI_ONLY) {
      await writeFile(currentPath, encoded);
      console.log(`✓ ${entry.family}-${entry.slot} 已按仓内母版重建`);
      continue;
    }
    const current = await sharp(currentPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const currentBounds = alphaBounds(current.data, current.info);
    const byteExact = sha256(encoded) === (await fileSha256(currentPath));
    const visibleMae = visibleMeanAbsoluteError(rebuilt.data, current.data);
    const maxVisibleMae = entry.slot === 'body' ? 8 : 0.1;
    if (visibleMae > maxVisibleMae) {
      throw new Error(
        `${entry.family}-${entry.slot} 重建可见像素偏差过大：${visibleMae.toFixed(3)} > ${maxVisibleMae}`,
      );
    }
    const widthDelta = Math.abs(
      rebuiltBounds.right - rebuiltBounds.left - (currentBounds.right - currentBounds.left),
    );
    const heightDelta = Math.abs(
      rebuiltBounds.bottom - rebuiltBounds.top - (currentBounds.bottom - currentBounds.top),
    );
    if (widthDelta > 2 || heightDelta > 2) {
      throw new Error(
        `${entry.family}-${entry.slot} 重建轮廓与当前 runtime 不等价：${widthDelta}/${heightDelta}`,
      );
    }
    console.log(
      `✓ ${entry.family}-${entry.slot} dry-run：${encoded.length} bytes，bbox=${rebuiltBounds.left},${rebuiltBounds.top},${rebuiltBounds.right},${rebuiltBounds.bottom}，byteExact=${byteExact}，visibleMAE=${visibleMae.toFixed(3)}`,
    );
  }
} else {
// 检查分支必须自然退出，让 sharp/libuv 完成句柄清理；禁止 process.exit 强杀。
if (CONTACT_ONLY) {
  const lock = JSON.parse(await readFile(LOCK_PATH, 'utf8'));
  for (const asset of REGION7_ALL_ASSETS) {
    const key = `${asset.category}:${asset.id}`;
    const lockedRuntime = lock.runtime?.[key];
    if (!lockedRuntime?.path) throw new Error(`R7 来源锁缺少运行时记录：${key}`);
    runtimeRecords.push({ key, path: resolve(ROOT, lockedRuntime.path) });
  }
} else {
for (const asset of REGION7_MAPS) {
  const source = resolve(SOURCE_ROOT, 'scenes', `${asset.id}.png`);
  const output = resolve(ROOT, 'public/assets/maps', `${asset.id}.webp`);
  await buildScene(source, output, 768, 1024, 82);
  record({ ...asset, category: 'map' }, output, [source]);
}
for (const asset of REGION7_BATTLEFIELDS) {
  const source = resolve(
    SOURCE_ROOT,
    'scenes',
    `${asset.id.replace('chapter-', 'battle-')}.png`,
  );
  const output = resolve(ROOT, 'public/assets/battlefields', `${asset.id}.webp`);
  await buildScene(source, output, 1536, 1024, 80);
  record({ ...asset, category: 'battlefield' }, output, [source]);
}
for (const asset of REGION7_MONSTERS) {
  const chroma = resolve(SOURCE_ROOT, 'monsters', `${asset.id}-chroma.png`);
  const alpha = resolve(SOURCE_ROOT, 'monsters', `${asset.id}-alpha.png`);
  const output = resolve(ROOT, 'public/assets/monsters/r7', `${asset.id}.webp`);
  await writeBudgetWebp(await bottomAnchoredMonster(alpha), output);
  record({ ...asset, category: 'monster' }, output, [chroma, alpha]);
}
for (const asset of REGION7_ITEMS) {
  const chroma = resolve(SOURCE_ROOT, 'items-equipment/chroma/items', `${asset.id}.png`);
  const alpha = resolve(SOURCE_ROOT, 'items-equipment/alpha/items', `${asset.id}.png`);
  const output = resolve(ROOT, 'public/assets/items', `${asset.id}.png`);
  await writeBudgetPng(await centeredTransparent(alpha, 256, 228), output, 120 * 1024);
  record({ ...asset, category: 'item' }, output, [chroma, alpha]);
}
for (const asset of REGION7_EQUIPMENT) {
  const chroma = resolve(
    SOURCE_ROOT,
    'items-equipment/chroma/equipment/r7',
    `${asset.slot}.png`,
  );
  const alpha = resolve(
    SOURCE_ROOT,
    'items-equipment/alpha/equipment/r7',
    `${asset.slot}.png`,
  );
  const output = resolve(ROOT, 'public/assets/equipment/r7', `${asset.slot}.png`);
  await writeBudgetPng(await centeredTransparent(alpha, 256, 228), output, 120 * 1024);
  record({ ...asset, category: 'equipment' }, output, [chroma, alpha]);
}
for (const asset of REGION7_SET_EQUIPMENT) {
  const chroma = resolve(
    SOURCE_ROOT,
    'items-equipment/chroma/equipment/r7-bloodmoon',
    `${asset.slot}.png`,
  );
  const alpha = resolve(
    SOURCE_ROOT,
    'items-equipment/alpha/equipment/r7-bloodmoon',
    `${asset.slot}.png`,
  );
  const output = resolve(
    ROOT,
    'public/assets/equipment/sets/r7-bloodmoon',
    `${asset.slot}.png`,
  );
  await writeBudgetPng(await centeredTransparent(alpha, 256, 228), output, 120 * 1024);
  record({ ...asset, category: 'set-equipment' }, output, [chroma, alpha]);
}
{
  const chroma = resolve(
    SOURCE_ROOT,
    'items-equipment/chroma/equipment/r7-bloodmoon/badge.png',
  );
  const alpha = resolve(
    SOURCE_ROOT,
    'items-equipment/alpha/equipment/r7-bloodmoon/badge.png',
  );
  const output = resolve(ROOT, 'public/assets/equipment/sets/r7-bloodmoon/badge.png');
  await writeBudgetPng(await centeredTransparent(alpha, 256, 228), output, 120 * 1024);
  record({ ...REGION7_BADGE, category: 'badge' }, output, [chroma, alpha]);
}
for (const asset of [...REGION7_MODULAR_LAYERS, ...REGION7_SET_MODULAR_LAYERS]) {
  const output = await buildLayer(asset);
  const base =
    asset.classId === 'kenshi'
      ? resolve(ROOT, 'art-source/characters/kenshi/regions', `${asset.family}-${asset.slot}`)
      : resolve(SOURCE_ROOT, 'modular', asset.classId, asset.family, asset.slot);
  record(
    {
      ...asset,
      category: asset.family === 'r7' ? 'layer' : 'set-layer',
    },
    output,
    [`${base}-chroma.png`, `${base}-alpha.png`],
  );
}

if (runtimeRecords.length !== REGION7_ALL_ASSETS.length) {
  throw new Error(
    `R7 构建记录错位：${runtimeRecords.length} !== ${REGION7_ALL_ASSETS.length}`,
  );
}

const lock = {
  version: 1,
  algorithm: 'sha256',
  sourceRepository: 'yingrenchuanshuo-art-source-r7',
  chromaRemoval:
    'remove_chroma_key.py --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill --edge-contract 1 --force',
  sources: Object.fromEntries(
    await Promise.all(
      sourceRecords.map(async ({ key, callId, path }, index) => [
        `${key}:${index}`,
        {
          callId,
          path: relative(ROOT, path).startsWith('..')
            ? relative(SOURCE_ROOT, path).replaceAll('\\', '/')
            : `repo:${relative(ROOT, path).replaceAll('\\', '/')}`,
          sha256: await fileSha256(path),
        },
      ]),
    ),
  ),
  runtime: Object.fromEntries(
    await Promise.all(
      runtimeRecords.map(async ({ key, path }) => [
        key,
        {
          path: relative(ROOT, path).replaceAll('\\', '/'),
          sha256: await fileSha256(path),
        },
      ]),
    ),
  ),
};
await mkdirFor(LOCK_PATH);
await writeFile(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
}

if (runtimeRecords.length !== REGION7_ALL_ASSETS.length) {
  throw new Error(
    `R7 联系表记录错位：${runtimeRecords.length} !== ${REGION7_ALL_ASSETS.length}`,
  );
}

const cellWidth = 220;
const cellHeight = 180;
const columns = 5;
const rows = Math.ceil(runtimeRecords.length / columns);
const contactComposites = [];
for (let index = 0; index < runtimeRecords.length; index += 1) {
  const recordEntry = runtimeRecords[index];
  const thumb = await sharp(recordEntry.path)
    .ensureAlpha()
    .resize({ width: 184, height: 132, fit: 'contain', background: '#f5f0ff' })
    .flatten({ background: '#f5f0ff' })
    .png()
    .toBuffer();
  const x = (index % columns) * cellWidth;
  const y = Math.floor(index / columns) * cellHeight;
  contactComposites.push({ input: thumb, left: x + 18, top: y + 8 });
  const label = recordEntry.key.replace(/[&<>]/g, '');
  const svg = Buffer.from(
    `<svg width="${cellWidth}" height="36"><rect width="100%" height="100%" fill="#eee6fb"/><text x="10" y="23" font-family="Arial,sans-serif" font-size="13" fill="#4f3e6b">${label}</text></svg>`,
  );
  contactComposites.push({ input: svg, left: x, top: y + 140 });
}
await mkdirFor(CONTACT_PATH);
await sharp({
  create: {
    width: columns * cellWidth,
    height: rows * cellHeight,
    channels: 3,
    background: '#f5f0ff',
  },
})
  .composite(contactComposites)
  .webp({ quality: 82, effort: 6 })
  .toFile(CONTACT_PATH);

console.log(
  CONTACT_ONLY
    ? `✓ 区域 7 全资产联系表已从 ${runtimeRecords.length} 张既有运行时资源重建。`
    : `✓ 区域 7 全资产构建完成：${runtimeRecords.length} 张运行时资源，来源锁与联系表已更新。`,
);
}
