#!/usr/bin/env node
/**
 * 复用守卫：**一套主题的穿戴母版，不许与另一套主题的成品是同一张轮廓。**
 *
 * ## ⚠ 性质：这是「内部复用未声明」，不是对外侵权
 *
 * 2026-08-03 查实：被复用的 `rose-night` **是本项目自己的资产**（@小库/@小督
 * 各自独立核过出处）。所以本守卫拦的**不是抄别人**，而是
 * **「宣称是新主题、实际是既有主题换个颜色」** —— 玩家花钱/打怪拿到的
 * 是同一套外观。**技术判据与此无关**（同一张轮廓就是同一张轮廓），
 * 但对外措辞请用「与既有主题重复、未做原创」，不要用「抄袭/侵权」。
 *
 * ## 为什么现有门禁抓不住
 *
 * `validate-ice-snow-assets.mjs` 里已有一道 alpha IoU 0.95，但它只查
 * **本主题的运行时产物**。运行时是「母版 + 代码画的 SVG 装饰」合成出来的，
 * 装饰把轮廓撑开之后 IoU 掉到 0.78 上下、武器更低到 0.57 ——
 * **离 0.95 远得很，门禁连看都不会看**。
 *
 * 2026-08-03 冰雪套事故就是这么漏过去的：门禁绿了一整晚，
 * 玩家看到的却是「绯夜的红靴子洗成灰、脚踝贴一块蓝片」。
 *
 * ## 比什么对什么（这一条错了，整个守卫就废了）
 *
 * · **左** = 待检主题的**母版** `art-source/shop/<theme>/wearable-base/<cls>-<slot>.png`
 * · **右** = **其他每一个**主题的**运行时成品**
 *   `public/assets/characters/modular/shop/<other>/<cls>-<slot>.png`
 *
 * ⚠ **被复用的是运行时成品，不是母版。** 三方哈希已证：绯夜母版与绯夜运行时
 * 本身就不同，而**冰雪母版 == 绯夜运行时**。所以拿母版对母版去比，同一批
 * 素材只能量到 0.53~0.69，守卫会给出「只剩 7 件」的假安心 ——
 * 这是本文件第一版真实犯过的错，**它在已知是复用的素材上报了通过**。
 *
 * ⚠ **右侧必须遍历所有主题**，不能只盯绯夜。这次复用的是绯夜，下次可能是月糖。
 *
 * ## ★ 两种口径都要跑，缺一漏一
 *
 * · **① 整画布逐像素**（同尺寸时）：抓「**原样复用**」。本例 18 件恰好 1.0000。
 * · **② 包围盒归一**（裁到内容再拉同尺寸）：抓「**描完还挪过位置或缩放过**」。
 *
 * 取两者较大值判定。**只留其一必漏**，这不是理论，是本文件真实的两次事故：
 * · 只用 ② → `swordsman-shoes` 等被重排的件量到 0.53~0.69，报「只剩 7 件」；
 * · 只用 ① → `swordsman-head` 整画布只有 **0.6491**，被当成「唯一原创」，
 *   而它的包围盒读数是 **0.9943** —— 它是同一张轮廓，只是被挪过位置。
 *
 * 两次都是**同一个形状**：判据里量错了量，和没有判据一样危险，
 * **而且更难发现，因为它是绿的**。
 *
 * ## 阈值 0.96 的两侧定标（@小督 / @小库 2026-08-03 各自实测）
 *
 * · **合法侧**：真正独立的主题两两同槽位，alpha IoU 上界 **0.9065~0.9325**
 *   （两人分别量到，取更保守的那个仍低于阈值）。
 * · **复用侧**：冰雪母版 vs 绯夜运行时，**18 件恰好 1.0000**，
 *   另两件 0.9715 / 0.9943。
 * · 取 **0.96**：两边各留余量。**红了不许调阈值** —— 阈值一调，
 *   下一次复用同样会溜过去。
 *
 * 用法：node scripts/validate-traced-art.mjs [--json]
 */

import sharp from 'sharp';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MASTER_ROOT = resolve(ROOT, 'art-source/shop');
const RUNTIME_ROOT = resolve(ROOT, 'public/assets/characters/modular/shop');
const ICON_ROOT = resolve(ROOT, 'public/assets/equipment/shop');

/** 判为「同一张轮廓」的 alpha IoU 阈值；两侧定标见文件头。 */
const TRACED_IOU = 0.96;

