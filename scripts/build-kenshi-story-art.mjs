#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const ROOT = resolve('.');
const CHECK = process.argv.includes('--check');
const SOURCE_ROOT = 'art-source/characters/kenshi/affection';
const CONTACT_PREVIEW_MAX_MAE = 0.5;

const WIDE_RECTS = [
  { left: 7, top: 8, width: 705, height: 523 },
  { left: 733, top: 8, width: 708, height: 523 },
  { left: 7, top: 557, width: 705, height: 522 },
  { left: 733, top: 557, width: 708, height: 522 },
];
const THREE_TWO_RECTS = [
  { left: 8, top: 9, width: 756, height: 498 },
  { left: 773, top: 9, width: 755, height: 498 },
  { left: 8, top: 517, width: 756, height: 498 },
  { left: 773, top: 517, width: 755, height: 498 },
];

const sheets = [
  {
    source: `${SOURCE_ROOT}/story-a-sheet.png`,
    size: [1448, 1086],
    rects: WIDE_RECTS,
    outputs: [
      'public/assets/affection/scenes/kenshi-dojo-sakura-dawn.webp',
      'public/assets/affection/scenes/kenshi-rain-eaves-blue.webp',
      'public/assets/affection/scenes/kenshi-moonlit-scabbard.webp',
      'public/assets/affection/scenes/kenshi-workbench-afterglow.webp',
    ],
  },
  {
    source: `${SOURCE_ROOT}/story-b-sheet.png`,
    size: [1536, 1024],
    rects: THREE_TWO_RECTS,
    outputs: [
      'public/assets/affection/scenes/kenshi-dojo-nightwatch.webp',
      'public/assets/affection/scenes/kenshi-dojo-homecoming-sunrise.webp',
      'public/assets/affection/scenes/kenshi-gift-whetstone-morning.webp',
      'public/assets/affection/scenes/kenshi-sakura-market-rain.webp',
    ],
  },
  {
    source: `${SOURCE_ROOT}/story-c-sheet.png`,
    size: [1448, 1086],
    rects: WIDE_RECTS,
    outputs: [
      'public/assets/affection/scenes/kenshi-route-map-sunset.webp',
      'public/assets/affection/scenes/kenshi-tassel-market-morning.webp',
      'public/assets/affection/scenes/kenshi-riverside-tea-afternoon.webp',
      'public/assets/affection/scenes/kenshi-dojo-lantern-night.webp',
    ],
  },
  {
    source: `${SOURCE_ROOT}/key-cg-sheet.png`,
    size: [1448, 1086],
    rects: WIDE_RECTS,
    outputs: [
      'public/assets/affection/cg/kenshi-bluebell-scabbard.webp',
      'public/assets/affection/cg/kenshi-paired-dojo-lanterns.webp',
      'public/assets/affection/cg/kenshi-shared-patrol-map.webp',
      'public/assets/affection/cg/kenshi-dojo-keyplate.webp',
    ],
  },
];

function abs(path) {
  return resolve(ROOT, path);
}

