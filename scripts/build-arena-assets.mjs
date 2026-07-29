import { execFile } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);
const ICON_SIZE = 256;
const SUBJECT_SIZE = 224;

const EQUIPMENT = {
  swordsman: [
    'triumph-verdict-blade',
    'triumph-laurel-crown',
    'triumph-battle-mantle',
    'triumph-oath-ring',
  ],
  witch: [
    'starjudge-scale-staff',
    'starjudge-observatory-crown',
    'starjudge-orbit-robe',
    'starjudge-fixedstar-ring',
  ],
  shaman: [
    'oracle-spirit-bell-staff',
    'oracle-rite-crown',
    'oracle-ritual-vestment',
    'oracle-pact-ring',
  ],
  catkin: [
    'swiftshadow-twin-claws',
    'swiftshadow-nighthunt-ears',
    'swiftshadow-stalker-suit',
    'swiftshadow-agile-ring',
  ],
};

const ITEMS = ['honor_sigil', 'box_sacred', 'box_starlight'];
const TIERS = ['qingying', 'feiyue', 'hupo', 'feiying', 'yingguan'];

const equipmentAssets = Object.entries(EQUIPMENT).flatMap(([classId, slugs]) =>
  slugs.map((slug) => ({
    id: `${classId}/${slug}`,
    label: `${classId} · ${slug}`,
    source: `art-source/arena/${classId}/${slug}-chroma.png`,
    output: `public/assets/equipment/arena/${classId}/${slug}.png`,
  })),
);
const rewardAssets = [
  ...ITEMS.map((id) => ({
    id,
    label: id,
    source: `art-source/arena/${id}-chroma.png`,
    output: `public/assets/items/${id}.png`,
  })),
  ...TIERS.map((id) => ({
    id: `tier-${id}`,
    label: `tier · ${id}`,
    source: `art-source/arena/tier-${id}-chroma.png`,
    output: `public/assets/arena/tier-${id}.png`,
  })),
];

const sourceRoot = resolve('art-source/arena');
const temporaryRoot = join(sourceRoot, '.alpha-tmp');
const codexRoot = process.env.CODEX_HOME ?? join(homedir(), '.codex');
const chromaHelper = join(
  codexRoot,
  'skills',
  '.system',
  'imagegen',
  'scripts',
  'remove_chroma_key.py',
);
const pythonCommand = process.env.PYTHON ?? 'python';

async function removeChroma(source, output) {
  await mkdir(dirname(output), { recursive: true });
  await execFileAsync(
    pythonCommand,
    [
      chromaHelper,
      '--input',
      source,
      '--out',
      output,
      '--auto-key',
      'border',
      '--soft-matte',
      '--transparent-threshold',
      '12',
      '--opaque-threshold',
      '220',
      '--despill',
      '--force',
    ],
    { windowsHide: true },
  );
}

