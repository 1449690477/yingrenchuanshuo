/** 「冰雪华年」资产静态门禁：规格、透明度、锚点与新旧可辨识度。 */
import { access, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  ARTIFACT_ALPHA_CLEAR,
  ARTIFACT_LINE_COLUMNS,
  CUT_LINES,
  KENSHI_PASTE_Y,
  bboxOf,
  computeBodyRemovalMask,
  computeShoeShift,
  computeWeaponAlign,
  inFaceEllipse,
  rawRgba,
  translate,
} from './ice-snow-fix-params.mjs';

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
const wearableFidelityEvidence = [];
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

/**
 * 2026-08-04 合同换代：旧「无内置鞋合同」把鞋遮罩区回填 base-noshoes——
 * 对 v1 母版是对的（v1 把靴子画进身体）；v2 母版是及地长裙、无内置鞋，
 * 鞋遮罩（高筒靴）与裙面重叠，回填等于把裙布当靴子挖穿（y740 行不透明宽
 * 521→355px，老板线上单件试穿实测露腿）。现行构型=底模垫层
 * （build 的 underlayKenshiBase）：裙面保真由 compareWearableAlpha 承担，
 * 这里验两条实测锚定的完整性探针，两侧都有背书：
 * ① 裙宽完整：y=740 行不透明宽度 ≥480（母版实测 521；挖洞事故时 355）；
 * ② 单穿有脚：y=860 行不透明宽度 ≥30（垫层后实测约 63；漏垫层则 0 悬空）。
 */
async function inspectKenshiDressIntegrity() {
  const { data, info } = await sharp(
    resolve(ROOT, 'public/assets/characters/modular/shop/ice-snow/kenshi-body.png'),
  )
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rowWidth = (y) => {
    let n = 0;
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] > 128) n += 1;
    }
    return n;
  };
  const skirt = rowWidth(740);
  const feet = rowWidth(860);
  if (skirt < 480) {
    fail(`樱酱冰雪长裙 y740 行不透明宽度仅 ${skirt}px（应 ≥480）——裙面疑似被鞋区处理挖穿`);
  }
  if (feet < 30) {
    fail(`樱酱冰雪单穿 y860 行不透明宽度仅 ${feet}px（应 ≥30）——底模垫层缺失，单穿会悬空无脚`);
  }
  return { skirt, feet };
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


/**
 * 全新母版工作流下的防抄袭承接（2026-08-03，复核：小Q）：
 * 成品与**每一个旧精品主题**的同槽件比轮廓（含镜像/平移），≥阈值即拒 ——
 * 「不许把任何旧主题的剪影拿来换色」这层意图原样保留；
 * 另与绯夜同槽件比可见区色差，MAE < 24 即拒（防对绯夜的贴色复刻）。
 */
async function compareAgainstLegacyThemes(target, slot, classId) {
  const targetShape = await alphaShape(target);
  for (const theme of LEGACY_EFFECT_THEMES) {
    const legacyPath = resolve(
      ROOT,
      `public/assets/characters/modular/shop/${theme}/${classId}-${slot}.png`,
    );
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
      maxShiftedIou(targetShape, legacyShape),
      maxShiftedIou(targetShape, mirroredLegacyShape),
    );
    wearableShapeEvidence.push(`${classId}-${slot}~${theme}=${score.toFixed(3)}`);
    if (score >= WEARABLE_SHAPE_REUSE_THRESHOLD) {
      fail(`${target}: 与旧主题 ${theme} 同槽件轮廓过度相似（IoU ${score.toFixed(3)}）`);
    }
    if (theme === 'rose-night') {
      const [a, b] = await Promise.all([
        sharp(target).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
        sharp(legacyPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
      ]);
      let visible = 0;
      let delta = 0;
      for (let offset = 0; offset < a.data.length; offset += 4) {
        if (a.data[offset + 3] > 16 && b.data[offset + 3] > 16) {
          visible += 1;
          delta += Math.abs(a.data[offset] - b.data[offset]);
          delta += Math.abs(a.data[offset + 1] - b.data[offset + 1]);
          delta += Math.abs(a.data[offset + 2] - b.data[offset + 2]);
        }
      }
      const mae = visible ? delta / (visible * 3) : 255;
      if (visible > 5000 && mae < 24) {
        fail(`${target}: 与绯夜同槽件色差过小（MAE ${mae.toFixed(2)}，重叠 ${visible}px）`);
      }
    }
  }
}

