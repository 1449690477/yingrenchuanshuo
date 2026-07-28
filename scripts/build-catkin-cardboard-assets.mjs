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

console.log('纸箱键帽摸鱼套已生成：2 个角色层、2 个装备图标、1 个攻击特效、1 张整身 QA');
