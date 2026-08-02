#!/usr/bin/env node

import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import sharp from 'sharp';

const ROOT = resolve('.');
const PUBLIC_ROOT = resolve(ROOT, 'public/assets');
const CHROMA_ROOT = resolve(ROOT, 'art-source/characters/kenshi');
const QA_ROOT = resolve(ROOT, 'art-source/qa');
const JSON_OUTPUT = resolve(QA_ROOT, 'kenshi-r2-texture-audit.json');
const SHEET_OUTPUT = resolve(QA_ROOT, 'kenshi-r2-texture-audit.webp');
const CLASS_IDS = ['swordsman', 'witch', 'shaman', 'catkin'];
const SUPPORTED = new Set(['.png', '.webp']);

function slash(path) {
  return path.split(sep).join('/');
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else files.push(path);
  }
  return files;
}

function extension(path) {
  const index = path.lastIndexOf('.');
  return index < 0 ? '' : path.slice(index).toLowerCase();
}

function isKenshiAsset(path) {
  const normalized = slash(relative(PUBLIC_ROOT, path)).toLowerCase();
  return (
    normalized.includes('/kenshi/') ||
    normalized.startsWith('characters/kenshi-') ||
    /(^|[/_-])kenshi([/_.-]|$)/.test(normalized)
  );
}

function classify(path) {
  const normalized = slash(relative(PUBLIC_ROOT, path));
  if (normalized.startsWith('characters/kenshi-')) return 'portrait';
  if (/characters\/modular\/kenshi\/base/.test(normalized)) return 'base';
  if (normalized.startsWith('characters/modular/')) return 'wearable';
  if (normalized.startsWith('effects/')) return 'effect';
  if (normalized.startsWith('icons/skills/')) return 'skill-icon';
  if (normalized.startsWith('affection/scenes/')) return 'scene';
  if (normalized.startsWith('affection/cg/')) return 'cg';
  if (normalized.startsWith('equipment/')) return 'equipment-icon';
  if (normalized.startsWith('affection/gifts/') || normalized.startsWith('items/'))
    return 'item-icon';
  return 'other';
}

function percentile(values, fraction) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round((sorted.length - 1) * fraction)),
  );
  return sorted[index];
}

function round(value, digits = 4) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

