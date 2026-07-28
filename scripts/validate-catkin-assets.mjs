import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const characterFiles = [
  'public/assets/characters/catkin-sakura.png',
  'public/assets/characters/catkin-sakura-cast.png',
  ...['base', 'r1-body', 'r1-head', 'r1-weapon', 'r2-body', 'r2-head', 'r2-weapon'].map(
    (name) => `public/assets/characters/modular/catkin/${name}.png`,
  ),
  ...['berry-cream', 'moon-sugar', 'rose-night'].flatMap((theme) =>
    ['body', 'head', 'shoes', 'weapon'].map(
      (slot) => `public/assets/characters/modular/shop/${theme}/catkin-${slot}.png`,
    ),
  ),
  'public/assets/characters/modular/shop/cardboard-cat/catkin-body.png',
  'public/assets/characters/modular/shop/cardboard-cat/catkin-weapon.png',
];

const effectNames = [
  'paw-combo',
  'light-pounce',
  'scratch-frenzy',
  'bristle-counter',
  'tail-sweep',
  'box-ambush',
  'nine-life-spin',
  'moonshadow-step',
  'furball-storm',
  'hundred-claw',
];
const effectFiles = [
  'public/assets/effects/basic/catkin-paw.png',
  ...effectNames.map((name) => `public/assets/effects/catkin-${name}.png`),
  ...['berry-cream', 'moon-sugar', 'rose-night'].map(
    (theme) => `public/assets/effects/boutique/${theme}-catkin.png`,
  ),
  'public/assets/effects/boutique/cardboard-cat-catkin.png',
];

const iconFiles = [
  ...effectNames.map((name) => `public/assets/icons/skills/catkin-${name}.png`),
  ...['keen-whiskers', 'nimble-step', 'claw-mark', 'hunting-instinct'].map(
    (name) => `public/assets/icons/skills/catkin-${name}.png`,
  ),
  ...['berry-cream', 'moon-sugar', 'rose-night'].map(
    (theme) => `public/assets/equipment/shop/${theme}/weapon-catkin.png`,
  ),
  'public/assets/equipment/shop/cardboard-cat/body-catkin.png',
  'public/assets/equipment/shop/cardboard-cat/weapon-catkin.png',
];

const sourceFiles = [
  ...[
    'paw-combo',
    'light-pounce',
    'scratch-frenzy',
    'bristle-counter',
    'tail-sweep',
    'box-ambush',
    'nine-life-spin',
    'moonshadow-step',
    'furball-storm',
    'hundred-claw',
    'basic-attack',
    'passive-icons',
  ].map((name) => `art-source/effects/catkin/${name}-alpha.png`),
  ...['berry-cream', 'moon-sugar', 'rose-night'].map(
    (theme) => `art-source/shop/${theme}/catkin-effect-alpha.png`,
  ),
  ...['body', 'weapon', 'effect'].map(
    (name) => `art-source/shop/cardboard-cat/catkin-${name}-alpha.png`,
  ),
];

function specFor(file) {
  if (sourceFiles.includes(file)) return { width: null, height: null, maxBytes: null };
  if (characterFiles.includes(file)) return { width: 640, height: 960, maxBytes: 550 * 1024 };
  if (effectFiles.includes(file)) return { width: 512, height: 512, maxBytes: 250 * 1024 };
  return { width: 256, height: 256, maxBytes: 120 * 1024 };
}

async function validate(file) {
  const absolute = resolve(file);
  const [metadata, fileInfo, raw] = await Promise.all([
    sharp(absolute).metadata(),
    stat(absolute),
    sharp(absolute).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  const spec = specFor(file);
  if (
    (spec.width !== null && metadata.width !== spec.width) ||
    (spec.height !== null && metadata.height !== spec.height)
  ) {
    throw new Error(`${file} 尺寸错误：${metadata.width}×${metadata.height}`);
  }
  if (metadata.channels !== 4) throw new Error(`${file} 必须是 RGBA`);
  if (spec.maxBytes !== null && fileInfo.size > spec.maxBytes) {
    throw new Error(`${file} 体积 ${fileInfo.size} 超过 ${spec.maxBytes}`);
  }

  const { data, info } = raw;
  const cornerOffsets = [
    0,
    (info.width - 1) * 4,
    (info.height - 1) * info.width * 4,
    (info.height * info.width - 1) * 4,
  ];
  if (cornerOffsets.some((offset) => data[offset + 3] !== 0)) {
    throw new Error(`${file} 四角不是完全透明`);
  }

  let visiblePixels = 0;
  let chromaPixels = 0;
  let nearBlackOpaquePixels = 0;
  let middleShoePixels = 0;
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const alpha = data[offset + 3];
    const pixel = offset / 4;
    const x = pixel % info.width;
    const y = Math.floor(pixel / info.width);
    if (alpha > 8) {
      visiblePixels++;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    if (alpha > 240 && red < 12 && green < 12 && blue < 12) nearBlackOpaquePixels++;
    if (file.endsWith('/catkin-shoes.png') && x >= 295 && x <= 344 && alpha > 16) {
      middleShoePixels++;
    }
    if (alpha > 0 && green > 120 && green > red * 1.35 && green > blue * 1.35) {
      chromaPixels++;
    }
  }
  if (visiblePixels === 0) throw new Error(`${file} 没有可见主体`);
  if (chromaPixels > 0) throw new Error(`${file} 有 ${chromaPixels} 个绿幕污染像素`);

  if (file.includes('/equipment/shop/') && file.endsWith('/weapon-catkin.png')) {
    if (nearBlackOpaquePixels > 500) {
      throw new Error(`${file} 有 ${nearBlackOpaquePixels} 个近纯黑不透明像素，疑似 contain 黑边`);
    }
  }
  if (file.endsWith('/catkin/r1-head.png') || file.endsWith('/catkin/r2-head.png')) {
    if (maxY > 110 || maxX - minX + 1 > 200) {
      throw new Error(`${file} 帽饰范围 [${minX},${minY},${maxX},${maxY}] 会遮挡猫耳或脸`);
    }
  }
  if (file.endsWith('/catkin-shoes.png') && middleShoePixels > 0) {
    throw new Error(`${file} 两鞋之间有 ${middleShoePixels} 个悬空像素`);
  }
}

const runtimeFiles = [...characterFiles, ...effectFiles, ...iconFiles];
if (new Set(runtimeFiles).size !== 57) {
  throw new Error(`喵喵运行时资产清单应为 57 个，当前为 ${new Set(runtimeFiles).size}`);
}

for (const file of [...runtimeFiles, ...sourceFiles]) await validate(file);

console.log(`喵喵资产审计通过：57 个运行时文件 + ${sourceFiles.length} 个透明母版`);
