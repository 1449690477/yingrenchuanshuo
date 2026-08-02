#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);
const ROOT = resolve('.');
const CHECK = process.argv.includes('--check');
const REBUILD = process.argv.includes('--rebuild');
const SOURCE_CHECK = process.argv.includes('--source-check');
const ONLY_ARENA_RING = process.argv.includes('--arena-ring-only');
const selectedModes = [CHECK, REBUILD, SOURCE_CHECK].filter(Boolean).length;
if (selectedModes !== 1) {
  throw new Error(
    '用法：node scripts/build-kenshi-r2-assets.mjs --rebuild | --check | --source-check',
  );
}
const COMPARE = CHECK || SOURCE_CHECK;
const NEEDS_CHROMA_TOOL = (REBUILD || SOURCE_CHECK) && !ONLY_ARENA_RING;

const CODEX_ROOT = process.env.CODEX_HOME ?? join(homedir(), '.codex');
const REMOVE_CHROMA = join(
  CODEX_ROOT,
  'skills',
  '.system',
  'imagegen',
  'scripts',
  'remove_chroma_key.py',
);
if (NEEDS_CHROMA_TOOL && !existsSync(REMOVE_CHROMA)) {
  throw new Error(`缺少统一绿幕工具：${REMOVE_CHROMA}`);
}

const PYTHON = process.env.CODEX_KENSHI_PYTHON ?? 'python';
const CANVAS = { width: 640, height: 960 };
const R2_ROOT = 'art-source/characters/kenshi/r2';
const R2_ARENA_RING_SOURCE = `${R2_ROOT}/arena/blinkbloom-return-ring.png`;
const R2_ARENA_RING_OUTPUT =
  'public/assets/characters/modular/arena/kenshi/blinkbloom-return-ring.png';
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
const NO_SHOES_REGION_FAMILIES = new Set(['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7']);
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

const sourceJobs = [
  {
    chroma: 'art-source/characters/kenshi/base-chroma.png',
    alpha: 'art-source/characters/kenshi/base-alpha.png',
    output: 'public/assets/characters/modular/kenshi/base.png',
    role: 'body',
  },
  {
    chroma: 'art-source/characters/kenshi/base-noshoes-chroma.png',
    alpha: 'art-source/characters/kenshi/base-noshoes-alpha.png',
    output: 'public/assets/characters/modular/kenshi/base-noshoes.png',
    role: 'body',
  },
  ...REGION_FAMILIES.flatMap((family) =>
    ['body', 'head', 'weapon'].map((role) => ({
      chroma: `art-source/characters/kenshi/regions/${family}-${role}-chroma.png`,
      alpha: `art-source/characters/kenshi/regions/${family}-${role}-alpha.png`,
      output: `public/assets/characters/modular/kenshi/${family}-${role}.png`,
      role,
      ...(role === 'body' && NO_SHOES_REGION_FAMILIES.has(family)
        ? {
            noShoesContract: family,
            shoes: `public/assets/characters/modular/kenshi/${family}-shoes.png`,
          }
        : {}),
    })),
  ),
  ...BOUTIQUE_THEMES.map((theme) => ({
    chroma: `art-source/characters/kenshi/boutique/${theme}-body-chroma.png`,
    alpha: `art-source/characters/kenshi/boutique/${theme}-body-alpha.png`,
    output: `public/assets/characters/modular/shop/${theme}/kenshi-body.png`,
    role: 'body',
    noShoesContract: `boutique/${theme}`,
    shoes: `public/assets/characters/modular/shop/${theme}/kenshi-shoes.png`,
  })),
  ...DUNGEON_TIERS.map((tier) => ({
    chroma: `art-source/characters/kenshi/dungeon/${tier}-body-chroma.png`,
    alpha: `art-source/characters/kenshi/dungeon/${tier}-body-alpha.png`,
    output: `public/assets/characters/modular/dungeon/${tier}/kenshi-body.png`,
    role: 'body',
    noShoesContract: `dungeon/${tier}`,
    shoes: `public/assets/characters/modular/dungeon/${tier}/kenshi-shoes.png`,
  })),
];

const portraitJobs = [
  {
    chroma: `${R2_ROOT}/portrait-chroma.png`,
    alpha: `${R2_ROOT}/portrait-alpha.png`,
    output: 'public/assets/characters/kenshi-sakura.png',
  },
  {
    chroma: `${R2_ROOT}/cast-portrait-chroma.png`,
    alpha: `${R2_ROOT}/cast-portrait-alpha.png`,
    output: 'public/assets/characters/kenshi-sakura-cast.png',
  },
];

