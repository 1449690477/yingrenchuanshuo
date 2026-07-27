import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const classId = process.argv[2];
if (!classId) {
  throw new Error('用法：node scripts/resize-aligned-character-layers.mjs <classId>');
}

const sourceDir = resolve(`art-source/characters/modular/${classId}/alpha-master`);
const outputDir = resolve(`public/assets/characters/modular/${classId}`);
const files = (await readdir(sourceDir)).filter((file) => file.endsWith('.png')).sort();

if (files.length !== 7) {
  throw new Error(`${classId} 纸娃娃母版应为 7 张，实际 ${files.length} 张`);
}

for (const fileName of files) {
  await sharp(resolve(sourceDir, fileName))
    .resize(640, 960, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toFile(resolve(outputDir, fileName));
}
