import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const STORY_WIDTH = 960;
const STORY_HEIGHT = 640;
const SOURCE_ROOT = 'art-source/affection';
const RUNTIME_ROOT = 'public/assets/affection';
const CLASS_IDS = ['swordsman', 'witch', 'shaman', 'catkin'];

const ASSETS = [
  {
    classId: 'swordsman',
    kind: 'scenes',
    slug: 'swordsman-gift-tea-dawn',
  },
  {
    classId: 'swordsman',
    kind: 'scenes',
    slug: 'swordsman-rain-market-tasting',
  },
  {
    classId: 'swordsman',
    kind: 'scenes',
    slug: 'swordsman-reciprocal-gift-sunset',
  },
  {
    classId: 'swordsman',
    kind: 'cg',
    slug: 'swordsman-two-way-gift-ribbons',
  },
  {
    classId: 'witch',
    kind: 'scenes',
    slug: 'witch-gift-safety-atelier',
  },
  {
    classId: 'witch',
    kind: 'scenes',
    slug: 'witch-secret-library-night',
  },
  {
    classId: 'witch',
    kind: 'scenes',
    slug: 'witch-reciprocal-star-dawn',
  },
  {
    classId: 'witch',
    kind: 'cg',
    slug: 'witch-reciprocal-star-ink',
  },
  {
    classId: 'shaman',
    kind: 'scenes',
    slug: 'shaman-blank-gift-paper-morning',
  },
  {
    classId: 'shaman',
    kind: 'scenes',
    slug: 'shaman-moontea-rest-evening',
  },
  {
    classId: 'shaman',
    kind: 'scenes',
    slug: 'shaman-return-charm-night',
  },
  {
    classId: 'shaman',
    kind: 'cg',
    slug: 'shaman-open-knot-keepsakes',
  },
  {
    classId: 'catkin',
    kind: 'scenes',
    slug: 'catkin-gift-inspection-workshop',
  },
  {
    classId: 'catkin',
    kind: 'scenes',
    slug: 'catkin-sentimental-shelf-rain',
  },
  {
    classId: 'catkin',
    kind: 'scenes',
    slug: 'catkin-shared-expedition-locker-sunrise',
  },
  {
    classId: 'catkin',
    kind: 'cg',
    slug: 'catkin-two-way-supply-tags',
  },
];

function sourcePath(asset) {
  return resolve(`${SOURCE_ROOT}/${asset.kind}/round3/${asset.slug}.png`);
}

function runtimePath(asset) {
  return resolve(`${RUNTIME_ROOT}/${asset.kind}/${asset.slug}.webp`);
}

async function buildAsset(asset) {
  const source = sourcePath(asset);
  const output = runtimePath(asset);
  const metadata = await sharp(source).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (metadata.format !== 'png' || width * 2 !== height * 3) {
    throw new Error(
      `${source} 必须是严格 3:2 PNG 母版，当前为 ${width || '?'}×${height || '?'} ` +
        `${metadata.format ?? '未知格式'}`,
    );
  }

  await mkdir(dirname(output), { recursive: true });
  await sharp(source)
    .rotate()
    .resize(STORY_WIDTH, STORY_HEIGHT, { fit: 'fill' })
    .webp({ quality: 86, smartSubsample: true })
    .toFile(output);
}

async function buildClassContactSheet(classId) {
  const classAssets = ASSETS.filter((asset) => asset.classId === classId);
  if (classAssets.length !== 4) {
    throw new Error(`${classId} 的第三批联系表必须恰好包含 3 场景 + 1 CG`);
  }

  const tileWidth = 480;
  const tileHeight = 320;
  const gutter = 16;
  const composites = await Promise.all(
    classAssets.map(async (asset, index) => ({
      input: await sharp(runtimePath(asset))
        .resize(tileWidth, tileHeight, { fit: 'fill' })
        .toBuffer(),
      left: gutter + (index % 2) * (tileWidth + gutter),
      top: gutter + Math.floor(index / 2) * (tileHeight + gutter),
    })),
  );
  const output = resolve(`art-source/qa/affection-round3-${classId}-contact-sheet.png`);
  await mkdir(dirname(output), { recursive: true });
  await sharp({
    create: {
      width: tileWidth * 2 + gutter * 3,
      height: tileHeight * 2 + gutter * 3,
      channels: 3,
      background: '#191528',
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(output);
}

async function buildOverviewContactSheet() {
  const tileWidth = 240;
  const tileHeight = 160;
  const columns = 4;
  const rows = 4;
  const gutter = 12;
  const composites = await Promise.all(
    ASSETS.map(async (asset, index) => ({
      input: await sharp(runtimePath(asset))
        .resize(tileWidth, tileHeight, { fit: 'fill' })
        .toBuffer(),
      left: gutter + (index % columns) * (tileWidth + gutter),
      top: gutter + Math.floor(index / columns) * (tileHeight + gutter),
    })),
  );
  const output = resolve('art-source/qa/affection-round3-contact-sheet.png');
  await mkdir(dirname(output), { recursive: true });
  await sharp({
    create: {
      width: tileWidth * columns + gutter * (columns + 1),
      height: tileHeight * rows + gutter * (rows + 1),
      channels: 3,
      background: '#191528',
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(output);
}

for (const asset of ASSETS) await buildAsset(asset);
for (const classId of CLASS_IDS) await buildClassContactSheet(classId);
await buildOverviewContactSheet();

console.log('好感第三批素材构建完成：12 张场景 + 4 张物件 CG + 5 张联系表。');
