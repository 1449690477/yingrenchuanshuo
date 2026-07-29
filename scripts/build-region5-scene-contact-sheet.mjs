/**
 * 区域 5 场景联系表。
 *
 * 只读取已经压缩并通过尺寸约束的运行图，不接触 ImageGen 原图。
 */

import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  REGION5_BATTLEFIELDS,
  REGION5_MAPS,
} from './region5-assets-manifest.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const OUTPUT = resolve(ROOT, 'art-source/qa/r5-scenes-contact.webp');

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function textSvg(width, height, text, fontSize, y, weight = 800) {
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text x="18" y="${y}"
        font-family="Arial, Microsoft YaHei, sans-serif"
        font-size="${fontSize}" font-weight="${weight}" fill="#29455f">
        ${escapeXml(text)}
      </text>
    </svg>
  `);
}

async function tile(input, label, width, height, imageWidth, imageHeight) {
  const top = 12;
  const rendered = await sharp(input)
    .resize({
      width: imageWidth,
      height: imageHeight,
      fit: 'contain',
      background: '#eef7fc',
    })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
  const labelSvg = Buffer.from(`
    <svg width="${width}" height="34" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" rx="8" fill="#ffffff" fill-opacity=".92"/>
      <text x="50%" y="22" text-anchor="middle"
        font-family="Arial, Microsoft YaHei, sans-serif"
        font-size="14" font-weight="700" fill="#38506b">
        ${escapeXml(label)}
      </text>
    </svg>
  `);

  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: '#eef7fc',
    },
  })
    .composite([
      {
        input: rendered,
        left: Math.floor((width - imageWidth) / 2),
        top,
      },
      { input: labelSvg, left: 0, top: height - 34 },
    ])
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
}

const width = 1040;
const margin = 20;
const gap = 12;
const titleHeight = 52;
const mapTileWidth = 320;
const mapTileHeight = 430;
const mapRows = 2;
const mapSectionHeight =
  titleHeight + mapRows * mapTileHeight + (mapRows - 1) * gap;
const battlefieldTileWidth = 494;
const battlefieldTileHeight = 350;
const battlefieldRows = 3;
const battlefieldSectionHeight =
  titleHeight +
  battlefieldRows * battlefieldTileHeight +
  (battlefieldRows - 1) * gap;
const height =
  margin * 2 + mapSectionHeight + gap * 2 + battlefieldSectionHeight;

const composites = [
  {
    input: textSvg(width, titleHeight, '区域 5 · 地图与章节封面', 23, 33),
    left: 0,
    top: margin,
  },
];

for (let index = 0; index < REGION5_MAPS.length; index += 1) {
  const asset = REGION5_MAPS[index];
  const image = await tile(
    resolve(ROOT, `public/assets/maps/${asset.id}.webp`),
    asset.id,
    mapTileWidth,
    mapTileHeight,
    288,
    384,
  );
  const column = index % 3;
  const row = Math.floor(index / 3);
  composites.push({
    input: image,
    left: margin + column * (mapTileWidth + gap),
    top: margin + titleHeight + row * (mapTileHeight + gap),
  });
}

const battlefieldTop = margin + mapSectionHeight + gap * 2;
composites.push({
  input: textSvg(width, titleHeight, '区域 5 · 3:2 挂机战场', 23, 33),
  left: 0,
  top: battlefieldTop,
});

for (let index = 0; index < REGION5_BATTLEFIELDS.length; index += 1) {
  const asset = REGION5_BATTLEFIELDS[index];
  const image = await tile(
    resolve(ROOT, `public/assets/battlefields/${asset.id}.webp`),
    asset.id,
    battlefieldTileWidth,
    battlefieldTileHeight,
    462,
    308,
  );
  const column = index % 2;
  const row = Math.floor(index / 2);
  composites.push({
    input: image,
    left: margin + column * (battlefieldTileWidth + gap),
    top: battlefieldTop + titleHeight + row * (battlefieldTileHeight + gap),
  });
}

await mkdir(dirname(OUTPUT), { recursive: true });
await sharp({
  create: {
    width,
    height,
    channels: 3,
    background: '#dfeff8',
  },
})
  .composite(composites)
  .webp({
    quality: 76,
    effort: 6,
    smartSubsample: true,
    preset: 'picture',
  })
  .toFile(OUTPUT);

console.log(`✔ ${OUTPUT}`);
