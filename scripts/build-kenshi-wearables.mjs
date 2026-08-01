#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const ROOT = resolve('.');
const CHECK = process.argv.includes('--check');
const REBUILD = process.argv.includes('--rebuild') || !CHECK;
const CANVAS = { width: 640, height: 960 };
const SOURCE_ROOT = 'art-source/characters/kenshi/wearables';
const THEME_ATLAS = `${SOURCE_ROOT}/theme-equipment-atlas-alpha.png`;

const transparentCanvas = () => ({
  create: {
    width: CANVAS.width,
    height: CANVAS.height,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
});

const iconCleanupPaths = [
  'public/assets/equipment/arena/kenshi/blinkbloom-snowear-crown.png',
  'public/assets/equipment/arena/kenshi/blinkbloom-whitefeather-garb.png',
  'public/assets/equipment/arena/kenshi/blinkbloom-return-ring.png',
  'public/assets/equipment/affection/kenshi/homeward-sakura-ring.png',
  'public/assets/equipment/affection/kenshi/moonblue-lantern-date-kimono.png',
  'public/assets/equipment/affection/kenshi/white-feather-guardian-kimono.png',
];

const runtimeWearables = [
  {
    source: 'public/assets/equipment/arena/kenshi/blinkbloom-boundary-katana.png',
    output:
      'public/assets/characters/modular/arena/kenshi/blinkbloom-boundary-katana.png',
    slot: 'weapon',
  },
  {
    source: 'public/assets/equipment/arena/kenshi/blinkbloom-snowear-crown.png',
    output:
      'public/assets/characters/modular/arena/kenshi/blinkbloom-snowear-crown.png',
    slot: 'head',
  },
  {
    source: `${SOURCE_ROOT}/arena-whitefeather-body.png`,
    output:
      'public/assets/characters/modular/arena/kenshi/blinkbloom-whitefeather-garb.png',
    slot: 'body',
  },
  {
    source: 'public/assets/equipment/arena/kenshi/blinkbloom-return-ring.png',
    output:
      'public/assets/characters/modular/arena/kenshi/blinkbloom-return-ring.png',
    slot: 'ring',
  },
  ...[
    ['snow-sakura-cat-ear-ribbon', 'head'],
    ['blue-bell-swordheart-necklace', 'necklace'],
    ['side-by-side-sheath-bracelet', 'bracelet'],
    ['homeward-sakura-ring', 'ring'],
    ['iai-tassel-belt', 'belt'],
    ['snowstep-sakura-sandals', 'shoes'],
    ['heart-rainbow-frost-sakura-katana', 'weapon'],
    ['thousand-sakura-homecoming-blade', 'weapon'],
  ].map(([slug, slot]) => ({
    source: `public/assets/equipment/affection/kenshi/${slug}.png`,
    output: `public/assets/characters/modular/affection/kenshi/${slug}.png`,
    slot,
  })),
  {
    source: `${SOURCE_ROOT}/affection-guardian-body.png`,
    output:
      'public/assets/characters/modular/affection/kenshi/white-feather-guardian-kimono.png',
    slot: 'body',
  },
  {
    source: `${SOURCE_ROOT}/affection-moonblue-body.png`,
    output:
      'public/assets/characters/modular/affection/kenshi/moonblue-lantern-date-kimono.png',
    slot: 'body',
  },
];

const variantFamilies = [
  {
    kind: 'boutique',
    id: 'berry-cream',
  },
  {
    kind: 'boutique',
    id: 'moon-sugar',
  },
  {
    kind: 'boutique',
    id: 'rose-night',
  },
  {
    kind: 'dungeon',
    id: 'azure',
  },
  {
    kind: 'dungeon',
    id: 'violet',
  },
  {
    kind: 'dungeon',
    id: 'auric',
  },
  {
    kind: 'dungeon',
    id: 'crimson',
  },
];

const variantRuntimeWearables = variantFamilies.flatMap((family) =>
  ['head', 'weapon'].map((slot) => ({
    label: `${family.id}-${slot}`,
    output:
      family.kind === 'boutique'
        ? `public/assets/characters/modular/shop/${family.id}/kenshi-${slot}.png`
        : `public/assets/characters/modular/dungeon/${family.id}/kenshi-${slot}.png`,
    slot,
  })),
);

const placements = {
  weapon: { left: 255, top: 322, width: 250, height: 300 },
  head: { left: 356, top: 108, width: 70, height: 70 },
  necklace: { left: 294, top: 266, width: 52, height: 52 },
  bracelet: { left: 144, top: 392, width: 42, height: 42 },
  ring: { left: 449, top: 397, width: 26, height: 26 },
  belt: { left: 270, top: 402, width: 100, height: 64 },
  shoes: { left: 266, top: 818, width: 108, height: 82 },
};

function abs(path) {
  return resolve(ROOT, path);
}

function ensureParent(path) {
  mkdirSync(dirname(abs(path)), { recursive: true });
}

function sha(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function pixelSha(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let index = 0; index < info.width * info.height; index += 1) {
    const offset = index * info.channels;
    if ((data[offset + 3] ?? 255) === 0) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
    }
  }
  return sha(Buffer.concat([Buffer.from(`${info.width}x${info.height}:`), data]));
}

