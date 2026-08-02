#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const PUBLIC_ROOT = resolve('public');
const PNG = 'png';
const WEBP = 'webp';

const portrait = (path) => ({
  path,
  kind: 'portrait',
  width: 640,
  height: 960,
  format: PNG,
  maxBytes: 550 * 1024,
});
const layer = (path, options = {}) => ({
  path,
  kind: 'layer',
  width: 640,
  height: 960,
  format: PNG,
  maxBytes: 300 * 1024,
  ...options,
});
const icon = (path) => ({
  path,
  kind: 'icon',
  width: 256,
  height: 256,
  format: PNG,
  maxBytes: 120 * 1024,
});
const effect = (path) => ({
  path,
  kind: 'effect',
  width: 512,
  height: 512,
  format: PNG,
  maxBytes: 250 * 1024,
});
const scene = (path) => ({
  path,
  kind: 'scene',
  width: 960,
  height: 640,
  format: WEBP,
  maxBytes: 480 * 1024,
});

const REGION_FAMILIES = [
  'r1',
  'r2',
  'r3',
  'r4',
  'r5',
  'r5-crimson',
  'r6',
  'r6-shadow',
  'r7',
  'r7-bloodmoon',
];
const NO_SHOES_REGION_FAMILIES = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7'];
const REGION_WEAPON_APPEARANCES = [
  'r1-weapon',
  'r2-weapon',
  'r3-weapon',
  'r4-weapon',
  'r5-weapon',
  'r5-set-weapon',
  'r6-weapon',
  'r6-set-weapon',
  'r7-weapon',
  'r7-set-weapon',
];
const BOUTIQUE_THEMES = ['berry-cream', 'moon-sugar', 'rose-night'];
const DUNGEON_TIERS = ['azure', 'violet', 'auric', 'crimson'];
const SKILL_SLUGS = [
  'iai-draw',
  'sword-heart',
  'wind-thrust',
  'white-blade',
  'sakura-blizzard',
  'armor-break',
  'sword-intent',
  'iai-flash',
  'sword-storm',
  'swallow-return',
  'no-self',
  'ice-heart',
  'sword-saint',
  'thousand-sakura',
];
const ACTIVE_SKILL_SLUGS = [
  'iai-draw',
  'wind-thrust',
  'sakura-blizzard',
  'armor-break',
  'iai-flash',
  'sword-storm',
  'swallow-return',
  'ice-heart',
  'thousand-sakura',
];
const ARENA_SLUGS = [
  'blinkbloom-boundary-katana',
  'blinkbloom-snowear-crown',
  'blinkbloom-whitefeather-garb',
  'blinkbloom-return-ring',
];
const ARENA_WEARABLE_SLOTS = {
  'blinkbloom-boundary-katana': 'weapon',
  'blinkbloom-snowear-crown': 'head',
  'blinkbloom-whitefeather-garb': 'body',
  'blinkbloom-return-ring': 'ring',
};
const AFFECTION_EQUIPMENT_SLUGS = [
  'snow-sakura-cat-ear-ribbon',
  'blue-bell-swordheart-necklace',
  'side-by-side-sheath-bracelet',
  'homeward-sakura-ring',
  'iai-tassel-belt',
  'snowstep-sakura-sandals',
  'white-feather-guardian-kimono',
  'heart-rainbow-frost-sakura-katana',
  'moonblue-lantern-date-kimono',
  'thousand-sakura-homecoming-blade',
];
const AFFECTION_WEARABLE_SLOTS = {
  'snow-sakura-cat-ear-ribbon': 'head',
  'blue-bell-swordheart-necklace': 'necklace',
  'side-by-side-sheath-bracelet': 'bracelet',
  'homeward-sakura-ring': 'ring',
  'iai-tassel-belt': 'belt',
  'snowstep-sakura-sandals': 'shoes',
  'white-feather-guardian-kimono': 'body',
  'heart-rainbow-frost-sakura-katana': 'weapon',
  'moonblue-lantern-date-kimono': 'body',
  'thousand-sakura-homecoming-blade': 'weapon',
};
const AFFECTION_GIFT_IDS = [
  'gift_kenshi_moonwhite_whetstone_case',
  'gift_kenshi_twin_sakura_tassel_case',
  'gift_kenshi_sakura_blade_care_paper',
];
const AFFECTION_SCENE_SLUGS = [
  'kenshi-dojo-sakura-dawn',
  'kenshi-rain-eaves-blue',
  'kenshi-moonlit-scabbard',
  'kenshi-workbench-afterglow',
  'kenshi-dojo-nightwatch',
  'kenshi-dojo-homecoming-sunrise',
  'kenshi-gift-whetstone-morning',
  'kenshi-sakura-market-rain',
  'kenshi-route-map-sunset',
  'kenshi-tassel-market-morning',
  'kenshi-riverside-tea-afternoon',
  'kenshi-dojo-lantern-night',
];
const AFFECTION_CG_SLUGS = [
  'kenshi-bluebell-scabbard',
  'kenshi-paired-dojo-lanterns',
  'kenshi-shared-patrol-map',
  'kenshi-dojo-keyplate',
];