async function compareWearableAlpha(source, target, slot, classId) {
  let expected = slot === 'head'
    ? sharp(source)
        .extract({ left: 0, top: 0, width: 640, height: 180 })
        .resize({ width: 640, height: 100, fit: 'fill', kernel: sharp.kernel.lanczos3 })
        .extend({ bottom: 860, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    : sharp(source);
  // 鞋层在 build 期按底模锚点平移（确定性校正），忠实比对需对母版施加同一平移。
  if (slot === 'shoes') {
    const shift = await computeShoeShift(classId, ROOT);
    expected = sharp(await translate(source, shift.dx, shift.dy));
  }
  // 妖灵武器在 build 期等比缩放并对齐 rose-night 扇带（确定性校正），比对需同一变换。
  if (slot === 'weapon') {
    const align = await computeWeaponAlign(classId, ROOT);
    if (align) {
      const resized = await sharp(source)
        .resize({ width: align.newW, height: align.newH, kernel: sharp.kernel.lanczos3 })
        .png()
        .toBuffer();
      const placed = await sharp({
        create: { width: 640, height: 960, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      })
        .composite([{ input: resized, left: align.left, top: align.top }])
        .png()
        .toBuffer();
      expected = sharp(placed);
    }
  }
  const [a, b] = await Promise.all([
    expected.ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(target).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  // body 成品在独立鞋层落点上**必然**异于母版：老四职业在构建期把衣裙
  // Alpha 让位给鞋层（build 的 yieldBodyToShoes，防靴口穿透裙面）；樱酱是
  // 底模垫层构型（underlayKenshiBase），底模在母版透明/半透明处合法出现，
  // 由下方 underlayMask 豁免；完整性另由 inspectKenshiDressIntegrity 验收。
  let shoeMask = null;
  let underlayMask = null;
  let headZoneMask = null;
  let artifactLineMask = null;
  if (slot === 'weapon' && ARTIFACT_LINE_COLUMNS[classId]) {
    // 清线是合法结构变更：伪影列（witch x77-78 / catkin x34 / swordsman x59）
    // 从母版保真比对中豁免，由 assertArtifactLinesCleared 独立验收。
    artifactLineMask = Buffer.alloc(640 * 960);
    for (const x of ARTIFACT_LINE_COLUMNS[classId]) {
      for (let y = 0; y < 960; y += 1) {
        artifactLineMask[y * 640 + x] = 255;
      }
    }
  }
  if (slot === 'body') {
    const shift = await computeShoeShift(classId, ROOT);
    const shoesTranslated = await translate(
      source.replace(/-body\.png$/, '-shoes.png'),
      shift.dx,
      shift.dy,
    );
    shoeMask = await sharp(shoesTranslated).ensureAlpha().extractChannel('alpha').raw().toBuffer();
    const baseRaw = await rawRgba(
      resolve(ROOT, `public/assets/characters/modular/${classId}/base-noshoes.png`),
    );
    if (classId === 'kenshi') {
      headZoneMask = Buffer.alloc(baseRaw.info.width * baseRaw.info.height);
      for (let y = 0; y < baseRaw.info.height; y += 1) {
        for (let x = 0; x < baseRaw.info.width; x += 1) {
          const pixel = y * baseRaw.info.width + x;
          const inZone = y < KENSHI_PASTE_Y && baseRaw.data[pixel * 4 + 3] > 16;
          if (inZone || inFaceEllipse(x, y, classId)) headZoneMask[pixel] = 255;
        }
      }
    } else {
      // 老四职业：豁免掩码=build 同一份羽化切除掩码（computeBodyRemovalMask），
      // 含头区/脸椭圆/侧边条与羽化坡。分开各写一份形状=两侧读数迟早对不上。
      headZoneMask = (await computeBodyRemovalMask(classId, ROOT, baseRaw)).feathered;
    }
    if (classId === 'kenshi') {
      // 底模垫层构型：底模剪影内、母版非全不透明处，成品像素合法混入底模。
      underlayMask = Buffer.alloc(baseRaw.info.width * baseRaw.info.height);
      for (let pixel = 0; pixel < underlayMask.length; pixel += 1) {
        if (baseRaw.data[pixel * 4 + 3] > 16) underlayMask[pixel] = 255;
      }
    }
  }
  let compared = 0;
  let alphaMismatch = 0;
  let alphaDeltaSum = 0;
  let bigAlphaDelta = 0;
  let visible = 0;
  let colorDelta = 0;
  for (let offset = 0; offset < a.data.length; offset += 4) {
    if (shoeMask && shoeMask[offset / 4] > 20) continue;
    if (headZoneMask && headZoneMask[offset / 4] > 0) continue;
    if (underlayMask && underlayMask[offset / 4] > 0 && a.data[offset + 3] < 250) continue;
    if (artifactLineMask && artifactLineMask[offset / 4] > 0) continue;
    compared += 1;
    const deltaAlpha = Math.abs(a.data[offset + 3] - b.data[offset + 3]);
    if (deltaAlpha !== 0) alphaMismatch += 1;
    alphaDeltaSum += deltaAlpha;
    if (deltaAlpha > 64) bigAlphaDelta += 1;
    if (a.data[offset + 3] > 16 && b.data[offset + 3] > 16) {
      visible += 1;
      colorDelta += Math.abs(a.data[offset] - b.data[offset]);
      colorDelta += Math.abs(a.data[offset + 1] - b.data[offset + 1]);
      colorDelta += Math.abs(a.data[offset + 2] - b.data[offset + 2]);
    }
  }
  const alphaMae = compared ? alphaDeltaSum / compared : 0;
  const colorMae = visible ? colorDelta / (visible * 3) : 0;
  if (slot === 'head') {
    // 帽层出口始终真彩无损（内容只占顶部 100px，体积远低于预算），
    // 因此维持逐像素严判。
    if (alphaMismatch !== 0) fail(`${target}: 帽层 Alpha 锚点与校准母版不一致（${alphaMismatch} 像素）`);
    if (colorMae > 8) fail(`${target}: 帽层颜色与母版偏差过大（MAE ${colorMae.toFixed(2)}）`);
    return;
  }
  // ── 2026-08-03 工作流换代（复核：小Q）──
  // v1 时代 art-source 里放的是**绯夜模板**，成品靠换色改形得来，所以这里
  // 曾要求「成品必须异于母版」。v2 起母版是**全新生成的最终稿**
  //（docs/art/ice-snow-v2/SOURCE-MAPPING.csv 逐件可溯源），忠实构建才是
  // 正确契约 —— 与帽层同一语义。容差只为出口降级压缩（writePng 超预算时的
  // RGBA 调色板量化）的编码噪声留出：换错图、绕过构建、私改成品这类结构性
  // 改动在下面三个指标上都会超出一个数量级。
  // **防抄袭没有放弃，只是换了判定对象**：见 compareAgainstLegacyThemes。
  if (alphaMae > 1.5) {
    fail(`${target}: 与全新母版 Alpha 偏差过大（alphaMAE ${alphaMae.toFixed(3)}）—— 构建失真或母版被绕过`);
  }
  if (bigAlphaDelta > compared * 0.002) {
    fail(`${target}: 与全新母版存在结构性 Alpha 差异（|Δα|>64 共 ${bigAlphaDelta} 像素）`);
  }
  if (colorMae > 8) {
    fail(`${target}: 与全新母版可见区色差过大（colorMAE ${colorMae.toFixed(2)}）`);
  }
  wearableFidelityEvidence.push(
    `${classId}-${slot}:aMAE=${alphaMae.toFixed(3)},big=${bigAlphaDelta},cMAE=${colorMae.toFixed(2)}`,
  );
  await compareAgainstLegacyThemes(target, slot, classId);
}

/**
 * 老四职业：body 头区必须切净（2026-08-03 线上事故根因的门禁化）。
 * 判定 = 脸椭圆内不透明像素 ≤50（边界噪声）且切头线以上不透明像素 ==0。
 */
async function assertOldClassHeadClear(target, classId) {
  const { data, info } = await rawRgba(target);
  let facePx = 0;
  let headPx = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * 4;
      if (data[offset + 3] <= 16) continue;
      if (inFaceEllipse(x, y, classId)) facePx += 1;
      if (y < CUT_LINES[classId]) headPx += 1;
    }
  }
  if (facePx > 50) {
    fail(`${target}: ${classId} body 脸椭圆内残留 ${facePx}px（要求 ≤50）`);
  }
  if (headPx !== 0) {
    fail(`${target}: ${classId} body 切头线（y<${CUT_LINES[classId]}）以上残留 ${headPx}px（要求 ==0）`);
  }
}

/**
 * 樱酱(kenshi)：v2 母版把头画丢（头区是毛领/兜帽），build 确定性贴回 base 头区。
 * 反向断言：头区不透明像素 ≥ v1 rose-night kenshi 同区下限 13,132px，防无头陈列图复发。
 */
async function assertKenshiHeadPasted(target) {
  const { data, info } = await rawRgba(target);
  let headPx = 0;
  for (let y = 0; y < Math.min(KENSHI_PASTE_Y, info.height); y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] > 16) headPx += 1;
    }
  }
  if (headPx < 13_132) {
    fail(`${target}: 樱酱头区（y<${KENSHI_PASTE_Y}）仅 ${headPx}px，低于 v1 参照下限 13132px——补头失败`);
  }
}

