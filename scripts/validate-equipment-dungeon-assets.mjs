import { readdir, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import sharp from 'sharp';

const TIERS = ['azure', 'violet', 'auric', 'crimson'];
const CLASSES = ['swordsman', 'witch', 'shaman', 'catkin', 'kenshi'];
const ICON_KEYS = [
  'weapon-swordsman',
  'weapon-witch',
  'weapon-shaman',
  'weapon-catkin',
  'weapon-kenshi',
  'body-swordsman',
  'body-witch',
  'body-shaman',
  'body-catkin',
  'body-kenshi',
  'head-starlace',
  'head-dreamhat',
  'necklace-heart',
  'necklace-moon',
  'bracelet-butterfly',
  'bracelet-rose',
  'ring-star',
  'ring-guard',
  'belt-bow',
  'belt-starlight',
  'shoes-stardust',
  'shoes-ribbon',
];
const SLOTS = ['weapon', 'head', 'body', 'necklace', 'bracelet', 'ring', 'belt', 'shoes'];
const MONSTER_KINDS = ['minion', 'boss'];
const DOLL_SLOTS = ['body', 'head', 'shoes', 'weapon'];

const mapFiles = SLOTS.map((slot) => `public/assets/dungeons/equipment/${slot}-battle.webp`);
const monsterFiles = SLOTS.flatMap((slot) =>
  MONSTER_KINDS.map((kind) => `public/assets/monsters/equipment-dungeon/${slot}-${kind}.webp`),
);
const iconFiles = TIERS.flatMap((tier) =>
  ICON_KEYS.map((key) => `public/assets/equipment/dungeon/${tier}/${key}.png`),
);
const characterFiles = TIERS.flatMap((tier) =>
  CLASSES.flatMap((classId) =>
    DOLL_SLOTS.map(
      (slot) => `public/assets/characters/modular/dungeon/${tier}/${classId}-${slot}.png`,
    ),
  ),
);

function assertExactManifest() {
  if (mapFiles.length !== 8) throw new Error(`地图清单应为 8，当前 ${mapFiles.length}`);
  if (monsterFiles.length !== 16) {
    throw new Error(`怪物清单应为 16，当前 ${monsterFiles.length}`);
  }
  if (iconFiles.length !== 88) {
    throw new Error(`装备图标清单应为 88，当前 ${iconFiles.length}`);
  }
  if (characterFiles.length !== 80) {
    throw new Error(`纸娃娃外观清单应为 80，当前 ${characterFiles.length}`);
  }
  const all = [...mapFiles, ...monsterFiles, ...iconFiles, ...characterFiles];
  if (new Set(all).size !== 192) throw new Error('装备副本资产清单存在重复路径');
}

async function filesUnder(directory) {
  const absolute = resolve(directory);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = join(absolute, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(child)));
    else if (entry.isFile()) files.push(relative(resolve('.'), child).replaceAll('\\', '/'));
  }
  return files;
}

async function assertNoUnexpectedRuntimeFiles() {
  const roots = [
    'public/assets/dungeons/equipment',
    'public/assets/monsters/equipment-dungeon',
    'public/assets/equipment/dungeon',
    'public/assets/characters/modular/dungeon',
  ];
  const expected = new Set([...mapFiles, ...monsterFiles, ...iconFiles, ...characterFiles]);
  const actual = (await Promise.all(roots.map(filesUnder))).flat();
  const unexpected = actual.filter((file) => !expected.has(file));
  const missing = [...expected].filter((file) => !actual.includes(file));
  if (unexpected.length > 0 || missing.length > 0) {
    throw new Error(
      `装备副本运行时目录必须严格等于 192 项清单；` +
        `多余：${unexpected.join('、') || '无'}；缺失：${missing.join('、') || '无'}`,
    );
  }
}