const contractGroups = {
  portraits: [
    portrait('assets/characters/kenshi-sakura.png'),
    portrait('assets/characters/kenshi-sakura-cast.png'),
  ],
  bases: [
    layer('assets/characters/modular/kenshi/base.png', { footAnchor: true }),
    layer('assets/characters/modular/kenshi/base-noshoes.png', { footAnchor: true }),
  ],
  regionLayers: REGION_FAMILIES.flatMap((family) =>
    ['body', 'head', 'weapon'].map((slot) =>
      layer(`assets/characters/modular/kenshi/${family}-${slot}.png`, {
        footAnchor: slot === 'body',
        handAnchor: slot === 'weapon',
      }),
    ),
  ),
  regionWeaponIcons: REGION_WEAPON_APPEARANCES.map((appearanceId) =>
    icon(`assets/equipment/weapons/${appearanceId}/kenshi.png`),
  ),
  boutique: [
    ...BOUTIQUE_THEMES.flatMap((theme) =>
      ['body', 'head', 'shoes', 'weapon'].map((slot) =>
        layer(`assets/characters/modular/shop/${theme}/kenshi-${slot}.png`, {
          handAnchor: slot === 'weapon',
        }),
      ),
    ),
    ...BOUTIQUE_THEMES.map((theme) => icon(`assets/equipment/shop/${theme}/weapon-kenshi.png`)),
    ...BOUTIQUE_THEMES.map((theme) => effect(`assets/effects/boutique/${theme}-kenshi.png`)),
  ],
  dungeon: [
    ...DUNGEON_TIERS.flatMap((tier) =>
      ['body', 'head', 'shoes', 'weapon'].map((slot) =>
        layer(`assets/characters/modular/dungeon/${tier}/kenshi-${slot}.png`, {
          maxBytes: slot === 'body' ? 560 * 1024 : 300 * 1024,
          footAnchor: slot === 'body',
          handAnchor: slot === 'weapon',
        }),
      ),
    ),
    ...DUNGEON_TIERS.flatMap((tier) =>
      ['body', 'weapon'].map((slot) => icon(`assets/equipment/dungeon/${tier}/${slot}-kenshi.png`)),
    ),
  ],
  arena: [
    ...ARENA_SLUGS.map((slug) => icon(`assets/equipment/arena/kenshi/${slug}.png`)),
    ...Object.entries(ARENA_WEARABLE_SLOTS).map(([slug, slot]) =>
      layer(`assets/characters/modular/arena/kenshi/${slug}.png`, {
        maxBytes: slot === 'body' ? 560 * 1024 : 300 * 1024,
        footAnchor: slot === 'body',
        handAnchor: slot === 'weapon',
        wearableSlot: slot,
      }),
    ),
  ],
  skills: [
    ...SKILL_SLUGS.map((slug) => icon(`assets/icons/skills/kenshi-${slug}.png`)),
    ...ACTIVE_SKILL_SLUGS.map((slug) => effect(`assets/effects/kenshi-${slug}.png`)),
    effect('assets/effects/basic/kenshi-iai.png'),
  ],
  affection: [
    ...AFFECTION_EQUIPMENT_SLUGS.map((slug) =>
      icon(`assets/equipment/affection/kenshi/${slug}.png`),
    ),
    ...Object.entries(AFFECTION_WEARABLE_SLOTS).map(([slug, slot]) =>
      layer(`assets/characters/modular/affection/kenshi/${slug}.png`, {
        maxBytes: slot === 'body' ? 560 * 1024 : 300 * 1024,
        footAnchor: slot === 'body',
        handAnchor: slot === 'weapon',
        wearableSlot: slot,
      }),
    ),
    ...AFFECTION_GIFT_IDS.map((id) => icon(`assets/affection/gifts/${id}.png`)),
    ...AFFECTION_SCENE_SLUGS.map((slug) => scene(`assets/affection/scenes/${slug}.webp`)),
    ...AFFECTION_CG_SLUGS.map((slug) => scene(`assets/affection/cg/${slug}.webp`)),
  ],
};

