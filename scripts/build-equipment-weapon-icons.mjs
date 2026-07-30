/**
 * 从真实纸娃娃武器层生成职业专属装备图标。
 *
 * 图标与人物手里的武器共用同一像素来源，避免“列表里是剑，角色手上却是
 * 法杖 / 灵扇 / 猫爪”。运行时纸娃娃层已是经过人工对位的 640×960 透明图，
 * 本脚本只做确定性裁切、排版与压缩。
 */

import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLASS_IDS = ['swordsman', 'witch', 'shaman', 'catkin'];
const FAMILIES = [
  { appearanceId: 'r1-weapon', layerName: 'r1-weapon' },
  { appearanceId: 'r2-weapon', layerName: 'r2-weapon' },
  { appearanceId: 'r3-weapon', layerName: 'r3-weapon' },
  { appearanceId: 'r4-weapon', layerName: 'r4-weapon' },
  { appearanceId: 'r5-weapon', layerName: 'r5-weapon' },
  { appearanceId: 'r5-set-weapon', layerName: 'r5-crimson-weapon' },
  { appearanceId: 'r6-weapon', layerName: 'r6-weapon' },
  { appearanceId: 'r6-set-weapon', layerName: 'r6-shadow-weapon' },
];
const ICON_SIZE = 256;
const MAX_ICON_BYTES = 82 * 1024;

function transparentCanvas() {
  return sharp({
    create: {
      width: ICON_SIZE,
      height: ICON_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });
}

async function fittedBuffer(input, boxSize) {
  return sharp(input)
    .ensureAlpha()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
    .resize({
      width: boxSize,
      height: boxSize,
      fit: 'inside',
      withoutEnlargement: false,
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();
}

async function centeredComposite(input, boxSize = 222) {
  const fitted = await fittedBuffer(input, boxSize);
  const metadata = await sharp(fitted).metadata();
  return transparentCanvas()
    .composite([
      {
        input: fitted,
        left: Math.round((ICON_SIZE - (metadata.width ?? boxSize)) / 2),
        top: Math.round((ICON_SIZE - (metadata.height ?? boxSize)) / 2),
      },
    ])
    .png()
    .toBuffer();
}

async function pairedCatkinComposite(input) {
  const metadata = await sharp(input).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`无法读取喵喵武器层：${input}`);
  }
  const center = Math.floor(metadata.width / 2);
  const halves = await Promise.all([
    sharp(input)
      .extract({ left: 0, top: 0, width: center, height: metadata.height })
      .png()
      .toBuffer(),
    sharp(input)
      .extract({
        left: center,
        top: 0,
        width: metadata.width - center,
        height: metadata.height,
      })
      .png()
      .toBuffer(),
  ]);
  const fitted = await Promise.all(halves.map((half) => fittedBuffer(half, 142)));
  const sizes = await Promise.all(fitted.map((buffer) => sharp(buffer).metadata()));
  const placements = [
    { x: 18, y: 92 },
    { x: 101, y: 22 },
  ];

  return transparentCanvas()
    .composite(
      fitted.map((buffer, index) => ({
        input: buffer,
        left:
          placements[index].x +
          Math.round((142 - (sizes[index].width ?? 142)) / 2),
        top:
          placements[index].y +
          Math.round((142 - (sizes[index].height ?? 142)) / 2),
      })),
    )
    .png()
    .toBuffer();
}

async function encodeIcon(input) {
  for (const colours of [192, 128, 96, 64]) {
    const encoded = await sharp(input)
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: true,
        colours,
        dither: 0.65,
      })
      .toBuffer();
    if (encoded.length < MAX_ICON_BYTES) return encoded;
  }
  throw new Error(`职业武器图标无法压到 ${MAX_ICON_BYTES / 1024} KiB 内`);
}

for (const family of FAMILIES) {
  for (const classId of CLASS_IDS) {
    const source = resolve(
      ROOT,
      'public/assets/characters/modular',
      classId,
      `${family.layerName}.png`,
    );
    const output = resolve(
      ROOT,
      'public/assets/equipment/weapons',
      family.appearanceId,
      `${classId}.png`,
    );
    const composed =
      classId === 'catkin'
        ? await pairedCatkinComposite(source)
        : await centeredComposite(source);
    await mkdir(dirname(output), { recursive: true });
    await sharp(await encodeIcon(composed)).toFile(output);
    console.log(`✓ ${output}`);
  }
}

console.log(`职业武器图标已生成：${FAMILIES.length * CLASS_IDS.length} 张。`);
