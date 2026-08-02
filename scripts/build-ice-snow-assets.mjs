/**
 * 「冰雪华年」精品套可复现资产构建器。
 *
 * 穿戴层沿用已实穿校准的任务内母版；五职业攻击特效则从独立绿幕原画抠图，
 * 禁止从任何旧套装调色复用。帽层把顶部 180px 纵向收至 100px，让帽檐离开眼睛。
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
const sourceEffectChromaRoot = resolve(ROOT, 'art-source/shop/ice-snow/effect-chroma');
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

/**
 * 将 ImageGen 的纯绿背景还原为软 Alpha，同时清除半透明边缘的绿色溢色。
 * 这里读取任务内 effect-chroma 原画，而不是读取任何旧主题运行时特效。
 */
async function removeGreenChroma(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const smoothstep = (value) => {
    const clamped = Math.max(0, Math.min(1, value));
    return clamped * clamped * (3 - 2 * clamped);
  };

  for (let offset = 0; offset < data.length; offset += 4) {
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const sourceAlpha = data[offset + 3];
    const nonGreen = Math.max(r, b);
    const dominance = g - nonGreen;
    const keyDistance = Math.max(r, Math.abs(255 - g), b);
    let matte = 255;

    if (keyDistance <= 24) {
      matte = 0;
    } else if (g > 105 && dominance > 18) {
      const distanceAlpha = Math.round(255 * smoothstep((keyDistance - 20) / 105));
      const dominanceAlpha = Math.round(
        255 * (1 - Math.min(1, dominance / Math.max(1, 255 - nonGreen))),
      );
      matte = Math.min(distanceAlpha, dominanceAlpha);
    }

    const alpha = Math.round((sourceAlpha * matte) / 255);
    data[offset + 3] = alpha <= 6 ? 0 : alpha;
    if (data[offset + 3] === 0) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
    } else if (g > 105 && dominance > 18) {
      data[offset + 1] = Math.min(g, Math.max(0, nonGreen - 1));
    }
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

function silhouetteDefs() {
  return `
    <defs>
      <linearGradient id="iceTulle" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity=".92"/>
        <stop offset=".48" stop-color="#d9f4ff" stop-opacity=".66"/>
        <stop offset="1" stop-color="#efcfef" stop-opacity=".48"/>
      </linearGradient>
      <linearGradient id="iceEdge" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fdfcff"/>
        <stop offset="1" stop-color="#9edcf2"/>
      </linearGradient>
      <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2.2" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>`;
}

function bodySilhouetteSvg(classId, width, height) {
  const config = {
    swordsman: { cx: 320, shoulder: 184, waist: 326, hem: 548, left: 150, right: 489 },
    witch: { cx: 335, shoulder: 182, waist: 330, hem: 558, left: 165, right: 504 },
    shaman: { cx: 325, shoulder: 205, waist: 338, hem: 536, left: 165, right: 484 },
    catkin: { cx: 335, shoulder: 182, waist: 330, hem: 558, left: 165, right: 504 },
    kenshi: { cx: 322, shoulder: 245, waist: 390, hem: 610, left: 120, right: 533 },
  }[classId];
  const { cx, shoulder, waist, hem, left, right } = config;
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${silhouetteDefs()}
      <g stroke="#a9dced" stroke-width="2.2" stroke-linejoin="round">
        <path d="M${cx - 88} ${shoulder + 8} Q${cx - 58} ${shoulder - 17} ${cx} ${shoulder - 8} Q${cx + 58} ${shoulder - 17} ${cx + 88} ${shoulder + 8} Q${cx + 74} ${shoulder + 44} ${cx + 34} ${shoulder + 51} L${cx} ${shoulder + 35} L${cx - 34} ${shoulder + 51} Q${cx - 74} ${shoulder + 44} ${cx - 88} ${shoulder + 8}Z" fill="url(#iceTulle)" opacity=".88"/>
        <path d="M${left + 58} ${waist + 58} C${left + 18} ${waist + 104} ${left - 20} ${hem + 30} ${left - 4} ${hem + 102} C${left + 36} ${hem + 88} ${left + 78} ${hem + 40} ${left + 96} ${waist + 92}Z" fill="url(#iceTulle)" opacity=".62"/>
        <path d="M${right - 58} ${waist + 58} C${right - 18} ${waist + 104} ${right + 20} ${hem + 30} ${right + 4} ${hem + 102} C${right - 36} ${hem + 88} ${right - 78} ${hem + 40} ${right - 96} ${waist + 92}Z" fill="url(#iceTulle)" opacity=".62"/>
        <path d="M${cx - 90} ${hem - 4} Q${cx - 56} ${hem + 25} ${cx - 22} ${hem + 1} Q${cx} ${hem + 31} ${cx + 22} ${hem + 1} Q${cx + 56} ${hem + 25} ${cx + 90} ${hem - 4}" fill="none" stroke="#f9fdff" stroke-width="11" opacity=".72"/>
      </g>
      <g fill="url(#iceEdge)" stroke="#ffffff" stroke-width="1.5" opacity=".95">
        <path d="M${left - 28} ${hem + 82}l13-20 13 20-13 20Z"/>
        <path d="M${right + 28} ${hem + 82}l13-20 13 20-13 20Z"/>
        <circle cx="${cx - 106}" cy="${waist + 84}" r="10"/>
        <circle cx="${cx + 106}" cy="${waist + 84}" r="10"/>
      </g>
    </svg>`);
}

function shoesSilhouetteSvg(classId, width, height) {
  const config = {
    swordsman: { left: 235, right: 430, y: 774, cuff: 92 },
    witch: { left: 270, right: 385, y: 774, cuff: 58 },
    shaman: { left: 275, right: 380, y: 755, cuff: 56 },
    catkin: { left: 250, right: 390, y: 780, cuff: 62 },
    kenshi: { left: 300, right: 370, y: 784, cuff: 48 },
  }[classId];
  const cuffPath = (x) => `M${x - config.cuff} ${config.y} Q${x} ${config.y - 28} ${x + config.cuff} ${config.y} Q${x + config.cuff - 8} ${config.y + 32} ${x} ${config.y + 20} Q${x - config.cuff + 8} ${config.y + 32} ${x - config.cuff} ${config.y}Z`;
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${silhouetteDefs()}
      <g fill="url(#iceTulle)" stroke="#9bd9ed" stroke-width="2" filter="url(#softGlow)">
        <path d="${cuffPath(config.left)}"/>
        <path d="${cuffPath(config.right)}"/>
      </g>
      <g fill="#fff" stroke="#a9dced" stroke-width="1.5">
        <circle cx="${config.left - config.cuff + 3}" cy="${config.y + 14}" r="11"/>
        <circle cx="${config.right + config.cuff - 3}" cy="${config.y + 14}" r="11"/>
      </g>
      <g fill="none" stroke="#d8b1d9" stroke-width="4" opacity=".82">
        <path d="M${config.left - 10} ${config.y + 10}l-18 46m28-46l18 46"/>
        <path d="M${config.right - 10} ${config.y + 10}l-18 46m28-46l18 46"/>
      </g>
    </svg>`);
}

