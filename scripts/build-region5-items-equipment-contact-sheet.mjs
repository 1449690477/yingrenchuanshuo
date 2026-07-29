/**
 * 区域 5 物品与装备图标 QA 联系表。
 * 读取运行时图标，用棋盘格显式展示透明边缘，并分组比较普通装与绯焰套装。
 */

import { mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  REGION5_EQUIPMENT,
  REGION5_ITEMS,
  REGION5_SET_EQUIPMENT,
} from './region5-assets-manifest.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const OUTPUT = resolve(ROOT, 'art-source', 'qa', 'r5-items-equipment-contact.webp');
const SHEET_WIDTH = 1090;
const TILE_WIDTH = 194;
const TILE_HEIGHT = 214;
const GAP = 14;
const TITLE_HEIGHT = 62;
const SECTION_TITLE_HEIGHT = 38;

const names = {
  slag_lava: '熔岩渣',
  shard_scorched: '焦岩碎片',
  ember_ritual: '祭火余烬',
  core_moltenheart: '熔心核心',
  frag_crimson: '绯焰碎片',
  'r5-weapon': '绯金誓刃',
  'r5-head': '火纹祭冠',
  'r5-body': '赤焰祭礼裙',
  'r5-necklace': '余烬心坠',
  'r5-bracelet': '熔纹护腕',
  'r5-ring': '誓火金戒',
  'r5-belt': '赤金绶带',
  'r5-shoes': '焰步短靴',
  'r5-crimson-weapon': '维斯塔誓焰刃',
  'r5-crimson-head': '绯焰圣冠',
  'r5-crimson-body': '绯焰誓约礼装',
  'r5-crimson-necklace': '熔心誓坠',
  'r5-crimson-ring': '不灭焰戒',
  'r5-crimson-bracelet': '赤金焰护',
};

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function checkerboardSvg(width, height) {
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="checker" width="24" height="24" patternUnits="userSpaceOnUse">
          <rect width="24" height="24" fill="#f8fbff"/>
          <rect width="12" height="12" fill="#dfeaf3"/>
          <rect x="12" y="12" width="12" height="12" fill="#dfeaf3"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" rx="18" fill="url(#checker)"/>
      <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="17"
        fill="none" stroke="#ffffff" stroke-opacity=".92" stroke-width="2"/>
    </svg>
  `);
}

async function renderTile({ input, id, name }) {
  const imageSize = 164;
  const image = await sharp(input)
    .resize(imageSize, imageSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const label = Buffer.from(`
    <svg width="${TILE_WIDTH}" height="48" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" rx="12" fill="#ffffff" fill-opacity=".93"/>
      <text x="50%" y="19" text-anchor="middle"
        font-family="Microsoft YaHei, Arial, sans-serif" font-size="13" font-weight="800"
        fill="#3d526d">${escapeXml(name)}</text>
      <text x="50%" y="37" text-anchor="middle"
        font-family="Arial, sans-serif" font-size="10" font-weight="600"
        fill="#8094aa">${escapeXml(id)}</text>
    </svg>
  `);

  return sharp({
    create: {
      width: TILE_WIDTH,
      height: TILE_HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: checkerboardSvg(TILE_WIDTH, TILE_HEIGHT), left: 0, top: 0 },
      {
        input: image,
        left: Math.floor((TILE_WIDTH - imageSize) / 2),
        top: 2,
      },
      { input: label, left: 0, top: TILE_HEIGHT - 48 },
    ])
    .png()
    .toBuffer();
}

function sectionHeight(entryCount, columns) {
  return (
    SECTION_TITLE_HEIGHT +
    Math.ceil(entryCount / columns) * TILE_HEIGHT +
    (Math.ceil(entryCount / columns) - 1) * GAP
  );
}

async function renderSection({ title, subtitle, entries, columns }) {
  const width = columns * TILE_WIDTH + (columns - 1) * GAP;
  const height = sectionHeight(entries.length, columns);
  const titleSvg = Buffer.from(`
    <svg width="${width}" height="${SECTION_TITLE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <text x="2" y="22"
        font-family="Microsoft YaHei, Arial, sans-serif" font-size="18" font-weight="900"
        fill="#334d6b">${escapeXml(title)}</text>
      <text x="${width - 2}" y="21" text-anchor="end"
        font-family="Microsoft YaHei, Arial, sans-serif" font-size="12" font-weight="600"
        fill="#8497ad">${escapeXml(subtitle)}</text>
    </svg>
  `);
  const composites = [{ input: titleSvg, left: 0, top: 0 }];
  for (let index = 0; index < entries.length; index += 1) {
    const tile = await renderTile(entries[index]);
    composites.push({
      input: tile,
      left: (index % columns) * (TILE_WIDTH + GAP),
      top: SECTION_TITLE_HEIGHT + Math.floor(index / columns) * (TILE_HEIGHT + GAP),
    });
  }
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

const sections = [
  {
    title: '区域 5 · 掉落物',
    subtitle: '5 / 5 · 透明运行时图标',
    columns: 5,
    entries: REGION5_ITEMS.map(({ id }) => ({
      input: resolve(ROOT, 'public', 'assets', 'items', `${id}.png`),
      id,
      name: names[id],
    })),
  },
  {
    title: '绯金火纹 · 普通装备',
    subtitle: '8 / 8 · 珍珠白、冰蓝、粉色主色',
    columns: 4,
    entries: REGION5_EQUIPMENT.map(({ id, slot }) => ({
      input: resolve(ROOT, 'public', 'assets', 'equipment', 'r5', `${slot}.png`),
      id,
      name: names[id],
    })),
  },
  {
    title: '绯焰誓约 · 六件套',
    subtitle: '6 / 6 · 赤红漆金、白莲、双焰徽记',
    columns: 3,
    entries: REGION5_SET_EQUIPMENT.map(({ id, slot }) => ({
      input: resolve(ROOT, 'public', 'assets', 'equipment', 'sets', 'r5-crimson', `${slot}.png`),
      id,
      name: names[id],
    })),
  },
];

const renderedSections = [];
for (const section of sections) {
  renderedSections.push({
    buffer: await renderSection(section),
    height: sectionHeight(section.entries.length, section.columns),
    width: section.columns * TILE_WIDTH + (section.columns - 1) * GAP,
  });
}

const margin = 28;
const sectionGap = 24;
const sheetHeight =
  margin * 2 +
  TITLE_HEIGHT +
  renderedSections.reduce((sum, section) => sum + section.height, 0) +
  sectionGap * (renderedSections.length - 1);
const titleSvg = Buffer.from(`
  <svg width="${SHEET_WIDTH}" height="${TITLE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <text x="${margin}" y="30"
      font-family="Microsoft YaHei, Arial, sans-serif" font-size="25" font-weight="900"
      fill="#2d4764">区域 5「熔岩神殿」物品与装备资产联系表</text>
    <text x="${margin}" y="51"
      font-family="Microsoft YaHei, Arial, sans-serif" font-size="12" font-weight="600"
      fill="#7890a8">19 张独立 ImageGen 资产 · 官方绿幕抠图 · 256×256 RGBA PNG</text>
  </svg>
`);
const composites = [{ input: titleSvg, left: 0, top: margin }];
let top = margin + TITLE_HEIGHT;
for (const section of renderedSections) {
  composites.push({
    input: section.buffer,
    left: Math.floor((SHEET_WIDTH - section.width) / 2),
    top,
  });
  top += section.height + sectionGap;
}

await mkdir(dirname(OUTPUT), { recursive: true });
await sharp({
  create: {
    width: SHEET_WIDTH,
    height: sheetHeight,
    channels: 4,
    background: { r: 229, g: 241, b: 250, alpha: 1 },
  },
})
  .composite(composites)
  .webp({ quality: 86, effort: 6, smartSubsample: true, preset: 'picture' })
  .toFile(OUTPUT);

const outputStat = await stat(OUTPUT);
if (outputStat.size > 600 * 1024) {
  throw new Error(`R5 物品装备联系表超过 600KiB：${(outputStat.size / 1024).toFixed(1)}KiB`);
}
console.log(`✓ ${OUTPUT} (${(outputStat.size / 1024).toFixed(1)}KiB，19 个资产)`);