const atlasJobs = [
  [
    'art-source/characters/kenshi/atlases/skill-icons-chroma.png',
    'art-source/characters/kenshi/atlases/skill-icons-alpha.png',
  ],
  [
    'art-source/characters/kenshi/atlases/skill-effects-chroma.png',
    'art-source/characters/kenshi/atlases/skill-effects-alpha.png',
  ],
];

function abs(path) {
  return resolve(ROOT, path);
}

async function alphaBounds(input, threshold = 20) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if ((data[(y * info.width + x) * info.channels + 3] ?? 0) <= threshold) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < 0) throw new Error('透明图没有可见主体');
  return { left, top, right, bottom };
}

async function cleanTransparentEdges(input) {
  const decoded = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = decoded;
  const original = Buffer.from(data);
  const width = info.width;
  const height = info.height;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * info.channels;
      const alpha = original[offset + 3] ?? 0;
      if (alpha === 0 || alpha >= 248) continue;
      let red = original[offset] ?? 0;
      let green = original[offset + 1] ?? 0;
      let blue = original[offset + 2] ?? 0;
      const greenDominance = green - Math.max(red, blue);
      const luminance = (red * 54 + green * 183 + blue * 19) / 256;
      const suspicious = greenDominance > 8 || luminance < 24;
      if (suspicious) {
        let sampleRed = 0;
        let sampleGreen = 0;
        let sampleBlue = 0;
        let samples = 0;
        for (let radius = 1; radius <= 3 && samples === 0; radius += 1) {
          for (
            let sampleY = Math.max(0, y - radius);
            sampleY <= Math.min(height - 1, y + radius);
            sampleY += 1
          ) {
            for (
              let sampleX = Math.max(0, x - radius);
              sampleX <= Math.min(width - 1, x + radius);
              sampleX += 1
            ) {
              if (Math.abs(sampleX - x) !== radius && Math.abs(sampleY - y) !== radius) continue;
              const sampleOffset = (sampleY * width + sampleX) * info.channels;
              if ((original[sampleOffset + 3] ?? 0) < 220) continue;
              const sr = original[sampleOffset] ?? 0;
              const sg = original[sampleOffset + 1] ?? 0;
              const sb = original[sampleOffset + 2] ?? 0;
              if (sg - Math.max(sr, sb) > 12) continue;
              sampleRed += sr;
              sampleGreen += sg;
              sampleBlue += sb;
              samples += 1;
            }
          }
        }
        if (samples > 0) {
          red = Math.round(sampleRed / samples);
          green = Math.round(sampleGreen / samples);
          blue = Math.round(sampleBlue / samples);
        }
      }
      if (green - Math.max(red, blue) > 6) green = Math.min(255, Math.max(red, blue) + 6);
      data[offset] = red;
      data[offset + 1] = green;
      data[offset + 2] = blue;
    }
  }

  return sharp(data, { raw: info }).png().toBuffer();
}

async function canonicalPng(input, quality = 94) {
  return sharp(input)
    .ensureAlpha()
    .png({ compressionLevel: 9, palette: true, quality, effort: 10 })
    .toBuffer();
}

function rawAlphaBounds(data, info, threshold = 20) {
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if ((data[(y * info.width + x) * info.channels + 3] ?? 0) <= threshold) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return right < 0 ? null : { left, top, right, bottom };
}

function rawBoundsDelta(left, right) {
  if (!left || !right) return left === right ? 0 : Number.POSITIVE_INFINITY;
  return Math.max(
    Math.abs(left.left - right.left),
    Math.abs(left.top - right.top),
    Math.abs(left.right - right.right),
    Math.abs(left.bottom - right.bottom),
  );
}

