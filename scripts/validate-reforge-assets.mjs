import { createHash } from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import sharp from 'sharp';

const ITEM_IDS = [
  'sand_crystal',
  'charm_bind',
  'sigil_swordsman',
  'sigil_witch',
  'sigil_shaman',
  'sigil_catkin',
  'sigil_kenshi',
  'crystal_resonance',
];
const EFFECT_IDS = ['reforge-swirl', 'tier-up-burst', 'lock-seal'];
/** 洗练工坊四个操作按钮的图标（kimi 的工坊 UI），与 ReforgeStudio.vue 的 opIconUrl 一一对应。 */
const OP_ICON_IDS = ['op-temper', 'op-inscribe', 'op-reforge', 'op-resonate'];
/** 工坊页头横幅。非透明底图，走 webp 而不是 RGBA PNG，因此单独校验。 */
const BANNER_FILE = 'public/assets/effects/reforge/reforge-studio-banner.webp';

const itemFiles = ITEM_IDS.map((id) => `public/assets/items/${id}.png`);
const effectFiles = EFFECT_IDS.map((id) => `public/assets/effects/reforge/${id}.png`);
const opIconFiles = OP_ICON_IDS.map((id) => `public/assets/effects/reforge/${id}.png`);
const sourceFiles = [
  ...[...ITEM_IDS.filter((id) => id !== 'sigil_kenshi'), ...EFFECT_IDS].map(
    (id) => `art-source/reforge/${id}-chroma.png`,
  ),
  // 樱酱徽记来自角色系统物品母版；不得伪造一张不存在的 reforge 绿幕源。
  'art-source/characters/kenshi/atlases/system-items-alpha.png',
  // 操作图标与横幅是直接产出的透明图/底图，没有绿幕中间态
  ...OP_ICON_IDS.map((id) => `art-source/reforge/${id}.png`),
  'art-source/reforge/studio-banner.png',
];
const promptFiles = [
  'art-source/reforge/PROMPTS.md',
  'art-source/reforge/PROMPTS-SIGILS.md',
  'art-source/reforge/PROMPTS-MATERIALS-EFFECTS.md',
];

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

async function assertManifest() {
  if (itemFiles.length !== 8 || effectFiles.length !== 3) {
    throw new Error('洗练资产清单必须严格为 8 张材料图标和 3 张特效图');
  }
  const actualEffects = await filesUnder('public/assets/effects/reforge');
  const declared = [...effectFiles, ...opIconFiles, BANNER_FILE];
  const expectedEffects = new Set(declared);
  const missing = declared.filter((file) => !actualEffects.includes(file));
  const unexpected = actualEffects.filter((file) => !expectedEffects.has(file));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `洗练特效目录与清单不一致；缺失：${missing.join('、') || '无'}；` +
        `多余：${unexpected.join('、') || '无'}`,
    );
  }

  for (const file of [...sourceFiles, ...promptFiles]) {
    const info = await stat(resolve(file));
    if (!info.isFile() || info.size === 0) throw new Error(`${file} 不是有效生产源文件`);
    if (info.size > 3 * 1024 * 1024) throw new Error(`${file} 超过 3MB 生产源上限`);
  }
}

async function validateTransparentPng(file, width, height, maxBytes) {
  const absolute = resolve(file);
  const [{ size }, metadata, raw] = await Promise.all([
    stat(absolute),
    sharp(absolute).metadata(),
    sharp(absolute).raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (size > maxBytes) {
    throw new Error(`${file} 为 ${Math.ceil(size / 1024)}KB，超过 ${Math.ceil(maxBytes / 1024)}KB`);
  }
  if (
    metadata.format !== 'png' ||
    metadata.width !== width ||
    metadata.height !== height ||
    metadata.channels !== 4 ||
    metadata.hasAlpha !== true
  ) {
    throw new Error(
      `${file} 必须是 ${width}×${height} RGBA PNG；当前为 ` +
        `${metadata.width ?? '?'}×${metadata.height ?? '?'} ${metadata.channels ?? '?'} 通道`,
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
    throw new Error(`${file} 四角必须透明，当前 alpha=${cornerAlpha.join('/')}`);
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
  if (visible < pixels * 0.01 || visible > pixels * 0.82) {
    throw new Error(`${file} 可见主体占比异常：${((visible / pixels) * 100).toFixed(1)}%`);
  }
  if (greenSpill > Math.max(8, visible * 0.002)) {
    throw new Error(`${file} 疑似残留绿幕像素：${greenSpill}/${visible}`);
  }
  if (minX <= 0 || minY <= 0 || maxX >= info.width - 1 || maxY >= info.height - 1) {
    throw new Error(`${file} 主体触碰画布边缘，存在裁切风险`);
  }

  return createHash('sha256').update(data).digest('hex');
}

/**
 * 工坊横幅：不透明底图，只保证格式、尺寸比例与体积。
 * 宽高比放宽到 1.5~1.7，出图工具在 3:2 附近会有几十像素的浮动。
 */
async function validateBanner() {
  const absolute = resolve(BANNER_FILE);
  const [{ size }, metadata] = await Promise.all([stat(absolute), sharp(absolute).metadata()]);
  if (metadata.format !== 'webp') {
    throw new Error(`${BANNER_FILE} 必须是 webp，当前为 ${metadata.format ?? '?'}`);
  }
  if (size > 400 * 1024) {
    throw new Error(`${BANNER_FILE} 为 ${Math.ceil(size / 1024)}KB，超过 400KB`);
  }
  const ratio = (metadata.width ?? 0) / (metadata.height ?? 1);
  if ((metadata.width ?? 0) < 1200 || ratio < 1.5 || ratio > 1.7) {
    throw new Error(
      `${BANNER_FILE} 需为宽度不低于 1200 的横幅且宽高比落在 1.5~1.7；` +
        `当前 ${metadata.width ?? '?'}×${metadata.height ?? '?'}`,
    );
  }
}

await assertManifest();
const hashes = [];
for (const file of itemFiles) {
  hashes.push(await validateTransparentPng(file, 256, 256, 120 * 1024));
}
for (const file of effectFiles) {
  hashes.push(await validateTransparentPng(file, 512, 512, 280 * 1024));
}
for (const file of opIconFiles) {
  hashes.push(await validateTransparentPng(file, 256, 256, 120 * 1024));
}
if (new Set(hashes).size !== hashes.length) {
  throw new Error('洗练运行时素材存在像素完全重复的占位图');
}

await validateBanner();

console.log(
  `洗练资产校验通过：${itemFiles.length} 张材料图标 + ${effectFiles.length} 张特效 + ` +
    `${opIconFiles.length} 张操作图标 + 1 张工坊横幅，` +
    `${sourceFiles.length} 张生产源，${promptFiles.map((file) => basename(file)).join(' / ')}`,
);