const EXPECTED_GROUP_COUNTS = {
  portraits: 2,
  bases: 2,
  regionLayers: 30,
  regionWeaponIcons: 10,
  boutique: 18,
  dungeon: 24,
  arena: 8,
  skills: 24,
  affection: 39,
};

const CONTRACT_ASSETS = Object.values(contractGroups).flat();
const STANDALONE_REQUIRED = [icon('assets/items/sigil_kenshi.png')];
// docs/82 选定的 B 案会把刀永久烘焙到腰侧居合佩刀位，而不是旧版左右手位。
// 该区域同时覆盖短刀柄与长刀身；仍要求至少 150 个 alpha 像素，防止空层或错位层混入。
const KENSHI_IAI_CARRY_ANCHOR = [170, 520, 240, 200];
const THEME_LAYER_PATHS = (slot) => [
  ...BOUTIQUE_THEMES.map((theme) => `assets/characters/modular/shop/${theme}/kenshi-${slot}.png`),
  ...DUNGEON_TIERS.map((tier) => `assets/characters/modular/dungeon/${tier}/kenshi-${slot}.png`),
];

const errors = [];
const rgbaHashes = new Map();
const layerAlphaHashes = new Map();
const CLEAN_COMPONENT_ICONS = new Set([
  'assets/equipment/arena/kenshi/blinkbloom-snowear-crown.png',
  'assets/equipment/arena/kenshi/blinkbloom-whitefeather-garb.png',
  'assets/equipment/arena/kenshi/blinkbloom-return-ring.png',
  'assets/equipment/affection/kenshi/homeward-sakura-ring.png',
  'assets/equipment/affection/kenshi/moonblue-lantern-date-kimono.png',
  'assets/equipment/affection/kenshi/white-feather-guardian-kimono.png',
]);
const SLOT_RECTS = {
  head: [245, 0, 195, 195],
  necklace: [280, 250, 80, 90],
  bracelet: [135, 382, 60, 70],
  ring: [440, 390, 50, 55],
  belt: [250, 385, 140, 100],
  shoes: [240, 790, 170, 130],
};
const R2_ARENA_RING_LAYER = 'assets/characters/modular/arena/kenshi/blinkbloom-return-ring.png';
const R2_ARENA_RING_HAND_RECT = [420, 430, 80, 80];

async function noShoesError(body, shoesPath) {
  const base = await sharp(
    resolve(PUBLIC_ROOT, 'assets/characters/modular/kenshi/base-noshoes.png'),
  )
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const shoes = await sharp(resolve(PUBLIC_ROOT, shoesPath))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let compared = 0;
  let premultipliedDifference = 0;
  let alphaDifference = 0;
  for (let index = 0; index < body.info.width * body.info.height; index += 1) {
    const offset = index * body.info.channels;
    if ((shoes.data[offset + 3] ?? 0) <= 20) continue;
    const bodyAlpha = (body.data[offset + 3] ?? 0) / 255;
    const baseAlpha = (base.data[offset + 3] ?? 0) / 255;
    for (let channel = 0; channel < 3; channel += 1) {
      premultipliedDifference += Math.abs(
        (body.data[offset + channel] ?? 0) * bodyAlpha -
          (base.data[offset + channel] ?? 0) * baseAlpha,
      );
    }
    alphaDifference += Math.abs((body.data[offset + 3] ?? 0) - (base.data[offset + 3] ?? 0));
    compared += 1;
  }
  return {
    compared,
    rgbMae: premultipliedDifference / Math.max(1, compared * 3),
    alphaMae: alphaDifference / Math.max(1, compared),
  };
}

