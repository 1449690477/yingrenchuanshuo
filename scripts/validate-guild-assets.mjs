/** 公会团本美术门禁。独立运行：node scripts/validate-guild-assets.mjs */
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const ROOT = resolve(import.meta.dirname, '..');
const sourcePath = resolve(ROOT, 'art-source/guild/guild-expedition-arena.png');
const runtimePath = resolve(ROOT, 'public/assets/guild/guild-expedition-arena.webp');
const errors = [];

try {
  const source = await sharp(sourcePath).metadata();
  if (!source.width || !source.height || source.width / source.height < 1.45) {
    errors.push('ImageGen 母版必须是可裁成 3:2 的横版场景');
  }
} catch {
  errors.push('缺少 art-source/guild/guild-expedition-arena.png');
}

try {
  const runtime = await sharp(runtimePath).metadata();
  const bytes = (await stat(runtimePath)).size;
  if (runtime.width !== 1536 || runtime.height !== 1024 || runtime.format !== 'webp') {
    errors.push('guild-expedition-arena.webp 必须是 1536×1024 WebP');
  }
  if (bytes > 520 * 1024) {
    errors.push(`guild-expedition-arena.webp 超过 520KB：${Math.ceil(bytes / 1024)}KB`);
  }
} catch {
  errors.push('缺少 public/assets/guild/guild-expedition-arena.webp');
}

if (errors.length > 0) throw new Error(`公会团本资产校验失败：\n- ${errors.join('\n- ')}`);
console.log('公会团本资产校验通过：1536×1024 场景存在、格式与体积合格。');
