#!/usr/bin/env node

import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const ROOT = resolve('.');
const CHECK = process.argv.includes('--check');
const REBUILD = process.argv.includes('--rebuild') || !CHECK;
const CANVAS = { width: 640, height: 960 };
const CLASS_IDS = ['swordsman', 'witch', 'shaman', 'catkin', 'kenshi'];
const DUNGEON_TIERS = ['azure', 'violet', 'auric', 'crimson'];

const BODY_BATCHES = [
  {
    source: 'art-source/characters/kenshi/body-icons/body-icons-batch-1.png',
    columns: 3,
    rows: 2,
    key: 'checker',
    ids: ['r1-body', 'r2-body', 'r3-body', 'r4-body', 'r5-body', 'r6-body'],
  },
  {
    source: 'art-source/characters/kenshi/body-icons/body-icons-batch-2.png',
    columns: 3,
    rows: 2,
    key: 'green',
    ids: ['r7-body', 'r5-set-body', 'r6-set-body', 'r7-set-body', 'dungeon-azure-body'],
  },
  {
    source: 'art-source/characters/kenshi/body-icons/body-icons-batch-3.png',
    columns: 3,
    rows: 2,
    key: 'green',
    ids: [
      'dungeon-violet-body',
      'dungeon-auric-body',
      'dungeon-crimson-body',
      'boutique-berry-cream-body',
      'boutique-moon-sugar-body',
    ],
  },
  {
    source: 'art-source/characters/kenshi/body-icons/body-icons-batch-4.png',
    columns: 2,
    rows: 1,
    key: 'green',
    ids: [
      'boutique-rose-night-body',
      'affection-kenshi-moonblue-lantern-date-kimono',
    ],
  },
];

const ARENA_SPECS = {
  swordsman: {
    weapon: 'triumph-verdict-blade',
    head: 'triumph-laurel-crown',
    body: 'triumph-battle-mantle',
  },
  witch: {
    weapon: 'starjudge-scale-staff',
    head: 'starjudge-observatory-crown',
    body: 'starjudge-orbit-robe',
  },
  shaman: {
    weapon: 'oracle-spirit-bell-staff',
    head: 'oracle-rite-crown',
    body: 'oracle-ritual-vestment',
  },
  catkin: {
    weapon: 'swiftshadow-twin-claws',
    head: 'swiftshadow-nighthunt-ears',
    body: 'swiftshadow-stalker-suit',
  },
};

const ARENA_RECTS = {
  swordsman: {
    body: { left: 150, top: 130, width: 340, height: 470 },
    head: { left: 235, top: 10, width: 170, height: 115 },
    weapon: { left: 10, top: 65, width: 220, height: 450 },
  },
  witch: {
    body: { left: 130, top: 125, width: 380, height: 440 },
    head: { left: 235, top: 8, width: 170, height: 115 },
    weapon: { left: 440, top: 45, width: 190, height: 360 },
  },
  shaman: {
    body: { left: 155, top: 130, width: 330, height: 475 },
    head: { left: 235, top: 10, width: 170, height: 120 },
    weapon: { left: 440, top: 75, width: 190, height: 330 },
  },
  catkin: {
    body: { left: 130, top: 125, width: 380, height: 520 },
    head: { left: 205, top: 0, width: 230, height: 155 },
    weapon: { left: 145, top: 260, width: 465, height: 340 },
  },
};

const SHOE_RECTS = {
  swordsman: [
    { left: 169, top: 763, width: 75, height: 165 },
    { left: 379, top: 758, width: 93, height: 155 },
  ],
  witch: [
    { left: 211, top: 758, width: 88, height: 176 },
    { left: 355, top: 759, width: 74, height: 177 },
  ],
  shaman: [
    { left: 212, top: 742, width: 96, height: 195 },
    { left: 333, top: 742, width: 96, height: 195 },
  ],
  catkin: [
    { left: 190, top: 753, width: 88, height: 176 },
    { left: 366, top: 752, width: 74, height: 177 },
  ],
  kenshi: [
    { left: 259, top: 760, width: 50, height: 164 },
    { left: 346, top: 760, width: 63, height: 147 },
  ],
};