async function assertPixelsEquivalent(actualInput, candidate, label, maxVisibleMae = 0.12) {
  const left = await sharp(actualInput).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const right = await sharp(candidate).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (left.info.width !== right.info.width || left.info.height !== right.info.height) {
    throw new Error(`[R2重建] ${label} 尺寸不可复现`);
  }
  let visibleDifference = 0;
  let comparedChannels = 0;
  let alphaDifference = 0;
  let unionVisiblePixels = 0;
  for (let index = 0; index < left.data.length; index += left.info.channels) {
    const leftAlphaByte = left.data[index + 3] ?? 0;
    const rightAlphaByte = right.data[index + 3] ?? 0;
    if (leftAlphaByte === 0 && rightAlphaByte === 0) continue;
    const leftAlpha = leftAlphaByte / 255;
    const rightAlpha = rightAlphaByte / 255;
    visibleDifference += Math.abs(
      (left.data[index] ?? 0) * leftAlpha - (right.data[index] ?? 0) * rightAlpha,
    );
    visibleDifference += Math.abs(
      (left.data[index + 1] ?? 0) * leftAlpha - (right.data[index + 1] ?? 0) * rightAlpha,
    );
    visibleDifference += Math.abs(
      (left.data[index + 2] ?? 0) * leftAlpha - (right.data[index + 2] ?? 0) * rightAlpha,
    );
    visibleDifference += Math.abs(leftAlphaByte - rightAlphaByte);
    alphaDifference += Math.abs(leftAlphaByte - rightAlphaByte);
    comparedChannels += 4;
    unionVisiblePixels += 1;
  }
  const visibleMae = visibleDifference / Math.max(1, comparedChannels);
  const alphaMae = alphaDifference / Math.max(1, unionVisiblePixels);
  const bboxDelta = rawBoundsDelta(
    rawAlphaBounds(left.data, left.info),
    rawAlphaBounds(right.data, right.info),
  );
  const maxAlphaMae = Math.max(0.5, maxVisibleMae * 4);
  if (visibleMae > maxVisibleMae || alphaMae > maxAlphaMae || bboxDelta > 1) {
    throw new Error(
      `[R2重建] ${label} 像素不可复现，visibleMAE=${visibleMae.toFixed(4)}，alphaMAE=${alphaMae.toFixed(4)}，bboxDelta=${bboxDelta}`,
    );
  }
}

async function comparePixels(path, candidate, maxMae = 0.12) {
  if (!existsSync(abs(path))) throw new Error(`[R2重建] 缺少目标：${path}`);
  await assertPixelsEquivalent(abs(path), candidate, path, maxMae);
}

async function expectPixelGuardRejects(name, actual, candidate) {
  let rejected = false;
  try {
    await assertPixelsEquivalent(actual, candidate, `破坏样本/${name}`);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('像素不可复现')) throw error;
    rejected = true;
  }
  if (!rejected) throw new Error(`[R2重建] 像素门禁未拒绝破坏样本：${name}`);
}

