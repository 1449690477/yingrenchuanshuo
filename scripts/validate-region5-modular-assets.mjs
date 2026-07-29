/**
 * 区域 5 四职业纸娃娃资产门禁。
 *
 * 默认只检查主仓运行时 PNG、SHA 锁、合成对位和联系表，可在没有美术源仓的
 * CI / Pages 环境运行。显式传入 `--with-sources` 时，才追加检查独立源仓里的
 * 24 张绿幕原图与 24 张官方抠图 alpha 母版。
 */

import { createHash } from 'node:crypto';
import { access, readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const SOURCE_ROOT = process.env.REGION5_MODULAR_SOURCE_ROOT?.trim()
  ? resolve(process.env.REGION5_MODULAR_SOURCE_ROOT)
  : resolve(ROOT, '..', 'yingrenchuanshuo-art-source-r5', 'modular');
const WITH_SOURCES = process.argv.includes('--with-sources');
const LOCK_PATH = resolve(
  ROOT,
  'art-source/regions/r5/MODULAR-SOURCE-SHA256.json',
);
const CONTACT_PATH = resolve(ROOT, 'art-source/qa/r5-modular-contact.webp');

const CLASSES = ['swordsman', 'witch', 'shaman', 'catkin'];
const FAMILIES = ['r5', 'r5-crimson'];
const SLOTS = ['body', 'head', 'weapon'];
const EXPECTED_COUNT = CLASSES.length * FAMILIES.length * SLOTS.length;
const MAX_RUNTIME_BYTES = 300 * 1024;

const EYE_BANDS = {
  swordsman: { left: 285, top: 110, width: 100, height: 30 },
  witch: { left: 280, top: 105, width: 100, height: 35 },
  shaman: { left: 280, top: 105, width: 105, height: 35 },
  catkin: { left: 292, top: 120, width: 78, height: 20 },
};

const WEAPON_HAND_BOXES = {
  swordsman: [{ left: 160, top: 390, width: 75, height: 90 }],
  witch: [{ left: 190, top: 305, width: 85, height: 100 }],
  shaman: [{ left: 300, top: 270, width: 90, height: 95 }],
  catkin: [
    { left: 145, top: 365, width: 100, height: 115 },
    { left: 435, top: 255, width: 115, height: 115 },
  ],
};

function fail(message) {
  throw new Error(`R5 纸娃娃资产门禁失败：${message}`);
}

async function requireFile(path) {
  try {
    await access(path);
  } catch {
    fail(`缺少文件 ${path}`);
  }
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

function keyFor(classId, family, slot) {
  return `${classId}:${family}:${slot}`;
}

function runtimePathFor(classId, family, slot) {
  return resolve(
    ROOT,
    'public/assets/characters/modular',
    classId,
    `${family}-${slot}.png`,
  );
}

async function rgba(path) {
  return sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

function alphaBounds(data, info, threshold = 16) {
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  let pixels = 0;
  let residualGreen = 0;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * 4;
      const alpha = data[offset + 3];
      if (alpha <= threshold) continue;
      pixels += 1;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      if (
        green >= 185 &&
        green > red * 1.55 &&
        green > blue * 1.45
      ) {
        residualGreen += 1;
      }
    }
  }
  return { left, top, right, bottom, pixels, residualGreen };
}

function alphaCountInRect(data, info, rect, threshold = 24) {
  let pixels = 0;
  const right = Math.min(info.width, rect.left + rect.width);
  const bottom = Math.min(info.height, rect.top + rect.height);
  for (let y = Math.max(0, rect.top); y < bottom; y += 1) {
    for (let x = Math.max(0, rect.left); x < right; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] > threshold) pixels += 1;
    }
  }
  return pixels;
}

function cornerAlphas(data, info) {
  const points = [
    [0, 0],
    [info.width - 1, 0],
    [0, info.height - 1],
    [info.width - 1, info.height - 1],
  ];
  return points.map(
    ([x, y]) => data[(y * info.width + x) * 4 + 3],
  );
}

function alphaMaskIoU(first, second, threshold = 24) {
  let intersection = 0;
  let union = 0;
  for (let index = 3; index < first.length; index += 4) {
    const a = first[index] > threshold;
    const b = second[index] > threshold;
    if (a || b) union += 1;
    if (a && b) intersection += 1;
  }
  return union === 0 ? 1 : intersection / union;
}