async function textureMetrics(path, analysisWidth) {
  const metadata = await sharp(path).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const scale = analysisWidth && width > analysisWidth ? analysisWidth / width : 1;
  const pipeline = sharp(path).ensureAlpha();
  if (scale < 1)
    pipeline.resize(
      Math.max(1, Math.round(width * scale)),
      Math.max(1, Math.round(height * scale)),
      { fit: 'fill' },
    );
  const original = await pipeline.clone().raw().toBuffer({ resolveWithObject: true });
  const blurred = await pipeline.clone().blur(1.35).raw().toBuffer({ resolveWithObject: true });
  const broad = await pipeline.clone().blur(4).raw().toBuffer({ resolveWithObject: true });
  const residuals = [];
  const paleResiduals = [];
  let visible = 0;
  let opaque = 0;
  let semiTransparent = 0;
  let green = 0;
  let greenEdge = 0;
  let coloredEdge = 0;
  let nearBlackEdge = 0;
  let minX = original.info.width;
  let minY = original.info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < original.info.height; y += 1) {
    for (let x = 0; x < original.info.width; x += 1) {
      const offset = (y * original.info.width + x) * original.info.channels;
      const red = original.data[offset] ?? 0;
      const greenChannel = original.data[offset + 1] ?? 0;
      const blue = original.data[offset + 2] ?? 0;
      const alpha = original.data[offset + 3] ?? 255;
      if (alpha <= 12) continue;
      visible += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      const isGreen =
        greenChannel >= 170 && greenChannel > red * 1.42 && greenChannel > blue * 1.28;
      if (isGreen) green += 1;
      if (alpha < 245) {
        semiTransparent += 1;
        if (isGreen) greenEdge += 1;
        if (Math.max(red, greenChannel, blue) - Math.min(red, greenChannel, blue) > 48)
          coloredEdge += 1;
        if (red < 24 && greenChannel < 24 && blue < 24) nearBlackEdge += 1;
        continue;
      }
      opaque += 1;
      const blurRed = blurred.data[offset] ?? 0;
      const blurGreen = blurred.data[offset + 1] ?? 0;
      const blurBlue = blurred.data[offset + 2] ?? 0;
      const broadRed = broad.data[offset] ?? 0;
      const broadGreen = broad.data[offset + 1] ?? 0;
      const broadBlue = broad.data[offset + 2] ?? 0;
      const localStructure =
        (Math.abs(blurRed - broadRed) +
          Math.abs(blurGreen - broadGreen) +
          Math.abs(blurBlue - broadBlue)) /
        3;
      if (localStructure > 13) continue;
      const residual =
        (Math.abs(red - blurRed) + Math.abs(greenChannel - blurGreen) + Math.abs(blue - blurBlue)) /
        3;
      residuals.push(residual);
      const saturation = Math.max(red, greenChannel, blue) - Math.min(red, greenChannel, blue);
      const luminance = (red * 54 + greenChannel * 183 + blue * 19) / 256;
      if (saturation < 42 && luminance > 112) paleResiduals.push(residual);
    }
  }

  const total = original.info.width * original.info.height;
  return {
    width,
    height,
    analysisWidth: original.info.width,
    analysisHeight: original.info.height,
    bbox: visible === 0 ? null : [minX, minY, maxX, maxY],
    visibleRatio: round(visible / Math.max(1, total), 6),
    semiTransparentRatio: round(semiTransparent / Math.max(1, visible), 6),
    greenRatio: round(green / Math.max(1, visible), 6),
    greenEdgeRatio: round(greenEdge / Math.max(1, semiTransparent), 6),
    coloredEdgeRatio: round(coloredEdge / Math.max(1, semiTransparent), 6),
    nearBlackEdgeRatio: round(nearBlackEdge / Math.max(1, semiTransparent), 6),
    textureMean: round(
      residuals.reduce((sum, value) => sum + value, 0) / Math.max(1, residuals.length),
    ),
    textureP95: round(percentile(residuals, 0.95)),
    paleTextureMean: round(
      paleResiduals.reduce((sum, value) => sum + value, 0) / Math.max(1, paleResiduals.length),
    ),
    paleTextureP95: round(percentile(paleResiduals, 0.95)),
    sampleCount: residuals.length,
    paleSampleCount: paleResiduals.length,
    opaque,
  };
}

function peerCandidates(path, publicFiles) {
  const normalized = slash(relative(PUBLIC_ROOT, path));
  const direct = CLASS_IDS.flatMap((classId) => {
    const candidates = new Set([
      normalized.replaceAll('kenshi', classId),
      normalized.replaceAll('Kenshi', classId),
    ]);
    return [...candidates].map((candidate) => resolve(PUBLIC_ROOT, candidate));
  }).filter((candidate) => publicFiles.has(candidate));
  if (direct.length > 0) return direct;
  const kind = classify(path);
  return [...publicFiles]
    .filter((candidate) => !isKenshiAsset(candidate) && classify(candidate) === kind)
    .slice(0, 80);
}

function riskScore(metrics, peerTexture) {
  const peer = Math.max(peerTexture, 0.25);
  const nativeTexture = Math.max(metrics.native.paleTextureMean, metrics.native.textureMean * 0.78);
  const displayTexture = Math.max(
    metrics.display.paleTextureMean,
    metrics.display.textureMean * 0.78,
  );
  const relativeTexture = Math.max(nativeTexture / peer, 1);
  return round(
    displayTexture * 0.34 +
      nativeTexture * 0.18 +
      Math.min(relativeTexture, 4) * 0.8 +
      metrics.native.greenEdgeRatio * 180 +
      metrics.native.nearBlackEdgeRatio * 26,
  );
}