async function canonicalPng(buffer) {
  const image = sharp(buffer).ensureAlpha();
  const metadata = await image.metadata();
  const normalized =
    metadata.width === CANVAS.width && metadata.height === CANVAS.height
      ? image
      : image.resize(CANVAS.width, CANVAS.height, { fit: 'fill' });
  return normalized
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toBuffer();
}

async function writeOrCheck(path, buffer) {
  const output = await canonicalPng(buffer);
  if (CHECK) {
    if (!existsSync(abs(path))) {
      throw new Error(`[樱酱可穿资产] 缺少运行时文件：${path}`);
    }
    const actual = readFileSync(abs(path));
    if ((await pixelSha(actual)) !== (await pixelSha(output))) {
      throw new Error(`[樱酱可穿资产] 非确定性或未重建：${path}`);
    }
    return;
  }
  ensureParent(path);
  await sharp(output).toFile(abs(path));
}

async function cleanLargestComponent(input) {
  const source = Buffer.isBuffer(input) ? input : abs(input);
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = info.width * info.height;
  const visited = new Uint8Array(pixels);
  const components = [];
  const queue = new Int32Array(pixels);

  for (let start = 0; start < pixels; start += 1) {
    if (visited[start] || data[start * info.channels + 3] <= 20) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    const members = [];
    while (head < tail) {
      const index = queue[head++];
      members.push(index);
      const x = index % info.width;
      const y = Math.floor(index / info.width);
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x + 1 < info.width ? index + 1 : -1,
        y > 0 ? index - info.width : -1,
        y + 1 < info.height ? index + info.width : -1,
      ];
      for (const next of neighbors) {
        if (next < 0 || visited[next] || data[next * info.channels + 3] <= 20) continue;
        visited[next] = 1;
        queue[tail++] = next;
      }
    }
    components.push(members);
  }

  components.sort((a, b) => b.length - a.length);
  if (components.length === 0) {
    throw new Error(
      `[樱酱可穿资产] 图标没有主体：${typeof input === 'string' ? input : '内存母版'}`,
    );
  }
  const keep = new Uint8Array(pixels);
  for (const index of components[0]) keep[index] = 1;
  const cleaned = Buffer.from(data);
  for (let index = 0; index < pixels; index += 1) {
    if (!keep[index]) cleaned[index * info.channels + 3] = 0;
  }
  return sharp(cleaned, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .png({ compressionLevel: 9, palette: true, quality: 94 })
    .toBuffer();
}

