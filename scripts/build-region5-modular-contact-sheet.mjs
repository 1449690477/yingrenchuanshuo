/**
 * 区域 5 普通装 / 绯焰套四职业合成对比联系表。
 *
 * 联系表只读主仓运行时层，用于人工检查脸部遮挡、浮空、手位、尾巴通道与
 * 普通 / 套装的结构差异；不把外部母版复制回主仓。
 */

import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const OUTPUT = resolve(ROOT, 'art-source/qa/r5-modular-contact.webp');
const CLASSES = [
  ['swordsman', '剑士'],
  ['witch', '魔女'],
  ['shaman', '巫祝'],
  ['catkin', '喵喵'],
];
const FAMILIES = [
  ['r5', '普通熔晶装'],
  ['r5-crimson', '绯焰套'],
];
const SLOTS = ['body', 'head', 'weapon'];

const TILE = { width: 250, height: 390 };
const MARGIN = 24;
const GAP = 14;
const HEADER = 76;
const WIDTH =
  MARGIN * 2 + CLASSES.length * TILE.width + (CLASSES.length - 1) * GAP;
const HEIGHT =
  MARGIN * 2 + HEADER + FAMILIES.length * TILE.height + GAP;

function svgText(text, width, height, fontSize, color, y, weight = 700) {
  const escaped = text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <text x="50%" y="${y}" text-anchor="middle"
        font-family="Microsoft YaHei, Noto Sans CJK SC, Arial, sans-serif"
        font-size="${fontSize}" font-weight="${weight}" fill="${color}">
        ${escaped}
      </text>
    </svg>
  `);
}

async function compositeOutfit(classId, family) {
  const classRoot = resolve(
    ROOT,
    'public/assets/characters/modular',
    classId,
  );
  const base = resolve(classRoot, 'base.png');
  const full = await sharp(base)
    .composite(
      SLOTS.map((slot) => ({
        input: resolve(classRoot, `${family}-${slot}.png`),
      })),
    )
    .png()
    .toBuffer();
  return sharp(full)
    .resize({
      width: 224,
      height: 336,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function renderTile(classId, className, family, familyName) {
  const outfit = await compositeOutfit(classId, family);
  const label = svgText(
    `${className} · ${familyName}`,
    TILE.width,
    42,
    15,
    family === 'r5' ? '#8f5360' : '#8a2732',
    27,
    800,
  );
  const accent =
    family === 'r5'
      ? { r: 255, g: 236, b: 236, alpha: 1 }
      : { r: 252, g: 222, b: 218, alpha: 1 };

  return sharp({
    create: {
      width: TILE.width,
      height: TILE.height,
      channels: 4,
      background: accent,
    },
  })
    .composite([
      {
        input: Buffer.from(`
          <svg xmlns="http://www.w3.org/2000/svg" width="${TILE.width}" height="${TILE.height}">
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#fffafb"/>
                <stop offset="1" stop-color="${
                  family === 'r5' ? '#fff0f2' : '#fbe0dc'
                }"/>
              </linearGradient>
            </defs>
            <rect x="1" y="1" width="${TILE.width - 2}" height="${TILE.height - 2}"
              rx="20" fill="url(#g)" stroke="${
                family === 'r5' ? '#f4c6ce' : '#e9a89f'
              }" stroke-width="2"/>
            <circle cx="${TILE.width / 2}" cy="184" r="102"
              fill="${family === 'r5' ? '#ffd8df' : '#f7b7ae'}" opacity=".26"/>
          </svg>
        `),
        left: 0,
        top: 0,
      },
      { input: outfit, left: 13, top: 8 },
      { input: label, left: 0, top: TILE.height - 44 },
    ])
    .png()
    .toBuffer();
}

const composites = [
  {
    input: svgText(
      'R5 熔岩神殿 · 四职业普通装 / 绯焰套合成对比',
      WIDTH,
      HEADER,
      26,
      '#6f3441',
      34,
      900,
    ),
    left: 0,
    top: MARGIN,
  },
  {
    input: svgText(
      'base + body + head + weapon · 640×960 同画布',
      WIDTH,
      HEADER,
      14,
      '#9a6872',
      60,
      600,
    ),
    left: 0,
    top: MARGIN,
  },
];

for (let row = 0; row < FAMILIES.length; row += 1) {
  const [family, familyName] = FAMILIES[row];
  for (let column = 0; column < CLASSES.length; column += 1) {
    const [classId, className] = CLASSES[column];
    composites.push({
      input: await renderTile(classId, className, family, familyName),
      left: MARGIN + column * (TILE.width + GAP),
      top: MARGIN + HEADER + row * (TILE.height + GAP),
    });
  }
}

await mkdir(dirname(OUTPUT), { recursive: true });
await sharp({
  create: {
    width: WIDTH,
    height: HEIGHT,
    channels: 4,
    background: { r: 239, g: 245, b: 250, alpha: 1 },
  },
})
  .composite(composites)
  .webp({ quality: 86, effort: 6, smartSubsample: true })
  .toFile(OUTPUT);

console.log(`区域 5 纸娃娃合成联系表已生成：${OUTPUT}`);
