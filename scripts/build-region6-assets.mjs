/**
 * 区域 6「幽影祀塔」全资产确定性构建器。
 *
 * 原始大图和 Alpha 母版只从仓库外美术源目录读取；主仓仅保存压缩后的
 * 地图、战场、怪物、物品、装备与 640×960 纸娃娃层。
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  REGION6_ALL_ASSETS,
  REGION6_BATTLEFIELDS,
  REGION6_EQUIPMENT,
  REGION6_ITEMS,
  REGION6_MAPS,
  REGION6_MODULAR_LAYERS,
  REGION6_MONSTERS,
  REGION6_SET_EQUIPMENT,
  REGION6_SET_MODULAR_LAYERS,
} from './region6-assets-manifest.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const SOURCE_ROOT = process.env.REGION6_ART_SOURCE_ROOT?.trim()
  ? resolve(process.env.REGION6_ART_SOURCE_ROOT)
  : resolve(ROOT, '..', 'yingrenchuanshuo-art-source-r6');
const LOCK_PATH = resolve(ROOT, 'art-source/regions/r6/SOURCE-SHA256.json');
const CONTACT_PATH = resolve(ROOT, 'art-source/qa/r6-assets-contact.webp');

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
  'swordsman:r6:body': { x: 140, y: 145, width: 360, height: 520 },
  'swordsman:r6:head': { x: 220, y: 40, width: 200, height: 100 },
  // 剑柄锁到左手（约 x=195 / y=420），剑刃自然垂向左下；禁止只在人物身后“飘着”。
  'swordsman:r6:weapon': { x: 35, y: 370, width: 185, height: 305 },
  'swordsman:r6-shadow:body': { x: 125, y: 140, width: 390, height: 560 },
  'swordsman:r6-shadow:head': { x: 190, y: 10, width: 260, height: 150 },
  'swordsman:r6-shadow:weapon': { x: 15, y: 345, width: 225, height: 350 },
  'witch:r6:body': { x: 140, y: 145, width: 360, height: 430 },
  'witch:r6:head': { x: 230, y: 30, width: 180, height: 95 },
  // 杖身贴进左手手掌，留出右手施法动作，不盖住脸。
  'witch:r6:weapon': { x: 135, y: 115, width: 160, height: 245, flip: true },
  'witch:r6-shadow:body': { x: 110, y: 150, width: 420, height: 560 },
  'witch:r6-shadow:head': { x: 225, y: 8, width: 190, height: 85 },
  // 套装法器的星盘体积较大，下移避开眼睛；杖身仍穿过左手锚点。
  'witch:r6-shadow:weapon': { x: 90, y: 115, width: 230, height: 340, flip: true },
  'shaman:r6:body': { x: 145, y: 155, width: 350, height: 470 },
  'shaman:r6:head': { x: 220, y: 35, width: 200, height: 90 },
  'shaman:r6:weapon': { x: 300, y: 185, width: 170, height: 150 },
  'shaman:r6-shadow:body': { x: 115, y: 150, width: 410, height: 570 },
  'shaman:r6-shadow:head': { x: 205, y: 5, width: 230, height: 110 },
  'shaman:r6-shadow:weapon': { x: 190, y: 195, width: 180, height: 160 },
  'catkin:r6:body': { x: 140, y: 160, width: 360, height: 455 },
  'catkin:r6:head': { x: 260, y: 70, width: 120, height: 50 },
  'catkin:r6:weapon': [
    { side: 'left', x: 125, y: 350, width: 115, height: 130 },
    { side: 'right', x: 455, y: 270, width: 135, height: 130 },
  ],
  'catkin:r6-shadow:body': { x: 115, y: 125, width: 410, height: 560 },
  'catkin:r6-shadow:head': { x: 235, y: 55, width: 170, height: 90 },
  'catkin:r6-shadow:weapon': [
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

for (const asset of REGION6_MAPS) {
  const source = resolve(SOURCE_ROOT, 'scenes/maps', `${asset.id}-source.png`);
  const output = resolve(ROOT, 'public/assets/maps', `${asset.id}.webp`);
  await buildScene(source, output, 768, 1024, 82);
  record({ ...asset, category: 'map' }, output, [source]);
}
for (const asset of REGION6_BATTLEFIELDS) {
  const source = resolve(SOURCE_ROOT, 'scenes/battlefields', `${asset.id}-source.png`);
  const output = resolve(ROOT, 'public/assets/battlefields', `${asset.id}.webp`);
  await buildScene(source, output, 1536, 1024, 80);
  record({ ...asset, category: 'battlefield' }, output, [source]);
}
for (const asset of REGION6_MONSTERS) {
  const chroma = resolve(SOURCE_ROOT, 'monsters', `${asset.id}-chroma.png`);
  const alpha = resolve(SOURCE_ROOT, 'monsters', `${asset.id}-alpha.png`);
  const output = resolve(ROOT, 'public/assets/monsters/r6', `${asset.id}.webp`);
  await writeBudgetWebp(await bottomAnchoredMonster(alpha), output);
  record({ ...asset, category: 'monster' }, output, [chroma, alpha]);
}
for (const asset of REGION6_ITEMS) {
  const chroma = resolve(SOURCE_ROOT, 'items-equipment/chroma/items', `${asset.id}.png`);
  const alpha = resolve(SOURCE_ROOT, 'items-equipment/alpha/items', `${asset.id}.png`);
  const output = resolve(ROOT, 'public/assets/items', `${asset.id}.png`);
  await writeBudgetPng(await centeredTransparent(alpha, 256, 228), output, 120 * 1024);
  record({ ...asset, category: 'item' }, output, [chroma, alpha]);
}
for (const asset of REGION6_EQUIPMENT) {
  const chroma = resolve(
    SOURCE_ROOT,
    'items-equipment/chroma/equipment/r6',
    `${asset.slot}.png`,
  );
  const alpha = resolve(
    SOURCE_ROOT,
    'items-equipment/alpha/equipment/r6',
    `${asset.slot}.png`,
  );
  const output = resolve(ROOT, 'public/assets/equipment/r6', `${asset.slot}.png`);
  await writeBudgetPng(await centeredTransparent(alpha, 256, 228), output, 120 * 1024);
  record({ ...asset, category: 'equipment' }, output, [chroma, alpha]);
}
for (const asset of REGION6_SET_EQUIPMENT) {
  const chroma = resolve(
    SOURCE_ROOT,
    'items-equipment/chroma/equipment/r6-shadow',
    `${asset.slot}.png`,
  );
  const alpha = resolve(
    SOURCE_ROOT,
    'items-equipment/alpha/equipment/r6-shadow',
    `${asset.slot}.png`,
  );
  const output = resolve(
    ROOT,
    'public/assets/equipment/sets/r6-shadow',
    `${asset.slot}.png`,
  );
  await writeBudgetPng(await centeredTransparent(alpha, 256, 228), output, 120 * 1024);
  record({ ...asset, category: 'set-equipment' }, output, [chroma, alpha]);
}
for (const asset of [...REGION6_MODULAR_LAYERS, ...REGION6_SET_MODULAR_LAYERS]) {
  const output = await buildLayer(asset);
  const base = resolve(
    SOURCE_ROOT,
    'modular',
    asset.classId,
    asset.family,
    asset.slot,
  );
  record(
    {
      ...asset,
      category: asset.family === 'r6' ? 'layer' : 'set-layer',
    },
    output,
    [`${base}-chroma.png`, `${base}-alpha.png`],
  );
}

if (runtimeRecords.length !== REGION6_ALL_ASSETS.length) {
  throw new Error(
    `R6 构建记录错位：${runtimeRecords.length} !== ${REGION6_ALL_ASSETS.length}`,
  );
}

const lock = {
  version: 1,
  algorithm: 'sha256',
  sourceRepository: 'yingrenchuanshuo-art-source-r6',
  chromaRemoval:
    'remove_chroma_key.py --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill --edge-contract 1 --force',
  sources: Object.fromEntries(
    await Promise.all(
      sourceRecords.map(async ({ key, callId, path }, index) => [
        `${key}:${index}`,
        {
          callId,
          path: path.replaceAll('\\', '/').split('/yingrenchuanshuo-art-source-r6/')[1],
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
          path: path.replaceAll('\\', '/').split('/sakura-legend/')[1],
          sha256: await fileSha256(path),
        },
      ]),
    ),
  ),
};
await mkdirFor(LOCK_PATH);
await writeFile(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');

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
  `✓ 区域 6 全资产构建完成：${runtimeRecords.length} 张运行时资源，来源锁与联系表已更新。`,
);