const lock = JSON.parse(await readFile(LOCK_PATH, 'utf8'));
if (
  lock.version !== 1 ||
  lock.algorithm !== 'sha256' ||
  !lock.assets ||
  typeof lock.assets !== 'object'
) {
  fail('MODULAR-SOURCE-SHA256.json 结构或版本不正确');
}

const expectedKeys = [];
for (const classId of CLASSES) {
  for (const family of FAMILIES) {
    for (const slot of SLOTS) {
      expectedKeys.push(keyFor(classId, family, slot));
    }
  }
}
const lockedKeys = Object.keys(lock.assets).sort();
if (
  lockedKeys.length !== EXPECTED_COUNT ||
  JSON.stringify(lockedKeys) !== JSON.stringify([...expectedKeys].sort())
) {
  fail(`SHA 锁必须精确登记 ${EXPECTED_COUNT} 个矩阵项`);
}

const callIds = new Set();
const runtimeHashes = new Set();
const runtimeRaw = new Map();

for (const key of expectedKeys) {
  const [classId, family, slot] = key.split(':');
  const entry = lock.assets[key];
  const runtimePath = runtimePathFor(classId, family, slot);
  await requireFile(runtimePath);

  if (!entry.callId || callIds.has(entry.callId)) {
    fail(`${key} 的 ImageGen callId 缺失或与其他资产重复`);
  }
  callIds.add(entry.callId);

  const relativeRuntime =
    `public/assets/characters/modular/${classId}/${family}-${slot}.png`;
  if (entry.runtimePath !== relativeRuntime) {
    fail(`${key} 的 runtimePath 与正式路由不一致`);
  }
  const runtimeHash = await sha256(runtimePath);
  if (runtimeHash !== entry.runtimeSha256) {
    fail(`${key} 运行时 SHA 漂移，请重建并审查后更新锁`);
  }
  if (runtimeHashes.has(runtimeHash)) {
    fail(`${key} 与另一资产像素完全重复`);
  }
  runtimeHashes.add(runtimeHash);

  const file = await stat(runtimePath);
  if (file.size > MAX_RUNTIME_BYTES) {
    fail(`${key} 超过 300KiB：${file.size} bytes`);
  }
  const metadata = await sharp(runtimePath).metadata();
  if (
    metadata.format !== 'png' ||
    metadata.width !== 640 ||
    metadata.height !== 960 ||
    metadata.channels !== 4 ||
    !metadata.hasAlpha
  ) {
    fail(`${key} 必须是 640×960 RGBA PNG`);
  }

  const raw = await rgba(runtimePath);
  runtimeRaw.set(key, raw);
  const bounds = alphaBounds(raw.data, raw.info);
  if (bounds.pixels < 1_000) {
    fail(`${key} 主体为空或过小`);
  }
  if (
    bounds.left < 2 ||
    bounds.top < 2 ||
    bounds.right > 637 ||
    bounds.bottom > 957
  ) {
    fail(`${key} 主体触碰画布边缘`);
  }
  if (cornerAlphas(raw.data, raw.info).some((alpha) => alpha > 4)) {
    fail(`${key} 四角必须透明`);
  }
  if (bounds.residualGreen > 24) {
    fail(`${key} 检出 ${bounds.residualGreen} 个高亮残绿像素`);
  }
}

