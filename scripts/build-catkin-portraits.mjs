import { mkdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const jobs = [
  ['anchor-alpha.png', 'catkin-sakura.png'],
  ['cast-alpha.png', 'catkin-sakura-cast.png'],
];

const sourceRoot = resolve('art-source/characters/catkin');
const outputRoot = resolve('public/assets/characters');
await mkdir(outputRoot, { recursive: true });

for (const [sourceName, outputName] of jobs) {
  const output = resolve(outputRoot, outputName);
  await sharp(resolve(sourceRoot, sourceName))
    .resize(640, 960, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9, palette: true, colours: 224, quality: 94 })
    .toFile(output);

  const [metadata, fileInfo, raw] = await Promise.all([
    sharp(output).metadata(),
    stat(output),
    sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (metadata.width !== 640 || metadata.height !== 960 || metadata.channels !== 4) {
    throw new Error(`${output} 必须是 640×960 RGBA`);
  }
  if (fileInfo.size > 550 * 1024) {
    throw new Error(`${output} 体积 ${fileInfo.size} 超过 550 KiB`);
  }

  const { data, info } = raw;
  const cornerOffsets = [
    0,
    (info.width - 1) * 4,
    (info.height - 1) * info.width * 4,
    (info.height * info.width - 1) * 4,
  ];
  if (cornerOffsets.some((offset) => data[offset + 3] !== 0)) {
    throw new Error(`${output} 四角必须完全透明`);
  }

  let visiblePixels = 0;
  let chromaPixels = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const alpha = data[offset + 3];
    if (alpha > 8) visiblePixels++;
    if (alpha > 8 && green > 120 && green > red * 1.35 && green > blue * 1.35) {
      chromaPixels++;
    }
  }
  if (visiblePixels === 0) throw new Error(`${output} 没有可见主体`);
  if (chromaPixels > 0) throw new Error(`${output} 仍有 ${chromaPixels} 个绿幕污染像素`);
}

console.log(`喵喵角色立绘已生成并通过规格检查：${jobs.length} 个文件`);
