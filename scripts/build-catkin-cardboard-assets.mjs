import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const sourceDir = resolve('art-source/shop/cardboard-cat');
const characterDir = resolve('public/assets/characters/modular/shop/cardboard-cat');
const equipmentDir = resolve('public/assets/equipment/shop/cardboard-cat');
const effectDir = resolve('public/assets/effects/boutique');
const qaDir = resolve('art-source/qa');

await Promise.all([
  mkdir(characterDir, { recursive: true }),
  mkdir(equipmentDir, { recursive: true }),
  mkdir(effectDir, { recursive: true }),
  mkdir(qaDir, { recursive: true }),
]);

async function cleanAlpha(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] <= 12) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
    }
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

async function writeRuntime(inputName, output, width, height) {
  const clean = await cleanAlpha(resolve(sourceDir, inputName));
  await sharp(clean)
    .resize(width, height, { fit: 'fill' })
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toFile(output);
}

await Promise.all([
  writeRuntime(
    'catkin-body-alpha.png',
    resolve(characterDir, 'catkin-body.png'),
    640,
    960,
  ),
  writeRuntime(
    'catkin-weapon-alpha.png',
    resolve(characterDir, 'catkin-weapon.png'),
    640,
    960,
  ),
  writeRuntime(
    'catkin-effect-alpha.png',
    resolve(effectDir, 'cardboard-cat-catkin.png'),
    512,
    512,
  ),
]);