/**
 * 鞋层锚点：底边对齐参照（swordsman=base 脚底档，其余=rose-night 底边档），
 * 水平中心对齐 rose-night；容差 ±8px。
 */
async function assertShoeAnchor(classId) {
  const shift = await computeShoeShift(classId, ROOT);
  const targetRaw = await rawRgba(
    resolve(ROOT, `public/assets/characters/modular/shop/ice-snow/${classId}-shoes.png`),
  );
  const roseRaw = await rawRgba(
    resolve(ROOT, `public/assets/characters/modular/shop/rose-night/${classId}-shoes.png`),
  );
  const targetBBox = await bboxOf(targetRaw);
  const roseBBox = await bboxOf(roseRaw);
  const targetBottom = classId === 'swordsman' ? shift.baseBottom : shift.roseBottom;
  const targetCenterX = Math.round((roseBBox.x0 + roseBBox.x1) / 2);
  const centerX = Math.round((targetBBox.x0 + targetBBox.x1) / 2);
  const label = `shop/ice-snow/${classId}-shoes.png`;
  if (Math.abs(targetBBox.y1 - targetBottom) > 8) {
    fail(`${label}: 鞋底边 y=${targetBBox.y1} 与目标 ${targetBottom} 差 ${targetBBox.y1 - targetBottom}px（要求 ±8px）`);
  }
  if (Math.abs(centerX - targetCenterX) > 8) {
    fail(`${label}: 鞋中心 x=${centerX} 与参照 ${targetCenterX} 差 ${centerX - targetCenterX}px（要求 ±8px）`);
  }
}

