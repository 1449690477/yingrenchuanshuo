/** 「冰雪华年」资产静态门禁：规格、透明度、锚点与新旧可辨识度。 */
import { stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const CLASSES = ['swordsman', 'witch', 'shaman', 'catkin', 'kenshi'];
const SLOTS = ['body', 'head', 'shoes', 'weapon'];
const ICON_FILES = [
  'belt.png', 'body.png', 'bracelet.png', 'head.png', 'necklace.png', 'ring.png', 'shoes.png',
  ...CLASSES.map((classId) => `weapon-${classId}.png`),
];
const failures = [];

function fail(message) {
  failures.push(message);
}

async function inspectRgba(path, expected, maxBytes) {
  const [metadata, fileInfo, raw] = await Promise.all([
    sharp(path).metadata(),
    stat(path),
    sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (metadata.width !== expected.width || metadata.height !== expected.height) {
    fail(`${path}: ${metadata.width}×${metadata.height}，应为 ${expected.width}×${expected.height}`);
  }
  if (!metadata.hasAlpha) fail(`${path}: 缺少透明通道`);
  if (fileInfo.size > maxBytes) fail(`${path}: ${fileInfo.size} B 超过 ${maxBytes} B`);
  let opaque = 0;
  for (let offset = 3; offset < raw.data.length; offset += 4) {
    if (raw.data[offset] > 16) opaque += 1;
  }
  const ratio = opaque / (raw.info.width * raw.info.height);
  if (ratio < 0.002 || ratio > 0.78) fail(`${path}: 非透明像素比例异常 ${ratio.toFixed(4)}`);
  return raw;
}

async function inspectWhiteBackgroundContrast(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let visible = 0;
  let luminanceSum = 0;
  let nearWhite = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    const alpha = data[offset + 3] / 255;
    if (alpha <= 0.06) continue;
    const r = data[offset] * alpha + 255 * (1 - alpha);
    const g = data[offset + 1] * alpha + 255 * (1 - alpha);
    const b = data[offset + 2] * alpha + 255 * (1 - alpha);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    visible += 1;
    luminanceSum += luminance;
    if (luminance > 235) nearWhite += 1;
  }
  const mean = visible ? luminanceSum / visible : 255;
  const nearWhiteRatio = visible ? nearWhite / visible : 1;
  if (mean > 228 || nearWhiteRatio > 0.45) {
    fail(
      `${path}: 白底对比不足 meanLum=${mean.toFixed(1)} nearWhite=${(
        nearWhiteRatio * 100
      ).toFixed(1)}%（要求 <=228 / <=45%）`,
    );
  }
  if (info.width !== 256 || info.height !== 256) fail(`${path}: 白底门禁只接受 256×256 图标`);
}

async function compareWearableAlpha(source, target, slot) {
  const expected = slot === 'head'
    ? sharp(source)
        .extract({ left: 0, top: 0, width: 640, height: 180 })
        .resize({ width: 640, height: 100, fit: 'fill', kernel: sharp.kernel.lanczos3 })
        .extend({ bottom: 860, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    : sharp(source);
  const [a, b] = await Promise.all([
    expected.ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(target).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  let alphaMismatch = 0;
  let colorDelta = 0;
  let visible = 0;
  for (let offset = 0; offset < a.data.length; offset += 4) {
    if (a.data[offset + 3] !== b.data[offset + 3]) alphaMismatch += 1;
    if (a.data[offset + 3] > 16) {
      visible += 1;
      colorDelta += Math.abs(a.data[offset] - b.data[offset]);
      colorDelta += Math.abs(a.data[offset + 1] - b.data[offset + 1]);
      colorDelta += Math.abs(a.data[offset + 2] - b.data[offset + 2]);
    }
  }
  if (alphaMismatch !== 0) fail(`${target}: Alpha 锚点与校准母版不一致（${alphaMismatch} 像素）`);
  const mae = visible ? colorDelta / (visible * 3) : 0;
  if (mae < 24) fail(`${target}: 与绯夜母版色差过小（MAE ${mae.toFixed(2)}）`);
}

for (const classId of CLASSES) {
  for (const slot of SLOTS) {
    const target = resolve(ROOT, `public/assets/characters/modular/shop/ice-snow/${classId}-${slot}.png`);
    const source = resolve(ROOT, `art-source/shop/ice-snow/wearable-base/${classId}-${slot}.png`);
    await inspectRgba(target, { width: 640, height: 960 }, 340_000);
    await compareWearableAlpha(source, target, slot);
  }
  await inspectRgba(
    resolve(ROOT, `public/assets/effects/boutique/ice-snow-${classId}.png`),
    { width: 512, height: 512 },
    260_000,
  );
}

for (const fileName of ICON_FILES) {
  const iconPath = resolve(ROOT, `public/assets/equipment/shop/ice-snow/${fileName}`);
  await inspectRgba(
    iconPath,
    { width: 256, height: 256 },
    125_000,
  );
  await inspectWhiteBackgroundContrast(iconPath);
}
const kenshiBodyIcon = resolve(
  ROOT,
  'public/assets/equipment/bodies/boutique-ice-snow-body/kenshi.png',
);
await inspectRgba(
  kenshiBodyIcon,
  { width: 256, height: 256 },
  160_000,
);
await inspectWhiteBackgroundContrast(kenshiBodyIcon);

const scene = resolve(ROOT, 'public/assets/shops/ice-snow-shelf.webp');
const [sceneMetadata, sceneInfo] = await Promise.all([sharp(scene).metadata(), stat(scene)]);
if (sceneMetadata.width !== 960 || sceneMetadata.height !== 640 || sceneMetadata.format !== 'webp') {
  fail(`${scene}: 必须是 960×640 WebP`);
}
if (sceneInfo.size > 430_000) fail(`${scene}: ${sceneInfo.size} B 超过 430000 B`);

if (failures.length) {
  console.error(`冰雪华年资产门禁失败（${failures.length} 项）：`);
  for (const message of failures) console.error(`- ${message}`);
  process.exitCode = 1;
} else {
  console.log('冰雪华年资产门禁通过：20 穿戴层锚点一致（帽区 180→100px 实机校正），13 图标、5 特效、1 货架规格全绿。');
}
