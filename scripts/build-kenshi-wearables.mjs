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
    sourceFamily: 'r3',
    color: '#ff79b8',
    accent: '#fff0f8',
    hue: 332,
    motif: 'sakura',
  },
  {
    kind: 'boutique',
    id: 'moon-sugar',
    sourceFamily: 'r6',
    color: '#6aaeff',
    accent: '#f4fbff',
    hue: 208,
    motif: 'moon',
  },
  {
    kind: 'boutique',
    id: 'rose-night',
    sourceFamily: 'r6-shadow',
    color: '#b93482',
    accent: '#ffd4eb',
    hue: 316,
    motif: 'rose',
  },
  {
    kind: 'dungeon',
    id: 'azure',
    sourceFamily: 'r2',
    color: '#24d7ff',
    accent: '#effeff',
    hue: 188,
    motif: 'crystal',
  },
  {
    kind: 'dungeon',
    id: 'violet',
    sourceFamily: 'r6-shadow',
    color: '#9d61ff',
    accent: '#f0e7ff',
    hue: 270,
    motif: 'diamond',
  },
  {
    kind: 'dungeon',
    id: 'auric',
    sourceFamily: 'r7-bloodmoon',
    color: '#ffd15c',
    accent: '#fff9d9',
    hue: 0,
    motif: 'sun',
  },
  {
    kind: 'dungeon',
    id: 'crimson',
    sourceFamily: 'r5-crimson',
    color: '#ff4c6b',
    accent: '#fff0f2',
    hue: 350,
    motif: 'flame',
  },
];

const placements = {
  weapon: { left: 245, top: 280, width: 310, height: 350 },
  head: { left: 370, top: 96, width: 96, height: 96 },
  necklace: { left: 260, top: 255, width: 120, height: 120 },
  bracelet: { left: 116, top: 392, width: 94, height: 94 },
  ring: { left: 448, top: 402, width: 78, height: 78 },
  belt: { left: 230, top: 390, width: 180, height: 112 },
  shoes: { left: 210, top: 777, width: 220, height: 155 },
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

function motifSvg(family, slot) {
  const { color, accent, motif } = family;
  const core =
    motif === 'moon'
      ? `<path d="M73 24a31 31 0 1 0 27 51A37 37 0 1 1 73 24Z" fill="${color}"/><circle cx="91" cy="29" r="5" fill="${accent}"/>`
      : motif === 'rose'
        ? `<path d="M62 22c18 2 29 18 20 31 14 1 20 17 11 27-13 15-47 14-59-2-10-13-1-27 13-28-9-11-1-26 15-28Z" fill="${color}"/><path d="M40 83c18-5 32-17 42-36" stroke="${accent}" stroke-width="5" fill="none"/>`
        : motif === 'crystal'
          ? `<path d="M64 14 98 52 64 108 30 52Z" fill="${color}" stroke="${accent}" stroke-width="5"/><path d="M64 14v94M30 52h68" stroke="${accent}" stroke-width="3" opacity=".8"/>`
          : motif === 'diamond'
            ? `<path d="M64 13 105 45 88 103H40L23 45Z" fill="${color}" stroke="${accent}" stroke-width="5"/><path d="m23 45 41 58 41-58-41 17Z" fill="${accent}" opacity=".45"/>`
            : motif === 'sun'
              ? `<circle cx="64" cy="60" r="27" fill="${color}" stroke="${accent}" stroke-width="6"/><path d="M64 8v17M64 95v17M12 60h17M99 60h17M27 23l12 12M89 85l12 12M101 23 89 35M39 85 27 97" stroke="${color}" stroke-width="7" stroke-linecap="round"/>`
              : motif === 'flame'
                ? `<path d="M68 10c14 27-1 34 12 48 8 9 20 1 20-11 18 31 1 68-34 68-29 0-48-28-34-53 3 20 18 19 22 5 5-17-8-23 14-57Z" fill="${color}"/><path d="M67 55c12 14 11 34-3 45-15-8-18-29 3-45Z" fill="${accent}"/>`
                : `<g fill="${color}" stroke="${accent}" stroke-width="3"><ellipse cx="64" cy="32" rx="13" ry="26"/><ellipse cx="64" cy="88" rx="13" ry="26"/><ellipse cx="36" cy="60" rx="26" ry="13"/><ellipse cx="92" cy="60" rx="26" ry="13"/></g><circle cx="64" cy="60" r="12" fill="${accent}"/>`;
  const tassel =
    slot === 'weapon'
      ? `<path d="M66 92c3 14-4 22-1 34M82 86c8 14 2 25 9 35" stroke="${color}" stroke-width="5" stroke-linecap="round"/><path d="m56 121 12 22 10-23m5-1 11 22 10-24" fill="${color}"/>`
      : '';
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="160" viewBox="0 0 128 160"><defs><filter id="g"><feGaussianBlur stdDeviation="2"/></filter></defs><circle cx="64" cy="60" r="45" fill="${color}" opacity=".22" filter="url(#g)"/>${core}${tassel}</svg>`,
  );
}

async function buildVariantMaster(family, slot) {
  const source = `public/assets/characters/modular/kenshi/${family.sourceFamily}-${slot}.png`;
  const sourceBuffer = await sharp(abs(source))
    .ensureAlpha()
    .modulate({ hue: family.hue, saturation: 1.12, brightness: 1.02 })
    .png()
    .toBuffer();
  const motif = await sharp(motifSvg(family, slot))
    .resize(slot === 'head' ? 88 : 112, slot === 'head' ? 110 : 140, {
      fit: 'contain',
    })
    .png()
    .toBuffer();
  const composited = await sharp(sourceBuffer)
    .composite([
      {
        input: motif,
        left: slot === 'head' ? 326 : 406,
        top: slot === 'head' ? 104 : 334,
      },
    ])
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toBuffer();
  const { data, info } = await sharp(composited)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let index = 0; index < info.width * info.height; index += 1) {
    const offset = index * info.channels;
    const alpha = data[offset + 3] ?? 255;
    const red = data[offset] ?? 0;
    const green = data[offset + 1] ?? 0;
    const blue = data[offset + 2] ?? 0;
    if (alpha > 32 && green > 126 && green > red * 1.38 && green > blue * 1.38) {
      data[offset + 1] = Math.min(255, Math.round(Math.max(red, blue) * 1.2));
    }
  }
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .png({ compressionLevel: 9, palette: true, quality: 92 })
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
  const slug = entry.output.split('/').pop().replace('.png', '');
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
  for (const entry of runtimeWearables) cards.push(await wearablePreview(entry));
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

  for (const family of variantFamilies) {
    for (const slot of ['head', 'weapon']) {
      const masterPath = `${SOURCE_ROOT}/${family.kind}/${family.id}-${slot}-alpha.png`;
      const master = await buildVariantMaster(family, slot);
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