async function validateCharacter(file) {
  const absolute = resolve(file);
  const [metadata, info, raw] = await Promise.all([
    sharp(absolute).metadata(),
    stat(absolute),
    sharp(absolute).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (metadata.width !== 640 || metadata.height !== 960 || metadata.channels !== 4) {
    throw new Error(
      `${file} 必须为 640×960 RGBA，当前 ${metadata.width}×${metadata.height} ${metadata.channels}通道`,
    );
  }
  const isBody = file.endsWith('-body.png');
  const maxBytes = (isBody ? 560 : 180) * 1024;
  if (info.size > maxBytes) throw new Error(`${file} 体积 ${info.size} 超过 ${maxBytes}`);
  const { data, info: rawInfo } = raw;
  const corners = [
    3,
    (rawInfo.width - 1) * rawInfo.channels + 3,
    (rawInfo.height - 1) * rawInfo.width * rawInfo.channels + 3,
    (rawInfo.height * rawInfo.width - 1) * rawInfo.channels + 3,
  ];
  if (corners.some((offset) => data[offset] !== 0)) {
    throw new Error(`${file} 四角不是完全透明`);
  }
  let visible = 0;
  let greenSpill = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    const alpha = data[offset + 3];
    if (alpha <= 8) continue;
    visible += 1;
    if (
      alpha > 32 &&
      data[offset + 1] > 126 &&
      data[offset + 1] > data[offset] * 1.38 &&
      data[offset + 1] > data[offset + 2] * 1.38
    ) {
      greenSpill += 1;
    }
  }
  if (visible < (isBody ? 45_000 : 150)) throw new Error(`${file} 可见主体过少`);
  if (greenSpill > Math.max(8, visible * 0.0004)) {
    throw new Error(`${file} 检出 ${greenSpill} 个疑似绿幕污染像素`);
  }
}

async function validateMap(file) {
  const absolute = resolve(file);
  const [metadata, info] = await Promise.all([sharp(absolute).metadata(), stat(absolute)]);
  if (metadata.width !== 1536 || metadata.height !== 1024 || metadata.format !== 'webp') {
    throw new Error(
      `${file} 必须为 1536×1024 WebP，当前 ${metadata.width}×${metadata.height} ${metadata.format}`,
    );
  }
  if (info.size > 520 * 1024) {
    throw new Error(`${file} 体积 ${info.size} 超过 520 KiB`);
  }
}

async function validateTransparent(file, width, height, maxBytes, safeMargin) {
  const absolute = resolve(file);
  const [metadata, info, raw] = await Promise.all([
    sharp(absolute).metadata(),
    stat(absolute),
    sharp(absolute).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (metadata.width !== width || metadata.height !== height || metadata.channels !== 4) {
    throw new Error(
      `${file} 必须为 ${width}×${height} RGBA，当前 ${metadata.width}×${metadata.height} ${metadata.channels}通道`,
    );
  }
  if (info.size > maxBytes) {
    throw new Error(`${file} 体积 ${info.size} 超过 ${maxBytes}`);
  }

  const { data, info: rawInfo } = raw;
  let visible = 0;
  let greenSpill = 0;
  let minX = rawInfo.width;
  let minY = rawInfo.height;
  let maxX = -1;
  let maxY = -1;
  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const alpha = data[offset + 3];
    if (alpha <= 8) continue;
    const pixel = offset / 4;
    const x = pixel % rawInfo.width;
    const y = Math.floor(pixel / rawInfo.width);
    visible += 1;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    if (alpha > 32 && green > 126 && green > red * 1.38 && green > blue * 1.38) {
      greenSpill += 1;
    }
  }
  if (visible < width * height * 0.015) throw new Error(`${file} 可见主体过少`);
  if (greenSpill > Math.max(8, visible * 0.0004)) {
    throw new Error(`${file} 检出 ${greenSpill} 个疑似绿幕污染像素`);
  }
  if (
    minX < safeMargin ||
    minY < safeMargin ||
    maxX >= width - safeMargin ||
    maxY >= height - safeMargin
  ) {
    throw new Error(`${file} 主体越过 ${safeMargin}px 安全边距：[${minX},${minY},${maxX},${maxY}]`);
  }
}

assertExactManifest();
await assertNoUnexpectedRuntimeFiles();
for (const file of mapFiles) await validateMap(file);
for (const file of monsterFiles) {
  await validateTransparent(file, 512, 512, 140 * 1024, 12);
}
for (const file of iconFiles) {
  await validateTransparent(file, 256, 256, 120 * 1024, 12);
}
for (const file of characterFiles) await validateCharacter(file);

console.log('装备副本资产审计通过：8 张地图 + 16 个怪物 + 88 个装备图标 + 80 个纸娃娃外观。');
