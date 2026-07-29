/**
 * 区域 5 怪物素材门禁。
 *
 * CI 可验证主仓中的运行时资产、PROMPTS、SHA 锁和联系表；在本机外置美术
 * 源仓存在时，还会逐条复核 chroma/alpha 文件的实际 SHA256。
 */

import { createHash } from 'node:crypto';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { REGION5_MONSTERS } from './region5-assets-manifest.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const RUNTIME_ROOT = resolve(ROOT, 'public/assets/monsters/r5');
const PROMPTS_PATH = resolve(ROOT, 'art-source/regions/r5/PROMPTS.md');
const LOCK_PATH = resolve(ROOT, 'art-source/regions/r5/MONSTERS-SHA256.txt');
const CONTACT_PATH = resolve(ROOT, 'art-source/qa/r5-monsters-contact.webp');
const DEFAULT_SOURCE_ROOT =
  'C:/Users/Administrator/Desktop/二次元传奇项目/yingrenchuanshuo-art-source-r5/monsters';
const SOURCE_ROOT = resolve(process.env.R5_MONSTER_SOURCE ?? DEFAULT_SOURCE_ROOT);

const EXPECTED_SIZE = 512;
const LAST_VISIBLE_Y = 503;
const ALPHA_THRESHOLD = 8;
const MAX_BYTES = 120 * 1024;
const MAX_CONTACT_BYTES = 1500 * 1024;

const errors = [];
const pixelHashes = new Map();

function fail(message) {
  errors.push(message);
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function findBoundsAndGreen(data, width, height) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  let visible = 0;
  let green = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const [r, g, b, alpha] = data.subarray(offset, offset + 4);
      if (alpha <= ALPHA_THRESHOLD) continue;
      visible += 1;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
      if (g > 96 && g > r * 1.35 && g > b * 1.35) green += 1;
    }
  }

  return {
    left,
    top,
    right,
    bottom,
    width: right - left + 1,
    height: bottom - top + 1,
    visible,
    green,
  };
}

const expectedFiles = REGION5_MONSTERS.map((monster) => `${monster.id}.webp`).sort();
const actualFiles = (await readdir(RUNTIME_ROOT)).filter((file) => !file.startsWith('.')).sort();
if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
  fail(`运行时文件集合不精确：expected=${expectedFiles.join(',')} actual=${actualFiles.join(',')}`);
}

for (const monster of REGION5_MONSTERS) {
  const path = resolve(RUNTIME_ROOT, `${monster.id}.webp`);
  const fileStat = await stat(path);
  if (fileStat.size > MAX_BYTES) {
    fail(`${monster.id} 超过 120 KiB：${fileStat.size} bytes`);
  }

  const metadata = await sharp(path).metadata();
  if (
    metadata.format !== 'webp' ||
    metadata.width !== EXPECTED_SIZE ||
    metadata.height !== EXPECTED_SIZE
  ) {
    fail(`${monster.id} 规格错误：${metadata.format} ${metadata.width}×${metadata.height}`);
  }
  if (!metadata.hasAlpha) fail(`${monster.id} 缺少 alpha 通道`);

  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const corners = [
    data[3],
    data[(info.width - 1) * 4 + 3],
    data[(info.height - 1) * info.width * 4 + 3],
    data[(info.width * info.height - 1) * 4 + 3],
  ];
  if (corners.some((alpha) => alpha !== 0)) {
    fail(`${monster.id} 四角未完全透明：${corners.join('/')}`);
  }

  const bounds = findBoundsAndGreen(data, info.width, info.height);
  if (bounds.visible === 0) {
    fail(`${monster.id} 没有可见像素`);
    continue;
  }
  if (bounds.bottom !== LAST_VISIBLE_Y) {
    fail(`${monster.id} 最后可见 y=${bounds.bottom}，应为 ${LAST_VISIBLE_Y}`);
  }
  if (bounds.width < 120 || bounds.height < 120 || bounds.width > 480 || bounds.height > 480) {
    fail(`${monster.id} 主体 bbox 不合理：${bounds.width}×${bounds.height}`);
  }
  const greenRatio = bounds.green / bounds.visible;
  if (greenRatio > 0.0005) {
    fail(
      `${monster.id} 疑似绿幕残留：${bounds.green}/${bounds.visible} (${(greenRatio * 100).toFixed(
        3,
      )}%)`,
    );
  }

  const pixelHash = sha256(data);
  const duplicate = pixelHashes.get(pixelHash);
  if (duplicate) {
    fail(`${monster.id} 与 ${duplicate} 像素完全相同`);
  } else {
    pixelHashes.set(pixelHash, monster.id);
  }
}

