/** 「冰雪华年」资产静态门禁：规格、透明度、锚点与新旧可辨识度。 */
import { access, stat } from 'node:fs/promises';
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
const LEGACY_EFFECT_THEMES = ['berry-cream', 'moon-sugar', 'rose-night', 'cardboard-cat'];
// 穿戴层共享人体锚点，合法独立设计的 IoU 天然高于特效；独立新图最高 0.886，
// 旧层经平移 / 97% 缩放 / 镜像后的伪装复制最低 0.966，因此单独定标为 0.95。
const WEARABLE_SHAPE_REUSE_THRESHOLD = 0.95;
// 实测锚点：独立新图对旧主题最大 0.589；旧图平移 10×7px / 缩放 97% /
// 水平镜像后的伪装复制最低 0.870。0.82 位于两组证据之间，不是拍脑袋常量。
const EFFECT_SHAPE_REUSE_THRESHOLD = 0.82;
const failures = [];
const effectShapeEvidence = [];
const effectShapeCalibration = [];
const wearableShapeEvidence = [];
const wearableShapeCalibration = [];

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
  let chromaSum = 0;
  let nearWhite = 0;
  let dark = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    const alpha = data[offset + 3] / 255;
    if (alpha <= 0.06) continue;
    const r = data[offset] * alpha + 255 * (1 - alpha);
    const g = data[offset + 1] * alpha + 255 * (1 - alpha);
    const b = data[offset + 2] * alpha + 255 * (1 - alpha);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    visible += 1;
    luminanceSum += luminance;
    chromaSum += chroma;
    if (luminance > 235) nearWhite += 1;
    if (luminance <= 200) dark += 1;
  }
  const mean = visible ? luminanceSum / visible : 255;
  const meanChroma = visible ? chromaSum / visible : 0;
  const nearWhiteRatio = visible ? nearWhite / visible : 1;
  const darkRatio = visible ? dark / visible : 0;
  if (mean > 228 || nearWhiteRatio > 0.45) {
    fail(
      `${path}: 白底对比不足 meanLum=${mean.toFixed(1)} nearWhite=${(
        nearWhiteRatio * 100
      ).toFixed(1)}%（要求 <=228 / <=45%）`,
    );
  }
  // 真商店卡片里的图标只有约 58px：近白、低色差且缺少暗部的细武器会融进玻璃底。
  // 三轴必须同时越线才拒绝，避免误伤本来明亮、但仍有连续蓝色或暗部轮廓的冰雪饰品。
  if (mean > 205 && meanChroma < 16 && darkRatio < 0.4) {
    fail(
      `${path}: 58px 白底可读性不足 meanLum=${mean.toFixed(2)} meanChroma=${meanChroma.toFixed(1)} darkRatio=${(darkRatio * 100).toFixed(1)}%`,
    );
  }
  if (info.width !== 256 || info.height !== 256) fail(`${path}: 白底门禁只接受 256×256 图标`);
}

function maskedPixelDifference(actual, expected, mask) {
  let checked = 0;
  let premultipliedError = 0;
  let alphaError = 0;
  for (let offset = 0; offset < mask.data.length; offset += mask.info.channels) {
    if (mask.data[offset + 3] <= 20) continue;
    checked += 1;
    const actualAlpha = actual.data[offset + 3] / 255;
    const expectedAlpha = expected.data[offset + 3] / 255;
    alphaError += Math.abs(actual.data[offset + 3] - expected.data[offset + 3]);
    for (let channel = 0; channel < 3; channel += 1) {
      premultipliedError += Math.abs(
        actual.data[offset + channel] * actualAlpha -
          expected.data[offset + channel] * expectedAlpha,
      );
    }
  }
  return {
    checked,
    premultipliedMae: premultipliedError / (checked * 3),
    alphaMae: alphaError / checked,
  };
}

