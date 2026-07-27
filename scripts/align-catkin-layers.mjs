import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const sourceDir = resolve('art-source/characters/modular/catkin/alpha-master');
const outputDir = resolve('public/assets/characters/modular/catkin');
const canvas = { width: 640, height: 960 };

await mkdir(outputDir, { recursive: true });

const transparent = () => ({
  create: {
    ...canvas,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
});

async function writeFullCanvas(fileName) {
  await sharp(resolve(sourceDir, fileName))
    .resize(canvas.width, canvas.height, { fit: 'fill' })
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toFile(resolve(outputDir, fileName));
}

async function trimmedBuffer(fileName, width, options = {}) {
  let image = sharp(resolve(sourceDir, fileName)).trim({
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  if (options.flip) image = image.flop();
  return image
    .resize({ width, withoutEnlargement: false })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function writePlaced(fileName, layers) {
  const composites = [];
  for (const layer of layers) {
    const input =
      layer.input ??
      (await trimmedBuffer(fileName, layer.width, {
        flip: layer.flip,
      }));
    composites.push({ input, left: layer.left, top: layer.top });
  }
  await sharp(transparent())
    .composite(composites)
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toFile(resolve(outputDir, fileName));
}

async function halfWeapon(side, width) {
  const metadata = await sharp(resolve(sourceDir, 'r1-weapon.png')).metadata();
  const sourceWidth = metadata.width ?? 1024;
  const sourceHeight = metadata.height ?? 1536;
  const halfWidth = Math.floor(sourceWidth / 2);
  const left = side === 'left' ? 0 : halfWidth;
  const extractWidth = side === 'left' ? halfWidth : sourceWidth - halfWidth;
  const extracted = await sharp(resolve(sourceDir, 'r1-weapon.png'))
    .extract({ left, top: 0, width: extractWidth, height: sourceHeight })
    .png()
    .toBuffer();
  return sharp(extracted)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ width, withoutEnlargement: false })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

await Promise.all([
  writeFullCanvas('base.png'),
  writeFullCanvas('r1-body.png'),
  writeFullCanvas('r2-body.png'),
]);

// 猫灵的猫耳、双眼与蓝色泪滴是不可遮挡的职业识别点。
// R1 花环缩成额顶小冠，R2 草帽缩成右侧斜戴小帽；禁止用宽帽压住整张脸。
await writePlaced('r1-head.png', [{ width: 180, left: 230, top: -4 }]);
await writePlaced('r2-head.png', [{ width: 172, left: 300, top: 2 }]);

await writePlaced('r1-weapon.png', [
  { input: await halfWeapon('left', 132), left: 125, top: 364 },
  { input: await halfWeapon('right', 138), left: 424, top: 257 },
]);

await writePlaced('r2-weapon.png', [
  { width: 224, left: 45, top: 168, flip: true },
]);
