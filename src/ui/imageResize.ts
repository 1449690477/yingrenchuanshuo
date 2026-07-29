/**
 * 头像上传前的客户端预压（docs/51 附录 A · 防护第 3 层）。
 *
 * 为什么必须在客户端压：
 * 桶上虽然写了 200KB 上限，但那是**拒绝**，不是**压缩** ——
 * 玩家随手选一张 6MB 的手机照片会直接被拒，体验是「传不上去」而不是
 * 「帮你压好了」。这一层把任何输入都收敛成 512×512 以内的 webp，
 * 让上传永远成功，也顺带把服务端存储成本压到最低。
 *
 * 本文件用到 canvas，**只能在浏览器里跑**，所以不放 `src/core/`——
 * core 要被 Edge Function 在 Deno 里 import，必须保持环境无关。
 */

/** 头像最长边（像素）。榜单头像显示不超过 96px，512 足够二倍图还有余量。 */
export const AVATAR_MAX_EDGE = 512;

/** 与 Storage 桶上的 file_size_limit 保持一致，超过就再降一档质量。 */
export const AVATAR_MAX_BYTES = 200 * 1024;

/** 桶只收这三种；其余格式（gif/bmp/heic…）一律先拦在客户端给出人话提示。 */
export const AVATAR_ACCEPT = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * 等比缩放到边长上限内。纯函数，可单测。
 *
 * 小图**不放大** —— 放大只会糊，还平白增加体积。
 */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`fitWithin: 尺寸必须是正数，收到 ${width}×${height}`);
  }
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width: Math.round(width), height: Math.round(height) };
  const scale = maxEdge / longest;
  return {
    // 至少留 1px，避免极端长条图算出 0
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** 逐档下探的 webp 质量。第一档就够用时不会继续压。 */
const QUALITY_STEPS = [0.85, 0.7, 0.55, 0.4] as const;

export interface CompressedAvatar {
  blob: Blob;
  width: number;
  height: number;
  /** 实际采用的质量档，便于出问题时定位 */
  quality: number;
}

/**
 * 把用户选的图压成可上传的头像。
 *
 * @throws Error 格式不支持、图片损坏，或压到最低质量仍超限
 */
export async function compressAvatar(file: File): Promise<CompressedAvatar> {
  if (!(AVATAR_ACCEPT as readonly string[]).includes(file.type)) {
    throw new Error('只支持 JPG、PNG 和 WebP 格式的图片');
  }

  const bitmap = await loadBitmap(file);
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, AVATAR_MAX_EDGE);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('当前浏览器不支持图片处理，请换个浏览器再试');
    // 缩图时开高质量插值，否则头像边缘会有锯齿
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);

    for (const quality of QUALITY_STEPS) {
      const blob = await canvasToBlob(canvas, quality);
      if (blob.size <= AVATAR_MAX_BYTES) return { blob, width, height, quality };
    }
    // 512×512 的 webp 压到 0.4 还超 200KB 实际上不可能，
    // 真发生了说明输入异常，宁可报错也不要传一个会被桶拒的文件
    throw new Error('这张图压缩后仍然过大，换一张试试');
  } finally {
    bitmap.close?.();
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    throw new Error('这张图片无法读取，可能已损坏');
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('图片处理失败，请重试'))),
      'image/webp',
      quality,
    );
  });
}