async function verifyPixelComparisonGuard() {
  const width = 16;
  const height = 16;
  const source = Buffer.alloc(width * height * 4);
  for (let y = 4; y < 12; y += 1) {
    for (let x = 4; x < 12; x += 1) {
      const offset = (y * width + x) * 4;
      source[offset] = 120;
      source[offset + 1] = 210;
      source[offset + 2] = 255;
      source[offset + 3] = 255;
    }
  }
  const actual = await sharp(source, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
  await assertPixelsEquivalent(actual, actual, '门禁同图自检');
  const erased = Buffer.from(source);
  for (let index = 3; index < erased.length; index += 4) erased[index] = 0;
  await expectPixelGuardRejects(
    '清空 alpha 但保留不可见 RGB',
    actual,
    await sharp(erased, { raw: { width, height, channels: 4 } })
      .png()
      .toBuffer(),
  );
  const shifted = Buffer.alloc(source.length);
  for (let y = 4; y < 12; y += 1) {
    for (let x = 7; x < 15; x += 1) {
      const sourceOffset = (y * width + (x - 3)) * 4;
      const targetOffset = (y * width + x) * 4;
      source.copy(shifted, targetOffset, sourceOffset, sourceOffset + 4);
    }
  }
  await expectPixelGuardRejects(
    '主体平移 3px',
    actual,
    await sharp(shifted, { raw: { width, height, channels: 4 } })
      .png()
      .toBuffer(),
  );
}

async function writeOrCheck(path, candidate, maxMae = 0.12, preserveExactPixels = false) {
  const png = preserveExactPixels
    ? await sharp(candidate)
        .ensureAlpha()
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toBuffer()
    : await canonicalPng(candidate, path.includes('characters/kenshi-sakura') ? 90 : 94);
  if (COMPARE) {
    await comparePixels(path, png, maxMae);
    // 下游必须基于刚刚验证过的仓内规范母版继续派生，不能基于“误差内通过”
    // 的候选缓冲区再次量化；否则两条构建管线会把同一稀疏层越编码越漂。
    return readFileSync(abs(path));
  } else {
    await mkdir(dirname(abs(path)), { recursive: true });
    await sharp(png).toFile(abs(path));
  }
  return png;
}

async function keyChroma(chroma, tempRoot) {
  if (!existsSync(abs(chroma))) throw new Error(`[R2母版] 缺少绿幕源：${chroma}`);
  const tempOutput = join(tempRoot, `${chroma.replaceAll(/[\\/:]/g, '_')}.png`);
  await execFileAsync(
    PYTHON,
    [
      REMOVE_CHROMA,
      '--input',
      abs(chroma),
      '--out',
      tempOutput,
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
    { maxBuffer: 4 * 1024 * 1024 },
  );
  return cleanTransparentEdges(tempOutput);
}

async function fitCanvas(input) {
  return sharp(input)
    .ensureAlpha()
    .resize(CANVAS.width, CANVAS.height, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
}

async function alignBody(input) {
  let resized = await fitCanvas(input);
  let bounds = await alphaBounds(resized);
  const targetBottom = 925;
  const minimumTop = 3;
  const maximumVisibleHeight = targetBottom - minimumTop + 1;
  const visibleHeight = bounds.bottom - bounds.top + 1;
  // 先按可见主体高度等比缩入安全区，再对齐脚底。若先缩整张画布、后上移脚底，
  // 发梢会被第二步重新推回 y=0，无法同时满足顶部留白与脚底锚点。
  if (visibleHeight > maximumVisibleHeight) {
    const scale = maximumVisibleHeight / visibleHeight;
    const scaledWidth = Math.max(1, Math.round(CANVAS.width * scale));
    const scaledHeight = Math.max(1, Math.round(CANVAS.height * scale));
    const inset = await sharp(resized)
      .resize(scaledWidth, scaledHeight, {
        fit: 'fill',
        kernel: sharp.kernel.lanczos3,
      })
      .png()
      .toBuffer();
    resized = await sharp({
      create: {
        width: CANVAS.width,
        height: CANVAS.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: inset,
          left: Math.round((CANVAS.width - scaledWidth) / 2),
          top: Math.round((CANVAS.height - scaledHeight) / 2),
        },
      ])
      .png()
      .toBuffer();
    bounds = await alphaBounds(resized);
  }
  const offsetY = targetBottom - bounds.bottom;
  const sourceTop = Math.max(0, -offsetY);
  const targetTop = Math.max(0, offsetY);
  const height = Math.min(CANVAS.height - sourceTop, CANVAS.height - targetTop);
  const visible = await sharp(resized)
    .extract({ left: 0, top: sourceTop, width: CANVAS.width, height })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: CANVAS.width,
      height: CANVAS.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: visible, left: 0, top: targetTop }])
    .png()
    .toBuffer();
}

async function carryWeapon(input) {
  const normalized = await fitCanvas(input);
  const resized = await sharp(normalized)
    .resize(544, 816, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const targetLeft = Math.round((CANVAS.width - 544) / 2 - 110);
  const targetTop = Math.round((CANVAS.height - 816) / 2 + 150);
  const sourceLeft = Math.max(0, -targetLeft);
  const sourceTop = Math.max(0, -targetTop);
  const width = Math.min(544 - sourceLeft, CANVAS.width - Math.max(0, targetLeft));
  const height = Math.min(816 - sourceTop, CANVAS.height - Math.max(0, targetTop));
  const visible = await sharp(resized)
    .extract({ left: sourceLeft, top: sourceTop, width, height })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: CANVAS.width,
      height: CANVAS.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: visible, left: Math.max(0, targetLeft), top: Math.max(0, targetTop) }])
    .png()
    .toBuffer();
}

async function runtimeForRole(alpha, role) {
  if (role === 'body') return alignBody(alpha);
  if (role === 'weapon') return carryWeapon(alpha);
  return fitCanvas(alpha);
}