async function buildVariantMaster(familyIndex, slot) {
  const metadata = await sharp(abs(THEME_ATLAS)).metadata();
  if (!metadata.width || !metadata.height || metadata.width < 1700 || metadata.height < 850) {
    throw new Error(
      `[樱酱可穿资产] 主题装备图集尺寸异常：${metadata.width}×${metadata.height}`,
    );
  }

  const left = Math.round((familyIndex * metadata.width) / variantFamilies.length);
  const right = Math.round(((familyIndex + 1) * metadata.width) / variantFamilies.length);
  const rowBreak = Math.round(metadata.height / 2);
  const top = slot === 'head' ? 0 : rowBreak;
  const bottom = slot === 'head' ? rowBreak : metadata.height;

  const cellCrop = await sharp(abs(THEME_ATLAS))
    .extract({
      left,
      top,
      width: right - left,
      height: bottom - top,
    })
    .png()
    .toBuffer();
  const isolated = await cleanLargestComponent(cellCrop);
  const cell = await sharp(isolated)
    .ensureAlpha()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  const placement =
    slot === 'head'
      ? { left: 250, top: 2, width: 140, height: 103 }
      : { left: 246, top: 426, width: 285, height: 430 };
  const item = await sharp(cell)
    .resize(placement.width, placement.height, {
      fit: 'contain',
      position: 'centre',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  return sharp(transparentCanvas())
    .composite([{ input: item, left: placement.left, top: placement.top }])
    .png({ compressionLevel: 9, palette: true, quality: 94 })
    .toBuffer();
}

async function normalizedBody(source) {
  const base = await sharp(abs('public/assets/characters/modular/kenshi/base.png'))
    .ensureAlpha()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer({ resolveWithObject: true });
  const cleaned = await cleanLargestComponent(source);
  const body = await sharp(cleaned)
    .ensureAlpha()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(base.info.width, base.info.height, {
      fit: 'contain',
      position: 'centre',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer({ resolveWithObject: true });
  const left = Math.round((CANVAS.width - body.info.width) / 2);
  const top = 925 - body.info.height;
  return sharp(transparentCanvas())
    .composite([{ input: body.data, left, top }])
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toBuffer();
}

async function iconLayer(source, slot) {
  const placement = placements[slot];
  if (!placement) throw new Error(`[樱酱可穿资产] 未定义槽位对位：${slot}`);
  const cleaned = await cleanLargestComponent(source);
  const item = await sharp(cleaned)
    .resize(placement.width, placement.height, {
      fit: 'contain',
      position: 'centre',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer({ resolveWithObject: true });
  return sharp(transparentCanvas())
    .composite([{ input: item.data, left: placement.left, top: placement.top }])
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toBuffer();
}

async function snowstepSandalsLayer() {
  const source = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="960" viewBox="0 0 640 960">
      <defs>
        <linearGradient id="sole" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff9fd"/>
          <stop offset="1" stop-color="#ffd9ea"/>
        </linearGradient>
      </defs>
      <g stroke-linecap="round" stroke-linejoin="round">
        <path d="M276 832 C272 854 267 880 267 902 C267 919 276 928 290 929 C303 930 310 923 310 911 C308 888 302 861 297 839 Z"
          fill="url(#sole)" stroke="#6788c4" stroke-width="3"/>
        <path d="M374 817 C367 839 358 866 356 887 C355 902 363 911 377 912 C391 913 400 906 402 894 C401 871 394 843 392 822 Z"
          fill="url(#sole)" stroke="#6788c4" stroke-width="3"/>
        <path d="M274 866 C284 858 296 859 304 871 M273 878 C285 869 299 871 306 884"
          fill="none" stroke="#f28fbd" stroke-width="8"/>
        <path d="M364 852 C374 844 388 846 397 858 M361 864 C374 855 390 858 400 871"
          fill="none" stroke="#f28fbd" stroke-width="8"/>
        <g fill="#ffd1e5" stroke="#ffffff" stroke-width="2">
          <path d="M289 861 C281 851 284 843 291 846 C293 837 302 838 302 847 C311 843 316 851 307 858 C314 865 307 873 299 867 C294 875 285 871 289 861 Z"/>
          <path d="M381 847 C373 837 376 829 383 832 C385 823 394 824 394 833 C403 829 408 837 399 844 C406 851 399 859 391 853 C386 861 377 857 381 847 Z"/>
        </g>
      </g>
    </svg>
  `);
  return sharp(source)
    .png({ compressionLevel: 9, palette: true, quality: 94 })
    .toBuffer();
}

async function weaponIcon(source) {
  const trimmed = await sharp(source)
    .ensureAlpha()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(224, 224, {
      fit: 'contain',
      position: 'centre',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: 256,
      height: 256,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: trimmed, left: 16, top: 16 }])
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toBuffer();
}

async function wearablePreview(entry) {
  const base =
    entry.slot === 'body'
      ? abs(entry.output)
      : abs(
          entry.slot === 'shoes'
            ? 'public/assets/characters/modular/kenshi/base-noshoes.png'
            : 'public/assets/characters/modular/kenshi/base.png',
        );
  const character =
    entry.slot === 'body'
      ? await sharp(base).png().toBuffer()
      : await sharp(base)
          .composite([{ input: abs(entry.output) }])
          .png()
          .toBuffer();
  const slug = entry.label ?? entry.output.split('/').pop().replace('.png', '');
  const label = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="410"><rect width="280" height="410" rx="24" fill="#f5f1fb"/><rect x="10" y="10" width="260" height="330" rx="18" fill="#eaf4ff"/><text x="140" y="366" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#352d50">${slug}</text><text x="140" y="390" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" fill="#7d6f98">${entry.slot}</text></svg>`,
  );
  const thumb = await sharp(character)
    .resize(238, 320, {
      fit: 'contain',
      position: 'centre',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  return sharp(label)
    .composite([{ input: thumb, left: 21, top: 16 }])
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toBuffer();
}

async function buildContactSheet() {
  const cards = [];
  for (const entry of [...variantRuntimeWearables, ...runtimeWearables]) {
    cards.push(await wearablePreview(entry));
  }
  const columns = 4;
  const rows = Math.ceil(cards.length / columns);
  const canvas = sharp({
    create: {
      width: columns * 280,
      height: rows * 410,
      channels: 4,
      background: { r: 236, g: 243, b: 252, alpha: 1 },
    },
  });
  const output = await canvas
    .composite(
      cards.map((input, index) => ({
        input,
        left: (index % columns) * 280,
        top: Math.floor(index / columns) * 410,
      })),
    )
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toBuffer();
  const path = 'art-source/qa/kenshi-wearables-contact.png';
  if (CHECK) {
    if (!existsSync(abs(path)) || (await pixelSha(abs(path))) !== (await pixelSha(output))) {
      throw new Error(`[樱酱可穿资产] 试穿联系图未更新：${path}`);
    }
    return;
  }
  ensureParent(path);
  await sharp(output).toFile(abs(path));
}

async function writeIcon(path, buffer) {
  const image = sharp(buffer).ensureAlpha();
  const metadata = await image.metadata();
  const normalized =
    metadata.width === 256 && metadata.height === 256
      ? image
      : image.resize(256, 256, { fit: 'fill' });
  const canonical = await normalized
    .png({ compressionLevel: 9, palette: true, quality: 94 })
    .toBuffer();
  if (CHECK) {
    if (!existsSync(abs(path))) throw new Error(`[樱酱可穿资产] 缺少图标：${path}`);
    const actual = readFileSync(abs(path));
    if ((await pixelSha(actual)) !== (await pixelSha(canonical))) {
      throw new Error(`[樱酱可穿资产] 图标未由独立层重建：${path}`);
    }
    return;
  }
  ensureParent(path);
  await sharp(canonical).toFile(abs(path));
}

async function build() {
  for (const path of iconCleanupPaths) {
    if (!CHECK) {
      const cleaned = await cleanLargestComponent(path);
      await writeIcon(path, cleaned);
    }
  }

  for (const [familyIndex, family] of variantFamilies.entries()) {
    for (const slot of ['head', 'weapon']) {
      const masterPath = `${SOURCE_ROOT}/${family.kind}/${family.id}-${slot}-alpha.png`;
      const master = await buildVariantMaster(familyIndex, slot);
      await writeOrCheck(masterPath, master);
      const runtimePath =
        family.kind === 'boutique'
          ? `public/assets/characters/modular/shop/${family.id}/kenshi-${slot}.png`
          : `public/assets/characters/modular/dungeon/${family.id}/kenshi-${slot}.png`;
      await writeOrCheck(runtimePath, master);
      if (slot === 'weapon') {
        const iconPath =
          family.kind === 'boutique'
            ? `public/assets/equipment/shop/${family.id}/weapon-kenshi.png`
            : `public/assets/equipment/dungeon/${family.id}/weapon-kenshi.png`;
        await writeIcon(iconPath, await weaponIcon(master));
      }
    }
  }

  for (const entry of runtimeWearables) {
    if (!existsSync(abs(entry.source))) {
      throw new Error(`[樱酱可穿资产] 缺少母版：${entry.source}`);
    }
    const output =
      entry.slot === 'body'
        ? await normalizedBody(entry.source)
        : entry.slot === 'shoes'
          ? await snowstepSandalsLayer()
        : await iconLayer(entry.source, entry.slot);
    await writeOrCheck(entry.output, output);
  }
  await buildContactSheet();
}

if (!REBUILD && !CHECK) {
  throw new Error('用法：node scripts/build-kenshi-wearables.mjs [--rebuild|--check]');
}

await build();
console.log(
  CHECK
    ? '✓ 樱酱 28 张独立层、7 张派生图标与 6 张图标连通域清理均可确定性重建'
    : '✓ 樱酱可穿资产与独立精品/副本变体已重建',
);
