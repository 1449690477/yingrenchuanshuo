import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import sharp from 'sharp';

const CLASSES = ['swordsman', 'witch', 'shaman', 'catkin', 'kenshi'];
const THEMES = ['berry-cream', 'moon-sugar', 'rose-night', 'ice-snow'];
const SLOTS = ['body', 'head', 'shoes', 'weapon'];
const ARENA_GEAR = {
  swordsman: {
    weapon: 'triumph-verdict-blade',
    head: 'triumph-laurel-crown',
    body: 'triumph-battle-mantle',
    ring: 'triumph-oath-ring',
  },
  witch: {
    weapon: 'starjudge-scale-staff',
    head: 'starjudge-observatory-crown',
    body: 'starjudge-orbit-robe',
    ring: 'starjudge-fixedstar-ring',
  },
  shaman: {
    weapon: 'oracle-spirit-bell-staff',
    head: 'oracle-rite-crown',
    body: 'oracle-ritual-vestment',
    ring: 'oracle-pact-ring',
  },
  catkin: {
    weapon: 'swiftshadow-twin-claws',
    head: 'swiftshadow-nighthunt-ears',
    body: 'swiftshadow-stalker-suit',
    ring: 'swiftshadow-agile-ring',
  },
  kenshi: {
    weapon: 'blinkbloom-boundary-katana',
    head: 'blinkbloom-snowear-crown',
    body: 'blinkbloom-whitefeather-garb',
    ring: 'blinkbloom-return-ring',
  },
};
const ICON_FILES = [
  'belt.png',
  'body.png',
  'bracelet.png',
  'head.png',
  'necklace.png',
  'ring.png',
  'shoes.png',
  ...CLASSES.map((classId) => `weapon-${classId}.png`),
];
const WIDTH = 640;
const HEIGHT = 960;
const checkOnly = process.argv.includes('--check');
const FACE = {
  swordsman: { cx: 332.8, cy: 96, rx: 121.6, ry: 86.4 },
  witch: { cx: 320, cy: 96, rx: 115.2, ry: 84.48 },
  shaman: { cx: 320, cy: 96, rx: 108.8, ry: 84.48 },
  catkin: { cx: 320, cy: 93.12, rx: 118.4, ry: 89.28 },
  kenshi: { cx: 320, cy: 93.12, rx: 118.4, ry: 89.28 },
};
const WEAPON_ANCHORS = {
  swordsman: [
    [145, 385, 105, 115],
    [440, 265, 135, 145],
  ],
  witch: [
    [215, 315, 105, 110],
    [450, 250, 135, 125],
  ],
  shaman: [
    [275, 300, 110, 115],
    [450, 240, 140, 125],
  ],
  catkin: [
    [145, 375, 120, 130],
    [435, 250, 145, 180],
  ],
  // 樱酱是腰侧佩刀，不复用老职业手持锚点。
  kenshi: [[170, 520, 240, 200]],
};
const ARENA_WEAPON_ANCHORS = {
  ...WEAPON_ANCHORS,
  // 凯旋裁决剑是左手斜持，剑柄位于胸腰之间，不沿用普通剑士的下垂持剑区。
  swordsman: [[120, 280, 130, 140]],
};
const ARENA_KENSHI_RING_ANCHOR = [400, 340, 140, 180];

const runtimeRoot = resolve('public/assets/characters/modular');
const qaImage = resolve('art-source/qa/shop-appearance-contact.webp');
const qaIconImage = resolve('art-source/qa/shop-appearance-icons-contact.webp');
const qaJson = resolve('art-source/qa/shop-appearance-audit.json');
const failures = [];
const report = [];
const iconReport = [];
const effectReport = [];

function fail(message) {
  failures.push(message);
}

async function writeOrCheck(file, content) {
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  if (!checkOnly) {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, bytes);
    return;
  }
  if (!existsSync(file)) {
    fail(`${relative(resolve('.'), file)} 缺少已提交验收产物`);
    return;
  }
  const current = await readFile(file);
  if (!current.equals(bytes)) {
    fail(`${relative(resolve('.'), file)} 已与当前商城外观矩阵不一致，请重新生成`);
  }
}