async function buildIcon(asset) {
  const source = resolve(asset.source);
  const temporary = join(temporaryRoot, `${asset.id.replaceAll('/', '-')}-alpha.png`);
  const output = resolve(asset.output);
  const metadata = await sharp(source).metadata();
  if (metadata.format !== 'png' || !metadata.width || !metadata.height) {
    throw new Error(`${asset.source} 必须是可解码的 PNG 生产源`);
  }

  await removeChroma(source, temporary);
  await mkdir(dirname(output), { recursive: true });
  await sharp(temporary)
    .ensureAlpha()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(SUBJECT_SIZE, SUBJECT_SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .extend({
      top: (ICON_SIZE - SUBJECT_SIZE) / 2,
      bottom: (ICON_SIZE - SUBJECT_SIZE) / 2,
      left: (ICON_SIZE - SUBJECT_SIZE) / 2,
      right: (ICON_SIZE - SUBJECT_SIZE) / 2,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      palette: true,
      colours: 256,
      dither: 0.75,
    })
    .toFile(output);
}

async function buildBanner() {
  const source = resolve('art-source/arena/arena-banner.png');
  const output = resolve('public/assets/arena/arena-banner.webp');
  await mkdir(dirname(output), { recursive: true });
  await sharp(source)
    .resize({ width: 1536, withoutEnlargement: true })
    .webp({ quality: 86, effort: 6, smartSubsample: true })
    .toFile(output);
}

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function buildContactSheet({ assets, output, title, columns }) {
  const tileWidth = 220;
  const tileHeight = 254;
  const gap = 14;
  const headerHeight = 72;
  const rows = Math.ceil(assets.length / columns);
  const width = gap + columns * (tileWidth + gap);
  const height = headerHeight + gap + rows * (tileHeight + gap);
  const cards = assets
    .map((asset, index) => {
      const x = gap + (index % columns) * (tileWidth + gap);
      const y = headerHeight + gap + Math.floor(index / columns) * (tileHeight + gap);
      return [
        `<rect x="${x}" y="${y}" width="${tileWidth}" height="${tileHeight}" rx="18" fill="#ffffff" />`,
        `<rect x="${x + 12}" y="${y + 12}" width="${tileWidth - 24}" height="190" rx="12" fill="#eef6fb" />`,
        `<text x="${x + tileWidth / 2}" y="${y + 222}" text-anchor="middle" ` +
          `font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="#29445f">` +
          `${escapeXml(asset.label)}</text>`,
      ].join('');
    })
    .join('');

  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<rect width="100%" height="100%" fill="#dcebf5" />` +
      `<text x="${gap}" y="42" font-family="Arial, sans-serif" font-size="26" ` +
      `font-weight="700" fill="#203d5b">${escapeXml(title)}</text>` +
      `<text x="${width - gap}" y="42" text-anchor="end" font-family="Arial, sans-serif" ` +
      `font-size="14" fill="#5d748a">${assets.length} unique runtime assets</text>` +
      cards +
      '</svg>',
  );

  const iconComposites = await Promise.all(
    assets.map(async (asset, index) => {
      const x = gap + (index % columns) * (tileWidth + gap);
      const y = headerHeight + gap + Math.floor(index / columns) * (tileHeight + gap);
      return {
        input: await sharp(resolve(asset.output))
          .resize(180, 180, { fit: 'contain' })
          .png()
          .toBuffer(),
        left: x + 20,
        top: y + 17,
      };
    }),
  );

  const absoluteOutput = resolve(output);
  await mkdir(dirname(absoluteOutput), { recursive: true });
  await sharp(svg).composite(iconComposites).png({ compressionLevel: 9 }).toFile(absoluteOutput);
}

async function buildBannerPreview() {
  const source = resolve('public/assets/arena/arena-banner.webp');
  const output = resolve('art-source/qa/arena-banner-preview.png');
  await mkdir(dirname(output), { recursive: true });
  await sharp(source).resize({ width: 960 }).png({ compressionLevel: 9 }).toFile(output);
}

try {
  for (const asset of [...equipmentAssets, ...rewardAssets]) {
    await buildIcon(asset);
  }
  await buildBanner();
  await buildContactSheet({
    assets: equipmentAssets,
    output: 'art-source/qa/arena-equipment-contact-sheet.png',
    title: 'Arena Sacred-Mark Equipment · 4 classes × 4 slots',
    columns: 4,
  });
  await buildContactSheet({
    assets: rewardAssets,
    output: 'art-source/qa/arena-rewards-contact-sheet.png',
    title: 'Arena Rewards · currency, coffers and five tiers',
    columns: 4,
  });
  await buildBannerPreview();
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

console.log(
  `竞技场资产构建完成：${equipmentAssets.length} 张装备图标 + ` +
    `${rewardAssets.length} 张奖励图标 + 1 张横幅 + 3 张 QA 联系图；` +
    `源图来自 ${basename(sourceRoot)}。`,
);