/**
 * 第四道断言：五职业武器不得遮脸（v1 现架全部 0，天然合同；防妖灵扇子事故复发）。
 */
async function assertWeaponFaceClear(classId) {
  const target = resolve(
    ROOT,
    `public/assets/characters/modular/shop/ice-snow/${classId}-weapon.png`,
  );
  const { data, info } = await rawRgba(target);
  let facePx = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] > 16 && inFaceEllipse(x, y, classId)) {
        facePx += 1;
      }
    }
  }
  if (facePx > 50) {
    fail(`${target}: ${classId} 武器脸椭圆内 ${facePx}px（要求 ≤50，防武器遮脸）`);
  }
}

/**
 * 头饰锚点：顶边对齐 v1 rose-night 参照，容差 ±4px（小衡 22:32 容差总表）。
 */
/**
 * 清线探针（小Q5 判据）：伪影列（alpha≤90 的半透明细长线）必须清零。
 * 修后同列只允许 alpha>90 的武器本体像素（伪影线 maxAlpha≤71，量化后不超 90）。
 */
async function assertArtifactLinesCleared(classId) {
  const columns = ARTIFACT_LINE_COLUMNS[classId];
  if (!columns) return;
  const target = resolve(
    ROOT,
    `public/assets/characters/modular/shop/ice-snow/${classId}-weapon.png`,
  );
  const { data, info } = await rawRgba(target);
  let residual = 0;
  let maxAlpha = 0;
  for (const x of columns) {
    for (let y = 0; y < info.height; y += 1) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha > 16 && alpha <= ARTIFACT_ALPHA_CLEAR) residual += 1;
      if (alpha > maxAlpha) maxAlpha = alpha;
    }
  }
  if (residual > 0) {
    fail(
      `${target}: ${classId} 伪影列（x=${columns.join('/')}）残留 alpha 17~${ARTIFACT_ALPHA_CLEAR} 像素 ${residual}px（要求 ==0，maxAlpha=${maxAlpha}）`,
    );
  }
}