async function inspectKenshiNoEmbeddedShoes() {
  const load = (path) => sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [body, baseNoShoes, shoes] = await Promise.all([
    load(resolve(ROOT, 'public/assets/characters/modular/shop/ice-snow/kenshi-body.png')),
    load(resolve(ROOT, 'public/assets/characters/modular/kenshi/base-noshoes.png')),
    load(resolve(ROOT, 'public/assets/characters/modular/shop/ice-snow/kenshi-shoes.png')),
  ]);
  const pixels = maskedPixelDifference(body, baseNoShoes, shoes);
  if (pixels.checked < 2_000) {
    fail(`樱酱冰雪鞋遮罩仅 ${pixels.checked} 像素，无法证明 replacement 已剔除内置鞋`);
  }
  if (pixels.premultipliedMae > 0.1 || pixels.alphaMae > 0.1) {
    fail(
      `樱酱冰雪 body 仍含内置鞋：鞋遮罩 premulMAE=${pixels.premultipliedMae.toFixed(3)} / alphaMAE=${pixels.alphaMae.toFixed(3)}`,
    );
  }
  return pixels;
}

async function alphaShape(input) {
  const rgba = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minX = rgba.info.width;
  let minY = rgba.info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < rgba.info.height; y += 1) {
    for (let x = 0; x < rgba.info.width; x += 1) {
      if (rgba.data[(y * rgba.info.width + x) * 4 + 3] <= 18) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0 || maxY < 0) return { width: 128, height: 128, mask: new Uint8Array(128 * 128) };
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .extractChannel('alpha')
    .resize({
      width: 128,
      height: 128,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0 },
      kernel: sharp.kernel.nearest,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    mask: Uint8Array.from(data, (alpha) => (alpha > 18 ? 1 : 0)),
  };
}

function shiftedIou(a, b, dx, dy) {
  let intersection = 0;
  let union = 0;
  for (let y = 0; y < a.height; y += 1) {
    const by = y + dy;
    for (let x = 0; x < a.width; x += 1) {
      const bx = x + dx;
      const av = a.mask[y * a.width + x];
      const bv = bx >= 0 && bx < b.width && by >= 0 && by < b.height
        ? b.mask[by * b.width + bx]
        : 0;
      if (av && bv) intersection += 1;
      if (av || bv) union += 1;
    }
  }
  return union ? intersection / union : 1;
}

function maxShiftedIou(a, b) {
  let best = 0;
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      best = Math.max(best, shiftedIou(a, b, dx, dy));
    }
  }
  return best;
}

async function assertOriginalEffectShape(classId, currentPath, currentShape, acceptedShapes) {
  let strongestLegacy = { theme: 'none', score: 0 };
  for (const theme of LEGACY_EFFECT_THEMES) {
    const legacyPath = resolve(ROOT, `public/assets/effects/boutique/${theme}-${classId}.png`);
    try {
      await access(legacyPath);
    } catch {
      continue;
    }
    const [legacyShape, mirroredLegacyShape] = await Promise.all([
      alphaShape(legacyPath),
      sharp(legacyPath).flop().png().toBuffer().then(alphaShape),
    ]);
    const score = Math.max(
      maxShiftedIou(currentShape, legacyShape),
      maxShiftedIou(currentShape, mirroredLegacyShape),
    );
    if (score > strongestLegacy.score) strongestLegacy = { theme, score };
    if (score >= EFFECT_SHAPE_REUSE_THRESHOLD) {
      fail(`${currentPath}: 与旧主题 ${theme}-${classId} Alpha 轮廓过度相似（IoU ${score.toFixed(3)}）`);
    }
  }
  for (const [otherClassId, otherShape] of acceptedShapes) {
    const score = maxShiftedIou(currentShape, otherShape);
    if (score >= 0.72) {
      fail(`${currentPath}: 与冰雪 ${otherClassId} 职业特效轮廓过度相似（IoU ${score.toFixed(3)}）`);
    }
  }
  effectShapeEvidence.push(
    `${classId}↔${strongestLegacy.theme}=${strongestLegacy.score.toFixed(3)}`,
  );
}

