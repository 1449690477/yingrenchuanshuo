/**
 * 区域 5 四职业纸娃娃层构建器。
 *
 * ImageGen 绿幕原图与官方抠图后的 alpha 母版只存在于独立美术源目录；
 * 主仓仅保存 640×960 的运行时透明 PNG、提示词、SHA 锁和 QA 联系表。
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const SOURCE_ROOT = process.env.REGION5_MODULAR_SOURCE_ROOT?.trim()
  ? resolve(process.env.REGION5_MODULAR_SOURCE_ROOT)
  : resolve(ROOT, '..', 'yingrenchuanshuo-art-source-r5', 'modular');
const LOCK_PATH = resolve(
  ROOT,
  'art-source/regions/r5/MODULAR-SOURCE-SHA256.json',
);

const CANVAS = Object.freeze({ width: 640, height: 960 });
const MAX_RUNTIME_BYTES = 300 * 1024;

const asset = (
  classId,
  family,
  slot,
  callId,
  placement,
  extra = {},
) => ({
  classId,
  family,
  slot,
  callId,
  placement,
  ...extra,
});

export const REGION5_MODULAR_BUILD_ASSETS = [
  asset(
    'swordsman',
    'r5',
    'body',
    'call_shgbg8QPORVI15MbsK5mb82o',
    { x: 150, y: 150, width: 340, height: 505 },
    {
      provenance: 'parent task recovered / verbatim prompt unavailable',
    },
  ),
  asset(
    'swordsman',
    'r5',
    'head',
    'exec-60bcb9e0-f78b-4a1a-8f52-bd4afbbf94e9',
    { x: 225, y: 40, width: 190, height: 100 },
  ),
  asset(
    'swordsman',
    'r5',
    'weapon',
    'exec-82d33636-719b-467d-8a0a-91b9d6f7bf5c',
    { x: 35, y: 150, width: 185, height: 305 },
  ),
  asset(
    'swordsman',
    'r5-crimson',
    'body',
    'exec-cf186453-1c73-4ea0-a740-4b37d37e7c7b',
    { x: 125, y: 140, width: 390, height: 560 },
    {
      // ImageGen 额外给了两只不匹配底模手位的独立护腕；主衣裙保留，
      // 浮空护腕在母版坐标中确定性移除，武器与手部仍由独立层表达。
      eraseRects: [
        { left: 258, top: 537, width: 121, height: 190 },
        { left: 680, top: 485, width: 125, height: 95 },
      ],
    },
  ),
  asset(
    'swordsman',
    'r5-crimson',
    'head',
    'exec-8e1b84b0-3c0e-4774-8f3f-7578f7da1672',
    { x: 190, y: 10, width: 260, height: 150 },
  ),
  asset(
    'swordsman',
    'r5-crimson',
    'weapon',
    'exec-6a84ddc6-c53d-4941-98db-3799374a86f7',
    { x: 15, y: 115, width: 225, height: 350 },
  ),

  asset(
    'witch',
    'r5',
    'body',
    'exec-22feabf1-316b-437e-9e03-8613971fd5f7',
    { x: 140, y: 145, width: 360, height: 430 },
  ),
  asset(
    'witch',
    'r5',
    'head',
    'exec-a5adbce4-e13d-4d8a-a91e-7e2e277c3755',
    { x: 230, y: 30, width: 180, height: 95 },
  ),
  asset(
    'witch',
    'r5',
    'weapon',
    'exec-1f80fb87-bc3c-458e-a0ce-3c2094b109de',
    { x: 105, y: 115, width: 160, height: 245, flip: true },
  ),
  asset(
    'witch',
    'r5-crimson',
    'body',
    'exec-05d6bbde-e700-4dea-8658-0d2ce9a1413d',
    { x: 110, y: 150, width: 420, height: 560 },
  ),
  asset(
    'witch',
    'r5-crimson',
    'head',
    'exec-9456a301-93a9-491c-8e04-8973ed950d9b',
    { x: 225, y: 8, width: 190, height: 85 },
  ),
  asset(
    'witch',
    'r5-crimson',
    'weapon',
    'exec-6f33b405-3af1-446e-aa95-d6a163901613',
    { x: 65, y: 55, width: 230, height: 340, flip: true },
  ),

  asset(
    'shaman',
    'r5',
    'body',
    'exec-fba44470-26e7-44c0-9b35-f26532bfd809',
    { x: 145, y: 155, width: 350, height: 470 },
  ),
  asset(
    'shaman',
    'r5',
    'head',
    'exec-19c72cfe-9d97-4914-ab9e-30778a0771cb',
    { x: 220, y: 35, width: 200, height: 90 },
  ),
  asset(
    'shaman',
    'r5',
    'weapon',
    'exec-564e71d5-56fc-49f4-97b1-2e2f2fd88c0b',
    { x: 300, y: 185, width: 170, height: 150 },
  ),
  asset(
    'shaman',
    'r5-crimson',
    'body',
    'exec-54e5eeaa-d83a-4b5d-a27a-d1876b12e360',
    { x: 115, y: 150, width: 410, height: 570 },
  ),
  asset(
    'shaman',
    'r5-crimson',
    'head',
    'exec-61eabca4-665e-40f6-93b1-5c1862397a70',
    { x: 205, y: 5, width: 230, height: 110 },
  ),
  asset(
    'shaman',
    'r5-crimson',
    'weapon',
    'exec-07a478d0-f1a5-4fbf-b15e-1855ab65fc39',
    { x: 190, y: 195, width: 180, height: 160 },
  ),

  asset(
    'catkin',
    'r5',
    'body',
    'exec-d7eb0660-d238-48c5-b623-4ddc5b5d1dac',
    { x: 140, y: 160, width: 360, height: 455 },
  ),
  asset(
    'catkin',
    'r5',
    'head',
    'exec-162199d2-cf80-405f-8549-12a5ab2f86e7',
    { x: 260, y: 70, width: 120, height: 50 },
  ),
  asset(
    'catkin',
    'r5',
    'weapon',
    'exec-20646b6b-2775-444f-8e95-da5031687bd1',
    [
      { side: 'left', x: 125, y: 350, width: 115, height: 130 },
      { side: 'right', x: 455, y: 270, width: 135, height: 130 },
    ],
    { splitAtCenter: true },
  ),
  asset(
    'catkin',
    'r5-crimson',
    'body',
    'exec-90a7d133-1809-4a8e-abf9-e5b8cafb3ee0',
    { x: 115, y: 125, width: 410, height: 560 },
  ),
  asset(
    'catkin',
    'r5-crimson',
    'head',
    'exec-eb11d061-4c86-43a8-9e79-e8c5482045e4',
    { x: 235, y: 55, width: 170, height: 90 },
  ),
  asset(
    'catkin',
    'r5-crimson',
    'weapon',
    'exec-2c56b506-1986-471c-b6a6-cc60874134d2',
    [
      { side: 'left', x: 90, y: 330, width: 155, height: 170 },
      { side: 'right', x: 435, y: 240, width: 165, height: 170 },
    ],
    { splitAtCenter: true },
  ),
];

function sourcePathFor(entry, suffix) {
  return resolve(
    SOURCE_ROOT,
    entry.classId,
    entry.family,
    `${entry.slot}-${suffix}.png`,
  );
}

function runtimePathFor(entry) {
  return resolve(
    ROOT,
    'public/assets/characters/modular',
    entry.classId,
    `${entry.family}-${entry.slot}.png`,
  );
}

async function eraseRegions(input, rectangles = []) {
  if (rectangles.length === 0) return input;
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (const rectangle of rectangles) {
    const right = Math.min(info.width, rectangle.left + rectangle.width);
    const bottom = Math.min(info.height, rectangle.top + rectangle.height);
    for (let y = Math.max(0, rectangle.top); y < bottom; y += 1) {
      for (let x = Math.max(0, rectangle.left); x < right; x += 1) {
        const offset = (y * info.width + x) * 4;
        data[offset] = 0;
        data[offset + 1] = 0;
        data[offset + 2] = 0;
        data[offset + 3] = 0;
      }
    }
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

async function trimAndResize(input, placement, eraseRects = []) {
  let pipeline = sharp(await eraseRegions(input, eraseRects))
    .ensureAlpha()
    .trim({
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      threshold: 8,
    });
  if (placement.flip) pipeline = pipeline.flop();
  return pipeline
    .resize({
      width: placement.width,
      height: placement.height,
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();
}

async function splitSourceAtCenter(input, side) {
  const metadata = await sharp(input).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`无法读取纸娃娃母版尺寸：${input}`);
  }
  const center = Math.floor(metadata.width / 2);
  const left = side === 'left' ? 0 : center;
  const width = side === 'left' ? center : metadata.width - center;
  return sharp(input)
    .extract({ left, top: 0, width, height: metadata.height })
    .png()
    .toBuffer();
}

async function encodeRuntime(canvas) {
  for (const colours of [256, 192, 128, 96]) {
    const encoded = await sharp(canvas)
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: true,
        colours,
        dither: 0.7,
      })
      .toBuffer();
    if (encoded.length <= MAX_RUNTIME_BYTES) return encoded;
  }
  throw new Error(
    `纸娃娃运行时 PNG 无法压到 ${MAX_RUNTIME_BYTES / 1024}KiB 内`,
  );
}

async function buildAsset(entry) {
  const alphaPath = sourcePathFor(entry, 'alpha');
  const outputPath = runtimePathFor(entry);
  const placements = Array.isArray(entry.placement)
    ? entry.placement
    : [entry.placement];
  const composites = [];

  for (const placement of placements) {
    const source = entry.splitAtCenter
      ? await splitSourceAtCenter(alphaPath, placement.side)
      : alphaPath;
    composites.push({
      input: await trimAndResize(source, placement, entry.eraseRects),
      left: placement.x,
      top: placement.y,
    });
  }

  const canvas = await sharp({
    create: {
      ...CANVAS,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, await encodeRuntime(canvas));
  console.log(`✓ ${outputPath}`);
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

for (const entry of REGION5_MODULAR_BUILD_ASSETS) {
  await buildAsset(entry);
}

const lockAssets = {};
for (const entry of REGION5_MODULAR_BUILD_ASSETS) {
  const key = `${entry.classId}:${entry.family}:${entry.slot}`;
  const chromaPath = sourcePathFor(entry, 'chroma');
  const alphaPath = sourcePathFor(entry, 'alpha');
  const runtimePath = runtimePathFor(entry);
  const referencePath = resolve(
    ROOT,
    `public/assets/characters/modular/${entry.classId}/base.png`,
  );
  lockAssets[key] = {
    callId: entry.callId,
    provenance: entry.provenance ?? 'current task imagegen call',
    referencePath: `public/assets/characters/modular/${entry.classId}/base.png`,
    referenceSha256: await sha256(referencePath),
    sourcePath: `modular/${entry.classId}/${entry.family}/${entry.slot}-chroma.png`,
    sourceSha256: await sha256(chromaPath),
    alphaPath: `modular/${entry.classId}/${entry.family}/${entry.slot}-alpha.png`,
    alphaSha256: await sha256(alphaPath),
    runtimePath: `public/assets/characters/modular/${entry.classId}/${entry.family}-${entry.slot}.png`,
    runtimeSha256: await sha256(runtimePath),
    alignment: entry.placement,
    sourceEdits: entry.eraseRects
      ? { eraseRects: entry.eraseRects }
      : undefined,
  };
}

await mkdir(dirname(LOCK_PATH), { recursive: true });
await writeFile(
  LOCK_PATH,
  `${JSON.stringify(
    {
      version: 1,
      algorithm: 'sha256',
      sourceRepository: 'yingrenchuanshuo-art-source-r5',
      sourceRoot: 'modular',
      chromaRemoval:
        'remove_chroma_key.py --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill --edge-contract 1 --force',
      assets: lockAssets,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(
  `区域 5 纸娃娃层已构建：${REGION5_MODULAR_BUILD_ASSETS.length} 张，SHA 锁已更新。`,
);