const prompts = await readFile(PROMPTS_PATH, 'utf8');
for (const monster of REGION5_MONSTERS) {
  const sectionPattern = new RegExp(
    `## ${monster.id}[\\s\\S]*?ImageGen call:\\s*\\\`call_[A-Za-z0-9]+\\\``,
  );
  if (!sectionPattern.test(prompts)) {
    fail(`PROMPTS 缺少 ${monster.id} 的独立 call id`);
  }
}
const documentedCalls = [...prompts.matchAll(/ImageGen call:\s*`(call_[A-Za-z0-9]+)`/g)].map(
  (match) => match[1],
);
if (documentedCalls.length !== REGION5_MONSTERS.length) {
  fail(`PROMPTS call id 数量为 ${documentedCalls.length}，应为 24`);
}
if (new Set(documentedCalls).size !== documentedCalls.length) {
  fail('PROMPTS 中存在重复 ImageGen call id');
}

const lockText = await readFile(LOCK_PATH, 'utf8');
const lockEntries = [...lockText.matchAll(/^([a-f0-9]{64}) {2}(monsters\/(.+))$/gm)].map(
  (match) => ({ hash: match[1], relative: match[2], filename: match[3] }),
);
const expectedSourceFiles = REGION5_MONSTERS.flatMap((monster) => [
  `${monster.id}-chroma.png`,
  `${monster.id}-alpha.png`,
]).sort();
const lockedSourceFiles = lockEntries.map((entry) => entry.filename).sort();
if (JSON.stringify(lockedSourceFiles) !== JSON.stringify(expectedSourceFiles)) {
  fail('MONSTERS-SHA256.txt 未精确锁定 24 组 chroma/alpha');
}
if (new Set(lockEntries.map((entry) => entry.hash)).size !== lockEntries.length) {
  fail('MONSTERS-SHA256.txt 中存在重复源图哈希');
}

try {
  await access(SOURCE_ROOT);
  for (const entry of lockEntries) {
    const sourcePath = resolve(SOURCE_ROOT, entry.filename);
    const source = await readFile(sourcePath);
    const actualHash = sha256(source);
    if (actualHash !== entry.hash) {
      fail(`${entry.filename} SHA256 与锁文件不一致`);
    }

    const { data, info } = await sharp(sourcePath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const corners = [
      0,
      info.width - 1,
      (info.height - 1) * info.width,
      info.width * info.height - 1,
    ];

    if (entry.filename.endsWith('-alpha.png')) {
      if (corners.some((index) => data[index * 4 + 3] !== 0)) {
        fail(`${entry.filename} alpha 母版四角未完全透明`);
      }
      const bounds = findBoundsAndGreen(data, info.width, info.height);
      if (bounds.visible === 0) {
        fail(`${entry.filename} alpha 母版没有可见主体`);
      } else if (bounds.green / bounds.visible > 0.0005) {
        fail(`${entry.filename} alpha 母版存在可检测绿边`);
      }
    } else {
      if (
        corners.some((index) => {
          const offset = index * 4;
          return (
            data[offset] !== 0 ||
            data[offset + 1] !== 255 ||
            data[offset + 2] !== 0 ||
            data[offset + 3] !== 255
          );
        })
      ) {
        fail(`${entry.filename} 绿幕四角不是严格 #00ff00`);
      }

      const borderIndexes = [];
      for (let x = 0; x < info.width; x += 1) {
        borderIndexes.push(x, (info.height - 1) * info.width + x);
      }
      for (let y = 1; y < info.height - 1; y += 1) {
        borderIndexes.push(y * info.width, y * info.width + info.width - 1);
      }
      if (
        borderIndexes.some((index) => {
          const offset = index * 4;
          return (
            data[offset] !== 0 ||
            data[offset + 1] !== 255 ||
            data[offset + 2] !== 0 ||
            data[offset + 3] !== 255
          );
        })
      ) {
        fail(`${entry.filename} 外沿不是严格、均匀的 #00ff00`);
      }
    }
  }
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
  console.log('ℹ 未检测到外置 R5 美术源仓，跳过本机源图哈希实文件复核');
}

const contactMetadata = await sharp(CONTACT_PATH).metadata();
const contactStat = await stat(CONTACT_PATH);
if (
  contactMetadata.format !== 'webp' ||
  !contactMetadata.width ||
  !contactMetadata.height ||
  contactMetadata.width < 1200 ||
  contactMetadata.height < 900
) {
  fail(
    `联系表规格错误：${contactMetadata.format} ${contactMetadata.width}×${contactMetadata.height}`,
  );
}
if (contactStat.size > MAX_CONTACT_BYTES) {
  fail(`联系表超过 1.5 MiB：${contactStat.size} bytes`);
}

if (errors.length > 0) {
  console.error(`\nR5 怪物素材门禁失败（${errors.length} 项）：`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `✓ R5 怪物素材门禁通过：24 个独立 512×512 WebP、透明边界/落点/绿边/体积/哈希/PROMPTS/SHA 锁/联系表全部合格`,
  );
}