function assetPath(theme, classId, slot) {
  return resolve(runtimeRoot, 'shop', theme, `${classId}-${slot}.png`);
}

async function inspect(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  let alphaPixels = 0;
  let opaquePixels = 0;
  const alphaChannel = Buffer.alloc(info.width * info.height);
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * info.channels + 3];
      alphaChannel[y * info.width + x] = alpha;
      if (!alpha) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      alphaPixels += 1;
      if (alpha >= 128) opaquePixels += 1;
    }
  }
  return {
    data,
    info,
    bbox: [minX, minY, maxX, maxY],
    alphaPixels,
    opaquePixels,
    alphaSha256: createHash('sha256').update(alphaChannel).digest('hex'),
    sha256: createHash('sha256')
      .update(await readFile(file))
      .digest('hex'),
  };
}

function alphaInRect(stats, [left, top, width, height]) {
  let count = 0;
  for (let y = top; y < Math.min(top + height, stats.info.height); y += 1) {
    for (let x = left; x < Math.min(left + width, stats.info.width); x += 1) {
      if (stats.data[(y * stats.info.width + x) * stats.info.channels + 3] > 20) count += 1;
    }
  }
  return count;
}

function maskedPixelDifference(actual, expected, mask) {
  let checked = 0;
  let premultipliedError = 0;
  let alphaError = 0;
  for (let offset = 0; offset < mask.data.length; offset += mask.info.channels) {
    if (mask.data[offset + 3] <= 20) continue;
    checked += 1;
    const actualAlpha = actual.data[offset + 3] / 255;
    const expectedAlpha = expected.data[offset + 3] / 255;
    alphaError += Math.abs(actual.data[offset + 3] - expected.data[offset + 3]);
    for (let channel = 0; channel < 3; channel += 1) {
      premultipliedError += Math.abs(
        actual.data[offset + channel] * actualAlpha -
          expected.data[offset + channel] * expectedAlpha,
      );
    }
  }
  return {
    checked,
    premultipliedMae: premultipliedError / (checked * 3),
    alphaMae: alphaError / checked,
  };
}

function alphaOverlapPixels(first, second) {
  let firstPixels = 0;
  let secondPixels = 0;
  let overlapPixels = 0;
  for (let offset = 0; offset < first.data.length; offset += first.info.channels) {
    const firstVisible = first.data[offset + 3] > 20;
    const secondVisible = second.data[offset + 3] > 20;
    if (firstVisible) firstPixels += 1;
    if (secondVisible) secondPixels += 1;
    if (firstVisible && secondVisible) overlapPixels += 1;
  }
  return { firstPixels, secondPixels, overlapPixels };
}

function whiteBackgroundContrast(stats) {
  let visible = 0;
  let luminanceSum = 0;
  let chromaSum = 0;
  let nearWhite = 0;
  let darkPixels = 0;
  for (let offset = 0; offset < stats.data.length; offset += stats.info.channels) {
    const alpha = stats.data[offset + 3] / 255;
    if (alpha <= 0.06) continue;
    const red = stats.data[offset] * alpha + 255 * (1 - alpha);
    const green = stats.data[offset + 1] * alpha + 255 * (1 - alpha);
    const blue = stats.data[offset + 2] * alpha + 255 * (1 - alpha);
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
    visible += 1;
    luminanceSum += luminance;
    chromaSum += chroma;
    if (luminance > 235) nearWhite += 1;
    if (luminance <= 200) darkPixels += 1;
  }
  return {
    meanLuminance: visible ? luminanceSum / visible : 255,
    meanChroma: visible ? chromaSum / visible : 0,
    nearWhiteRatio: visible ? nearWhite / visible : 1,
    darkPixelRatio: visible ? darkPixels / visible : 0,
  };
}

function hasWeakWhiteBackgroundContrast(contrast) {
  return (
    contrast.meanLuminance > 228 ||
    contrast.nearWhiteRatio > 0.45 ||
    (contrast.meanLuminance > 205 && contrast.meanChroma < 16 && contrast.darkPixelRatio < 0.4)
  );
}

function contrastSummary(contrast) {
  return `meanLum=${contrast.meanLuminance.toFixed(1)}，meanChroma=${contrast.meanChroma.toFixed(1)}，dark=${(contrast.darkPixelRatio * 100).toFixed(1)}%，nearWhite=${(contrast.nearWhiteRatio * 100).toFixed(1)}%`;
}

