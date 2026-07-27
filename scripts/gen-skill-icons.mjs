import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const sourceDir = resolve('public/assets/effects');
const outputDir = resolve('public/assets/icons/skills');
const fileNames = [
  'swordsman-attack.png',
  'swordsman-halfmoon.png',
  'swordsman-flame.png',
  'witch-fireball.png',
  'witch-fire-ring.png',
  'witch-lightning.png',
  'shaman-heal.png',
  'shaman-poison.png',
  'shaman-skeleton.png',
];

await mkdir(outputDir, { recursive: true });

for (const fileName of fileNames) {
  await sharp(resolve(sourceDir, fileName))
    .resize(256, 256, { fit: 'cover' })
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toFile(resolve(outputDir, fileName));
}