async function applyNoShoesContract(input, contractId, shoesPath) {
  const body = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const base = await sharp(abs('public/assets/characters/modular/kenshi/base-noshoes.png'))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const shoes = await sharp(abs(shoesPath))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (const peer of [base, shoes]) {
    if (peer.info.width !== body.info.width || peer.info.height !== body.info.height) {
      throw new Error(`[R2无鞋合同] ${contractId} 画布尺寸与 body 不一致`);
    }
  }
  let replaced = 0;
  for (let index = 0; index < body.info.width * body.info.height; index += 1) {
    const offset = index * body.info.channels;
    if ((shoes.data[offset + 3] ?? 0) === 0) continue;
    for (let channel = 0; channel < 4; channel += 1) {
      body.data[offset + channel] = base.data[offset + channel];
    }
    replaced += 1;
  }
  if (replaced < 1000) {
    throw new Error(`[R2无鞋合同] ${contractId} 鞋层 mask 仅 ${replaced} 像素`);
  }
  return sharp(body.data, { raw: body.info }).png().toBuffer();
}

async function runtimeForJob(alpha, job) {
  let runtime = await runtimeForRole(alpha, job.role);
  if (job.noShoesContract) {
    // 先完成统一调色板量化，再覆盖 base-noshoes 的精确像素。若顺序相反，
    // 每张 body 的独立调色板会把同一鞋区再次舍入 0.3~1/255，导致合同漂移。
    runtime = await canonicalPng(runtime);
    runtime = await applyNoShoesContract(runtime, job.noShoesContract, job.shoes);
  }
  return runtime;
}

async function buildKeyedJob(job, tempRoot) {
  const alpha = await keyChroma(job.chroma, tempRoot);
  const canonicalAlpha = await writeOrCheck(job.alpha, alpha);
  const runtime = await runtimeForJob(canonicalAlpha, job);
  await writeOrCheck(job.output, runtime, 0.12, Boolean(job.noShoesContract));
}

async function checkKeyedRuntime(job) {
  if (!existsSync(abs(job.alpha))) throw new Error(`[R2透明母版] 缺少：${job.alpha}`);
  const runtime = await runtimeForJob(abs(job.alpha), job);
  await writeOrCheck(job.output, runtime, 0.12, Boolean(job.noShoesContract));
}

async function buildPortrait(job, tempRoot) {
  const alpha = await keyChroma(job.chroma, tempRoot);
  const canonicalAlpha = await writeOrCheck(job.alpha, alpha);
  await writeOrCheck(job.output, await fitCanvas(canonicalAlpha), 0.2);
}

async function checkPortraitRuntime(job) {
  if (!existsSync(abs(job.alpha))) throw new Error(`[R2透明母版] 缺少：${job.alpha}`);
  await writeOrCheck(job.output, await fitCanvas(abs(job.alpha)), 0.2);
}

async function buildStaticSkillAssets() {
  for (const slug of SKILL_SLUGS) {
    const source = `${R2_ROOT}/skills/${slug}.png`;
    const output = `public/assets/icons/skills/kenshi-${slug}.png`;
    await writeOrCheck(output, await cleanTransparentEdges(abs(source)));
  }
  for (const slug of ACTIVE_SKILL_SLUGS) {
    const source = `${R2_ROOT}/effects/${slug}.png`;
    const output = `public/assets/effects/kenshi-${slug}.png`;
    await writeOrCheck(output, await cleanTransparentEdges(abs(source)));
  }
  await writeOrCheck(
    'public/assets/effects/basic/kenshi-iai.png',
    await cleanTransparentEdges(abs(`${R2_ROOT}/effects/basic-iai.png`)),
  );
}

