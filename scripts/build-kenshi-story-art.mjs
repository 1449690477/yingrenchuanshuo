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
const STORY_CONTACT_LAYOUT = Object.freeze({
  columns: 4,
  rows: 4,
  cardWidth: 320,
  cardHeight: 250,
  previewHeight: 215,
  cardCount: 16,
  channels: 3,
});
const CONTACT_GUARD_LAYOUT = Object.freeze({
  columns: 4,
  rows: 4,
  cardWidth: 16,
  cardHeight: 20,
  previewHeight: 16,
  cardCount: 16,
  channels: 3,
});

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

async function losslessContactPng(image) {
  return image.png({ compressionLevel: 9, palette: false }).toBuffer();
}

async function assertTruecolorContactPng(input, label) {
  const metadata = await sharp(input).metadata();
  if (metadata.format !== 'png' || metadata.isPalette === true) {
    throw new Error(`[樱酱剧情美术] 联系图必须是无损 truecolor PNG：${label}`);
  }
}

async function pixelDigest(input) {
  const { data, info } = await decodedRgb(input);
  return digest(Buffer.concat([Buffer.from(`${info.width}x${info.height}:`), data]));
}

function assertDecodedContactPreviewEquivalent(actual, expected, label, layout) {
  if (actual.info.width !== expected.info.width || actual.info.height !== expected.info.height) {
    throw new Error(
      `[樱酱剧情美术] 联系图尺寸不一致：${actual.info.width}×${actual.info.height} / ${expected.info.width}×${expected.info.height}`,
    );
  }
  const integerKeys = [
    'columns',
    'rows',
    'cardWidth',
    'cardHeight',
    'previewHeight',
    'cardCount',
    'channels',
  ];
  if (integerKeys.some((key) => !Number.isInteger(layout[key]) || layout[key] <= 0)) {
    throw new Error(`[樱酱剧情美术] 联系图布局参数无效：${label}`);
  }
  if (
    layout.cardCount !== layout.columns * layout.rows ||
    layout.previewHeight > layout.cardHeight ||
    actual.info.width !== layout.columns * layout.cardWidth ||
    actual.info.height !== layout.rows * layout.cardHeight ||
    actual.info.channels !== layout.channels ||
    expected.info.channels !== layout.channels
  ) {
    throw new Error(
      `[樱酱剧情美术] 联系图布局不一致：${label}（${actual.info.width}×${actual.info.height}×${actual.info.channels}，应为 ${layout.columns * layout.cardWidth}×${layout.rows * layout.cardHeight}×${layout.channels} / ${layout.cardCount} 卡）`,
    );
  }
  const totals = Array.from({ length: layout.cardCount }, () => 0);
  const channels = Array.from({ length: layout.cardCount }, () => 0);
  for (let index = 0; index < actual.data.length; index += 3) {
    const pixel = index / 3;
    const x = pixel % actual.info.width;
    const y = Math.floor(pixel / actual.info.width);
    if (y % layout.cardHeight >= layout.previewHeight) continue;
    const card =
      Math.floor(y / layout.cardHeight) * layout.columns + Math.floor(x / layout.cardWidth);
    totals[card] += Math.abs(actual.data[index] - expected.data[index]);
    totals[card] += Math.abs(actual.data[index + 1] - expected.data[index + 1]);
    totals[card] += Math.abs(actual.data[index + 2] - expected.data[index + 2]);
    channels[card] += 3;
  }
  const expectedChannels = layout.cardWidth * layout.previewHeight * layout.channels;
  const cardMae = totals.map((total, card) => {
    if (channels[card] !== expectedChannels) {
      throw new Error(
        `[樱酱剧情美术] 联系图分组不完整：${label}（card=${card}，channels=${channels[card]}，应为 ${expectedChannels}）`,
      );
    }
    return { card, value: total / channels[card] };
  });
  const worst = cardMae.reduce(
    (current, candidate) => (candidate.value > current.value ? candidate : current),
    { card: 0, value: 0 },
  );
  const mae = worst.value;
  if (mae > CONTACT_PREVIEW_MAX_MAE) {
    throw new Error(
      `[樱酱剧情美术] 联系图预览未更新：${label}（card=${worst.card}，visibleMAE=${mae.toFixed(3)}）`,
    );
  }
}

async function assertContactPreviewEquivalent(path, rebuilt) {
  await Promise.all([
    assertTruecolorContactPng(abs(path), `${path}/actual`),
    assertTruecolorContactPng(rebuilt, `${path}/rebuilt`),
  ]);
  assertDecodedContactPreviewEquivalent(
    await decodedRgb(abs(path)),
    await decodedRgb(rebuilt),
    path,
    STORY_CONTACT_LAYOUT,
  );
}

