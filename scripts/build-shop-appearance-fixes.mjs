import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const CHECK_ONLY = process.argv.includes('--check');
const CANVAS = { width: 640, height: 960 };

const repairs = [
  {
    kind: 'head-resize',
    label: '绯樱星愿·剑士礼帽',
    source: resolve('art-source/shop/rose-night/swordsman-head-alpha.png'),
    output: resolve('public/assets/characters/modular/shop/rose-night/swordsman-head.png'),
    width: 130,
    left: 258,
    top: 0,
  },
  {
    kind: 'replacement-full',
    label: '纸箱猫整身换装（保留专属靴）',
    source: resolve('art-source/shop/cardboard-cat/catkin-body-alpha.png'),
    output: resolve('public/assets/characters/modular/shop/cardboard-cat/catkin-body.png'),
  },
];

/**
 * 整身换装层沿用该资产原生成器（build-catkin-cardboard-assets.mjs）的调色板编码。
 *
 * 不是为了「压得更小好看」，是移动端硬上限 305000 字节的要求：
 * 640×960 全身图在**真无损**下实测 420264 字节，压不到上限以下
 * （compressionLevel 9 只比默认省 2673 字节）；调色板 q92 为 102284 字节，
 * 与该文件历来的体积（103481）同量级。**这个资产一直是调色板编码的。**
 */
const REPLACEMENT_PNG = { compressionLevel: 9, palette: true, quality: 92 };

async function rebuild(entry) {
  if (entry.kind === 'replacement-full') {
    return sharp(entry.source)
      .ensureAlpha()
      .resize(CANVAS.width, CANVAS.height, { fit: 'fill' })
      .png(REPLACEMENT_PNG)
      .toBuffer();
  }

  const trimmed = await sharp(entry.source)
    .ensureAlpha()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ width: entry.width, withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();

  return sharp({
    create: {
      ...CANVAS,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: trimmed, left: entry.left, top: entry.top }])
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
}

for (const entry of repairs) {
  const rebuilt = await rebuild(entry);
  if (CHECK_ONLY) {
    const [currentPixels, rebuiltPixels] = await Promise.all([
      sharp(entry.output).ensureAlpha().raw().toBuffer(),
      sharp(rebuilt).ensureAlpha().raw().toBuffer(),
    ]);
    if (!currentPixels.equals(rebuiltPixels)) {
      throw new Error(`[商城外观重建] ${entry.label} 与确定性重建结果不一致`);
    }
    continue;
  }

  await mkdir(resolve(entry.output, '..'), { recursive: true });
  // 直接落 rebuild() 编好的字节。**不要走 sharp(rebuilt).toFile()** ——
  // 那会用 sharp 的默认 PNG 参数重新编码，把上面精心选的编码整个丢掉：
  // 纸箱猫整身层因此从 ~102KB 变成 422937 字节，撞穿移动端 305000 上限。
  await writeFile(entry.output, rebuilt);
  console.log(
    entry.kind === 'replacement-full'
      ? `✓ ${entry.label}：640×960 完整工装，解析时抑制外部鞋层`
      : `✓ ${entry.label}：${entry.width}px 宽，锚点 (${entry.left}, ${entry.top})`,
  );
}

if (CHECK_ONLY) console.log(`✓ ${repairs.length} 项商城外观修复均可确定性重建`);