async function buildArenaRingLayer() {
  // 竞技戒指需要在人物手部可辨，不能把 256px 商品图标缩成几乎不可见的贴纸。
  // 这里直接围绕樱酱右手/手腕锚点绘制金色圣痕环、湖蓝剑气与小樱花光晕。
  const source = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="960" viewBox="0 0 640 960">
      <defs>
        <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff8c8"/>
          <stop offset="0.36" stop-color="#f8d477"/>
          <stop offset="0.72" stop-color="#c9892f"/>
          <stop offset="1" stop-color="#fff2a6"/>
        </linearGradient>
        <filter id="shine" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.2"/>
        </filter>
      </defs>
      <path d="M415 469 C430 443 455 430 484 439 C491 441 497 445 501 450" fill="none" stroke="#72d7ff" stroke-width="7" stroke-linecap="round" stroke-opacity="0.66"/>
      <path d="M419 478 C439 490 468 490 493 469" fill="none" stroke="#dff9ff" stroke-width="4" stroke-linecap="round" stroke-opacity="0.82"/>
      <path d="M427 443 C443 433 465 431 482 438" fill="none" stroke="#fff6bf" stroke-width="2.5" stroke-linecap="round" stroke-opacity="0.86"/>
      <g transform="rotate(-16 454 458)">
        <ellipse cx="454" cy="458" rx="31" ry="12" fill="none" stroke="#f7c95f" stroke-width="14" stroke-opacity="0.4" filter="url(#shine)"/>
        <ellipse cx="454" cy="458" rx="31" ry="12" fill="none" stroke="url(#gold)" stroke-width="6.5"/>
        <ellipse cx="454" cy="454" rx="25" ry="8" fill="none" stroke="#fff9d8" stroke-width="2.2" stroke-opacity="0.96"/>
      </g>
      <g transform="translate(481 439)" fill="#ffc4dc" stroke="#fff6fb" stroke-width="1.4">
        <ellipse cx="0" cy="-7" rx="4.7" ry="7"/>
        <ellipse cx="6.7" cy="-2" rx="4.7" ry="7" transform="rotate(72 6.7 -2)"/>
        <ellipse cx="4.1" cy="5.8" rx="4.7" ry="7" transform="rotate(144 4.1 5.8)"/>
        <ellipse cx="-4.1" cy="5.8" rx="4.7" ry="7" transform="rotate(216 -4.1 5.8)"/>
        <ellipse cx="-6.7" cy="-2" rx="4.7" ry="7" transform="rotate(288 -6.7 -2)"/>
        <circle r="3.2" fill="#ffe58d" stroke="#fff8cf"/>
      </g>
      <g fill="#fff7c3">
        <circle cx="422" cy="449" r="2.5"/>
        <circle cx="496" cy="458" r="2.8"/>
        <circle cx="438" cy="486" r="2"/>
      </g>
    </svg>
  `);
  const layer = await sharp(source)
    .ensureAlpha()
    .png({ compressionLevel: 9, palette: true, quality: 94, effort: 10 })
    .toBuffer();
  const canonicalLayer = await writeOrCheck(R2_ARENA_RING_SOURCE, layer);
  await writeOrCheck(R2_ARENA_RING_OUTPUT, canonicalLayer, 0.12, true);
}

const tempRoot = NEEDS_CHROMA_TOOL ? await mkdtemp(join(tmpdir(), 'kenshi-r2-build-')) : undefined;
try {
  await verifyPixelComparisonGuard();
  if (!ONLY_ARENA_RING) {
    if (CHECK) {
      for (const job of portraitJobs) await checkPortraitRuntime(job);
      for (const job of sourceJobs) await checkKeyedRuntime(job);
    } else {
      for (const job of portraitJobs) await buildPortrait(job, tempRoot);
      for (const job of sourceJobs) await buildKeyedJob(job, tempRoot);
      for (const [chroma, alphaPath] of atlasJobs) {
        await writeOrCheck(alphaPath, await keyChroma(chroma, tempRoot));
      }
    }
    await buildStaticSkillAssets();
  }
  await buildArenaRingLayer();
  console.log(
    ONLY_ARENA_RING
      ? `樱酱 R2 竞技戒指${COMPARE ? '复验通过' : '已重建'}：全画布母版与手腕运行层一致。`
      : SOURCE_CHECK
        ? '樱酱 R2 绿幕源复验通过：2 立绘、39 纸娃娃、2 技能图集均可重建当前透明母版与运行资产。'
        : CHECK
          ? '樱酱 R2 仓内重建通过：2 立绘、39 纸娃娃、1 竞技戒指层、24 技能运行资产；无需本机 Codex 工具。'
          : '樱酱 R2 重建完成：已统一软蒙版、去溢色、边缘净化与手机尺寸输出。',
  );
} finally {
  if (tempRoot) {
    const resolvedTemp = resolve(tempRoot);
    const resolvedRoot = resolve(tmpdir());
    if (
      !resolvedTemp.startsWith(`${resolvedRoot}\\`) &&
      !resolvedTemp.startsWith(`${resolvedRoot}/`)
    ) {
      console.error(`拒绝清理非临时目录：${resolvedTemp}`);
      process.exitCode = 1;
    } else {
      await rm(resolvedTemp, { recursive: true, force: true });
    }
  }
}
