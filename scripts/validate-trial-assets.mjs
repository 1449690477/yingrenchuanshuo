/**
 * 周常试炼美术门禁。独立运行：
 *   node scripts/validate-trial-assets.mjs
 */
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const ROOT = resolve(import.meta.dirname, '..');
const RUNTIME_ROOT = resolve(ROOT, 'public/assets/trial');
const SOURCE_ROOT = resolve(ROOT, 'art-source/trial');
const ELEMENTS = ['fire', 'ice', 'thunder'];
const GROUPS = ['shell', 'mirage', 'fury'];
const hashes = new Set();
const errors = [];

await validateScene();
for (const group of GROUPS) {
  await requireSource(`${group}-bosses-chroma.png`);
  for (const element of ELEMENTS) {
    await requireSource(`${group}-${element}-alpha.png`);
    await validateBoss(`${group}-${element}.webp`);
  }
}

if (hashes.size !== 9) errors.push(`9 只 Boss 运行时像素必须彼此独立，当前仅 ${hashes.size} 份`);
if (errors.length > 0) {
  throw new Error(`试炼资产校验失败：\n- ${errors.join('\n- ')}`);
}
console.log('试炼资产校验通过：1536×1024 场景、9 只 512×512 透明 Boss 均合格。');

async function validateScene() {
  const path = resolve(RUNTIME_ROOT, 'trial-arena.webp');
  const metadata = await sharp(path).metadata();
  const bytes = (await stat(path)).size;
  if (metadata.width !== 1536 || metadata.height !== 1024 || metadata.format !== 'webp') {
    errors.push(`trial-arena.webp 必须是 1536×1024 WebP`);
  }
  if (bytes > 520 * 1024) {
    errors.push(`trial-arena.webp 超过 520KB：${Math.ceil(bytes / 1024)}KB`);
  }
}

async function requireSource(name) {
  const path = resolve(SOURCE_ROOT, name);
  try {
    await stat(path);
  } catch {
    errors.push(`缺少可重建母版：art-source/trial/${name}`);
  }
}

async function validateBoss(name) {
  const path = resolve(RUNTIME_ROOT, name);
  const bytes = (await stat(path)).size;
  const image = sharp(path).ensureAlpha();
  const metadata = await image.metadata();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  if (
    metadata.width !== 512 ||
    metadata.height !== 512 ||
    metadata.format !== 'webp' ||
    metadata.hasAlpha !== true
  ) {
    errors.push(`${name} 必须是 512×512 透明 WebP`);
  }
  if (bytes > 120 * 1024) errors.push(`${name} 超过 120KB：${Math.ceil(bytes / 1024)}KB`);

  let visible = 0;
  let greenResidue = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const alpha = data[i + 3];
    if (alpha <= 12) continue;
    visible++;
    if (data[i + 1] > 190 && data[i] < 80 && data[i + 2] < 90) greenResidue++;
  }
  const coverage = visible / (info.width * info.height);
  if (coverage < 0.12 || coverage > 0.76) {
    errors.push(`${name} 可见像素占比异常：${(coverage * 100).toFixed(1)}%`);
  }
  if (visible > 0 && greenResidue / visible > 0.0005) {
    errors.push(`${name} 仍有明显绿幕残色：${greenResidue}/${visible}`);
  }
  const cornerOffsets = [
    3,
    (info.width - 4) * info.channels + 3,
    ((info.height - 1) * info.width + 0) * info.channels + 3,
    ((info.height - 1) * info.width + info.width - 1) * info.channels + 3,
  ];
  if (cornerOffsets.some((offset) => data[offset] > 12)) {
    errors.push(`${name} 四角必须透明`);
  }
  hashes.add(
    createHash('sha256')
      .update(await readFile(path))
      .digest('hex'),
  );
}