/** alpha 高于此值视为前景（沿用 @小督 的口径）。 */
const ALPHA_FLOOR = 20;

/** 比较对数低于这个值就认为扫描本身失效 —— 空扫描和全绿长得一模一样。 */
const MIN_PAIRS = 20;

function dirsIn(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root).filter((name) => statSync(resolve(root, name)).isDirectory());
}

/** `<class>-<slot>.png` → key `<class>-<slot>`。 */
function collectSlots(dir) {
  const out = new Map();
  if (!existsSync(dir)) return out;
  for (const file of readdirSync(dir)) {
    const m = file.match(/^([a-z]+)-([a-z]+)\.png$/i);
    if (m) out.set(`${m[1]}-${m[2]}`, resolve(dir, file));
  }
  return out;
}

/** 包围盒归一后的比较分辨率。 */
const NORM = 256;

const maskCache = new Map();
async function alphaMask(file) {
  if (maskCache.has(file)) return maskCache.get(file);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const mask = new Uint8Array(info.width * info.height);
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const on = data[(y * info.width + x) * info.channels + info.channels - 1] > ALPHA_FLOOR;
      mask[y * info.width + x] = on ? 1 : 0;
      if (on) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const entry = { mask, width: info.width, height: info.height, bbox: maxX < 0 ? null : { minX, minY, maxX, maxY }, file };
  maskCache.set(file, entry);
  return entry;
}

const normCache = new Map();
/** 裁到内容包围盒再拉成同尺寸：位置与缩放都被归一化，比的是形状本身。 */
async function normalizedMask(entry) {
  if (normCache.has(entry.file)) return normCache.get(entry.file);
  if (!entry.bbox) return null;
  const { minX, minY, maxX, maxY } = entry.bbox;
  const { data, info } = await sharp(entry.file)
    .ensureAlpha()
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .resize(NORM, NORM, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const mask = new Uint8Array(NORM * NORM);
  for (let i = 0, j = 0; i < data.length; i += info.channels, j += 1) {
    mask[j] = data[i + info.channels - 1] > ALPHA_FLOOR ? 1 : 0;
  }
  normCache.set(entry.file, mask);
  return mask;
}

function iou(a, b) {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] || b[i]) union += 1;
    if (a[i] && b[i]) inter += 1;
  }
  return union ? inter / union : 0;
}

/** 装备图标：`<theme>/<slot>.png`，与穿戴层不同名，单独收集。 */
function collectIcons(dir) {
  const out = new Map();
  if (!existsSync(dir)) return out;
  for (const file of readdirSync(dir)) {
    if (/\.png$/i.test(file)) out.set(file.toLowerCase(), resolve(dir, file));
  }
  return out;
}

/**
 * 图标层：`public/assets/equipment/shop/<theme>/<slot>.png` 两两比。
 *
 * 与穿戴层分开走，因为**图标这一路当初压根没有任何相似度检查**（只查了尺寸），
 * 所以 12 张全部与绯夜同轮廓 —— 换过色、原始像素哈希不同，但**裁包围盒归一后的轮廓
 * 与绯夜同名图标恰好 1.0000**。@小库 2026-08-03 13:31 实测。
 *
 * 这里两侧都是「成品对成品」，所以合法侧也会被量到，天然自带对照组。
 */
async function scanIconLayer(pairs, skipped) {
  const themes = dirsIn(ICON_ROOT);
  for (let i = 0; i < themes.length; i += 1) {
    for (let j = i + 1; j < themes.length; j += 1) {
      const a = collectIcons(resolve(ICON_ROOT, themes[i]));
      const b = collectIcons(resolve(ICON_ROOT, themes[j]));
      for (const [name, fileA] of a) {
        const fileB = b.get(name);
        if (!fileB) continue;
        const left = await alphaMask(fileA);
        const right = await alphaMask(fileB);
        const exact =
          left.width === right.width && left.height === right.height
            ? iou(left.mask, right.mask)
            : null;
        const leftNorm = await normalizedMask(left);
        const rightNorm = await normalizedMask(right);
        const placed = leftNorm && rightNorm ? iou(leftNorm, rightNorm) : null;
        if (exact === null && placed === null) {
          skipped.push({ slot: name, theme: themes[i], other: themes[j], reason: '两侧都取不到有效 alpha' });
          continue;
        }
        pairs.push({
          layer: 'icon',
          slot: name,
          theme: themes[i],
          other: themes[j],
          value: Math.max(exact ?? 0, placed ?? 0),
          exact,
          placed,
        });
      }
    }
  }
}