async function chromaBackgroundMetrics(path) {
  const metadata = await sharp(path).metadata();
  const width = metadata.width ?? 0;
  const pipeline = sharp(path).removeAlpha();
  if (width > 512) pipeline.resize({ width: 512 });
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  const samples = [];
  const distances = [];
  for (let index = 0; index < data.length; index += info.channels) {
    const red = data[index] ?? 0;
    const green = data[index + 1] ?? 0;
    const blue = data[index + 2] ?? 0;
    if (green < 120 || green <= red * 1.25 || green <= blue * 1.15) continue;
    samples.push([red, green, blue]);
    distances.push(Math.hypot(red, 255 - green, blue));
  }
  const totalPixels = info.width * info.height;
  const means = [0, 1, 2].map(
    (channel) =>
      samples.reduce((sum, sample) => sum + sample[channel], 0) / Math.max(1, samples.length),
  );
  const standardDeviations = [0, 1, 2].map((channel) => {
    const variance =
      samples.reduce((sum, sample) => sum + (sample[channel] - means[channel]) ** 2, 0) /
      Math.max(1, samples.length);
    return Math.sqrt(variance);
  });
  const distanceMean =
    distances.reduce((sum, value) => sum + value, 0) / Math.max(1, distances.length);
  const distanceP95 = percentile(distances, 0.95);
  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    greenCoverage: round(samples.length / Math.max(1, totalPixels), 6),
    keyMean: means.map((value) => round(value, 2)),
    keyStd: standardDeviations.map((value) => round(value, 2)),
    keyDistanceMean: round(distanceMean, 2),
    keyDistanceP95: round(distanceP95, 2),
    riskScore: round(
      distanceMean +
        distanceP95 * 0.45 +
        standardDeviations.reduce((sum, value) => sum + value, 0) * 0.8,
    ),
  };
}

function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

async function makeSheet(entries) {
  const columns = 4;
  const cellWidth = 300;
  const cellHeight = 370;
  const rows = Math.ceil(entries.length / columns);
  const composites = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const left = (index % columns) * cellWidth;
    const top = Math.floor(index / columns) * cellHeight;
    const thumb = await sharp(entry.absolutePath)
      .ensureAlpha()
      .resize(260, 280, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    const label = entry.path.length > 42 ? `…${entry.path.slice(-41)}` : entry.path;
    const svg = Buffer.from(
      `<svg width="${cellWidth}" height="${cellHeight}" xmlns="http://www.w3.org/2000/svg">` +
        `<rect width="${cellWidth}" height="${cellHeight}" rx="18" fill="#f7f2ff"/>` +
        `<rect x="12" y="12" width="276" height="286" rx="12" fill="#eaf4ff"/>` +
        `<text x="18" y="320" font-size="13" fill="#352f50">${escapeXml(label)}</text>` +
        `<text x="18" y="342" font-size="12" fill="#8d4874">risk ${entry.riskScore.toFixed(2)} · native ${entry.metrics.native.paleTextureMean.toFixed(2)} · display ${entry.metrics.display.paleTextureMean.toFixed(2)}</text>` +
        `<text x="18" y="360" font-size="11" fill="#5d6b83">peer ${entry.peerTexture.toFixed(2)} · green ${(entry.metrics.native.greenEdgeRatio * 100).toFixed(2)}% · black ${(entry.metrics.native.nearBlackEdgeRatio * 100).toFixed(2)}%</text>` +
        `</svg>`,
    );
    composites.push({ input: svg, left, top });
    composites.push({ input: thumb, left: left + 20, top: top + 16 });
  }
  await sharp({
    create: {
      width: columns * cellWidth,
      height: rows * cellHeight,
      channels: 4,
      background: { r: 239, g: 246, b: 255, alpha: 1 },
    },
  })
    .composite(composites)
    .webp({ quality: 88, effort: 6 })
    .toFile(SHEET_OUTPUT);
}

await mkdir(QA_ROOT, { recursive: true });
const allPublicFiles = new Set(
  (await walk(PUBLIC_ROOT)).filter((path) => SUPPORTED.has(extension(path))),
);
const kenshiFiles = [...allPublicFiles].filter(isKenshiAsset).sort();
const peerMetricCache = new Map();
const results = [];

for (const path of kenshiFiles) {
  const peers = peerCandidates(path, allPublicFiles);
  const peerValues = [];
  for (const peer of peers) {
    if (!peerMetricCache.has(peer)) peerMetricCache.set(peer, await textureMetrics(peer, 320));
    const metric = peerMetricCache.get(peer);
    peerValues.push(Math.max(metric.paleTextureMean, metric.textureMean * 0.78));
  }
  const peerTexture = round(percentile(peerValues, 0.5));
  const native = await textureMetrics(path, 640);
  const display = await textureMetrics(path, 160);
  const metrics = { native, display };
  results.push({
    path: `public/assets/${slash(relative(PUBLIC_ROOT, path))}`,
    absolutePath: path,
    kind: classify(path),
    peerCount: peers.length,
    peerTexture,
    metrics,
    riskScore: riskScore(metrics, peerTexture),
  });
}

