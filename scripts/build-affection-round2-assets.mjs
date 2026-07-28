import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const STORY_WIDTH = 960;
const STORY_HEIGHT = 640;
const SOURCE_ROOT = 'art-source/affection';
const RUNTIME_ROOT = 'public/assets/affection';

const ASSETS = [
  {
    classId: 'swordsman',
    kind: 'scenes',
    slug: 'swordsman-paired-trial-sunset',
  },
  {
    classId: 'swordsman',
    kind: 'scenes',
    slug: 'swordsman-lantern-dayoff',
  },
  {
    classId: 'swordsman',
    kind: 'scenes',
    slug: 'swordsman-homecoming-sunrise',
  },
  {
    classId: 'swordsman',
    kind: 'cg',
    slug: 'swordsman-homecoming-knot',
  },
  {
    classId: 'witch',
    kind: 'scenes',
    slug: 'witch-atelier-afterglow',
  },
  {
    classId: 'witch',
    kind: 'scenes',
    slug: 'witch-star-skiff-night',
  },
  {
    classId: 'witch',
    kind: 'scenes',
    slug: 'witch-observatory-dawn',
  },
  {
    classId: 'witch',
    kind: 'cg',
    slug: 'witch-shared-constellation',
  },
  {
    classId: 'shaman',
    kind: 'scenes',
    slug: 'shaman-quiet-tea-afternoon',
  },
  {
    classId: 'shaman',
    kind: 'scenes',
    slug: 'shaman-storm-lantern-path',
  },
  {
    classId: 'shaman',
    kind: 'scenes',
    slug: 'shaman-first-snow-garden',
  },
  {
    classId: 'shaman',
    kind: 'cg',
    slug: 'shaman-paired-lantern-charm',
  },
  {
    classId: 'catkin',
    kind: 'scenes',
    slug: 'catkin-base-expansion-day',
  },
  {
    classId: 'catkin',
    kind: 'scenes',
    slug: 'catkin-rainy-workshop-night',
  },
  {
    classId: 'catkin',
    kind: 'scenes',
    slug: 'catkin-sunrise-departure-platform',
  },
  {
    classId: 'catkin',
    kind: 'cg',
    slug: 'catkin-partner-badges',
  },
];

function sourcePath(asset) {
  return resolve(`${SOURCE_ROOT}/${asset.kind}/round2/${asset.slug}.png`);
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

async function buildContactSheet(classId) {
  const classAssets = ASSETS.filter((asset) => asset.classId === classId);
  if (classAssets.length !== 4) {
    throw new Error(`${classId} 的第二批好感联系表必须恰好包含 3 场景 + 1 CG`);
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
  const output = resolve(`art-source/qa/affection-round2-${classId}-contact-sheet.png`);
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

for (const asset of ASSETS) await buildAsset(asset);
for (const classId of ['swordsman', 'witch', 'shaman', 'catkin']) {
  await buildContactSheet(classId);
}

console.log('好感第二批素材构建完成：12 张场景 + 4 张物件 CG + 4 张职业联系表。');
