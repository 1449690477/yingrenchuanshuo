/**
 * 从正式品牌徽记生成 PWA / iOS / favicon 图标。
 *
 * 用法：node scripts/gen-icons.mjs
 * 依赖：sharp（devDependency）
 */
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const EMBLEM = resolve(ROOT, 'public/assets/brand/sakura-blade-emblem.png');
const ICON_DIR = resolve(ROOT, 'public/icons');
const PUBLIC_DIR = resolve(ROOT, 'public');

function backgroundSvg(size) {
  return Buffer.from(`
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff7fb"/>
          <stop offset="0.48" stop-color="#f4cce0"/>
          <stop offset="1" stop-color="#a8ddf5"/>
        </linearGradient>
        <radialGradient id="halo">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.82"/>
          <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#bg)"/>
      <circle cx="${size * 0.5}" cy="${size * 0.46}" r="${size * 0.43}" fill="url(#halo)"/>
      <g fill="#ffffff" opacity="0.46">
        <ellipse cx="${size * 0.13}" cy="${size * 0.2}" rx="${size * 0.017}" ry="${size * 0.036}" transform="rotate(-30 ${size * 0.13} ${size * 0.2})"/>
        <ellipse cx="${size * 0.87}" cy="${size * 0.27}" rx="${size * 0.014}" ry="${size * 0.03}" transform="rotate(34 ${size * 0.87} ${size * 0.27})"/>
        <ellipse cx="${size * 0.16}" cy="${size * 0.8}" rx="${size * 0.013}" ry="${size * 0.028}" transform="rotate(27 ${size * 0.16} ${size * 0.8})"/>
        <ellipse cx="${size * 0.85}" cy="${size * 0.76}" rx="${size * 0.017}" ry="${size * 0.034}" transform="rotate(-35 ${size * 0.85} ${size * 0.76})"/>
      </g>
      <circle cx="${size * 0.5}" cy="${size * 0.5}" r="${size * 0.43}" fill="none" stroke="#ffffff" stroke-opacity="0.34" stroke-width="${size * 0.012}"/>
    </svg>
  `);
}

async function renderSquare(size, emblemSize, outFile) {
  const emblem = await sharp(EMBLEM)
    .resize(emblemSize, emblemSize, { fit: 'contain' })
    .png()
    .toBuffer();
  const offset = Math.round((size - emblemSize) / 2);
  await sharp(backgroundSvg(size))
    .composite([{ input: emblem, left: offset, top: offset }])
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality: 100 })
    .toFile(outFile);
  console.log(`✔ ${outFile}`);
}

await mkdir(ICON_DIR, { recursive: true });

await renderSquare(512, 390, resolve(ICON_DIR, 'icon-512.png'));
await renderSquare(512, 300, resolve(ICON_DIR, 'icon-maskable-512.png'));

await sharp(resolve(ICON_DIR, 'icon-512.png'))
  .resize(192, 192)
  .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality: 100 })
  .toFile(resolve(ICON_DIR, 'icon-192.png'));

await sharp(resolve(ICON_DIR, 'icon-512.png'))
  .resize(180, 180)
  .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality: 100 })
  .toFile(resolve(ICON_DIR, 'apple-touch-icon.png'));

await sharp(resolve(ICON_DIR, 'icon-512.png'))
  .resize(32, 32)
  .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality: 100 })
  .toFile(resolve(PUBLIC_DIR, 'favicon-32.png'));

console.log('正式品牌图标已全部生成。');
