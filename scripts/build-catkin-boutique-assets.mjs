import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const themes = ['berry-cream', 'moon-sugar', 'rose-night'];
const characterRoot = resolve('public/assets/characters/modular/shop');
const equipmentRoot = resolve('public/assets/equipment/shop');
const sourceRoot = resolve('art-source/shop');
const shoePlacements = {
  'berry-cream': {
    left: { x: 190, y: 753 },
    right: { x: 366, y: 752 },
  },
  'moon-sugar': {
    left: { x: 201, y: 767 },
    right: { x: 372, y: 767 },
  },
  'rose-night': {
    left: { x: 185, y: 754 },
    right: { x: 345, y: 754 },
  },
};

async function transparentCanvas(width, height) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });
}

async function copyCleanLayer(source, output) {
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 已完全透明或只剩编码噪声的像素必须清成透明黑，避免缩放时把旧绿幕颜色插值回来。
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] <= 16) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
    }
  }

  await sharp(data, { raw: info })
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toFile(output);
}

async function weaponHalf(source, side, width) {
  const metadata = await sharp(source).metadata();
  const sourceWidth = metadata.width ?? 1024;
  const sourceHeight = metadata.height ?? 1536;
  const halfWidth = Math.floor(sourceWidth / 2);
  const left = side === 'left' ? 0 : halfWidth;
  const extractWidth = side === 'left' ? halfWidth : sourceWidth - halfWidth;
  const extracted = await sharp(source)
    .extract({ left, top: 0, width: extractWidth, height: sourceHeight })
    .png()
    .toBuffer();
  return sharp(extracted)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ width, withoutEnlargement: false })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function shoePair(source) {
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const gaps = [];
  let gapStart = null;
  for (let x = 0; x < info.width; x += 1) {
    let opaque = false;
    for (let y = 0; y < info.height; y += 1) {
      if (data[(y * info.width + x) * info.channels + 3] > 16) {
        opaque = true;
        break;
      }
    }
    if (!opaque && gapStart === null) gapStart = x;
    if (opaque && gapStart !== null) {
      gaps.push({ start: gapStart, end: x - 1 });
      gapStart = null;
    }
  }
  if (gapStart !== null) gaps.push({ start: gapStart, end: info.width - 1 });

  const centerGap = gaps
    .filter(
      (gap) => gap.start >= info.width * 0.25 && gap.end <= info.width * 0.75,
    )
    .sort(
      (a, b) =>
        Math.abs((a.start + a.end) / 2 - info.width / 2) -
        Math.abs((b.start + b.end) / 2 - info.width / 2),
    )[0];
  if (!centerGap) {
    throw new Error(`[喵喵精品鞋] ${source} 的两只鞋之间没有透明分隔带`);
  }

  const leftWidth = centerGap.start;
  const rightLeft = centerGap.end + 1;
  const halves = await Promise.all([
    sharp(source)
      .extract({ left: 0, top: 0, width: leftWidth, height: info.height })
      .png()
      .toBuffer(),
    sharp(source)
      .extract({
        left: rightLeft,
        top: 0,
        width: info.width - rightLeft,
        height: info.height,
      })
      .png()
      .toBuffer(),
  ]);
  return Promise.all(
    halves.map((half) =>
      sharp(half)
        .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ compressionLevel: 9 })
        .toBuffer(),
    ),
  );
}

for (const theme of themes) {
  const characterDir = resolve(characterRoot, theme);
  const equipmentDir = resolve(equipmentRoot, theme);
  const source = resolve(sourceRoot, theme, 'catkin-weapon-alpha.png');
  await Promise.all([
    mkdir(characterDir, { recursive: true }),
    mkdir(equipmentDir, { recursive: true }),
  ]);

  // 猫灵与魔女底模肩宽、腰线和脚底锚点一致；三件通用衣装复用成熟层，
  // 只为猫灵单独生产能读出职业特色的双爪武器。
  await Promise.all(
    ['body', 'head'].map((slot) =>
      copyCleanLayer(
        resolve(characterDir, `witch-${slot}.png`),
        resolve(characterDir, `catkin-${slot}.png`),
      ),
    ),
  );

  const [leftWeapon, rightWeapon] = await Promise.all([
    weaponHalf(source, 'left', 132),
    weaponHalf(source, 'right', 138),
  ]);

  await (
    await transparentCanvas(640, 960)
  )
    .composite([
      { input: leftWeapon, left: 125, top: 364 },
      { input: rightWeapon, left: 424, top: 257 },
    ])
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toFile(resolve(characterDir, 'catkin-weapon.png'));

  const [leftShoe, rightShoe] = await shoePair(resolve(characterDir, 'witch-shoes.png'));
  const placement = shoePlacements[theme];
  await (
    await transparentCanvas(640, 960)
  )
    .composite([
      { input: leftShoe, left: placement.left.x, top: placement.left.y },
      { input: rightShoe, left: placement.right.x, top: placement.right.y },
    ])
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toFile(resolve(characterDir, 'catkin-shoes.png'));

  const iconWeapon = await sharp(leftWeapon)
    .rotate(-10, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(222, 222, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await (
    await transparentCanvas(256, 256)
  )
    .composite([{ input: iconWeapon, left: 17, top: 17 }])
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toFile(resolve(equipmentDir, 'weapon-catkin.png'));
}