async function assertHeadAnchor(classId) {
  const target = resolve(
    ROOT,
    `public/assets/characters/modular/shop/ice-snow/${classId}-head.png`,
  );
  const rose = resolve(
    ROOT,
    `public/assets/characters/modular/shop/rose-night/${classId}-head.png`,
  );
  const [targetBBox, roseBBox] = await Promise.all([
    bboxOf(await rawRgba(target)),
    bboxOf(await rawRgba(rose)),
  ]);
  const diff = targetBBox.y0 - roseBBox.y0;
  if (Math.abs(diff) > 4) {
    fail(`${target}: 头饰顶边 y=${targetBBox.y0} 与参照 ${roseBBox.y0} 差 ${diff}px（要求 ±4px）`);
  }
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

for (const classId of CLASSES) {
  const bodyTarget = resolve(
    ROOT,
    `public/assets/characters/modular/shop/ice-snow/${classId}-body.png`,
  );
  if (classId === 'kenshi') {
    await assertKenshiHeadPasted(bodyTarget);
  } else {
    await assertOldClassHeadClear(bodyTarget, classId);
  }
  await assertShoeAnchor(classId);
  await assertWeaponFaceClear(classId);
  await assertArtifactLinesCleared(classId);
  await assertHeadAnchor(classId);
}

const kenshiDressIntegrity = await inspectKenshiDressIntegrity();

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
    `樱酱长裙完整性通过：y740 裙宽 ${kenshiDressIntegrity.skirt}px，y860 底模脚 ${kenshiDressIntegrity.feet}px（底模垫层构型）。`,
  );
  console.log(
    `冰雪华年资产门禁通过：20 穿戴层与 v2 母版保真（帽区 180→100px 实机校正），13 图标、5 原创特效、1 货架规格全绿；旧主题 Alpha 轮廓最大 IoU：${effectShapeEvidence.join('，')}；伪装复制最低锚点：${effectShapeCalibration.join('，')}。`,
    `冰雪 15 张衣裙/鞋/武器新轮廓 IoU：${wearableShapeEvidence.join('，')}。`,
    `母版保真读数：${wearableFidelityEvidence.join('，')}。`,
    `穿戴伪装复制最低锚点：${wearableShapeCalibration.join('，')}。`,
  );
}