function digest(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function decodedRgb(input) {
  return sharp(input).removeAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
}

async function pixelDigest(input) {
  const { data, info } = await decodedRgb(input);
  return digest(Buffer.concat([Buffer.from(`${info.width}x${info.height}:`), data]));
}

async function assertContactPreviewEquivalent(path, rebuilt) {
  const actual = await decodedRgb(abs(path));
  const expected = await decodedRgb(rebuilt);
  if (actual.info.width !== expected.info.width || actual.info.height !== expected.info.height) {
    throw new Error(
      `[樱酱剧情美术] 联系图尺寸不一致：${actual.info.width}×${actual.info.height} / ${expected.info.width}×${expected.info.height}`,
    );
  }
  let total = 0;
  let channels = 0;
  for (let index = 0; index < actual.data.length; index += 3) {
    const pixel = index / 3;
    const y = Math.floor(pixel / actual.info.width);
    // 每张 250px 卡片的场景预览止于 211px；底部文字依赖系统字体，不参与像素门禁。
    if (y % 250 >= 215) continue;
    total += Math.abs(actual.data[index] - expected.data[index]);
    total += Math.abs(actual.data[index + 1] - expected.data[index + 1]);
    total += Math.abs(actual.data[index + 2] - expected.data[index + 2]);
    channels += 3;
  }
  const mae = channels === 0 ? 0 : total / channels;
  if (mae > CONTACT_PREVIEW_MAX_MAE) {
    throw new Error(
      `[樱酱剧情美术] 联系图预览未更新：${path}（visibleMAE=${mae.toFixed(3)}）`,
    );
  }
}

async function panelBuffer(source, rect) {
  return sharp(abs(source))
    .extract(rect)
    .resize(960, 640, {
      fit: 'cover',
      position: 'centre',
      kernel: sharp.kernel.lanczos3,
    })
    .removeAlpha()
    .webp({ quality: 88, effort: 6, smartSubsample: true })
    .toBuffer();
}

async function writeOrCheck(path, buffer) {
  if (CHECK) {
    if (!existsSync(abs(path))) {
      throw new Error(`[樱酱剧情美术] 缺少运行时图：${path}`);
    }
    if ((await pixelDigest(abs(path))) !== (await pixelDigest(buffer))) {
      throw new Error(`[樱酱剧情美术] 未由权威无人原画板重建：${path}`);
    }
    return;
  }
  writeFileSync(abs(path), buffer);
}

for (const sheet of sheets) {
  if (!existsSync(abs(sheet.source))) {
    throw new Error(`[樱酱剧情美术] 缺少原画板：${sheet.source}`);
  }
  const metadata = await sharp(abs(sheet.source)).metadata();
  if (metadata.width !== sheet.size[0] || metadata.height !== sheet.size[1]) {
    throw new Error(
      `[樱酱剧情美术] ${sheet.source} 为 ${metadata.width}×${metadata.height}，期望 ${sheet.size.join('×')}`,
    );
  }
  for (let index = 0; index < sheet.outputs.length; index += 1) {
    await writeOrCheck(
      sheet.outputs[index],
      await panelBuffer(sheet.source, sheet.rects[index]),
    );
  }
}

async function buildContactSheet() {
  const outputs = sheets.flatMap((sheet) => sheet.outputs);
  const cards = [];
  for (const path of outputs) {
    const slug = path.split('/').pop().replace('.webp', '');
    const label = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="250"><rect width="320" height="250" fill="#eef4fc"/><text x="160" y="238" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#302947">${slug}</text></svg>`,
    );
    const scene = await sharp(abs(path))
      .resize(308, 205, { fit: 'cover', position: 'centre' })
      .webp({ quality: 88 })
      .toBuffer();
    cards.push(
      await sharp(label)
        .composite([{ input: scene, left: 6, top: 6 }])
        .png({ compressionLevel: 9, palette: true, quality: 92 })
        .toBuffer(),
    );
  }
  const contact = await sharp({
    create: {
      width: 1280,
      height: 1000,
      channels: 4,
      background: { r: 238, g: 244, b: 252, alpha: 1 },
    },
  })
    .composite(
      cards.map((input, index) => ({
        input,
        left: (index % 4) * 320,
        top: Math.floor(index / 4) * 250,
      })),
    )
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toBuffer();
  const path = 'art-source/qa/kenshi-story-contact.png';
  if (CHECK) {
    if (!existsSync(abs(path))) {
      throw new Error(`[樱酱剧情美术] 联系图未更新：${path}`);
    }
    // 场景本体仍由 writeOrCheck 做精确像素重建；这里只为二次缩放/调色板量化后的
    // QA 联系图预览接受小于一个色阶的跨平台误差。
    await assertContactPreviewEquivalent(path, contact);
  } else {
    writeFileSync(abs(path), contact);
  }
}

await buildContactSheet();

console.log(
  CHECK
    ? '✓ 樱酱 12 张无人场景 + 4 张纯物件 CG 可由四张权威原画板确定性重建'
    : '✓ 樱酱剧情图已重建：12 张无人场景 + 4 张纯物件 CG',
);
