/** 公会团本专用 3:2 战场构建。 */
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const ROOT = resolve(import.meta.dirname, '..');
const SOURCE = resolve(ROOT, 'art-source/guild/guild-expedition-arena.png');
const RUNTIME_ROOT = resolve(ROOT, 'public/assets/guild');

await mkdir(RUNTIME_ROOT, { recursive: true });
await sharp(SOURCE)
  .resize(1536, 1024, { fit: 'cover', position: 'centre' })
  .webp({ quality: 80, effort: 6, smartSubsample: true })
  .toFile(resolve(RUNTIME_ROOT, 'guild-expedition-arena.webp'));

console.log('公会团本战场构建完成：1536×1024 WebP。');
