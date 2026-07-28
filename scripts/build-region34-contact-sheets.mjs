/**
 * 区域 3～4 美术联系表。
 *
 * 只读取通过门禁的运行时资产，生成便于人工检查身份、配色与重复的 QA 图。
 */

import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  REGION34_BATTLEFIELDS,
  REGION34_EQUIPMENT,
  REGION34_ITEMS,
  REGION34_MAPS,
  REGION34_MODULAR_LAYERS,
  REGION34_MONSTERS,
} from './region34-assets-manifest.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const QA_ROOT = resolve(ROOT, 'art-source/qa');
await mkdir(QA_ROOT, { recursive: true });

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function renderTile(input, label, tileWidth, tileHeight, padding = 10) {
  const labelHeight = 28;
  const imageWidth = tileWidth - padding * 2;
  const imageHeight = tileHeight - labelHeight - padding * 2;
  const { data, info } = await sharp(input)
    .resize({
      width: imageWidth,
      height: imageHeight,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer({ resolveWithObject: true });
  const left = Math.floor((tileWidth - info.width) / 2);
  const top = padding + Math.floor((imageHeight - info.height) / 2);
  const labelSvg = Buffer.from(`
    <svg width="${tileWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" rx="8" fill="#ffffff" fill-opacity=".88"/>
      <text x="50%" y="18" text-anchor="middle"
        font-family="Arial, Microsoft YaHei, sans-serif" font-size="12" font-weight="700"
        fill="#38506b">${escapeXml(label)}</text>
    </svg>
  `);

  return sharp({
    create: {
      width: tileWidth,
      height: tileHeight,
      channels: 4,
      background: { r: 238, g: 247, b: 252, alpha: 1 },
    },
  })
    .composite([
      { input: data, left, top },
      { input: labelSvg, left: 0, top: tileHeight - labelHeight },
    ])
    .png()
    .toBuffer();
}

async function renderSheet({
  title,
  entries,
  columns,
  tileWidth,
  tileHeight,
  output,
}) {
  const gap = 12;
  const margin = 18;
  const headerHeight = 48;
  const rows = Math.ceil(entries.length / columns);
  const width = margin * 2 + columns * tileWidth + (columns - 1) * gap;
  const height = margin * 2 + headerHeight + rows * tileHeight + (rows - 1) * gap;
  const titleSvg = Buffer.from(`
    <svg width="${width}" height="${headerHeight}" xmlns="http://www.w3.org/2000/svg">
      <text x="${margin}" y="31"
        font-family="Arial, Microsoft YaHei, sans-serif" font-size="22" font-weight="800"
        fill="#2e4b67">${escapeXml(title)}</text>
    </svg>
  `);
  const composites = [{ input: titleSvg, left: 0, top: margin }];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const tile = await renderTile(entry.input, entry.label, tileWidth, tileHeight);
    const column = index % columns;
    const row = Math.floor(index / columns);
    composites.push({
      input: tile,
      left: margin + column * (tileWidth + gap),
      top: margin + headerHeight + row * (tileHeight + gap),
    });
  }

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 223, g: 239, b: 248, alpha: 1 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(output);
  console.log(`✔ ${output}`);
}

await renderSheet({
  title: '区域 3 / 4 · 地图与章节封面',
  entries: REGION34_MAPS.map((asset) => ({
    input: resolve(ROOT, `public/assets/maps/${asset.id}.webp`),
    label: asset.id,
  })),
  columns: 4,
  tileWidth: 210,
  tileHeight: 300,
  output: resolve(QA_ROOT, 'r34-maps-contact.png'),
});

await renderSheet({
  title: '区域 3 / 4 · 挂机战场',
  entries: REGION34_BATTLEFIELDS.map((asset) => ({
    input: resolve(ROOT, `public/assets/battlefields/${asset.id}.webp`),
    label: asset.id,
  })),
  columns: 2,
  tileWidth: 420,
  tileHeight: 300,
  output: resolve(QA_ROOT, 'r34-battlefields-contact.png'),
});

for (const region of ['r3', 'r4']) {
  await renderSheet({
    title: `${region.toUpperCase()} · 怪物阵容`,
    entries: REGION34_MONSTERS.filter((asset) => asset.region === region).map((asset) => ({
      input: resolve(ROOT, `public/assets/monsters/${asset.region}/${asset.id}.webp`),
      label: `${asset.id} · ${asset.name}`,
    })),
    columns: 5,
    tileWidth: 190,
    tileHeight: 220,
    output: resolve(QA_ROOT, `${region}-monsters-contact.png`),
  });
}

await renderSheet({
  title: '区域 3 / 4 · 掉落材料',
  entries: REGION34_ITEMS.map((asset) => ({
    input: resolve(ROOT, `public/assets/items/${asset.id}.png`),
    label: asset.id,
  })),
  columns: 4,
  tileWidth: 210,
  tileHeight: 230,
  output: resolve(QA_ROOT, 'r34-items-contact.png'),
});

await renderSheet({
  title: '区域 3 / 4 · 装备主题',
  entries: REGION34_EQUIPMENT.map((asset) => ({
    input: resolve(ROOT, `public/assets/equipment/${asset.region}/${asset.slot}.png`),
    label: `${asset.region} · ${asset.slot}`,
  })),
  columns: 4,
  tileWidth: 210,
  tileHeight: 230,
  output: resolve(QA_ROOT, 'r34-equipment-contact.png'),
});

const modularLayerEntries = [];
for (const asset of REGION34_MODULAR_LAYERS) {
  const base = resolve(
    ROOT,
    `public/assets/characters/modular/${asset.classId}/base.png`,
  );
  const layer = resolve(
    ROOT,
    `public/assets/characters/modular/${asset.classId}/${asset.region}-${asset.slot}.png`,
  );
  const composite = await sharp(base).composite([{ input: layer }]).png().toBuffer();
  modularLayerEntries.push({
    input: composite,
    label: `${asset.classId} · ${asset.region}-${asset.slot}`,
  });
}
await renderSheet({
  title: '区域 3 / 4 · 四职业纸娃娃单层对位',
  entries: modularLayerEntries,
  columns: 6,
  tileWidth: 180,
  tileHeight: 280,
  output: resolve(QA_ROOT, 'r34-modular-layers-contact.png'),
});

const modularOutfitEntries = [];
for (const classId of [...new Set(REGION34_MODULAR_LAYERS.map((asset) => asset.classId))]) {
  for (const region of [...new Set(REGION34_MODULAR_LAYERS.map((asset) => asset.region))]) {
    const base = resolve(ROOT, `public/assets/characters/modular/${classId}/base.png`);
    const layers = ['body', 'head', 'weapon'].map((slot) => ({
      input: resolve(
        ROOT,
        `public/assets/characters/modular/${classId}/${region}-${slot}.png`,
      ),
    }));
    const composite = await sharp(base).composite(layers).png().toBuffer();
    modularOutfitEntries.push({
      input: composite,
      label: `${classId} · ${region} 全套`,
    });
  }
}
await renderSheet({
  title: '区域 3 / 4 · 四职业纸娃娃全套叠装',
  entries: modularOutfitEntries,
  columns: 4,
  tileWidth: 240,
  tileHeight: 360,
  output: resolve(QA_ROOT, 'r34-modular-contact.png'),
});

console.log('区域 3/4 QA 联系表已生成。');