function isTextureGatedAsset(entry) {
  if (entry.kind === 'portrait') return true;
  if (entry.path.startsWith('assets/characters/modular/kenshi/')) return true;
  if (/assets\/characters\/modular\/(?:shop|dungeon)\/[^/]+\/kenshi-body\.png$/.test(entry.path)) {
    return true;
  }
  if (entry.path.startsWith('assets/icons/skills/kenshi-')) return true;
  if (entry.path.startsWith('assets/effects/kenshi-')) return true;
  return entry.path === 'assets/effects/basic/kenshi-iai.png';
}

function edgeContamination(data, info) {
  let semiTransparent = 0;
  let greenEdge = 0;
  let nearBlackEdge = 0;
  for (let index = 0; index < info.width * info.height; index += 1) {
    const offset = index * info.channels;
    const alpha = data[offset + 3] ?? 255;
    if (alpha <= 20 || alpha >= 245) continue;
    semiTransparent += 1;
    const red = data[offset] ?? 0;
    const green = data[offset + 1] ?? 0;
    const blue = data[offset + 2] ?? 0;
    if (green >= 170 && green > red * 1.42 && green > blue * 1.28) greenEdge += 1;
    if (red < 24 && green < 24 && blue < 24) nearBlackEdge += 1;
  }
  return {
    semiTransparent,
    greenRatio: greenEdge / Math.max(1, semiTransparent),
    nearBlackRatio: nearBlackEdge / Math.max(1, semiTransparent),
  };
}

function fail(message) {
  errors.push(message);
}

function validateContractShape() {
  for (const [group, expected] of Object.entries(EXPECTED_GROUP_COUNTS)) {
    const actual = contractGroups[group].length;
    if (actual !== expected) fail(`[合同数量] ${group}: 期望 ${expected}，实际 ${actual}`);
  }
  if (CONTRACT_ASSETS.length !== 157) {
    fail(`[合同数量] 樱酱角色运行时必须精确 157 项，实际 ${CONTRACT_ASSETS.length}`);
  }
  const paths = CONTRACT_ASSETS.map((entry) => entry.path);
  if (new Set(paths).size !== paths.length) {
    fail('[合同数量] 157 项运行时路径中存在重复');
  }
}

async function alphaMask(path) {
  const { data, info } = await sharp(resolve(PUBLIC_ROOT, path))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const mask = new Uint8Array(info.width * info.height);
  for (let index = 0; index < mask.length; index += 1) {
    mask[index] = (data[index * info.channels + 3] ?? 0) > 20 ? 1 : 0;
  }
  return mask;
}

async function validateThemeSilhouetteSeparation() {
  for (const slot of ['head', 'weapon']) {
    const paths = THEME_LAYER_PATHS(slot);
    const masks = await Promise.all(paths.map((path) => alphaMask(path)));
    for (let left = 0; left < masks.length; left += 1) {
      for (let right = left + 1; right < masks.length; right += 1) {
        let intersection = 0;
        let union = 0;
        for (let index = 0; index < masks[left].length; index += 1) {
          if (masks[left][index] && masks[right][index]) intersection += 1;
          if (masks[left][index] || masks[right][index]) union += 1;
        }
        const overlap = union === 0 ? 1 : intersection / union;
        if (overlap >= 0.9) {
          fail(
            `[主题轮廓] ${paths[left]} 与 ${paths[right]} 的 alpha IoU=${overlap.toFixed(3)}，要求 <0.900`,
          );
        }
      }
    }
  }
}

function visibleBounds(data, info) {
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  let opaque = 0;
  let green = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const alpha = data[offset + 3] ?? 255;
      if (alpha <= 20) continue;
      opaque += 1;
      const red = data[offset] ?? 0;
      const greenChannel = data[offset + 1] ?? 0;
      const blue = data[offset + 2] ?? 0;
      if (greenChannel >= 180 && greenChannel > red * 1.55 && greenChannel > blue * 1.35) {
        green += 1;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY, opaque, green };
}