async function contactGuardFixture({
  changedCard = null,
  color = [255, 64, 96],
  shift = 0,
  footerVariant = 0,
} = {}) {
  const layout = CONTACT_GUARD_LAYOUT;
  const cards = [];
  for (let card = 0; card < layout.cardCount; card += 1) {
    const data = Buffer.alloc(layout.cardWidth * layout.cardHeight * layout.channels, 238);
    const cardColor = card === changedCard ? color : [255, 64, 96];
    const cardShift = card === changedCard ? shift : 0;
    const drawLeft = 4 + cardShift;
    const drawRight = 12 + cardShift;
    if (drawLeft < 0 || drawRight > layout.cardWidth) {
      throw new Error(`[樱酱剧情美术] 联系图测试图形越出 card=${card}`);
    }
    for (let y = 4; y < 12; y += 1) {
      for (let x = drawLeft; x < drawRight; x += 1) {
        const offset = (y * layout.cardWidth + x) * layout.channels;
        data[offset] = cardColor[0];
        data[offset + 1] = cardColor[1];
        data[offset + 2] = cardColor[2];
      }
    }
    for (let y = layout.previewHeight; y < layout.cardHeight; y += 1) {
      for (let x = 0; x < layout.cardWidth; x += 1) {
        if ((x + y + footerVariant + card) % 3 !== 0) continue;
        const offset = (y * layout.cardWidth + x) * layout.channels;
        data[offset] = footerVariant === 0 ? 32 : 224;
        data[offset + 1] = footerVariant === 0 ? 48 : 24;
        data[offset + 2] = footerVariant === 0 ? 64 : 192;
      }
    }
    cards.push(
      await losslessContactPng(
        sharp(data, {
          raw: {
            width: layout.cardWidth,
            height: layout.cardHeight,
            channels: layout.channels,
          },
        }),
      ),
    );
  }
  const width = layout.columns * layout.cardWidth;
  const height = layout.rows * layout.cardHeight;
  const contact = await losslessContactPng(
    sharp({
      create: {
        width,
        height,
        channels: layout.channels,
        background: { r: 238, g: 238, b: 238 },
      },
    }).composite(
      cards.map((input, card) => ({
        input,
        left: (card % layout.columns) * layout.cardWidth,
        top: Math.floor(card / layout.columns) * layout.cardHeight,
      })),
    ),
  );
  await assertTruecolorContactPng(contact, '联系图编码门禁样本');
  return { ...(await decodedRgb(contact)), layout };
}

function expectContactGuardRejects(name, actual, rebuilt, layout) {
  let rejected = false;
  try {
    assertDecodedContactPreviewEquivalent(actual, rebuilt, `门禁破坏样本/${name}`, layout);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes('联系图预览未更新') ||
      !error.message.includes('card=0')
    ) {
      throw error;
    }
    rejected = true;
  }
  if (!rejected) throw new Error(`[樱酱剧情美术] 联系图逐卡门禁未拒绝：${name}`);
}

async function verifyContactComparisonGuard() {
  const base = await contactGuardFixture();
  assertDecodedContactPreviewEquivalent(base, base, '联系图逐卡同图自检', base.layout);
  const differentFooter = await contactGuardFixture({ footerVariant: 1 });
  assertDecodedContactPreviewEquivalent(base, differentFooter, '联系图字体区隔离自检', base.layout);
  const recolored = await contactGuardFixture({
    changedCard: 0,
    color: [64, 96, 255],
    footerVariant: 1,
  });
  expectContactGuardRejects('单卡明显改色', base, recolored, base.layout);
  const shifted = await contactGuardFixture({ changedCard: 0, shift: 3, footerVariant: 1 });
  expectContactGuardRejects('单卡 3px 位移', base, shifted, base.layout);
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
    await writeOrCheck(sheet.outputs[index], await panelBuffer(sheet.source, sheet.rects[index]));
  }
}

async function buildContactSheet() {
  const outputs = sheets.flatMap((sheet) => sheet.outputs);
  const layout = STORY_CONTACT_LAYOUT;
  if (outputs.length !== layout.cardCount) {
    throw new Error(`[樱酱剧情美术] 联系图卡数不一致：${outputs.length}，应为 ${layout.cardCount}`);
  }
  const cards = [];
  for (const path of outputs) {
    const slug = path.split('/').pop().replace('.webp', '');
    const label = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.cardWidth}" height="${layout.cardHeight}"><rect width="${layout.cardWidth}" height="${layout.cardHeight}" fill="#eef4fc"/><text x="${layout.cardWidth / 2}" y="238" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#302947">${slug}</text></svg>`,
    );
    // 联系图三段都必须保持 truecolor 无损：系统字体只应影响底部文字区，不能通过
    // 有损 WebP 或调色板训练把平台差异扩散到上方预览。16 张运行时 WebP 不经过此链。
    const scene = await losslessContactPng(
      sharp(abs(path)).resize(308, 205, { fit: 'cover', position: 'centre' }),
    );
    cards.push(
      await losslessContactPng(sharp(label).composite([{ input: scene, left: 6, top: 6 }])),
    );
  }
  const contact = await losslessContactPng(
    sharp({
      create: {
        width: layout.columns * layout.cardWidth,
        height: layout.rows * layout.cardHeight,
        channels: 4,
        background: { r: 238, g: 244, b: 252, alpha: 1 },
      },
    }).composite(
      cards.map((input, index) => ({
        input,
        left: (index % layout.columns) * layout.cardWidth,
        top: Math.floor(index / layout.columns) * layout.cardHeight,
      })),
    ),
  );
  const path = 'art-source/qa/kenshi-story-contact.png';
  if (CHECK) {
    if (!existsSync(abs(path))) {
      throw new Error(`[樱酱剧情美术] 联系图未更新：${path}`);
    }
    // 场景本体仍由 writeOrCheck 做精确像素重建；这里只为无损二次缩放后的
    // QA 联系图预览接受小于一个色阶的跨平台取整误差。
    await assertContactPreviewEquivalent(path, contact);
  } else {
    writeFileSync(abs(path), contact);
  }
}

if (CHECK) await verifyContactComparisonGuard();
await buildContactSheet();

console.log(
  CHECK
    ? '✓ 樱酱 12 张无人场景 + 4 张纯物件 CG 可由四张权威原画板确定性重建'
    : '✓ 樱酱剧情图已重建：12 张无人场景 + 4 张纯物件 CG',
);