function weaponSilhouetteSvg(classId, width, height) {
  const designs = {
    swordsman: `
      <g fill="url(#iceEdge)" stroke="#fff" stroke-width="1.6" filter="url(#softGlow)">
        <path d="M438 115l31-38 17 44-25 26Z"/><path d="M452 202l42-31 7 48-34 21Z"/>
        <path d="M430 294l39-23 2 43-35 17Z"/><path d="M409 388l29-18 5 34-26 20Z"/>
      </g><path d="M418 410q-54 54-20 104q32-31 46-82" fill="none" stroke="url(#iceTulle)" stroke-width="16" opacity=".78"/>`,
    witch: `
      <g fill="none" stroke="url(#iceEdge)" stroke-width="12" filter="url(#softGlow)">
        <path d="M436 230q45-76 94-9q-53 8-77 57"/>
      </g><g fill="url(#iceEdge)" stroke="#fff"><path d="M506 172l15 25-15 25-15-25Z"/><path d="M401 342l19-27 18 27-18 28Z"/></g>
      <path d="M437 397q42 38 2 91q-18-31-4-68" fill="none" stroke="#ead0ee" stroke-width="12" opacity=".78"/>`,
    shaman: `
      <g fill="url(#iceTulle)" stroke="#9bd9ed" stroke-width="2" filter="url(#softGlow)">
        <path d="M402 230l72-48 76 45-73 27Z"/><path d="M433 370l18 42-20 36-18-36Z"/><path d="M503 372l18 42-20 36-18-36Z"/>
      </g><g fill="none" stroke="#d8b1d9" stroke-width="4"><path d="M446 386v70"/><path d="M516 386v70"/></g>`,
    catkin: `
      <g fill="url(#iceEdge)" stroke="#fff" stroke-width="1.6" filter="url(#softGlow)">
        <path d="M170 325l-44-58 66 24 22 44Z"/><path d="M194 391l-57-34 68-5 28 30Z"/>
        <path d="M548 325l48-58-68 24-20 44Z"/><path d="M532 391l59-34-69-5-27 30Z"/>
      </g><path d="M187 440q-72 43-31 107m383-107q72 43 31 107" fill="none" stroke="#ead0ee" stroke-width="13" opacity=".72"/>`,
    kenshi: `
      <g fill="url(#iceEdge)" stroke="#fff" stroke-width="1.5" filter="url(#softGlow)">
        <path d="M210 664l-48-10 32-34 36 18Z"/><path d="M243 744l-55-5 35-39 38 20Z"/>
        <path d="M278 827l-54 11 23-48 42 5Z"/>
      </g><path d="M307 840q74 40 28 105q-37-37-32-76" fill="none" stroke="url(#iceTulle)" stroke-width="16" opacity=".8"/>`,
  }[classId];
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${silhouetteDefs()}
      ${designs}
    </svg>`);
}

async function addSilhouetteOrnament(base, slot, classId) {
  if (slot === 'head') return base;
  const metadata = await sharp(base).metadata();
  const width = metadata.width ?? 640;
  const height = metadata.height ?? 960;
  const ornament = slot === 'body'
    ? bodySilhouetteSvg(classId, width, height)
    : slot === 'shoes'
      ? shoesSilhouetteSvg(classId, width, height)
      : weaponSilhouetteSvg(classId, width, height);
  return sharp(base)
    .composite([{ input: ornament, blend: 'over' }])
    .png()
    .toBuffer();
}

/**
 * 商店卡片是近白玻璃底，单纯把绯夜图标换成象牙白会让武器主体消失。
 * 先保留冰雪白，再整体压一档亮度，并用原 alpha 膨胀出 3px 霁蓝银灰描边；
 * 这是图标自己的可读性合同，不依赖某一张 UI 背景兜底。
 */
async function addIconContrast(base, { strongIceCore = false } = {}) {
  let adjusted = await sharp(base)
    .modulate({ brightness: strongIceCore ? 0.82 : 0.88, saturation: 1.12 })
    .png()
    .toBuffer();
  if (strongIceCore) {
    const rgba = await sharp(adjusted).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let offset = 0; offset < rgba.data.length; offset += rgba.info.channels) {
      if (rgba.data[offset + 3] <= 4) continue;
      const luminance = (
        0.2126 * rgba.data[offset] +
        0.7152 * rgba.data[offset + 1] +
        0.0722 * rgba.data[offset + 2]
      ) / 255;
      const shade = luminance ** 1.8;
      rgba.data[offset] = Math.round(60 + 150 * shade);
      rgba.data[offset + 1] = Math.round(96 + 136 * shade);
      rgba.data[offset + 2] = Math.round(145 + 105 * shade);
    }
    adjusted = await sharp(rgba.data, { raw: rgba.info }).png().toBuffer();
  }
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
    // 穿戴层不能使用索引色：雪绒、薄纱和冰晶轮廓依赖连续的半透明抗锯齿。
    // 真彩 PNG 守住的是实穿边缘质量，不再以旧套装逐像素同形作为目标。
    .png({ compressionLevel: 9, palette: false, effort: 10 })
    .toFile(output);
}

async function removeKenshiEmbeddedShoes() {
  const bodyPath = resolve(targetWearableRoot, 'kenshi-body.png');
  const shoesPath = resolve(targetWearableRoot, 'kenshi-shoes.png');
  const baseNoShoesPath = resolve(ROOT, 'public/assets/characters/modular/kenshi/base-noshoes.png');
  const [body, shoes, baseNoShoes] = await Promise.all([
    sharp(bodyPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(shoesPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(baseNoShoesPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  const dimensions = [body, shoes, baseNoShoes].map(({ info }) =>
    `${info.width}x${info.height}x${info.channels}`,
  );
  if (new Set(dimensions).size !== 1) {
    throw new Error(`樱酱无鞋合同尺寸不一致：${dimensions.join(' / ')}`);
  }
  for (let offset = 0; offset < shoes.data.length; offset += shoes.info.channels) {
    if (shoes.data[offset + 3] <= 20) continue;
    for (let channel = 0; channel < 4; channel += 1) {
      body.data[offset + channel] = baseNoShoes.data[offset + channel];
    }
  }
  const composited = await sharp(body.data, { raw: body.info }).png().toBuffer();
  await writePng(composited, bodyPath);
}

for (const classId of CLASSES) {
  for (const slot of WEARABLE_SLOTS) {
    const input = resolve(sourceWearableRoot, `${classId}-${slot}.png`);
    const output = resolve(targetWearableRoot, `${classId}-${slot}.png`);
    const recolored = await recolor(input, { protectKenshi: classId === 'kenshi' && slot === 'body' });
    const ornamented = await addClippedOrnament(recolored, slot, classId);
    const silhouette = await addSilhouetteOrnament(ornamented, slot, classId);
    await writePng(await alignWearable(silhouette, slot), output);
  }

  const effectChromaInput = resolve(sourceEffectChromaRoot, `${classId}.png`);
  const effectBaseOutput = resolve(sourceEffectRoot, `${classId}.png`);
  const effectOutput = resolve(effectRoot, `${TARGET_THEME}-${classId}.png`);
  const keyedEffect = await removeGreenChroma(effectChromaInput);
  const resizedEffect = await sharp(keyedEffect)
    .resize({ width: 512, height: 512, fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  // Lanczos 会从完全透明像素的隐藏 RGB 取样；缩放后再清一次，避免绿边重新渗回。
  const effect = await removeGreenChroma(resizedEffect);
  await writePng(effect, effectBaseOutput);
  await mkdir(dirname(effectOutput), { recursive: true });
  await sharp(effect)
    // 战斗光效不承担纸娃娃逐像素锚点；256 色 RGBA 调色板保留透明渐变，
    // 同时把 512px 资源压进全仓 185KB 移动端硬上限。
    .png({ compressionLevel: 9, palette: true, colours: 256, dither: 0.4, effort: 10 })
    .toFile(effectOutput);
}

// 樱酱 body 是整身 replacement，而冰雪鞋是独立可穿层。鞋层实际覆盖的每个像素都必须
// 回到 base-noshoes，不能靠吞掉 shoes 图层掩盖旧鞋；否则商品买到后会形成双鞋。
await removeKenshiEmbeddedShoes();

for (const fileName of ICON_FILES) {
  const input = resolve(sourceIconRoot, fileName);
  const output = resolve(targetIconRoot, fileName);
  const recolored = await recolor(input);
  const ornamented = await addClippedOrnament(
    recolored,
    fileName.startsWith('weapon-') ? 'weapon' : fileName.replace('.png', ''),
    'swordsman',
  );
  const strongIceCore = fileName === 'weapon-swordsman.png' || fileName === 'weapon-witch.png';
  await writePng(await addIconContrast(ornamented, { strongIceCore }), output);
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
