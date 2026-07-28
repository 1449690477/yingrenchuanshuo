import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

/**
 * A-4 约会素材构建：art-source 1536×1024 源图 → 运行时 960×640 webp。
 * Kimi 生图通道会在左下角烧录「AI生成」合规标记，构建时统一切边去除：
 * 底部切 64px、左右各切 48px，保持 3:2（1440×960）后再缩放到 960×640。
 * 同时输出 4×4 联系表供 QA 目检。
 */

const STORY_WIDTH = 960;
const STORY_HEIGHT = 640;
const SOURCE_ROOT = 'art-source/affection';
const RUNTIME_ROOT = 'public/assets/affection';
const QA_SHEET = 'art-source/qa/affection-round4-contact-sheet.png';

const CROP = { left: 48, top: 0, width: 1440, height: 960 };

const ASSETS = [
  { kind: 'scenes', slug: 'swordsman-morning-market' },
  { kind: 'scenes', slug: 'swordsman-lakeside-bento' },
  { kind: 'scenes', slug: 'swordsman-lantern-bridge' },
  { kind: 'cg', slug: 'swordsman-paired-tassels' },
  { kind: 'scenes', slug: 'witch-starcandy-atelier' },
  { kind: 'scenes', slug: 'witch-planetarium-repair' },
  { kind: 'scenes', slug: 'witch-meteor-terrace' },
  { kind: 'cg', slug: 'witch-meteor-journal' },
  { kind: 'scenes', slug: 'shaman-shrine-market' },
  { kind: 'scenes', slug: 'shaman-firefly-ferry' },
  { kind: 'scenes', slug: 'shaman-rainy-teahouse' },
  { kind: 'cg', slug: 'shaman-paired-teacups' },
  { kind: 'scenes', slug: 'catkin-supply-market' },
  { kind: 'scenes', slug: 'catkin-workshop-coffee' },
  { kind: 'scenes', slug: 'catkin-rooftop-platform' },
  { kind: 'cg', slug: 'catkin-two-tickets' },
];

const TILE = 4;
const TILE_WIDTH = 384;
const TILE_HEIGHT = 256;

async function convert(asset) {
  const source = resolve(`${SOURCE_ROOT}/${asset.kind}/round4/${asset.slug}.png`);
  const target = resolve(`${RUNTIME_ROOT}/${asset.kind}/${asset.slug}.webp`);
  await mkdir(resolve(`${RUNTIME_ROOT}/${asset.kind}`), { recursive: true });
  await sharp(source)
    .extract(CROP)
    .resize(STORY_WIDTH, STORY_HEIGHT, { fit: 'fill' })
    .webp({ quality: 86, smartSubsample: true })
    .toFile(target);
  return target;
}

async function contactSheet() {
  const tiles = await Promise.all(
    ASSETS.map(async (asset, index) => ({
      input: await sharp(resolve(`${SOURCE_ROOT}/${asset.kind}/round4/${asset.slug}.png`))
        .extract(CROP)
        .resize(TILE_WIDTH, TILE_HEIGHT, { fit: 'fill' })
        .png()
        .toBuffer(),
      left: (index % TILE) * TILE_WIDTH,
      top: Math.floor(index / TILE) * TILE_HEIGHT,
    })),
  );
  await mkdir(resolve('art-source/qa'), { recursive: true });
  await sharp({
    create: {
      width: TILE * TILE_WIDTH,
      height: Math.ceil(ASSETS.length / TILE) * TILE_HEIGHT,
      channels: 3,
      background: '#1c1a30',
    },
  })
    .composite(tiles)
    .png()
    .toFile(QA_SHEET);
}

const converted = [];
for (const asset of ASSETS) {
  converted.push(await convert(asset));
}
await contactSheet();
console.log(`已转换 ${converted.length} 张运行时 webp，联系表：${QA_SHEET}`);
