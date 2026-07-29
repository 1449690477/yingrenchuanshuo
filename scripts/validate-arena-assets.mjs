import { createHash } from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import sharp from 'sharp';

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
const ITEM_IDS = ['honor_sigil', 'box_sacred', 'box_starlight'];
const TIER_IDS = ['qingying', 'feiyue', 'hupo', 'feiying', 'yingguan'];
const BANNER_FILE = 'public/assets/arena/arena-banner.webp';
const BANNER_SOURCE = 'art-source/arena/arena-banner.png';
const PROMPT_FILE = 'art-source/arena/PROMPTS.md';
const QA_FILES = [
  'art-source/qa/arena-equipment-contact-sheet.png',
  'art-source/qa/arena-rewards-contact-sheet.png',
  'art-source/qa/arena-banner-preview.png',
];

const equipmentFiles = Object.entries(EQUIPMENT).flatMap(([classId, slugs]) =>
  slugs.map((slug) => `public/assets/equipment/arena/${classId}/${slug}.png`),
);
const itemFiles = ITEM_IDS.map((id) => `public/assets/items/${id}.png`);
const tierFiles = TIER_IDS.map((id) => `public/assets/arena/tier-${id}.png`);
const iconFiles = [...equipmentFiles, ...itemFiles, ...tierFiles];
const equipmentSources = Object.entries(EQUIPMENT).flatMap(([classId, slugs]) =>
  slugs.map((slug) => `art-source/arena/${classId}/${slug}-chroma.png`),
);
const iconSources = [
  ...equipmentSources,
  ...ITEM_IDS.map((id) => `art-source/arena/${id}-chroma.png`),
  ...TIER_IDS.map((id) => `art-source/arena/tier-${id}-chroma.png`),
];
const sourceFiles = [...iconSources, BANNER_SOURCE];

async function filesUnder(directory) {
  const absolute = resolve(directory);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = join(absolute, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(child)));
    else if (entry.isFile()) {
      files.push(relative(resolve('.'), child).replaceAll('\\', '/'));
    }
  }
  return files;
}

async function assertExactFiles(directory, expectedFiles, label) {
  const actualFiles = await filesUnder(directory);
  const expected = new Set(expectedFiles);
  const missing = expectedFiles.filter((file) => !actualFiles.includes(file));
  const unexpected = actualFiles.filter((file) => !expected.has(file));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `${label}不符合严格白名单；缺失：${missing.join('、') || '无'}；` +
        `多余：${unexpected.join('、') || '无'}`,
    );
  }
}

async function assertManifest() {
  if (
    equipmentFiles.length !== 16 ||
    itemFiles.length !== 3 ||
    tierFiles.length !== 5 ||
    sourceFiles.length !== 25
  ) {
    throw new Error('竞技场资产清单必须严格为 16 装备 + 3 物品 + 5 徽章 + 1 横幅');
  }
  if (new Set([...iconFiles, BANNER_FILE]).size !== 25) {
    throw new Error('竞技场运行时资产路径存在重复');
  }

  await assertExactFiles('public/assets/equipment/arena', equipmentFiles, '竞技场装备运行时目录');
  await assertExactFiles(
    'public/assets/arena',
    [...tierFiles, BANNER_FILE],
    '竞技场通用运行时目录',
  );
  await assertExactFiles('art-source/arena', [...sourceFiles, PROMPT_FILE], '竞技场生产源目录');

  for (const file of [...sourceFiles, PROMPT_FILE, ...QA_FILES]) {
    const info = await stat(resolve(file));
    if (!info.isFile() || info.size === 0) throw new Error(`${file} 不是有效生产文件`);
    if (file.startsWith('art-source/arena/') && info.size > 3 * 1024 * 1024) {
      throw new Error(`${file} 超过 3MB 生产源上限`);
    }
  }
}