async function faceLayer(file, classId) {
  const face = FACE[classId];
  const mask = Buffer.from(
    `<svg width="${WIDTH}" height="${HEIGHT}"><ellipse cx="${face.cx}" cy="${face.cy}" rx="${face.rx}" ry="${face.ry}" fill="white"/></svg>`,
  );
  return sharp(file)
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

async function composeSuite(theme, classId) {
  const body = assetPath(theme, classId, 'body');
  const replacement = classId === 'kenshi';
  const base = replacement ? body : resolve(runtimeRoot, classId, 'base-noshoes.png');
  const layers = [{ input: base }];
  if (!replacement) layers.push({ input: body });
  layers.push(
    { input: assetPath(theme, classId, 'shoes') },
    { input: await faceLayer(base, classId) },
    { input: assetPath(theme, classId, 'head') },
    { input: assetPath(theme, classId, 'weapon') },
  );
  return sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(layers)
    .png()
    .toBuffer();
}

function arenaAssetPath(classId, slot, icon = false) {
  const slug = ARENA_GEAR[classId][slot];
  const root = icon ? 'public/assets/equipment/arena' : 'public/assets/characters/modular/arena';
  return resolve(root, classId, `${slug}.png`);
}

async function composeArenaSuite(classId) {
  const body = arenaAssetPath(classId, 'body');
  const replacement = classId === 'kenshi';
  const base = replacement ? body : resolve(runtimeRoot, classId, 'base.png');
  const layers = [{ input: base }];
  if (!replacement) layers.push({ input: body });
  layers.push(
    { input: await faceLayer(base, classId) },
    { input: arenaAssetPath(classId, 'head') },
    { input: arenaAssetPath(classId, 'weapon') },
  );
  if (classId === 'kenshi') layers.push({ input: arenaAssetPath(classId, 'ring') });
  return sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(layers)
    .png()
    .toBuffer();
}

async function composeCrossShopSuite(classId) {
  const body = assetPath('ice-snow', classId, 'body');
  const replacement = classId === 'kenshi';
  const base = replacement ? body : resolve(runtimeRoot, classId, 'base-noshoes.png');
  const layers = [{ input: base }];
  if (!replacement) layers.push({ input: body });
  layers.push(
    { input: assetPath('moon-sugar', classId, 'shoes') },
    { input: await faceLayer(base, classId) },
    { input: arenaAssetPath(classId, 'head') },
    { input: arenaAssetPath(classId, 'weapon') },
  );
  return sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(layers)
    .png()
    .toBuffer();
}

async function composeCardboardFullSuite(classId) {
  if (classId !== 'catkin') {
    return sharp({
      create: {
        width: WIDTH,
        height: HEIGHT,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();
  }
  const base = resolve(runtimeRoot, 'shop/cardboard-cat/catkin-body.png');
  const weapon = resolve(runtimeRoot, 'shop/cardboard-cat/catkin-weapon.png');
  return sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: base }, { input: await faceLayer(base, 'catkin') }, { input: weapon }])
    .png()
    .toBuffer();
}

const kenshiBaseNoShoes = await inspect(resolve(runtimeRoot, 'kenshi/base-noshoes.png'));

for (const theme of THEMES) {
  for (const classId of CLASSES) {
    for (const slot of SLOTS) {
      const file = assetPath(theme, classId, slot);
      const key = `${theme}/${classId}/${slot}`;
      if (!existsSync(file)) {
        fail(`${key} 缺少运行时图层`);
        continue;
      }
      const stats = await inspect(file);
      const [, minY, , maxY] = stats.bbox;
      if (stats.info.width !== WIDTH || stats.info.height !== HEIGHT || stats.info.channels !== 4) {
        fail(`${key} 必须是 640×960 RGBA`);
      }
      // 现有最小合法头饰是 ice-snow/kenshi 的 2746 像素；次小样本为 4731。
      // 取 2700 贴近真实样本，避免把近空层当作“小头饰”放过。
      const minimumVisiblePixels = slot === 'head' ? 2_700 : 3_500;
      if (stats.alphaPixels < minimumVisiblePixels) {
        fail(`${key} 可见像素过少：${stats.alphaPixels}`);
      }
      if (slot === 'head' && (minY > 24 || maxY > 210)) fail(`${key} 头饰离开头部安全区`);
      // 680 → 640（2026-08-03 冰雪批裁定，与 shopAppearanceVisual.spec 同口径）：
      // 冰雪 v2 高筒靴是合法设计（修复对齐鞋底边后靴顶更高，五职业实测最低 655），
      // 留 15px 缓冲；鞋层硬闸是脚底锚点 ±8px。
      if (slot === 'shoes' && (minY < 640 || maxY > 950)) fail(`${key} 鞋层离开脚部安全区`);
      if (slot === 'body' && classId === 'kenshi' && (minY > 30 || maxY < 880)) {
        fail(`${key} 樱酱衣裙应为整身替换图`);
      }
      const anchorAlpha =
        slot === 'weapon'
          ? Math.max(...WEAPON_ANCHORS[classId].map((rect) => alphaInRect(stats, rect)))
          : null;
      if (slot === 'weapon' && anchorAlpha < 500) fail(`${key} 武器未命中职业持握锚点`);
      report.push({
        key,
        path: relative(resolve('.'), file).replaceAll('\\', '/'),
        bbox: stats.bbox,
        alphaPixels: stats.alphaPixels,
        opaquePixels: stats.opaquePixels,
        anchorAlpha,
        sha256: stats.sha256,
        alphaSha256: stats.alphaSha256,
      });
    }
  }

  for (const classId of CLASSES.filter((entry) => entry !== 'kenshi')) {
    const body = await inspect(assetPath(theme, classId, 'body'));
    const shoes = await inspect(assetPath(theme, classId, 'shoes'));
    const overlap = alphaOverlapPixels(body, shoes);
    if (overlap.overlapPixels > 0) {
      fail(`${theme}/${classId}/body 与独立鞋层重叠 ${overlap.overlapPixels} 像素，疑似衣裙内置鞋`);
    }
    const bodyReport = report.find((entry) => entry.key === `${theme}/${classId}/body`);
    if (bodyReport) bodyReport.sameThemeShoeOverlapPixels = overlap.overlapPixels;
  }

  const kenshiBody = await inspect(assetPath(theme, 'kenshi', 'body'));
  const kenshiShoes = await inspect(assetPath(theme, 'kenshi', 'shoes'));
  if (theme === 'ice-snow') {
    // 2026-08-04 合同换代：冰雪 v2 樱酱是底模垫层构型（长裙压底模，见
    // build-ice-snow-assets 的 underlayKenshiBase）——旧「鞋区==裸腿」合同
    // 会把及地长裙的裙布当内置鞋挖穿（老板线上实测露腿）。这里改验
    // 裙宽完整（y740 ≥480，母版 521/事故 355）与单穿有脚（y860 ≥30）。
    const skirtRow = alphaInRect(kenshiBody, [0, 740, WIDTH, 1]);
    const feetRow = alphaInRect(kenshiBody, [0, 860, WIDTH, 1]);
    if (skirtRow < 480) fail(`ice-snow/kenshi/body y740 裙宽仅 ${skirtRow}px（应 ≥480）——裙面被挖穿`);
    if (feetRow < 30) fail(`ice-snow/kenshi/body y860 仅 ${feetRow}px（应 ≥30）——底模垫层缺失`);
    const kenshiBodyReport = report.find((entry) => entry.key === `${theme}/kenshi/body`);
    if (kenshiBodyReport) {
      kenshiBodyReport.dressSkirtRowWidth = skirtRow;
      kenshiBodyReport.dressFeetRowWidth = feetRow;
    }
  } else {
    const shoeMaskPixels = maskedPixelDifference(kenshiBody, kenshiBaseNoShoes, kenshiShoes);
    if (shoeMaskPixels.checked < 2_000) {
      fail(`${theme}/kenshi/shoes 鞋履遮罩过小，无法证明 replacement 已剔除内置鞋`);
    }
    // v1 主题维持原合同：v1 母版把靴子画进身体，回填后鞋区必须等于裸腿。
    if (shoeMaskPixels.premultipliedMae > 0.1 || shoeMaskPixels.alphaMae > 0.1) {
      fail(
        `${theme}/kenshi/body 仍含内置鞋：鞋履遮罩 premulMAE=${shoeMaskPixels.premultipliedMae.toFixed(3)} / alphaMAE=${shoeMaskPixels.alphaMae.toFixed(3)}`,
      );
    }
    const kenshiBodyReport = report.find((entry) => entry.key === `${theme}/kenshi/body`);
    if (kenshiBodyReport) {
      kenshiBodyReport.shoeMaskPixels = shoeMaskPixels.checked;
      kenshiBodyReport.shoePremultipliedMae = Number(shoeMaskPixels.premultipliedMae.toFixed(6));
      kenshiBodyReport.shoeAlphaMae = Number(shoeMaskPixels.alphaMae.toFixed(6));
    }
  }

  for (const fileName of ICON_FILES) {
    const file = resolve('public/assets/equipment/shop', theme, fileName);
    const key = `${theme}/${fileName}`;
    if (!existsSync(file)) {
      fail(`${key} 缺少商城图标`);
      continue;
    }
    const stats = await inspect(file);
    if (stats.info.width !== 256 || stats.info.height !== 256 || stats.info.channels !== 4) {
      fail(`${key} 必须是 256×256 RGBA`);
    }
    const contrast = whiteBackgroundContrast(stats);
    if (hasWeakWhiteBackgroundContrast(contrast)) {
      fail(`${key} 白底对比不足：${contrastSummary(contrast)}`);
    }
    iconReport.push({
      key,
      path: relative(resolve('.'), file).replaceAll('\\', '/'),
      bbox: stats.bbox,
      alphaPixels: stats.alphaPixels,
      meanLuminance: Number(contrast.meanLuminance.toFixed(2)),
      meanChroma: Number(contrast.meanChroma.toFixed(2)),
      nearWhiteRatio: Number(contrast.nearWhiteRatio.toFixed(4)),
      darkPixelRatio: Number(contrast.darkPixelRatio.toFixed(4)),
      sha256: stats.sha256,
    });
  }
}

for (const theme of THEMES) {
  const file = resolve('public/assets/equipment/bodies', `boutique-${theme}-body`, 'kenshi.png');
  const key = `${theme}/body-kenshi-presentation.png`;
  if (!existsSync(file)) {
    fail(`${key} 缺少樱酱衣裙职业展示图`);
    continue;
  }
  const stats = await inspect(file);
  if (stats.info.width !== 256 || stats.info.height !== 256 || stats.info.channels !== 4) {
    fail(`${key} 必须是 256×256 RGBA`);
  }
  const contrast = whiteBackgroundContrast(stats);
  if (hasWeakWhiteBackgroundContrast(contrast)) {
    fail(`${key} 白底对比不足：${contrastSummary(contrast)}`);
  }
  iconReport.push({
    key,
    path: relative(resolve('.'), file).replaceAll('\\', '/'),
    bbox: stats.bbox,
    alphaPixels: stats.alphaPixels,
    meanLuminance: Number(contrast.meanLuminance.toFixed(2)),
    meanChroma: Number(contrast.meanChroma.toFixed(2)),
    nearWhiteRatio: Number(contrast.nearWhiteRatio.toFixed(4)),
    darkPixelRatio: Number(contrast.darkPixelRatio.toFixed(4)),
    sha256: stats.sha256,
  });
}

const cardboard = [
  ['body', resolve(runtimeRoot, 'shop/cardboard-cat/catkin-body.png')],
  ['weapon', resolve(runtimeRoot, 'shop/cardboard-cat/catkin-weapon.png')],
];
for (const [slot, file] of cardboard) {
  const key = `cardboard-cat/catkin/${slot}`;
  if (!existsSync(file)) {
    fail(`${key} 缺少运行时图层`);
    continue;
  }
  const stats = await inspect(file);
  if (stats.info.width !== WIDTH || stats.info.height !== HEIGHT || stats.info.channels !== 4) {
    fail(`${key} 必须是 640×960 RGBA`);
  }
  const anchorAlpha =
    slot === 'weapon'
      ? Math.max(...WEAPON_ANCHORS.catkin.map((rect) => alphaInRect(stats, rect)))
      : null;
  if (slot === 'body' && stats.bbox[3] < 880) fail(`${key} 应为整身替换图`);
  if (slot === 'weapon' && anchorAlpha < 500) fail(`${key} 武器未命中喵喵持握锚点`);
  report.push({
    key,
    path: relative(resolve('.'), file).replaceAll('\\', '/'),
    bbox: stats.bbox,
    alphaPixels: stats.alphaPixels,
    opaquePixels: stats.opaquePixels,
    anchorAlpha,
    sha256: stats.sha256,
    alphaSha256: stats.alphaSha256,
  });
}

const cardboardBody = await inspect(resolve(runtimeRoot, 'shop/cardboard-cat/catkin-body.png'));
const cardboardFootAlpha = alphaInRect(cardboardBody, [170, 720, 300, 230]);
if (cardboardFootAlpha < 4_000) {
  fail(`cardboard-cat/catkin/body 完整工装缺少专属靴：脚部锚点仅 ${cardboardFootAlpha}`);
}

for (const fileName of ['body-catkin.png', 'weapon-catkin.png']) {
  const file = resolve('public/assets/equipment/shop/cardboard-cat', fileName);
  const key = `cardboard-cat/${fileName}`;
  if (!existsSync(file)) {
    fail(`${key} 缺少商城图标`);
    continue;
  }
  const stats = await inspect(file);
  if (stats.info.width !== 256 || stats.info.height !== 256 || stats.info.channels !== 4) {
    fail(`${key} 必须是 256×256 RGBA`);
  }
  const contrast = whiteBackgroundContrast(stats);
  if (hasWeakWhiteBackgroundContrast(contrast)) {
    fail(`${key} 白底对比不足：${contrastSummary(contrast)}`);
  }
  iconReport.push({
    key,
    path: relative(resolve('.'), file).replaceAll('\\', '/'),
    bbox: stats.bbox,
    alphaPixels: stats.alphaPixels,
    meanLuminance: Number(contrast.meanLuminance.toFixed(2)),
    meanChroma: Number(contrast.meanChroma.toFixed(2)),
    nearWhiteRatio: Number(contrast.nearWhiteRatio.toFixed(4)),
    darkPixelRatio: Number(contrast.darkPixelRatio.toFixed(4)),
    sha256: stats.sha256,
  });
}

for (const [theme, classId] of [
  ...THEMES.flatMap((theme) => CLASSES.map((classId) => [theme, classId])),
  ['cardboard-cat', 'catkin'],
]) {
  const file = resolve('public/assets/effects/boutique', `${theme}-${classId}.png`);
  const key = `${theme}/${classId}/effect`;
  if (!existsSync(file)) {
    fail(`${key} 缺少商城攻击演出`);
    continue;
  }
  const stats = await inspect(file);
  if (stats.info.width !== 512 || stats.info.height !== 512 || stats.info.channels !== 4) {
    fail(`${key} 必须是 512×512 RGBA`);
  }
  if (stats.alphaPixels < 3_500) fail(`${key} 可见像素过少：${stats.alphaPixels}`);
  effectReport.push({
    key,
    path: relative(resolve('.'), file).replaceAll('\\', '/'),
    bbox: stats.bbox,
    alphaPixels: stats.alphaPixels,
    opaquePixels: stats.opaquePixels,
    sha256: stats.sha256,
    alphaSha256: stats.alphaSha256,
  });
}

for (const classId of CLASSES) {
  for (const slot of ['body', 'head', 'weapon', ...(classId === 'kenshi' ? ['ring'] : [])]) {
    const file = arenaAssetPath(classId, slot);
    const key = `arena-stigma/${classId}/${slot}`;
    if (!existsSync(file)) {
      fail(`${key} 缺少荣誉商店运行时图层`);
      continue;
    }
    const stats = await inspect(file);
    if (stats.info.width !== WIDTH || stats.info.height !== HEIGHT || stats.info.channels !== 4) {
      fail(`${key} 必须是 640×960 RGBA`);
    }
    const minimumVisiblePixels = slot === 'head' || slot === 'ring' ? 2_000 : 3_500;
    if (stats.alphaPixels < minimumVisiblePixels) {
      fail(`${key} 手机人物上几乎不可辨：${stats.alphaPixels} alpha 像素`);
    }
    const anchorAlpha =
      slot === 'weapon'
        ? Math.max(...ARENA_WEAPON_ANCHORS[classId].map((rect) => alphaInRect(stats, rect)))
        : slot === 'ring'
          ? alphaInRect(stats, ARENA_KENSHI_RING_ANCHOR)
          : null;
    if (slot === 'weapon' && anchorAlpha < 500) fail(`${key} 武器未命中职业持握锚点`);
    if (slot === 'ring' && anchorAlpha < 900) fail(`${key} 戒指未贴合樱酱右手/手腕锚点`);
    report.push({
      key,
      path: relative(resolve('.'), file).replaceAll('\\', '/'),
      bbox: stats.bbox,
      alphaPixels: stats.alphaPixels,
      opaquePixels: stats.opaquePixels,
      anchorAlpha,
      sha256: stats.sha256,
      alphaSha256: stats.alphaSha256,
    });
  }

  for (const slot of ['body', 'head', 'weapon', 'ring']) {
    const file = arenaAssetPath(classId, slot, true);
    const key = `arena-stigma/${classId}/${slot}-icon`;
    if (!existsSync(file)) {
      fail(`${key} 缺少荣誉商店商品图标`);
      continue;
    }
    const stats = await inspect(file);
    if (stats.info.width !== 256 || stats.info.height !== 256 || stats.info.channels !== 4) {
      fail(`${key} 必须是 256×256 RGBA`);
    }
    const contrast = whiteBackgroundContrast(stats);
    if (hasWeakWhiteBackgroundContrast(contrast)) {
      fail(`${key} 白底对比不足：${contrastSummary(contrast)}`);
    }
    iconReport.push({
      key,
      path: relative(resolve('.'), file).replaceAll('\\', '/'),
      bbox: stats.bbox,
      alphaPixels: stats.alphaPixels,
      meanLuminance: Number(contrast.meanLuminance.toFixed(2)),
      meanChroma: Number(contrast.meanChroma.toFixed(2)),
      nearWhiteRatio: Number(contrast.nearWhiteRatio.toFixed(4)),
      darkPixelRatio: Number(contrast.darkPixelRatio.toFixed(4)),
      sha256: stats.sha256,
    });
  }
}

if (report.length !== 98) fail(`可见图层门禁空转：期望 98，实际 ${report.length}`);
if (iconReport.length !== 74) fail(`商品图标门禁空转：期望 74，实际 ${iconReport.length}`);
if (effectReport.length !== 21) fail(`系列演出门禁空转：期望 21，实际 ${effectReport.length}`);

const hashes = new Map();
const alphaHashes = new Map();
for (const entry of report) {
  const previous = hashes.get(entry.sha256);
  if (previous) fail(`${entry.key} 与 ${previous} 复用了同一张图层`);
  hashes.set(entry.sha256, entry.key);
  const previousShape = alphaHashes.get(entry.alphaSha256);
  if (previousShape) fail(`${entry.key} 与 ${previousShape} 复用了同一透明轮廓（疑似改色复制）`);
  alphaHashes.set(entry.alphaSha256, entry.key);
}

const iconHashes = new Map();
for (const entry of iconReport) {
  const previous = iconHashes.get(entry.sha256);
  if (previous) fail(`${entry.key} 与 ${previous} 复用了同一张商品图标`);
  iconHashes.set(entry.sha256, entry.key);
}

const effectHashes = new Map();
const effectAlphaHashes = new Map();
for (const entry of effectReport) {
  const previous = effectHashes.get(entry.sha256);
  if (previous) fail(`${entry.key} 与 ${previous} 复用了同一张攻击演出`);
  effectHashes.set(entry.sha256, entry.key);
  const previousShape = effectAlphaHashes.get(entry.alphaSha256);
  if (previousShape) {
    fail(`${entry.key} 与 ${previousShape} 复用了同一演出轮廓（疑似改色复制）`);
  }
  effectAlphaHashes.set(entry.alphaSha256, entry.key);
}

const roseSwordsmanHead = report.find((entry) => entry.key === 'rose-night/swordsman/head');
if (!roseSwordsmanHead || roseSwordsmanHead.bbox[3] > 115) {
  fail('绯樱星愿剑士礼帽帽檐仍压入眼睛安全区');
}

const cardWidth = 256;
const cardHeight = 412;
const contactLayers = [];
const contactRows = [...THEMES, 'arena-stigma', 'cross-shop', 'cardboard-full'];
for (let row = 0; row < contactRows.length; row += 1) {
  for (let column = 0; column < CLASSES.length; column += 1) {
    const classId = CLASSES[column];
    const theme = contactRows[row];
    const suiteSource =
      theme === 'arena-stigma'
        ? await composeArenaSuite(classId)
        : theme === 'cross-shop'
          ? await composeCrossShopSuite(classId)
          : theme === 'cardboard-full'
            ? await composeCardboardFullSuite(classId)
            : await composeSuite(theme, classId);
    const suite = await sharp(suiteSource).resize(cardWidth, 384).png().toBuffer();
    contactLayers.push({ input: suite, left: column * cardWidth, top: row * cardHeight + 28 });
    contactLayers.push({
      input: Buffer.from(
        `<svg width="${cardWidth}" height="28"><rect width="100%" height="100%" fill="#171a22"/><text x="8" y="20" fill="#fff" font-size="14">${theme} / ${classId}</text></svg>`,
      ),
      left: column * cardWidth,
      top: row * cardHeight,
    });
  }
}
const contactImage = await sharp({
  create: {
    width: cardWidth * CLASSES.length,
    height: cardHeight * contactRows.length,
    channels: 4,
    background: '#3a3e4d',
  },
})
  .composite(contactLayers)
  .webp({ lossless: true })
  .toBuffer();
await writeOrCheck(qaImage, contactImage);

const iconCardWidth = 176;
const iconCardHeight = 150;
const iconColumns = 8;
const iconRows = Math.ceil(iconReport.length / iconColumns);
const iconContactLayers = [];
for (let index = 0; index < iconReport.length; index += 1) {
  const entry = iconReport[index];
  const column = index % iconColumns;
  const row = Math.floor(index / iconColumns);
  const left = column * iconCardWidth;
  const top = row * iconCardHeight;
  const keyParts = entry.key.split('/');
  const labelTop = keyParts.slice(0, -1).join('/');
  const labelBottom = keyParts.at(-1);
  const icon = await sharp(resolve(entry.path)).resize(96, 96, { fit: 'contain' }).png().toBuffer();
  iconContactLayers.push({
    input: Buffer.from(
      `<svg width="${iconCardWidth}" height="${iconCardHeight}"><rect x="3" y="3" width="170" height="144" rx="12" fill="#ffffff" stroke="#d7dfed"/><text x="10" y="17" fill="#52627b" font-size="10">${labelTop}</text><text x="10" y="140" fill="#182437" font-size="11">${labelBottom}</text></svg>`,
    ),
    left,
    top,
  });
  iconContactLayers.push({ input: icon, left: left + 40, top: top + 26 });
}
const iconContactImage = await sharp({
  create: {
    width: iconCardWidth * iconColumns,
    height: iconCardHeight * iconRows,
    channels: 4,
    background: '#eef3fa',
  },
})
  .composite(iconContactLayers)
  .webp({ lossless: true })
  .toBuffer();
await writeOrCheck(qaIconImage, iconContactImage);

const auditJson = `${JSON.stringify(
  {
    contract:
      '4 boutique themes × 5 classes × 4 visible slots + cardboard-cat 2 + arena shop 16 visible layers',
    failures,
    assets: report,
    icons: iconReport,
    effects: effectReport,
  },
  null,
  2,
)}\n`;
await writeOrCheck(qaJson, auditJson);

if (failures.length) {
  console.error(failures.map((message) => `✗ ${message}`).join('\n'));
  process.exit(1);
}
console.log(
  `✓ 商城外观矩阵通过：${report.length} 张独立图层、${iconReport.length} 张白底可辨商品图标、${effectReport.length} 张独立攻击演出，五职业与商品图标接触表${checkOnly ? '与提交产物一致' : '已生成'}`,
);