async function writeIcon(source, output) {
  const foreground = await sharp(source)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(222, 222, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await sharp({
    create: {
      width: 256,
      height: 256,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: foreground, left: 17, top: 17 }])
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toFile(output);
}

await Promise.all([
  writeIcon(
    resolve(characterDir, 'catkin-body.png'),
    resolve(equipmentDir, 'body-catkin.png'),
  ),
  writeIcon(
    resolve(characterDir, 'catkin-weapon.png'),
    resolve(equipmentDir, 'weapon-catkin.png'),
  ),
]);

await sharp(resolve(characterDir, 'catkin-body.png'))
  .composite([{ input: resolve(characterDir, 'catkin-weapon.png') }])
  .png({ compressionLevel: 9, palette: true, quality: 92 })
  .toFile(resolve(qaDir, 'catkin-cardboard-outfit.png'));

const outfitBuffer = await sharp(resolve(characterDir, 'catkin-body.png'))
  .composite([{ input: resolve(characterDir, 'catkin-weapon.png') }])
  .png()
  .toBuffer();
const outfitDataUrl = `data:image/png;base64,${outfitBuffer.toString('base64')}`;
const actionExtremes = [
  { label: 'IDLE 待机', x: 0, y: -2, rotate: 1, scaleX: 0.992, scaleY: 1.012, fx: '' },
  { label: 'ATTACK 猫拳', x: 18, y: -3, rotate: 4, scaleX: 1.04, scaleY: 0.96, fx: 'slash' },
  { label: 'DASH 扑击', x: 10, y: -15, rotate: 7, scaleX: 0.9, scaleY: 1.12, fx: 'dash' },
  { label: 'FLURRY 乱抓', x: 13, y: -5, rotate: 12, scaleX: 0.93, scaleY: 1.08, fx: 'slash' },
  { label: 'SPIN 尾扫', x: 0, y: -10, rotate: 14, scaleX: 0.93, scaleY: 1.09, fx: 'ring' },
  { label: 'CAST 毛球术', x: 4, y: -8, rotate: 5, scaleX: 0.94, scaleY: 1.08, fx: 'keycap' },
  { label: 'COUNTER 空翻', x: -12, y: -14, rotate: -14, scaleX: 0.92, scaleY: 1.1, fx: 'ring' },
  { label: 'REACT 后跳', x: -13, y: -13, rotate: -6, scaleX: 0.9, scaleY: 1.12, fx: 'impact' },
  { label: 'VICTORY 理毛', x: -2, y: -1, rotate: 7, scaleX: 0.97, scaleY: 1.05, fx: 'keycap' },
];
const cellWidth = 360;
const cellHeight = 240;
const drawWidth = 136;
const drawHeight = 204;
const rootScale = 0.88;

function actionFx(kind, cellX, cellY) {
  if (kind === 'slash') {
    return [0, 1, 2]
      .map(
        (index) =>
          `<path d="M ${cellX + 202} ${cellY + 82 + index * 19} L ${cellX + 318} ${cellY + 43 + index * 17}" stroke="${index === 1 ? '#ff8fbd' : '#71d8ff'}" stroke-width="5" stroke-linecap="round" opacity=".72"/>`,
      )
      .join('');
  }
  if (kind === 'dash') {
    return [0, 1, 2, 3]
      .map(
        (index) =>
          `<path d="M ${cellX + 28} ${cellY + 88 + index * 27} H ${cellX + 178 + index * 13}" stroke="#7fdcff" stroke-width="3" stroke-linecap="round" opacity="${0.65 - index * 0.08}"/>`,
      )
      .join('');
  }
  if (kind === 'ring' || kind === 'impact') {
    return `<ellipse cx="${cellX + (kind === 'impact' ? 94 : 236)}" cy="${cellY + 126}" rx="${kind === 'impact' ? 48 : 78}" ry="${kind === 'impact' ? 38 : 55}" fill="none" stroke="${kind === 'impact' ? '#ff9aa8' : '#70d9ff'}" stroke-width="5" opacity=".58"/>`;
  }
  if (kind === 'keycap') {
    return [0, 1, 2, 3, 4]
      .map(
        (index) =>
          `<rect x="${cellX + 72 + index * 49}" y="${cellY + 54 + (index % 2) * 23}" width="11" height="11" rx="2" fill="${index % 2 ? '#ff8fb5' : '#7edcff'}" stroke="#fff" stroke-width="2" transform="rotate(${index * 13 - 24} ${cellX + 78 + index * 49} ${cellY + 60 + (index % 2) * 23})"/>`,
      )
      .join('');
  }
  return '';
}

const actionCells = actionExtremes
  .map((action, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const cellX = column * cellWidth;
    const cellY = row * cellHeight;
    const originX = cellX + 174 + (drawWidth * action.x) / 100;
    const originY = cellY + 225 + (drawHeight * (action.y + 2)) / 100;
    return `
      <g clip-path="url(#cell-${index})">
        <rect x="${cellX + 5}" y="${cellY + 5}" width="${cellWidth - 10}" height="${cellHeight - 10}" rx="18" fill="#f5fbff" stroke="#cfe8f5" stroke-width="2"/>
        <path d="M ${cellX + 28} ${cellY + 220} H ${cellX + 332}" stroke="#d7c8e9" stroke-width="2" stroke-dasharray="7 7"/>
        ${actionFx(action.fx, cellX, cellY)}
        <g transform="translate(${originX} ${originY}) rotate(${action.rotate}) scale(${action.scaleX * rootScale} ${action.scaleY * rootScale}) translate(${-drawWidth / 2} ${-drawHeight * 0.91})">
          <image href="${outfitDataUrl}" width="${drawWidth}" height="${drawHeight}" preserveAspectRatio="xMidYMid meet"/>
        </g>
        <rect x="${cellX + 17}" y="${cellY + 14}" width="126" height="23" rx="11.5" fill="#314f7e" opacity=".9"/>
        <text x="${cellX + 29}" y="${cellY + 30}" fill="#fff" font-family="Arial, sans-serif" font-size="12" font-weight="700">${action.label}</text>
      </g>`;
  })
  .join('');

const clipPaths = actionExtremes
  .map((_, index) => {
    const cellX = (index % 3) * cellWidth;
    const cellY = Math.floor(index / 3) * cellHeight;
    return `<clipPath id="cell-${index}"><rect x="${cellX + 5}" y="${cellY + 5}" width="${cellWidth - 10}" height="${cellHeight - 10}" rx="18"/></clipPath>`;
  })
  .join('');

const motionQaSvg = Buffer.from(`
  <svg width="1080" height="720" viewBox="0 0 1080 720" xmlns="http://www.w3.org/2000/svg">
    <defs>${clipPaths}</defs>
    <rect width="1080" height="720" fill="#eaf4fa"/>
    ${actionCells}
  </svg>
`);
await sharp(motionQaSvg)
  .png({ compressionLevel: 9, palette: true, quality: 92 })
  .toFile(resolve(qaDir, 'catkin-motion-extremes.png'));

console.log(
  '纸箱键帽摸鱼套已生成：2 个角色层、2 个装备图标、1 个攻击特效、2 张整身/九动作 QA',
);
