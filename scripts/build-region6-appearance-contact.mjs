/**
 * 区域 6 五职业普通装 / 幽影套纸娃娃合成验收图。
 *
 * 这里复现 CharacterAppearance.vue 的关键叠层顺序：
 * 底模 → 身体 →（喵喵头饰）→ 安全脸 →（其余职业头饰）→ 武器。
 * 产物只用于人工 QA，不进入运行时。
 */

import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const OUTPUT = resolve(ROOT, 'art-source/qa/r6-appearance-contact.webp');
const CLASSES = [
  { id: 'swordsman', label: '剑士', face: [52, 10, 19, 9] },
  { id: 'witch', label: '魔女', face: [50, 10, 18, 8.8] },
  { id: 'shaman', label: '巫祝', face: [50, 10, 17, 8.8] },
  { id: 'catkin', label: '喵喵', face: [50, 9.7, 18.5, 9.3] },
  { id: 'kenshi', label: '樱酱', face: [50, 9.7, 18.5, 9.3] },
];
const FAMILIES = [
  { id: 'r6', label: '幽塔普通装' },
  { id: 'r6-shadow', label: '幽影八件套' },
];
const CANVAS = { width: 640, height: 960 };
const CELL = { width: 360, height: 580 };

function assetPath(classId, file) {
  return resolve(ROOT, 'public/assets/characters/modular', classId, file);
}

async function faceLayer(basePath, [x, y, rx, ry]) {
  const mask = Buffer.from(`
    <svg width="${CANVAS.width}" height="${CANVAS.height}" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="${(x / 100) * CANVAS.width}" cy="${(y / 100) * CANVAS.height}"
        rx="${(rx / 100) * CANVAS.width}" ry="${(ry / 100) * CANVAS.height}" fill="white"/>
    </svg>
  `);
  return sharp(basePath)
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

async function renderAppearance(classInfo, family) {
  const base = assetPath(classInfo.id, 'base.png');
  const body = assetPath(classInfo.id, `${family.id}-body.png`);
  const head = assetPath(classInfo.id, `${family.id}-head.png`);
  const weapon = assetPath(classInfo.id, `${family.id}-weapon.png`);
  const appearanceBase = classInfo.id === 'kenshi' ? body : base;
  const face = await faceLayer(appearanceBase, classInfo.face);
  const layers = [{ input: appearanceBase }];
  if (classInfo.id !== 'kenshi') layers.push({ input: body });
  const protectFace = classInfo.id === 'catkin' || classInfo.id === 'kenshi';
  if (protectFace) layers.push({ input: head });
  layers.push({ input: face });
  if (!protectFace) layers.push({ input: head });
  layers.push({ input: weapon });
  return sharp({
    create: {
      ...CANVAS,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(layers)
    .png()
    .toBuffer();
}

const composites = [];
for (let row = 0; row < FAMILIES.length; row += 1) {
  for (let column = 0; column < CLASSES.length; column += 1) {
    const classInfo = CLASSES[column];
    const family = FAMILIES[row];
    const appearance = await renderAppearance(classInfo, family);
    const thumbnail = await sharp(appearance)
      .resize({ width: 320, height: 480, fit: 'contain' })
      .png()
      .toBuffer();
    const left = column * CELL.width;
    const top = row * CELL.height;
    composites.push({ input: thumbnail, left: left + 20, top: top + 55 });
    composites.push({
      input: Buffer.from(`
        <svg width="${CELL.width}" height="54" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" rx="18" fill="#1b1733" fill-opacity=".9"/>
          <text x="18" y="34" fill="#f6efff" font-size="22"
            font-family="Microsoft YaHei, sans-serif">${classInfo.label} · ${family.label}</text>
        </svg>
      `),
      left,
      top,
    });
  }
}

await mkdir(dirname(OUTPUT), { recursive: true });
await sharp({
  create: {
    width: CELL.width * CLASSES.length,
    height: CELL.height * FAMILIES.length,
    channels: 4,
    background: { r: 242, g: 237, b: 252, alpha: 1 },
  },
})
  .composite(composites)
  .webp({ quality: 90, effort: 6 })
  .toFile(OUTPUT);

console.log(`区域 6 纸娃娃验收图：${OUTPUT}`);
