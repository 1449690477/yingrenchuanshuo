/**
 * 「冰雪华年」精品套可复现资产构建器。
 *
 * 几何原则：沿用已经过实穿校准的 rose-night 同职业透明层，只改颜色和纹样；
 * 唯一例外是实机截图证明旧帽层压住眼睛，因此把顶部 180px 帽区纵向收至
 * 100px（不裁切任何 Alpha），让帽檐离开眼睛并由门禁钉死。
 */
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const TARGET_THEME = 'ice-snow';
const CLASSES = ['swordsman', 'witch', 'shaman', 'catkin', 'kenshi'];
const WEARABLE_SLOTS = ['body', 'head', 'shoes', 'weapon'];
const ICON_FILES = [
  'belt.png',
  'body.png',
  'bracelet.png',
  'head.png',
  'necklace.png',
  'ring.png',
  'shoes.png',
  ...CLASSES.map((classId) => `weapon-${classId}.png`),
];

// 冰雪的锚点母版随任务归档，禁止读取仍会被其它主题修订的运行时 rose-night。
const sourceWearableRoot = resolve(ROOT, 'art-source/shop/ice-snow/wearable-base');
const targetWearableRoot = resolve(ROOT, 'public/assets/characters/modular/shop', TARGET_THEME);
const sourceIconRoot = resolve(ROOT, 'art-source/shop/ice-snow/icon-base');
const targetIconRoot = resolve(ROOT, 'public/assets/equipment/shop', TARGET_THEME);
const sourceEffectRoot = resolve(ROOT, 'art-source/shop/ice-snow/effect-base');
const effectRoot = resolve(ROOT, 'public/assets/effects/boutique');
const sceneSource = resolve(ROOT, 'art-source/shop/ice-snow/shelf-source.png');
const sceneOutput = resolve(ROOT, 'public/assets/shops/ice-snow-shelf.webp');
const kenshiBodyIconOutput = resolve(
  ROOT,
  'public/assets/equipment/bodies/boutique-ice-snow-body/kenshi.png',
);

function isProtectedKenshiPixel(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const paleHair = min > 178 && max - min < 55;
  const skin = r > 150 && g > 92 && b > 82 && r > g * 1.035 && g >= b * 0.82;
  return paleHair || skin;
}

function icePixel(r, g, b) {
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const shade = 0.72 + 0.28 * Math.sqrt(luminance);
  const originalBlue = Math.max(0, b - (r + g) / 2) / 255;
  const originalRed = Math.max(0, r - (g + b) / 2) / 255;
  return [
    Math.round(Math.min(255, 246 * shade + originalRed * 18)),
    Math.round(Math.min(255, 250 * shade + originalBlue * 5)),
    Math.round(Math.min(255, 255 * shade + originalBlue * 13 + originalRed * 5)),
  ];
}

async function recolor(input, { protectKenshi = false } = {}) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let offset = 0; offset < data.length; offset += 4) {
    const alpha = data[offset + 3];
    if (alpha <= 4) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      // 半透明抗锯齿本身也是校准轮廓的一部分；只清 RGB 噪声，不吞 Alpha。
      continue;
    }
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    if (protectKenshi && isProtectedKenshiPixel(r, g, b)) continue;
    const [nextR, nextG, nextB] = icePixel(r, g, b);
    data[offset] = nextR;
    data[offset + 1] = nextG;
    data[offset + 2] = nextB;
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

