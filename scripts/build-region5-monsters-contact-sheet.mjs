/**
 * 区域 5 怪物压缩联系表：只读取通过门禁的运行时 WebP。
 */

import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { REGION5_MONSTERS } from './region5-assets-manifest.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const OUTPUT = resolve(ROOT, 'art-source/qa/r5-monsters-contact.webp');
const COLUMNS = 6;
const TILE_WIDTH = 210;
const TILE_HEIGHT = 236;
const LABEL_HEIGHT = 42;
const GAP = 10;
const MARGIN = 18;
const HEADER_HEIGHT = 54;

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function renderTile(monster) {
  const input = resolve(ROOT, `public/assets/monsters/r5/${monster.id}.webp`);
  const imageAreaHeight = TILE_HEIGHT - LABEL_HEIGHT;
  const image = await sharp(input)
    .resize({
      width: TILE_WIDTH - 18,
      height: imageAreaHeight - 12,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const metadata = await sharp(image).metadata();
  const label = Buffer.from(`
    <svg width="${TILE_WIDTH}" height="${LABEL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" rx="10" fill="#ffffff" fill-opacity=".9"/>
      <text x="50%" y="16" text-anchor="middle"
        font-family="Arial, Microsoft YaHei, sans-serif" font-size="11" font-weight="700"
        fill="#374964">${escapeXml(monster.id)}</text>
      <text x="50%" y="33" text-anchor="middle"
        font-family="Arial, Microsoft YaHei, sans-serif" font-size="13" font-weight="700"
        fill="#b64f5d">${escapeXml(monster.name)}</text>
    </svg>
  `);

  return sharp({
    create: {
      width: TILE_WIDTH,
      height: TILE_HEIGHT,
      channels: 4,
      background: { r: 251, g: 240, b: 241, alpha: 1 },
    },
  })
    .composite([
      {
        input: image,
        left: Math.floor((TILE_WIDTH - metadata.width) / 2),
        top: Math.floor((imageAreaHeight - metadata.height) / 2),
      },
      { input: label, left: 0, top: imageAreaHeight },
    ])
    .png()
    .toBuffer();
}

const rows = Math.ceil(REGION5_MONSTERS.length / COLUMNS);
const width = MARGIN * 2 + COLUMNS * TILE_WIDTH + (COLUMNS - 1) * GAP;
const height = MARGIN * 2 + HEADER_HEIGHT + rows * TILE_HEIGHT + (rows - 1) * GAP;
const title = Buffer.from(`
  <svg width="${width}" height="${HEADER_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <text x="${MARGIN}" y="31"
      font-family="Arial, Microsoft YaHei, sans-serif" font-size="23" font-weight="800"
      fill="#334a68">R5 熔岩神殿 · 24 怪物运行时资产</text>
    <text x="${width - MARGIN}" y="31" text-anchor="end"
      font-family="Arial, Microsoft YaHei, sans-serif" font-size="13" font-weight="700"
      fill="#c85d68">20 普通 · 3 精英 · 1 BOSS</text>
  </svg>
`);
const composites = [{ input: title, left: 0, top: MARGIN }];

for (let index = 0; index < REGION5_MONSTERS.length; index += 1) {
  const tile = await renderTile(REGION5_MONSTERS[index]);
  const column = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  composites.push({
    input: tile,
    left: MARGIN + column * (TILE_WIDTH + GAP),
    top: MARGIN + HEADER_HEIGHT + row * (TILE_HEIGHT + GAP),
  });
}

await mkdir(dirname(OUTPUT), { recursive: true });
await sharp({
  create: {
    width,
    height,
    channels: 4,
    background: { r: 228, g: 240, b: 249, alpha: 1 },
  },
})
  .composite(composites)
  .webp({ quality: 80, effort: 6, smartSubsample: true })
  .toFile(OUTPUT);

console.log(`✓ ${OUTPUT} (${width}×${height})`);
