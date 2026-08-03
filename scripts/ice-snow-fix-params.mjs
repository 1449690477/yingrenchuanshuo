/**
 * 冰雪 v2 服装 BUG 修复共享参数（2026-08-03，小灯主刀）
 *
 * 单一事实源：build-ice-snow-assets.mjs 与 validate-ice-snow-assets.mjs 共用，
 * 参数来源：
 *   - FACE_ELLIPSE：src/components/CharacterAppearance.vue 职业 --face-* 百分比
 *   - CUT_LINES：小Q·音效 22:05 坐标表（莓霜 body 顶边外扩 24px）
 *   - HEAD_CLEAR_Y / KENSHI_PASTE_Y：小灯 22:13 第二轮参数（视觉位定标中）
 */
import { resolve } from 'node:path';
import sharp from 'sharp';

/** 职业脸层椭圆（640x960 画布，百分比 -> 像素） */
export const FACE_ELLIPSE = {
  swordsman: { cx: 0.52 * 640, cy: 0.10 * 960, rx: 0.19 * 640, ry: 0.09 * 960 },
  witch: { cx: 0.50 * 640, cy: 0.10 * 960, rx: 0.18 * 640, ry: 0.088 * 960 },
  shaman: { cx: 0.50 * 640, cy: 0.10 * 960, rx: 0.17 * 640, ry: 0.088 * 960 },
  catkin: { cx: 0.50 * 640, cy: 0.097 * 960, rx: 0.185 * 640, ry: 0.093 * 960 },
  kenshi: { cx: 0.50 * 640, cy: 0.097 * 960, rx: 0.185 * 640, ry: 0.093 * 960 },
};

/** 老四职业 body 切头线（y < 该值整行透明） */
export const CUT_LINES = { swordsman: 116, witch: 114, shaman: 121, catkin: 114 };

/** C2 头区净空：y < 该值且 base 剪影有像素处透明（kenshi 贴头同深度） */
export const HEAD_CLEAR_Y = 190;

/** 老四职业头区切分模式：C1=cutB 全宽切头线；C2=头区净空到颈线（视觉位定标中） */
export const HEAD_CUT_MODE = 'C2';

/** kenshi 贴头深度（视觉位定标：190 或 280） */
export const KENSHI_PASTE_Y = 190;

/** 脸椭圆内像素判定（含 2px 边距容差） */
export function inFaceEllipse(x, y, classId, pad = 2) {
  const f = FACE_ELLIPSE[classId];
  const rx = f.rx + pad;
  const ry = f.ry + pad;
  return ((x + 0.5 - f.cx) ** 2) / (rx * rx) + ((y + 0.5 - f.cy) ** 2) / (ry * ry) <= 1;
}

export async function rawRgba(path) {
  return sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

export async function bboxOf(raw) {
  const { data, info } = raw;
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] > 18) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return { x0, y0, x1, y1 };
}

export async function translate(buffer, dx, dy) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  const copyPx = (sx, sy, ox, oy) => {
    if (ox < 0 || ox >= info.width || oy < 0 || oy >= info.height) return;
    if (sx < 0 || sx >= info.width || sy < 0 || sy >= info.height) return;
    const s = (sy * info.width + sx) * 4;
    const d = (oy * info.width + ox) * 4;
    out[d] = data[s];
    out[d + 1] = data[s + 1];
    out[d + 2] = data[s + 2];
    out[d + 3] = data[s + 3];
  };
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      copyPx(x, y, x + dx, y + dy);
    }
  }
  return sharp(out, { raw: info }).png().toBuffer();
}

/**
 * 鞋层锚点校正量：底边对齐参照（swordsman 走 base 脚底档，其余走 v1 rose-night 底边档），
 * 水平中心对齐 v1 rose-night。build 与 validate 共用同一算法，保证口径一致。
 */
export async function computeShoeShift(classId, root) {
  const baseRaw = await rawRgba(resolve(root, `public/assets/characters/modular/${classId}/base-noshoes.png`));
  const roseRaw = await rawRgba(resolve(root, `public/assets/characters/modular/shop/rose-night/${classId}-shoes.png`));
  // 从 raw 母版量 v2 鞋层（build 产物由母版忠实落位，源文件永不被改写，保证可重复构建）
  const v2Raw = await rawRgba(resolve(root, `art-source/shop/ice-snow/wearable-base/${classId}-shoes.png`));
  const baseBBox = await bboxOf(baseRaw);
  const roseBBox = await bboxOf(roseRaw);
  const v2BBox = await bboxOf(v2Raw);
  const targetBottom = classId === 'swordsman' ? baseBBox.y1 : roseBBox.y1;
  const dx = Math.round((roseBBox.x0 + roseBBox.x1) / 2 - (v2BBox.x0 + v2BBox.x1) / 2);
  const dy = targetBottom - v2BBox.y1;
  return { dx, dy, baseBottom: baseBBox.y1, roseBottom: roseBBox.y1, v2Bottom: v2BBox.y1 };
}

/**
 * 老四职业左右立绘边条：参照莓霜 body bbox ±24px 之外的区域视为画布填充（小Q·音效坐标表三口径）。
 * build 对 body 槽清空该区域；validate 的母版保真比对需同样豁免。
 */
export async function computeSideClip(classId, root) {
  const berryRaw = await rawRgba(
    resolve(root, `public/assets/characters/modular/shop/berry-cream/${classId}-body.png`),
  );
  const b = await bboxOf(berryRaw);
  return {
    leftX: Math.max(0, b.x0 - 24),
    rightX: Math.min(639, b.x1 + 24),
  };
}

/**
 * 妖灵(shaman) 武器对齐：v2 母版扇子横展遮脸，确定性一步=等比缩放到 rose-night 扇带
 * 并居中落位（小Q5 22:29 终审口径）。其余职业返回 null（武器不动，刀正常）。
 */
export async function computeWeaponAlign(classId, root) {
  if (classId !== 'shaman') return null;
  const srcRaw = await rawRgba(
    resolve(root, `art-source/shop/ice-snow/wearable-base/shaman-weapon.png`),
  );
  const roseRaw = await rawRgba(
    resolve(root, `public/assets/characters/modular/shop/rose-night/shaman-weapon.png`),
  );
  const srcBBox = await bboxOf(srcRaw);
  const tgtBBox = await bboxOf(roseRaw);
  const srcW = srcBBox.x1 - srcBBox.x0 + 1;
  const srcH = srcBBox.y1 - srcBBox.y0 + 1;
  const tgtW = tgtBBox.x1 - tgtBBox.x0 + 1;
  const tgtH = tgtBBox.y1 - tgtBBox.y0 + 1;
  const scale = Math.min(tgtW / srcW, tgtH / srcH);
  const newW = Math.max(1, Math.round(srcW * scale));
  const newH = Math.max(1, Math.round(srcH * scale));
  const left = Math.round((tgtBBox.x0 + tgtBBox.x1) / 2 - newW / 2);
  const top = Math.round((tgtBBox.y0 + tgtBBox.y1) / 2 - newH / 2);
  return { scale, newW, newH, left, top };
}