function ornamentSvg(slot, classId, width, height) {
  const bodyY = { swordsman: 440, witch: 452, shaman: 446, catkin: 452, kenshi: 500 }[classId];
  const waistY = { swordsman: 306, witch: 304, shaman: 318, catkin: 304, kenshi: 402 }[classId];
  const slotY = slot === 'body' ? bodyY : slot === 'head' ? 118 : slot === 'shoes' ? 790 : 430;
  const size = slot === 'body' ? 20 : slot === 'weapon' ? 17 : 14;
  const redKnot = slot === 'body'
    ? `<g transform="translate(320 ${waistY})" fill="none" stroke="#cc5970" stroke-width="2.4" stroke-linecap="round" opacity=".72">
         <path d="M0 0c-12-10-18 7-6 9C-18 18-2 23 0 10c2 13 18 8 6-1C18 7 12-10 0 0Z"/>
         <path d="M-4 14l-5 18M4 14l5 18"/>
       </g>`
    : '';
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(320 ${slotY})" stroke="#77ccec" stroke-width="2.2" stroke-linecap="round" opacity=".68">
        <path d="M-${size} 0H${size}M0 -${size}V${size}M-${Math.round(size * 0.72)} -${Math.round(size * 0.72)}L${Math.round(size * 0.72)} ${Math.round(size * 0.72)}M${Math.round(size * 0.72)} -${Math.round(size * 0.72)}L-${Math.round(size * 0.72)} ${Math.round(size * 0.72)}"/>
      </g>
      <circle cx="320" cy="${slotY}" r="4" fill="#fff" stroke="#b99ed6" stroke-width="1.5" opacity=".78"/>
      ${redKnot}
    </svg>
  `);
}

async function addClippedOrnament(base, slot, classId) {
  const metadata = await sharp(base).metadata();
  const width = metadata.width ?? 640;
  const height = metadata.height ?? 960;
  const [{ data: alpha }, { data: ornament, info }] = await Promise.all([
    sharp(base).ensureAlpha().extractChannel('alpha').raw().toBuffer({ resolveWithObject: true }),
    sharp(ornamentSvg(slot, classId, width, height)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  for (let offset = 0, pixel = 0; offset < ornament.length; offset += 4, pixel += 1) {
    ornament[offset + 3] = Math.min(ornament[offset + 3], alpha[pixel]);
  }
  const clipped = await sharp(ornament, { raw: info }).png().toBuffer();
  const composed = await sharp(base)
    .composite([{ input: clipped, blend: 'over' }])
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  // over 合成会对半透明边缘重新取整；颜色可以变，几何 Alpha 必须强制还原母版。
  for (let offset = 3, pixel = 0; offset < composed.data.length; offset += 4, pixel += 1) {
    composed.data[offset] = alpha[pixel];
  }
  return sharp(composed.data, { raw: composed.info }).png().toBuffer();
}

/**
 * 商店卡片是近白玻璃底，单纯把绯夜图标换成象牙白会让武器主体消失。
 * 先保留冰雪白，再整体压一档亮度，并用原 alpha 膨胀出 3px 霁蓝银灰描边；
 * 这是图标自己的可读性合同，不依赖某一张 UI 背景兜底。
 */
async function addIconContrast(base) {
  const adjusted = await sharp(base)
    .modulate({ brightness: 0.88, saturation: 1.12 })
    .png()
    .toBuffer();
  const { data: outlineAlpha, info } = await sharp(adjusted)
    .ensureAlpha()
    .extractChannel('alpha')
    .dilate(3)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let pixel = 0; pixel < outlineAlpha.length; pixel += 1) {
    const offset = pixel * 4;
    rgba[offset] = 73;
    rgba[offset + 1] = 126;
    rgba[offset + 2] = 166;
    rgba[offset + 3] = Math.min(210, Math.round(outlineAlpha[pixel] * 0.84));
  }
  return sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .composite([{ input: adjusted, blend: 'over' }])
    .png()
    .toBuffer();
}

async function alignWearable(base, slot) {
  if (slot !== 'head') return base;
  return sharp(base)
    .extract({ left: 0, top: 0, width: 640, height: 180 })
    .resize({ width: 640, height: 100, fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .extend({
      top: 0,
      right: 0,
      bottom: 860,
      left: 0,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function writePng(buffer, output) {
  await mkdir(dirname(output), { recursive: true });
  await sharp(buffer)
    // 穿戴层不能使用索引色：调色板会把半透明抗锯齿量化，令边缘 Alpha
    // 与实穿校准母版产生数千像素偏差。真彩 PNG 才能守住逐像素锚点。
    .png({ compressionLevel: 9, palette: false, effort: 10 })
    .toFile(output);
}

for (const classId of CLASSES) {
  for (const slot of WEARABLE_SLOTS) {
    const input = resolve(sourceWearableRoot, `${classId}-${slot}.png`);
    const output = resolve(targetWearableRoot, `${classId}-${slot}.png`);
    const recolored = await recolor(input, { protectKenshi: classId === 'kenshi' && slot === 'body' });
    const ornamented = await addClippedOrnament(recolored, slot, classId);
    await writePng(await alignWearable(ornamented, slot), output);
  }

  const effectInput = resolve(sourceEffectRoot, `${classId}.png`);
  const effectOutput = resolve(effectRoot, `${TARGET_THEME}-${classId}.png`);
  const effect = await recolor(effectInput);
  await mkdir(dirname(effectOutput), { recursive: true });
  await sharp(effect)
    .modulate({ brightness: 1.08, saturation: 1.25 })
    .png({ compressionLevel: 9, palette: false, effort: 10 })
    .toFile(effectOutput);
}

for (const fileName of ICON_FILES) {
  const input = resolve(sourceIconRoot, fileName);
  const output = resolve(targetIconRoot, fileName);
  const recolored = await recolor(input);
  const ornamented = await addClippedOrnament(
    recolored,
    fileName.startsWith('weapon-') ? 'weapon' : fileName.replace('.png', ''),
    'swordsman',
  );
  await writePng(await addIconContrast(ornamented), output);
}

// 樱酱的精品 body 是完整人物源，装备槽必须展示同源缩略图，不能退回通用空心裙。
await mkdir(dirname(kenshiBodyIconOutput), { recursive: true });
const kenshiBodyIcon = await sharp(resolve(targetWearableRoot, 'kenshi-body.png'))
  .resize({
    width: 240,
    height: 240,
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
    kernel: sharp.kernel.lanczos3,
  })
  .extend({
    top: 8,
    right: 8,
    bottom: 8,
    left: 8,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();
await writePng(await addIconContrast(kenshiBodyIcon), kenshiBodyIconOutput);

await mkdir(dirname(sceneOutput), { recursive: true });
await sharp(sceneSource)
  .resize({ width: 960, height: 640, fit: 'cover', position: 'centre', kernel: sharp.kernel.lanczos3 })
  .webp({ quality: 89, effort: 6, smartSubsample: true })
  .toFile(sceneOutput);

console.log('冰雪华年资产已重建：20 穿戴层 + 13 图标 + 5 职业特效 + 1 独立货架。');