for (const classId of CLASSES) {
  const eyeBand = EYE_BANDS[classId];
  for (const family of FAMILIES) {
    for (const slot of ['body', 'weapon']) {
      const raw = runtimeRaw.get(keyFor(classId, family, slot));
      const covered = alphaCountInRect(raw.data, raw.info, eyeBand);
      const ratio = covered / (eyeBand.width * eyeBand.height);
      const maxEyeCoverage = classId === 'catkin' ? 0.08 : 0.025;
      if (ratio > maxEyeCoverage) {
        fail(
          `${classId}/${family}-${slot} 遮挡眼部核心区 ${(ratio * 100).toFixed(1)}%`,
        );
      }
    }

    const weapon = runtimeRaw.get(keyFor(classId, family, 'weapon'));
    for (const handBox of WEAPON_HAND_BOXES[classId]) {
      const overlap = alphaCountInRect(
        weapon.data,
        weapon.info,
        handBox,
        16,
      );
      if (overlap < 45) {
        fail(`${classId}/${family}-weapon 未命中既定握持点`);
      }
    }

    const head = runtimeRaw.get(keyFor(classId, family, 'head'));
    const headBounds = alphaBounds(head.data, head.info);
    if (classId === 'catkin' && headBounds.right - headBounds.left > 250) {
      fail(`${classId}/${family}-head 过宽，可能压住猫耳`);
    }
  }

  for (const slot of SLOTS) {
    const normal = runtimeRaw.get(keyFor(classId, 'r5', slot));
    const crimson = runtimeRaw.get(keyFor(classId, 'r5-crimson', slot));
    const iou = alphaMaskIoU(normal.data, crimson.data);
    if (iou > 0.9) {
      fail(
        `${classId}/${slot} 普通装与绯焰套轮廓 IoU=${iou.toFixed(3)}，疑似仅改色`,
      );
    }
  }
}

await requireFile(CONTACT_PATH);
const contactMetadata = await sharp(CONTACT_PATH).metadata();
if (
  contactMetadata.format !== 'webp' ||
  !contactMetadata.width ||
  !contactMetadata.height ||
  contactMetadata.width < 1_000 ||
  contactMetadata.height < 800
) {
  fail('r5-modular-contact.webp 必须是可读的普通 / 绯焰八套对比联系表');
}

if (WITH_SOURCES) {
  for (const key of expectedKeys) {
    const entry = lock.assets[key];
    const relativeSource = entry.sourcePath.replace(/^modular\//, '');
    const relativeAlpha = entry.alphaPath.replace(/^modular\//, '');
    const sourcePath = resolve(SOURCE_ROOT, relativeSource);
    const alphaPath = resolve(SOURCE_ROOT, relativeAlpha);
    await requireFile(sourcePath);
    await requireFile(alphaPath);

    if ((await sha256(sourcePath)) !== entry.sourceSha256) {
      fail(`${key} 外置绿幕原图 SHA 漂移`);
    }
    if ((await sha256(alphaPath)) !== entry.alphaSha256) {
      fail(`${key} 外置 alpha 母版 SHA 漂移`);
    }

    const sourceMetadata = await sharp(sourcePath).metadata();
    if (
      !sourceMetadata.width ||
      !sourceMetadata.height ||
      Math.abs(sourceMetadata.width / sourceMetadata.height - 2 / 3) > 0.005
    ) {
      fail(`${key} 外置绿幕原图必须保持 2:3 画布`);
    }
    const sourceRaw = await rgba(sourcePath);
    const cornerRgb = [
      [0, 0],
      [sourceRaw.info.width - 1, 0],
      [0, sourceRaw.info.height - 1],
      [sourceRaw.info.width - 1, sourceRaw.info.height - 1],
    ].map(([x, y]) => {
      const offset = (y * sourceRaw.info.width + x) * 4;
      return [
        sourceRaw.data[offset],
        sourceRaw.data[offset + 1],
        sourceRaw.data[offset + 2],
      ];
    });
    if (
      cornerRgb.some(
        ([red, green, blue]) =>
          green < 220 || green <= red * 3 || green <= blue * 3,
      )
    ) {
      fail(`${key} 绿幕母版四角不是纯净高饱和绿色`);
    }

    const alphaRaw = await rgba(alphaPath);
    const alphaMetadata = await sharp(alphaPath).metadata();
    if (!alphaMetadata.hasAlpha) {
      fail(`${key} 外置 alpha 母版缺少透明通道`);
    }
    if (cornerAlphas(alphaRaw.data, alphaRaw.info).some((alpha) => alpha > 4)) {
      fail(`${key} 外置 alpha 母版四角不透明`);
    }
    if (alphaBounds(alphaRaw.data, alphaRaw.info).pixels < 1_000) {
      fail(`${key} 外置 alpha 母版为空`);
    }
  }
}

console.log(
  `✓ R5 纸娃娃门禁通过：${EXPECTED_COUNT} 张运行时层、8 套合成、24 个唯一 ImageGen key${
    WITH_SOURCES ? '，并已核验 48 个外置母版文件' : ''
  }。`,
);
