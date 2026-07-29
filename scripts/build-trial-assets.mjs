/**
 * 周常试炼战场与 9 个 Boss 运行时资产构建。
 *
 * 三张 ImageGen 绿幕母版各含 fire / ice / thunder 三只 Boss。脚本先使用
 * imagegen skill 自带的 remove_chroma_key.py 统一抠图，再按两段最宽绿幕
 * 间隔切成三只独立立绘，最后归一为 512×512 脚底锚点 WebP。
 */
import { execFileSync } from 'node:child_process';
import { mkdir, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const ROOT = resolve(import.meta.dirname, '..');
const SOURCE_ROOT = resolve(ROOT, 'art-source/trial');
const RUNTIME_ROOT = resolve(ROOT, 'public/assets/trial');
const QA_ROOT = resolve(ROOT, 'art-source/qa');
const CHROMA_HELPER =
  'C:\\Users\\Administrator\\.codex\\skills\\.system\\imagegen\\scripts\\remove_chroma_key.py';

const ELEMENTS = ['fire', 'ice', 'thunder'];
const GROUPS = ['shell', 'mirage', 'fury'];

await mkdir(RUNTIME_ROOT, { recursive: true });
await mkdir(QA_ROOT, { recursive: true });

await sharp(resolve(SOURCE_ROOT, 'trial-arena.png'))
  .resize(1536, 1024, { fit: 'cover', position: 'centre' })
  .webp({ quality: 80, effort: 6, smartSubsample: true })
  .toFile(resolve(RUNTIME_ROOT, 'trial-arena.webp'));

for (const group of GROUPS) {
  const chromaPath = resolve(SOURCE_ROOT, `${group}-bosses-chroma.png`);
  const transparentSheet = resolve(SOURCE_ROOT, `.${group}-bosses-alpha.tmp.png`);
  execFileSync(
    'python',
    [
      CHROMA_HELPER,
      '--input',
      chromaPath,
      '--out',
      transparentSheet,
      '--auto-key',
      'border',
      '--soft-matte',
      '--transparent-threshold',
      '12',
      '--opaque-threshold',
      '220',
      '--despill',
      '--edge-contract',
      '1',
      '--force',
    ],
    { stdio: 'inherit' },
  );

  const sheet = sharp(transparentSheet).ensureAlpha();
  const { data, info } = await sheet.clone().raw().toBuffer({ resolveWithObject: true });
  const splitA = findQuietSplit(data, info.width, info.height, 0.23, 0.43);
  const splitB = findQuietSplit(data, info.width, info.height, 0.56, 0.77);
  const regions = [
    [0, splitA],
    [splitA, splitB],
    [splitB, info.width],
  ];

  for (const [index, element] of ELEMENTS.entries()) {
    const [left, right] = regions[index];
    const bbox = visibleBounds(data, info.width, info.height, left, right);
    const alphaPath = resolve(SOURCE_ROOT, `${group}-${element}-alpha.png`);
    const runtimePath = resolve(RUNTIME_ROOT, `${group}-${element}.webp`);
    const normalized = sharp(transparentSheet)
      .extract(bbox)
      .resize(464, 464, {
        fit: 'contain',
        position: 'south',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .extend({
        top: 24,
        bottom: 24,
        left: 24,
        right: 24,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });

    // ImageGen 偶尔让相邻分区的一小块晶体/闪电越过绿幕中线。它与主体不相连，
    // 只保留最大连通轮廓即可精确去掉串图碎屑，同时不吞掉主体内部的半透明边缘。
    const normalizedRaw = await normalized.raw().toBuffer({ resolveWithObject: true });
    const cleaned = keepLargestAlphaComponent(
      normalizedRaw.data,
      normalizedRaw.info.width,
      normalizedRaw.info.height,
      normalizedRaw.info.channels,
    );
    const cleanedImage = sharp(cleaned, { raw: normalizedRaw.info });

    await cleanedImage.clone().png({ compressionLevel: 9 }).toFile(alphaPath);
    await cleanedImage
      .clone()
      .webp({ quality: 76, alphaQuality: 96, effort: 6, smartSubsample: true })
      .toFile(runtimePath);
  }
  await unlink(transparentSheet);
}

await buildContactSheet();
console.log('试炼资产构建完成：1 张 3:2 场景 + 9 只透明 Boss + 1 张 QA 联系表。');

function alphaAt(data, width, x, y) {
  return data[(y * width + x) * 4 + 3];
}

function findQuietSplit(data, width, height, fromRatio, toRatio) {
  const from = Math.floor(width * fromRatio);
  const to = Math.ceil(width * toRatio);
  let bestX = from;
  let bestVisible = Number.POSITIVE_INFINITY;
  for (let x = from; x <= to; x++) {
    let visible = 0;
    for (let y = 0; y < height; y++) {
      if (alphaAt(data, width, x, y) > 12) visible++;
    }
    if (visible < bestVisible) {
      bestVisible = visible;
      bestX = x;
    }
  }
  return bestX;
}

function visibleBounds(data, width, height, left, right) {
  let minX = right;
  let minY = height;
  let maxX = left;
  let maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = left; x < right; x++) {
      if (alphaAt(data, width, x, y) <= 12) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (minX > maxX || minY > maxY) {
    throw new Error(`试炼 Boss 分区 ${left}..${right} 没有可见像素`);
  }
  const pad = 12;
  const x = Math.max(left, minX - pad);
  const y = Math.max(0, minY - pad);
  const croppedRight = Math.min(right - 1, maxX + pad);
  const croppedBottom = Math.min(height - 1, maxY + pad);
  return {
    left: x,
    top: y,
    width: croppedRight - x + 1,
    height: croppedBottom - y + 1,
  };
}

function keepLargestAlphaComponent(input, width, height, channels) {
  const data = Buffer.from(input);
  const pixels = width * height;
  const labels = new Int32Array(pixels);
  const queue = new Int32Array(pixels);
  let nextLabel = 0;
  let largestLabel = 0;
  let largestSize = 0;

  for (let index = 0; index < pixels; index++) {
    if (labels[index] !== 0) continue;
    if (data[index * channels + 3] <= 12) {
      labels[index] = -1;
      continue;
    }
    nextLabel++;
    let head = 0;
    let tail = 0;
    let size = 0;
    queue[tail++] = index;
    labels[index] = nextLabel;
    while (head < tail) {
      const current = queue[head++];
      size++;
      const x = current % width;
      const y = Math.floor(current / width);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const neighbor = ny * width + nx;
          if (labels[neighbor] !== 0) continue;
          if (data[neighbor * channels + 3] <= 12) {
            labels[neighbor] = -1;
            continue;
          }
          labels[neighbor] = nextLabel;
          queue[tail++] = neighbor;
        }
      }
    }
    if (size > largestSize) {
      largestSize = size;
      largestLabel = nextLabel;
    }
  }

  for (let index = 0; index < pixels; index++) {
    if (labels[index] === largestLabel) continue;
    data[index * channels + 3] = 0;
  }
  return data;
}

async function buildContactSheet() {
  const tileSize = 512;
  const canvas = sharp({
    create: {
      width: tileSize * 3,
      height: tileSize * 3,
      channels: 4,
      background: { r: 237, g: 245, b: 252, alpha: 1 },
    },
  });
  const composites = [];
  for (const [row, group] of GROUPS.entries()) {
    for (const [column, element] of ELEMENTS.entries()) {
      composites.push({
        input: resolve(RUNTIME_ROOT, `${group}-${element}.webp`),
        left: column * tileSize,
        top: row * tileSize,
      });
    }
  }
  await canvas
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(resolve(QA_ROOT, 'trial-boss-contact-sheet.png'));
}
