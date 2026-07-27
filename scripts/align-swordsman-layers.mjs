import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const sourceDir = resolve('art-source/characters/modular/swordsman/alpha-unscaled');
const outputDir = resolve('public/assets/characters/modular/swordsman');
const canvas = { width: 640, height: 960 };

const layers = {
  'r1-body.png': { scale: 0.55, x: 0, y: -13.4 },
  'r2-body.png': { scale: 0.55, x: 0, y: -13.4 },
  'r1-head.png': { scale: 0.55, x: 0, y: -25 },
  'r2-head.png': { scale: 0.62, x: 0, y: -22.4 },
  'r1-weapon.png': { scale: 0.4, x: -25, y: 0 },
  'r2-weapon.png': { scale: 0.3, x: -31, y: -12, flop: true },
};

await mkdir(outputDir, { recursive: true });

await sharp(resolve(sourceDir, 'base.png'))
  .resize(canvas.width, canvas.height, { fit: 'fill' })
  .png({ compressionLevel: 9 })
  .toFile(resolve(outputDir, 'base.png'));

for (const [fileName, placement] of Object.entries(layers)) {
  const width = Math.round(canvas.width * placement.scale);
  const height = Math.round(canvas.height * placement.scale);
  const left = Math.round((canvas.width - width) / 2 + (canvas.width * placement.x) / 100);
  const top = Math.round((canvas.height - height) / 2 + (canvas.height * placement.y) / 100);
  const pipeline = sharp(resolve(sourceDir, fileName));
  if (placement.flop) pipeline.flop();
  const layer = await pipeline.resize(width, height, { fit: 'fill' }).png().toBuffer();

  await sharp({
    create: {
      width: canvas.width,
      height: canvas.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: layer, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(resolve(outputDir, fileName));
}