async function calibrateEffectShapeGate() {
  for (const classId of CLASSES) {
    const legacyPath = resolve(ROOT, `public/assets/effects/boutique/rose-night-${classId}.png`);
    const metadata = await sharp(legacyPath).metadata();
    const width = metadata.width ?? 512;
    const height = metadata.height ?? 512;
    const reference = await alphaShape(legacyPath);
    const shifted = await sharp(legacyPath)
      .extend({ left: 10, top: 7, right: 0, bottom: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extract({ left: 0, top: 0, width, height })
      .png()
      .toBuffer();
    const scaledWidth = Math.round(width * 0.97);
    const scaledHeight = Math.round(height * 0.97);
    const left = Math.floor((width - scaledWidth) / 2);
    const top = Math.floor((height - scaledHeight) / 2);
    const scaledInner = await sharp(legacyPath)
      .resize({ width: scaledWidth, height: scaledHeight, fit: 'fill' })
      .png()
      .toBuffer();
    const scaled = await sharp(scaledInner)
      .extend({
        left,
        top,
        right: width - scaledWidth - left,
        bottom: height - scaledHeight - top,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    const mirrored = await sharp(legacyPath).flop().png().toBuffer();
    const mirroredReference = await alphaShape(mirrored);
    const scores = {
      shifted: maxShiftedIou(reference, await alphaShape(shifted)),
      scaled: maxShiftedIou(reference, await alphaShape(scaled)),
      mirrored: Math.max(
        maxShiftedIou(mirroredReference, reference),
        maxShiftedIou(mirroredReference, mirroredReference),
      ),
    };
    const minimum = Math.min(scores.shifted, scores.scaled, scores.mirrored);
    if (minimum < EFFECT_SHAPE_REUSE_THRESHOLD) {
      fail(
        `Alpha 轮廓门禁校准失效 ${classId}: 平移=${scores.shifted.toFixed(3)} 缩放=${scores.scaled.toFixed(3)} 镜像=${scores.mirrored.toFixed(3)}`,
      );
    }
    effectShapeCalibration.push(`${classId}=${minimum.toFixed(3)}`);
  }
}

async function calibrateWearableShapeGate() {
  for (const classId of CLASSES) {
    for (const slot of ['body', 'shoes', 'weapon']) {
      const sourcePath = resolve(ROOT, `art-source/shop/ice-snow/wearable-base/${classId}-${slot}.png`);
      const metadata = await sharp(sourcePath).metadata();
      const width = metadata.width ?? 640;
      const height = metadata.height ?? 960;
      const reference = await alphaShape(sourcePath);
      const mirroredBuffer = await sharp(sourcePath).flop().png().toBuffer();
      const mirroredReference = await alphaShape(mirroredBuffer);
      const scoreCandidate = (candidate) => Math.max(
        maxShiftedIou(candidate, reference),
        maxShiftedIou(candidate, mirroredReference),
      );
      const shifted = await sharp(sourcePath)
        .extend({ left: 10, top: 7, right: 0, bottom: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .extract({ left: 0, top: 0, width, height })
        .png()
        .toBuffer();
      const scaledWidth = Math.round(width * 0.97);
      const scaledHeight = Math.round(height * 0.97);
      const left = Math.floor((width - scaledWidth) / 2);
      const top = Math.floor((height - scaledHeight) / 2);
      const scaledInner = await sharp(sourcePath)
        .resize({ width: scaledWidth, height: scaledHeight, fit: 'fill' })
        .png()
        .toBuffer();
      const scaled = await sharp(scaledInner)
        .extend({
          left,
          top,
          right: width - scaledWidth - left,
          bottom: height - scaledHeight - top,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
      const scores = {
        shifted: scoreCandidate(await alphaShape(shifted)),
        scaled: scoreCandidate(await alphaShape(scaled)),
        mirrored: scoreCandidate(mirroredReference),
      };
      const minimum = Math.min(scores.shifted, scores.scaled, scores.mirrored);
      if (minimum < WEARABLE_SHAPE_REUSE_THRESHOLD) {
        fail(
          `穿戴轮廓门禁校准失效 ${classId}-${slot}: 平移=${scores.shifted.toFixed(3)} 缩放=${scores.scaled.toFixed(3)} 镜像=${scores.mirrored.toFixed(3)}`,
        );
      }
      wearableShapeCalibration.push(`${classId}-${slot}=${minimum.toFixed(3)}`);
    }
  }
}

function assertNoChromaSpill(path, raw) {
  let visible = 0;
  let polluted = 0;
  for (let offset = 0; offset < raw.data.length; offset += 4) {
    if (raw.data[offset + 3] <= 8) continue;
    visible += 1;
    const dominance = raw.data[offset + 1] - Math.max(raw.data[offset], raw.data[offset + 2]);
    if (raw.data[offset + 1] > 120 && dominance > 35) polluted += 1;
  }
  if (polluted > 0) fail(`${path}: 仍有 ${polluted}/${visible} 个绿幕污染像素`);
}

async function compareWearableAlpha(source, target, slot, classId) {
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
  if (slot === 'head') {
    if (alphaMismatch !== 0) fail(`${target}: 帽层 Alpha 锚点与校准母版不一致（${alphaMismatch} 像素）`);
  } else {
    if (alphaMismatch === 0) fail(`${target}: 与旧精品母版 Alpha 轮廓完全相同，属于换色复用`);
    const [sourceShape, mirroredSourceShape, targetShape] = await Promise.all([
      alphaShape(source),
      sharp(source).flop().png().toBuffer().then(alphaShape),
      alphaShape(target),
    ]);
    const score = Math.max(
      maxShiftedIou(sourceShape, targetShape),
      maxShiftedIou(mirroredSourceShape, targetShape),
    );
    wearableShapeEvidence.push(`${classId}-${slot}=${score.toFixed(3)}`);
    if (score >= WEARABLE_SHAPE_REUSE_THRESHOLD) {
      fail(`${target}: 与旧精品母版 Alpha 轮廓过度相似（IoU ${score.toFixed(3)}）`);
    }
  }
  const mae = visible ? colorDelta / (visible * 3) : 0;
  if (mae < 24) fail(`${target}: 与绯夜母版色差过小（MAE ${mae.toFixed(2)}）`);
}

await calibrateEffectShapeGate();
await calibrateWearableShapeGate();
const acceptedEffectShapes = new Map();
for (const classId of CLASSES) {
  for (const slot of SLOTS) {
    const target = resolve(ROOT, `public/assets/characters/modular/shop/ice-snow/${classId}-${slot}.png`);
    const source = resolve(ROOT, `art-source/shop/ice-snow/wearable-base/${classId}-${slot}.png`);
    await inspectRgba(target, { width: 640, height: 960 }, 340_000);
    await compareWearableAlpha(source, target, slot, classId);
  }
  const effectPath = resolve(ROOT, `public/assets/effects/boutique/ice-snow-${classId}.png`);
  const effectRaw = await inspectRgba(
    effectPath,
    { width: 512, height: 512 },
    520_000,
  );
  assertNoChromaSpill(effectPath, effectRaw);
  const currentShape = await alphaShape(effectPath);
  await assertOriginalEffectShape(classId, effectPath, currentShape, acceptedEffectShapes);
  acceptedEffectShapes.set(classId, currentShape);
}

const kenshiShoeContract = await inspectKenshiNoEmbeddedShoes();

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
  console.log(
    `樱酱无内置鞋合同通过：冰雪鞋遮罩 ${kenshiShoeContract.checked} 像素，premulMAE=${kenshiShoeContract.premultipliedMae.toFixed(3)}，alphaMAE=${kenshiShoeContract.alphaMae.toFixed(3)}。`,
  );
  console.log(
    `冰雪华年资产门禁通过：20 穿戴层锚点一致（帽区 180→100px 实机校正），13 图标、5 原创特效、1 货架规格全绿；旧主题 Alpha 轮廓最大 IoU：${effectShapeEvidence.join('，')}；伪装复制最低锚点：${effectShapeCalibration.join('，')}。`,
    `冰雪 15 张衣裙/鞋/武器新轮廓 IoU：${wearableShapeEvidence.join('，')}。`,
    `穿戴伪装复制最低锚点：${wearableShapeCalibration.join('，')}。`,
  );
}