function abs(path) {
  return resolve(ROOT, path);
}

function ensureParent(path) {
  mkdirSync(dirname(abs(path)), { recursive: true });
}

function transparentCanvas(width = CANVAS.width, height = CANVAS.height) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });
}

async function canonicalPng(input) {
  return sharp(input)
    .ensureAlpha()
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toBuffer();
}

async function assertPixels(path, expected) {
  if (!existsSync(abs(path))) throw new Error(`[外观补全] 缺少资产：${path}`);
  const left = await sharp(abs(path)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const right = await sharp(expected).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (left.info.width !== right.info.width || left.info.height !== right.info.height) {
    throw new Error(`[外观补全] 尺寸不可重建：${path}`);
  }
  let total = 0;
  let max = 0;
  for (let index = 0; index < left.data.length; index += 1) {
    const delta = Math.abs(left.data[index] - right.data[index]);
    total += delta;
    max = Math.max(max, delta);
  }
  const mae = total / left.data.length;
  if (mae > 0.5 || max > 12) {
    throw new Error(`[外观补全] 可见像素不可重建：${path} mae=${mae.toFixed(3)} max=${max}`);
  }
}

async function writeOrCheck(path, input) {
  const canonical = await canonicalPng(input);
  if (CHECK) return assertPixels(path, canonical);
  ensureParent(path);
  await sharp(canonical).toFile(abs(path));
}

async function removeGreen(input) {
  const image = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let index = 0; index < image.data.length; index += 4) {
    const r = image.data[index];
    const g = image.data[index + 1];
    const b = image.data[index + 2];
    const dominance = g - Math.max(r, b);
    if (g > 120 && dominance > 35) {
      image.data[index + 3] = dominance > 85 ? 0 : Math.round(255 * (1 - (dominance - 35) / 50));
      image.data[index + 1] = Math.min(g, Math.max(r, b));
    }
  }
  return sharp(image.data, { raw: image.info }).png().toBuffer();
}

async function removeChecker(input) {
  const image = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = image.info;
  const seen = new Uint8Array(width * height);
  const queue = [];
  const qualifies = (pixel) => {
    const offset = pixel * 4;
    const r = image.data[offset];
    const g = image.data[offset + 1];
    const b = image.data[offset + 2];
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    return spread < 18 && (r > 145 || r < 55);
  };
  const push = (pixel) => {
    if (pixel < 0 || pixel >= seen.length || seen[pixel] || !qualifies(pixel)) return;
    seen[pixel] = 1;
    queue.push(pixel);
  };
  for (let x = 0; x < width; x += 1) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    push(y * width);
    push(y * width + width - 1);
  }
  for (let head = 0; head < queue.length; head += 1) {
    const pixel = queue[head];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) push(pixel - 1);
    if (x + 1 < width) push(pixel + 1);
    if (y > 0) push(pixel - width);
    if (y + 1 < height) push(pixel + width);
  }
  for (let pixel = 0; pixel < seen.length; pixel += 1) {
    if (seen[pixel]) image.data[pixel * 4 + 3] = 0;
  }
  return sharp(image.data, { raw: image.info }).png().toBuffer();
}

async function cellFromSheet(batch, index) {
  const metadata = await sharp(abs(batch.source)).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`[外观补全] 无法读取源板：${batch.source}`);
  const column = index % batch.columns;
  const row = Math.floor(index / batch.columns);
  const left = Math.round((column * metadata.width) / batch.columns) + 4;
  const top = Math.round((row * metadata.height) / batch.rows) + 4;
  const right = Math.round(((column + 1) * metadata.width) / batch.columns) - 4;
  const bottom = Math.round(((row + 1) * metadata.height) / batch.rows) - 4;
  const cell = await sharp(abs(batch.source))
    .extract({ left, top, width: right - left, height: bottom - top })
    .png()
    .toBuffer();
  return batch.key === 'green' ? removeGreen(cell) : removeChecker(cell);
}