async function validateTransparentPng(file) {
  const absolute = resolve(file);
  const [{ size }, metadata, raw] = await Promise.all([
    stat(absolute),
    sharp(absolute).metadata(),
    sharp(absolute).raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (size > 120 * 1024) {
    throw new Error(`${file} 为 ${Math.ceil(size / 1024)}KB，超过 120KB`);
  }
  if (
    metadata.format !== 'png' ||
    metadata.width !== 256 ||
    metadata.height !== 256 ||
    metadata.channels !== 4 ||
    metadata.hasAlpha !== true
  ) {
    throw new Error(
      `${file} 必须是 256×256 RGBA PNG；当前为 ` +
        `${metadata.width ?? '?'}×${metadata.height ?? '?'} ` +
        `${metadata.channels ?? '?'} 通道 ${metadata.format ?? '未知格式'}`,
    );
  }

  const { data, info } = raw;
  const cornerAlpha = [
    data[3],
    data[(info.width - 1) * info.channels + 3],
    data[(info.height - 1) * info.width * info.channels + 3],
    data[(info.height * info.width - 1) * info.channels + 3],
  ];
  if (cornerAlpha.some((alpha) => alpha !== 0)) {
    throw new Error(`${file} 四角必须完全透明，当前 alpha=${cornerAlpha.join('/')}`);
  }

  let visible = 0;
  let greenSpill = 0;
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const alpha = data[offset + 3];
    if (alpha <= 8) continue;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const pixel = offset / info.channels;
    const x = pixel % info.width;
    const y = Math.floor(pixel / info.width);
    visible += 1;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    if (green >= 120 && green - red >= 60 && green - blue >= 60) greenSpill += 1;
  }

  const pixels = info.width * info.height;
  const visibleRatio = visible / pixels;
  if (visibleRatio < 0.01 || visibleRatio > 0.82) {
    throw new Error(`${file} 可见主体占比异常：${(visibleRatio * 100).toFixed(1)}%`);
  }
  if (greenSpill > Math.max(8, visible * 0.002)) {
    throw new Error(`${file} 疑似残留绿幕像素：${greenSpill}/${visible}`);
  }
  if (minX <= 0 || minY <= 0 || maxX >= info.width - 1 || maxY >= info.height - 1) {
    throw new Error(`${file} 主体触碰画布边缘，存在裁切风险`);
  }

  return createHash('sha256').update(data).digest('hex');
}

async function validateSourceImages() {
  for (const file of iconSources) {
    const metadata = await sharp(resolve(file)).metadata();
    if (
      metadata.format !== 'png' ||
      (metadata.width ?? 0) < 512 ||
      metadata.width !== metadata.height
    ) {
      throw new Error(
        `${file} 必须是边长至少 512 的方形 PNG 生产源；当前 ` +
          `${metadata.width ?? '?'}×${metadata.height ?? '?'} ${metadata.format ?? '未知格式'}`,
      );
    }
  }

  const bannerMetadata = await sharp(resolve(BANNER_SOURCE)).metadata();
  const ratio = (bannerMetadata.width ?? 0) / (bannerMetadata.height ?? 1);
  if (
    bannerMetadata.format !== 'png' ||
    (bannerMetadata.width ?? 0) < 1200 ||
    ratio < 1.5 ||
    ratio > 1.7
  ) {
    throw new Error(
      `${BANNER_SOURCE} 必须是宽度不低于 1200、宽高比 1.5~1.7 的 PNG；当前 ` +
        `${bannerMetadata.width ?? '?'}×${bannerMetadata.height ?? '?'}`,
    );
  }
}

async function validateBanner() {
  const absolute = resolve(BANNER_FILE);
  const [{ size }, metadata] = await Promise.all([stat(absolute), sharp(absolute).metadata()]);
  const ratio = (metadata.width ?? 0) / (metadata.height ?? 1);
  if (metadata.format !== 'webp' || (metadata.width ?? 0) < 1200 || ratio < 1.5 || ratio > 1.7) {
    throw new Error(
      `${BANNER_FILE} 必须是宽度不低于 1200、宽高比 1.5~1.7 的 WebP；当前 ` +
        `${metadata.width ?? '?'}×${metadata.height ?? '?'} ${metadata.format ?? '未知格式'}`,
    );
  }
  if (size > 400 * 1024) {
    throw new Error(`${BANNER_FILE} 为 ${Math.ceil(size / 1024)}KB，超过 400KB`);
  }
}

await assertManifest();
await validateSourceImages();

const hashes = [];
for (const file of iconFiles) hashes.push(await validateTransparentPng(file));
if (new Set(hashes).size !== hashes.length) {
  throw new Error('竞技场运行时图标存在像素完全重复的占位图');
}

await validateBanner();

console.log(
  `竞技场资产校验通过：${equipmentFiles.length} 张装备 + ${itemFiles.length} 张物品 + ` +
    `${tierFiles.length} 张段位徽章 + 1 张横幅，${sourceFiles.length} 张生产源，` +
    `${QA_FILES.length} 张 QA 联系图。`,
);