results.sort((left, right) => right.riskScore - left.riskScore);
const chromaFiles = (await walk(CHROMA_ROOT)).filter((path) => path.endsWith('-chroma.png')).sort();
const chromaSources = [];
for (const path of chromaFiles) {
  chromaSources.push({
    path: slash(relative(ROOT, path)),
    metrics: await chromaBackgroundMetrics(path),
  });
}
chromaSources.sort((left, right) => right.metrics.riskScore - left.metrics.riskScore);

const sheetPriority = [
  'public/assets/characters/kenshi-sakura.png',
  'public/assets/characters/kenshi-sakura-cast.png',
  'public/assets/characters/modular/kenshi/base.png',
  'public/assets/characters/modular/kenshi/r1-body.png',
  'public/assets/characters/modular/kenshi/r5-crimson-body.png',
  'public/assets/characters/modular/kenshi/r6-shadow-body.png',
  'public/assets/characters/modular/kenshi/r7-bloodmoon-body.png',
  ...['berry-cream', 'moon-sugar', 'rose-night'].map(
    (theme) => `public/assets/characters/modular/shop/${theme}/kenshi-body.png`,
  ),
  ...['azure', 'violet', 'auric', 'crimson'].map(
    (tier) => `public/assets/characters/modular/dungeon/${tier}/kenshi-body.png`,
  ),
  'public/assets/characters/modular/arena/kenshi/blinkbloom-return-ring.png',
  'public/assets/icons/skills/kenshi-iai-draw.png',
  'public/assets/icons/skills/kenshi-sakura-blizzard.png',
  'public/assets/icons/skills/kenshi-thousand-sakura.png',
  'public/assets/effects/kenshi-iai-draw.png',
  'public/assets/effects/kenshi-sakura-blizzard.png',
  'public/assets/effects/kenshi-thousand-sakura.png',
];
const resultByPath = new Map(results.map((entry) => [entry.path, entry]));
const sheetEntries = sheetPriority.map((path) => resultByPath.get(path)).filter(Boolean);
const payload = {
  generatedAt: new Date().toISOString(),
  method: {
    nativeAnalysisMaxWidth: 640,
    displayAnalysisMaxWidth: 160,
    texture:
      'opaque low-structure RGB residual after Gaussian blur; pale regions reported separately',
    edge: 'semi-transparent chroma/near-black contamination ratios',
    ranking: 'display texture + native texture + peer-relative texture + edge contamination',
    chromaSource:
      'green-dominant source pixels compared with exact #00ff00; mean, P95 and channel variance are reported',
  },
  totals: {
    files: results.length,
    portraits: results.filter((entry) => entry.kind === 'portrait').length,
    wearables: results.filter((entry) => ['base', 'wearable'].includes(entry.kind)).length,
    effects: results.filter((entry) => entry.kind === 'effect').length,
    icons: results.filter((entry) => entry.kind.endsWith('icon')).length,
    scenes: results.filter((entry) => ['scene', 'cg'].includes(entry.kind)).length,
  },
  chromaSources,
  worst: results.slice(0, 32).map(({ absolutePath: _absolutePath, ...entry }) => entry),
  assets: results.map(({ absolutePath: _absolutePath, ...entry }) => entry),
};
await writeFile(JSON_OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await makeSheet(sheetEntries);

console.log(
  `樱酱 R2 纹理审计完成：${results.length} 项运行资产 / ${chromaSources.length} 张绿幕母版`,
);
console.log(`JSON: ${slash(relative(ROOT, JSON_OUTPUT))}`);
console.log(`联系图: ${slash(relative(ROOT, SHEET_OUTPUT))}`);
console.log('绿幕母版风险前 8 项：');
for (const entry of chromaSources.slice(0, 8)) {
  console.log(
    `${entry.metrics.riskScore.toFixed(2)}\t${entry.metrics.keyDistanceMean.toFixed(2)}\t${entry.metrics.keyDistanceP95.toFixed(2)}\t${entry.path}`,
  );
}