export async function scanTracedArt() {
  const masterThemes = dirsIn(MASTER_ROOT);
  const runtimeThemes = dirsIn(RUNTIME_ROOT);

  const pairs = [];
  const skipped = [];

  for (const theme of masterThemes) {
    const masters = collectSlots(resolve(MASTER_ROOT, theme, 'wearable-base'));
    if (masters.size === 0) continue;

    for (const other of runtimeThemes) {
      if (other === theme) continue; // 与自己的运行时比没有意义：运行时本来就由母版生成
      const runtime = collectSlots(resolve(RUNTIME_ROOT, other));
      for (const [slot, masterFile] of masters) {
        const runtimeFile = runtime.get(slot);
        if (!runtimeFile) continue;
        const left = await alphaMask(masterFile);
        const right = await alphaMask(runtimeFile);

        // ① 整画布逐像素：抓「原样复用」。同画布时才有意义。
        const exact =
          left.width === right.width && left.height === right.height
            ? iou(left.mask, right.mask)
            : null;

        // ② 包围盒归一：抓「描完还挪过位置或缩放过」。
        const leftNorm = await normalizedMask(left);
        const rightNorm = await normalizedMask(right);
        const placed = leftNorm && rightNorm ? iou(leftNorm, rightNorm) : null;

        if (exact === null && placed === null) {
          skipped.push({ slot, theme, other, reason: '两侧都取不到有效 alpha' });
          continue;
        }
        const value = Math.max(exact ?? 0, placed ?? 0);
        pairs.push({ layer: 'wearable', slot, theme, other, value, exact, placed });
      }
    }
  }

  await scanIconLayer(pairs, skipped);

  pairs.sort((x, y) => y.value - x.value);
  return { pairs, skipped, traced: pairs.filter((p) => p.value >= TRACED_IOU) };
}

async function main() {
  const { pairs, skipped, traced } = await scanTracedArt();

  if (pairs.length < MIN_PAIRS) {
    console.error(
      `[复用守卫] 只比较了 ${pairs.length} 对（低于 ${MIN_PAIRS}），扫描本身失效。\n` +
        `跳过 ${skipped.length} 对（画布尺寸不一致）。\n` +
        `空扫描和全绿长得一模一样，所以这里必须报错，而不是「没发现问题」。`,
    );
    process.exit(1);
  }

  console.log(
    `[复用守卫] 比较 ${pairs.length} 对（跳过 ${skipped.length} 对尺寸不符），阈值 ${TRACED_IOU}。`,
  );

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ threshold: TRACED_IOU, pairs, skipped }, null, 2));
  }

  if (traced.length > 0) {
    const byTheme = new Map();
    for (const p of traced) byTheme.set(p.theme, (byTheme.get(p.theme) ?? 0) + 1);
    console.error(
      `\n[复用守卫] 失败：${traced.length} 件母版与另一套主题的运行时成品轮廓重合度 >= ${TRACED_IOU}。\n` +
        [...byTheme].map(([t, n]) => `  ${t}: ${n} 件`).join('\n') +
        '\n' +
        traced
          .map((p) => {
            const how = p.exact !== null && p.exact >= TRACED_IOU ? '原样复用' : '同轮廓·挪位或缩放';
            const detail = `整画布=${p.exact === null ? '—' : p.exact.toFixed(4)} 包围盒=${p.placed === null ? '—' : p.placed.toFixed(4)}`;
            const side = p.layer === 'icon' ? '图标' : '穿戴';
            return `  [${side}] ${p.slot}: ${p.theme} ~ ${p.other} = ${p.value.toFixed(4)}  [${how}]  ${detail}`;
          })
          .join('\n') +
        `\n\n这不是「画得像」，是同一张轮廓 —— 等于新主题并不新。修法是**重画该主题的母版**，` +
        `不是调高阈值 —— 阈值一调，下一次复用同样会溜过去。`,
    );
    process.exit(1);
  }

  console.log('[复用守卫] 通过：没有任何一套主题的母版与别套成品同轮廓。');
}

if (process.argv[1]?.endsWith('validate-traced-art.mjs')) {
  main().catch((error) => {
    console.error('[复用守卫] 运行失败：', error);
    process.exit(1);
  });
}