async function fitInto(input, width, height, fit = 'contain') {
  const trimmed = await sharp(input)
    .ensureAlpha()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
    .png()
    .toBuffer();
  return sharp(trimmed)
    .resize({ width, height, fit, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function layerFromIcon(icon, rect) {
  const fitted = await fitInto(abs(icon), rect.width, rect.height, 'contain');
  return transparentCanvas().composite([{ input: fitted, left: rect.left, top: rect.top }]).png().toBuffer();
}

async function buildBodyIcons() {
  for (const batch of BODY_BATCHES) {
    if (!existsSync(abs(batch.source))) throw new Error(`[外观补全] 缺少服装源板：${batch.source}`);
    for (const [index, id] of batch.ids.entries()) {
      const cell = await cellFromSheet(batch, index);
      const fitted = await fitInto(cell, 232, 232, 'contain');
      const icon = await transparentCanvas(256, 256)
        .composite([{ input: fitted, left: 12, top: 12 }])
        .png()
        .toBuffer();
      await writeOrCheck(`public/assets/equipment/bodies/${id}/kenshi.png`, icon);
    }
  }
}

/*
 * 樱酱区域武器层（r1–r5、r5-crimson）**不再由本脚本生产**。
 *
 * 它们由 scripts/build-kenshi-r2-assets.mjs 唯一拥有并逐字节校验，见 docs/85 §4.0。
 * 此处原有一份 carryWeaponLayer + buildStaticKenshiWeapons，从同一批 alpha 母版
 * 再推导一次；R2 用统一软遮罩重制母版后，两边推出的像素不再逐字节相同
 * （实测 r1-weapon mae=0.116、max=175，撞穿本脚本 mae<=0.5 / max<=12 的容差）。
 *
 * **红的不是素材，是同一个文件有两个生产者。** 删除重复推导即消除分歧；
 * 覆盖面未减少：R2 的 FAMILIES 含 r1–r7 全部族，且实测 --rebuild 后
 * r1-weapon.png 字节不变，证明它能精确重现这批文件。
 */

async function buildArenaWearables() {
  for (const [classId, slots] of Object.entries(ARENA_SPECS)) {
    for (const [slot, slug] of Object.entries(slots)) {
      const icon = `public/assets/equipment/arena/${classId}/${slug}.png`;
      const output = `public/assets/characters/modular/arena/${classId}/${slug}.png`;
      const layer =
        classId === 'catkin' && slot === 'weapon'
          ? await pairLayer(icon, [
              { left: 125, top: 350, width: 155, height: 185 },
              { left: 425, top: 235, width: 165, height: 215 },
            ], 'contain')
          : await layerFromIcon(icon, ARENA_RECTS[classId][slot]);
      await writeOrCheck(output, layer);
    }
  }
}

async function shoeLayer(source, classId) {
  const metadata = await sharp(abs(source)).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`[外观补全] 无法读取鞋源图：${source}`);
  const halves = [];
  for (let side = 0; side < 2; side += 1) {
    const left = side === 0 ? 0 : Math.floor(metadata.width / 2);
    const width = side === 0 ? Math.floor(metadata.width / 2) : metadata.width - left;
    const part = await sharp(abs(source)).extract({ left, top: 0, width, height: metadata.height }).png().toBuffer();
    const rect = SHOE_RECTS[classId][side];
    halves.push({ input: await fitInto(part, rect.width, rect.height, 'fill'), left: rect.left, top: rect.top });
  }
  return transparentCanvas().composite(halves).png().toBuffer();
}

async function pairLayer(source, rects, fit = 'fill') {
  const metadata = await sharp(abs(source)).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`[外观补全] 无法读取成对源图：${source}`);
  const composites = [];
  for (let side = 0; side < 2; side += 1) {
    const left = side === 0 ? 0 : Math.floor(metadata.width / 2);
    const width = side === 0 ? Math.floor(metadata.width / 2) : metadata.width - left;
    const part = await sharp(abs(source)).extract({ left, top: 0, width, height: metadata.height }).png().toBuffer();
    const rect = rects[side];
    composites.push({ input: await fitInto(part, rect.width, rect.height, fit), left: rect.left, top: rect.top });
  }
  return transparentCanvas().composite(composites).png().toBuffer();
}

async function buildShoes() {
  for (let region = 1; region <= 7; region += 1) {
    const source = `public/assets/equipment/r${region}/shoes.png`;
    for (const classId of CLASS_IDS) {
      await writeOrCheck(
        `public/assets/characters/modular/${classId}/r${region}-shoes.png`,
        await shoeLayer(source, classId),
      );
    }
  }
  for (const tier of DUNGEON_TIERS) {
    const source = `public/assets/equipment/dungeon/${tier}/shoes-ribbon.png`;
    for (const classId of CLASS_IDS) {
      await writeOrCheck(
        `public/assets/characters/modular/dungeon/${tier}/${classId}-shoes.png`,
        await shoeLayer(source, classId),
      );
    }
  }
}

async function contactGrid(entries, columns, cardWidth, cardHeight, output) {
  const rows = Math.ceil(entries.length / columns);
  const cards = await Promise.all(
    entries.map(async ({ base, layer }) => {
      const composite = base
        ? await transparentCanvas()
            .composite([{ input: abs(base) }, { input: abs(layer) }])
            .png()
            .toBuffer()
        : abs(layer);
      return sharp(composite)
        .flatten({ background: '#eaf2fb' })
        .resize(cardWidth, cardHeight, { fit: 'contain', background: '#eaf2fb' })
        .png()
        .toBuffer();
    }),
  );
  const sheet = await sharp({
    create: {
      width: columns * cardWidth,
      height: rows * cardHeight,
      channels: 3,
      background: '#d9e7f5',
    },
  })
    .composite(cards.map((input, index) => ({
      input,
      left: (index % columns) * cardWidth,
      top: Math.floor(index / columns) * cardHeight,
    })))
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toBuffer();
  await writeOrCheck(output, sheet);
}

async function buildContacts() {
  const bodyEntries = BODY_BATCHES.flatMap((batch) => batch.ids).map((id) => ({
    layer: `public/assets/equipment/bodies/${id}/kenshi.png`,
  }));
  await contactGrid(bodyEntries, 6, 160, 160, 'art-source/characters/kenshi/body-icons/contact-sheet.png');

  const arenaEntries = Object.entries(ARENA_SPECS).flatMap(([classId, slots]) =>
    Object.values(slots).map((slug) => ({
      base: `public/assets/characters/modular/${classId}/base.png`,
      layer: `public/assets/characters/modular/arena/${classId}/${slug}.png`,
    })),
  );
  await contactGrid(arenaEntries, 4, 192, 288, 'art-source/qa/arena-wearables-contact-sheet.png');

  const shoeEntries = CLASS_IDS.flatMap((classId) => [
    ...Array.from({ length: 7 }, (_, index) => ({
      base: `public/assets/characters/modular/${classId}/base-noshoes.png`,
      layer: `public/assets/characters/modular/${classId}/r${index + 1}-shoes.png`,
    })),
    ...DUNGEON_TIERS.map((tier) => ({
      base: `public/assets/characters/modular/${classId}/base-noshoes.png`,
      layer: `public/assets/characters/modular/dungeon/${tier}/${classId}-shoes.png`,
    })),
  ]);
  await contactGrid(shoeEntries, 11, 116, 174, 'art-source/characters/modular/shoes-contact-sheet.png');
}

if (!REBUILD && !CHECK) throw new Error('用法：node scripts/build-appearance-debt-assets.mjs [--rebuild|--check]');

await buildBodyIcons();
await buildArenaWearables();
await buildShoes();
if (!CHECK) await buildContacts();

console.log(CHECK ? '✓ 外观补全资产可确定性重建' : '✓ 外观补全资产已重建（服装图标 18 / 圣痕 12 / 鞋 55；樱酱区域武器归 R2）');