function alphaInRect(data, info, [left, top, width, height]) {
  let count = 0;
  for (let y = top; y < Math.min(info.height, top + height); y += 1) {
    for (let x = left; x < Math.min(info.width, left + width); x += 1) {
      if ((data[(y * info.width + x) * info.channels + 3] ?? 255) > 20) count += 1;
    }
  }
  return count;
}

function digest(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function recordHash(map, hash, path) {
  const paths = map.get(hash) ?? [];
  paths.push(path);
  map.set(hash, paths);
}

function alphaComponentAreas(data, info) {
  const pixels = info.width * info.height;
  const visited = new Uint8Array(pixels);
  const queue = new Int32Array(pixels);
  const areas = [];
  for (let start = 0; start < pixels; start += 1) {
    if (visited[start] || data[start * info.channels + 3] <= 20) continue;
    let head = 0;
    let tail = 0;
    let area = 0;
    queue[tail++] = start;
    visited[start] = 1;
    while (head < tail) {
      const index = queue[head++];
      area += 1;
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
    areas.push(area);
  }
  return areas.sort((a, b) => b - a);
}

async function validateAsset(entry) {
  const filePath = resolve(PUBLIC_ROOT, entry.path);
  if (!existsSync(filePath)) {
    fail(`[缺失] ${entry.path}`);
    return;
  }
  const size = statSync(filePath).size;
  if (size > entry.maxBytes) {
    fail(`[体积] ${entry.path}: ${size} > ${entry.maxBytes} bytes`);
  }
  let metadata;
  try {
    metadata = await sharp(filePath).metadata();
  } catch (error) {
    fail(`[解码] ${entry.path}: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  if (metadata.width !== entry.width || metadata.height !== entry.height) {
    fail(
      `[尺寸] ${entry.path}: ${metadata.width ?? '?'}×${metadata.height ?? '?'}，期望 ${entry.width}×${entry.height}`,
    );
  }
  if (metadata.format !== entry.format) {
    fail(`[格式] ${entry.path}: ${metadata.format ?? '?'}，期望 ${entry.format}`);
  }
  if (entry.format !== PNG) return;
  if (metadata.channels !== 4 || metadata.hasAlpha !== true) {
    fail(`[透明通道] ${entry.path}: 必须为 RGBA PNG`);
    return;
  }

  let pixels;
  try {
    pixels = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  } catch (error) {
    fail(`[像素解码] ${entry.path}: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  const { data, info } = pixels;
  recordHash(
    rgbaHashes,
    digest(Buffer.concat([Buffer.from(`${info.width}x${info.height}:`), data])),
    entry.path,
  );
  if (entry.kind === 'layer') {
    const alpha = Buffer.alloc(info.width * info.height);
    for (let index = 0; index < alpha.length; index += 1) {
      alpha[index] = data[index * info.channels + 3] ?? 0;
    }
    recordHash(layerAlphaHashes, digest(alpha), entry.path);
  }
  const corners = [
    data[3],
    data[(info.width - 1) * info.channels + 3],
    data[(info.height - 1) * info.width * info.channels + 3],
    data[(info.height * info.width - 1) * info.channels + 3],
  ];
  if (corners.some((alpha) => alpha !== 0)) fail(`[四角] ${entry.path}: ${corners.join(',')}`);

  const bounds = visibleBounds(data, info);
  if (bounds.opaque === 0) {
    fail(`[空图] ${entry.path}: 没有可见像素`);
    return;
  }
  if (
    bounds.minX <= 0 ||
    bounds.minY <= 0 ||
    bounds.maxX >= info.width - 1 ||
    bounds.maxY >= info.height - 1
  ) {
    fail(`[触边] ${entry.path}: bbox=${bounds.minX},${bounds.minY},${bounds.maxX},${bounds.maxY}`);
  }
  if (bounds.green / bounds.opaque > 0.0004) {
    fail(`[绿幕] ${entry.path}: ${((100 * bounds.green) / bounds.opaque).toFixed(4)}% > 0.0400%`);
  }
  if (isTextureGatedAsset(entry)) {
    const nativeEdge = edgeContamination(data, info);
    if (nativeEdge.greenRatio > 0.005) {
      fail(
        `[R2绿边] ${entry.path}: 半透明边缘绿污染 ${(nativeEdge.greenRatio * 100).toFixed(3)}% > 0.500%`,
      );
    }
    if (nativeEdge.nearBlackRatio > 0.07) {
      fail(
        `[R2黑边] ${entry.path}: 半透明边缘黑蒙版 ${(nativeEdge.nearBlackRatio * 100).toFixed(3)}% > 7.000%`,
      );
    }
    const displayPixels = await sharp(filePath)
      .ensureAlpha()
      .resize({ width: Math.min(160, info.width) })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const displayEdge = edgeContamination(displayPixels.data, displayPixels.info);
    if (displayEdge.greenRatio > 0.01) {
      fail(
        `[R2手机绿边] ${entry.path}: 160px 显示边缘绿污染 ${(displayEdge.greenRatio * 100).toFixed(3)}% > 1.000%`,
      );
    }
    if (displayEdge.nearBlackRatio > 0.09) {
      fail(
        `[R2手机黑边] ${entry.path}: 160px 显示边缘黑蒙版 ${(displayEdge.nearBlackRatio * 100).toFixed(3)}% > 9.000%`,
      );
    }
  }
  if (entry.kind === 'icon') {
    if (bounds.minX < 12 || bounds.minY < 12 || bounds.maxX > 243 || bounds.maxY > 243) {
      fail(
        `[图标边距] ${entry.path}: bbox=${bounds.minX},${bounds.minY},${bounds.maxX},${bounds.maxY}，要求四边至少 12px`,
      );
    }
    if (CLEAN_COMPONENT_ICONS.has(entry.path)) {
      const components = alphaComponentAreas(data, info);
      if (components.length !== 1) {
        fail(
          `[图集碎片] ${entry.path}: 可见连通域 ${components.length} 个（${components.slice(0, 5).join('/')}），要求清理到 1 个主体`,
        );
      }
    }
  }
  if (entry.footAnchor) {
    const centerX = (bounds.minX + bounds.maxX) / 2;
    if (bounds.maxY < 921 || bounds.maxY > 929) {
      fail(`[脚底锚点] ${entry.path}: y=${bounds.maxY}，期望 925±4`);
    }
    if (centerX < 308 || centerX > 332) {
      fail(`[中心锚点] ${entry.path}: x=${centerX.toFixed(1)}，期望 320±12`);
    }
  }
  if (entry.handAnchor) {
    const intersection = alphaInRect(data, info, KENSHI_IAI_CARRY_ANCHOR);
    if (intersection <= 150) {
      fail(`[居合佩刀锚点] ${entry.path}: 佩刀区相交像素=${intersection}，必须 >150`);
    }
  }
  if (entry.wearableSlot && SLOT_RECTS[entry.wearableSlot]) {
    const visible = alphaInRect(data, info, SLOT_RECTS[entry.wearableSlot]);
    if (visible <= 80) {
      fail(`[穿戴槽位] ${entry.path}: ${entry.wearableSlot} 对应区域仅 ${visible} 个可见像素`);
    }
  }
  if (entry.path === R2_ARENA_RING_LAYER) {
    if (bounds.opaque < 2500 || bounds.opaque > 5000) {
      fail(
        `[竞技戒指可见度] ${entry.path}: alpha>20=${bounds.opaque}，要求 2500–5000，兼顾手机辨识与不遮人物`,
      );
    }
    const handPixels = alphaInRect(data, info, R2_ARENA_RING_HAND_RECT);
    if (handPixels < 900) {
      fail(`[竞技戒指锚点] ${entry.path}: 手腕区域仅 ${handPixels} 像素，要求至少 900`);
    }
    const base = await sharp(resolve(PUBLIC_ROOT, 'assets/characters/modular/kenshi/base.png'))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let overlap = 0;
    for (let index = 0; index < info.width * info.height; index += 1) {
      if ((data[index * info.channels + 3] ?? 0) > 20 && (base.data[index * 4 + 3] ?? 0) > 20) {
        overlap += 1;
      }
    }
    if (overlap < 250 || overlap / bounds.opaque < 0.2) {
      fail(
        `[竞技戒指贴合] ${entry.path}: 与手腕主体相交 ${overlap}/${bounds.opaque}，要求至少 250 且占自身 20%`,
      );
    }
    const bboxArea = (bounds.maxX - bounds.minX + 1) * (bounds.maxY - bounds.minY + 1);
    if (bounds.opaque / bboxArea > 0.58) {
      fail(
        `[竞技戒指形态] ${entry.path}: bbox 填充率 ${((100 * bounds.opaque) / bboxArea).toFixed(1)}% > 58%，疑似圆形图标底盘`,
      );
    }
  }
  const boutiqueMatch = entry.path.match(
    /^assets\/characters\/modular\/shop\/(berry-cream|moon-sugar|rose-night)\/kenshi-body\.png$/,
  );
  const dungeonMatch = entry.path.match(
    /^assets\/characters\/modular\/dungeon\/(azure|violet|auric|crimson)\/kenshi-body\.png$/,
  );
  const regionMatch = entry.path.match(
    /^assets\/characters\/modular\/kenshi\/(r1|r2|r3|r4|r5|r6|r7)-body\.png$/,
  );
  const noShoesContract = boutiqueMatch
    ? {
        label: `精品/${boutiqueMatch[1]}`,
        shoes: `assets/characters/modular/shop/${boutiqueMatch[1]}/kenshi-shoes.png`,
      }
    : dungeonMatch
      ? {
          label: `副本/${dungeonMatch[1]}`,
          shoes: `assets/characters/modular/dungeon/${dungeonMatch[1]}/kenshi-shoes.png`,
        }
      : regionMatch && NO_SHOES_REGION_FAMILIES.includes(regionMatch[1])
        ? {
            label: `区域/${regionMatch[1]}`,
            shoes: `assets/characters/modular/kenshi/${regionMatch[1]}-shoes.png`,
          }
        : null;
  if (noShoesContract) {
    const noShoes = await noShoesError({ data, info }, noShoesContract.shoes);
    if (noShoes.compared < 1000 || noShoes.rgbMae > 0.1 || noShoes.alphaMae > 0.1) {
      fail(
        `[整身替换无鞋] ${noShoesContract.label} ${entry.path}: mask=${noShoes.compared}，premultiplied RGB MAE=${noShoes.rgbMae.toFixed(3)}，alpha MAE=${noShoes.alphaMae.toFixed(3)}；要求 >=1000 / <=0.1 / <=0.1`,
      );
    }
  }
}

function validateNoDuplicatePixels() {
  for (const [hash, paths] of rgbaHashes) {
    if (paths.length > 1) {
      fail(`[像素复用] RGBA ${hash.slice(0, 10)}：${paths.join(' = ')}`);
    }
  }
  for (const [hash, paths] of layerAlphaHashes) {
    if (paths.length > 1) {
      fail(`[轮廓复用] alpha ${hash.slice(0, 10)}：${paths.join(' = ')}`);
    }
  }
}

function validateSourceWiring() {
  const selectedSources = [
    'src/data/characterAppearance.ts',
    'src/data/equipment.ts',
    'src/data/equipmentDungeonGear.ts',
    'src/data/boutique.ts',
    'src/data/items.ts',
    'src/data/skills.ts',
    'src/data/skillVisuals.ts',
  ];
  const source = Object.fromEntries(
    selectedSources.map((path) => [path, readFileSync(resolve(path), 'utf8')]),
  );
  const forbidden = [
    ['src/data/characterAppearance.ts', "classId === 'kenshi' ? 'catkin'"],
    ['src/data/characterAppearance.ts', "candidate === 'kenshi' ? 'catkin'"],
    ['src/data/characterAppearance.ts', "kenshi: 'assets/characters/modular/catkin"],
    ['src/data/characterAppearance.ts', "kenshi: 'assets/effects/basic/catkin"],
    ['src/data/equipment.ts', "classId === 'kenshi' ? 'catkin'"],
    ['src/data/equipment.ts', "item.classId === 'kenshi' ? 'catkin'"],
  ];
  for (const [path, snippet] of forbidden) {
    if (source[path].includes(snippet)) fail(`[回落] ${path}: ${snippet}`);
  }
  if (
    /kenshi\s*:\s*['"`]assets\/effects\/boutique\/[^'"`]*catkin/.test(
      source['src/data/boutique.ts'],
    )
  ) {
    fail('[回落] src/data/boutique.ts: kenshi 仍引用 catkin 精品特效');
  }
  const kenshiDungeonBlock = source['src/data/equipmentDungeonGear.ts'].match(
    /kenshi:\s*\{([\s\S]*?)\n\s*\},/,
  )?.[1];
  if (!kenshiDungeonBlock || kenshiDungeonBlock.includes('catkin')) {
    fail('[回落] src/data/equipmentDungeonGear.ts: kenshi 副本视觉键未独立');
  }
  const kenshiSigilBlock = source['src/data/items.ts'].match(
    /'sigil_kenshi'[\s\S]*?icon:\s*'([^']+)'/,
  );
  if (kenshiSigilBlock?.[1] !== 'assets/items/sigil_kenshi.png') {
    fail('[回落] src/data/items.ts: 樱酱徽记未引用独立 sigil_kenshi.png');
  }
  const kenshiVisualCount = (
    source['src/data/skillVisuals.ts'].match(/'skill_kenshi_[^']+'/g) ?? []
  ).length;
  const kenshiEffectCount = (
    source['src/data/skillVisuals.ts'].match(/'assets\/effects\/kenshi-[^']+\.png'/g) ?? []
  ).length;
  const kenshiPassiveIconCount = (
    source['src/data/skillVisuals.ts'].match(/'assets\/icons\/skills\/kenshi-[^']+\.png'/g) ?? []
  ).length;
  const kenshiSkillIconCount = (
    source['src/data/skills.ts'].match(/icon:\s*'assets\/icons\/skills\/kenshi-[^']+\.png'/g) ?? []
  ).length;
  if (
    kenshiVisualCount !== 14 ||
    kenshiEffectCount !== 9 ||
    kenshiPassiveIconCount !== 5 ||
    kenshiSkillIconCount !== 14
  ) {
    fail(
      `[技能接线] 期望 14 项 / 9 主动特效 / 5 被动视觉 / 14 技能图标，实际 ${kenshiVisualCount} / ${kenshiEffectCount} / ${kenshiPassiveIconCount} / ${kenshiSkillIconCount}`,
    );
  }

  const ownedTests = [
    'src/data/__tests__/characterAppearance.spec.ts',
    'src/data/__tests__/equipmentPresentation.spec.ts',
    'src/data/__tests__/equipmentDungeons.spec.ts',
    'src/data/__tests__/battleMotions.spec.ts',
    'src/data/__tests__/region5Appearance.spec.ts',
    'src/data/__tests__/region6Appearance.spec.ts',
    'src/data/__tests__/region7Appearance.spec.ts',
    'src/data/__tests__/region5AssetManifest.spec.ts',
    'src/data/__tests__/region6AssetManifest.spec.ts',
    'src/data/__tests__/region7AssetManifest.spec.ts',
    'src/data/__tests__/skillCards.spec.ts',
    'src/data/__tests__/content.spec.ts',
    'src/data/__tests__/enhanceProgression.spec.ts',
    'src/components/__tests__/characterAppearanceUi.spec.ts',
    'src/components/__tests__/setCodex.spec.ts',
  ];
  for (const path of ownedTests) {
    const text = readFileSync(resolve(path), 'utf8');
    if (/filter\s*\([^\n]*!==\s*['"]kenshi['"]/.test(text)) {
      fail(`[测试放行] ${path}: 仍通过 filter 排除 kenshi`);
    }
  }
}

validateContractShape();
validateSourceWiring();
for (const entry of [...CONTRACT_ASSETS, ...STANDALONE_REQUIRED]) {
  await validateAsset(entry);
}
await validateThemeSilhouetteSeparation();
validateNoDuplicatePixels();

if (errors.length > 0) {
  console.error(`\n樱酱资产门禁失败：${errors.length} 项\n`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    '樱酱资产门禁通过：157 项角色运行时资产 + 1 枚独立职业徽记，' +
      'RGBA/轮廓零复用、主题 alpha IoU < 0.900、武器命中居合佩刀锚点；' +
      'R2 核心资产原生/160px 半透明绿边与近黑蒙版均低于硬阈值。',
  );
}
