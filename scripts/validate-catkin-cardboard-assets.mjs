import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const specs = [
  {
    file: 'public/assets/characters/modular/shop/cardboard-cat/catkin-body.png',
    width: 640,
    height: 960,
    maxBytes: 550 * 1024,
  },
  {
    file: 'public/assets/characters/modular/shop/cardboard-cat/catkin-weapon.png',
    width: 640,
    height: 960,
    maxBytes: 300 * 1024,
  },
  {
    file: 'public/assets/equipment/shop/cardboard-cat/body-catkin.png',
    width: 256,
    height: 256,
    maxBytes: 120 * 1024,
  },
  {
    file: 'public/assets/equipment/shop/cardboard-cat/weapon-catkin.png',
    width: 256,
    height: 256,
    maxBytes: 120 * 1024,
  },
  {
    file: 'public/assets/effects/boutique/cardboard-cat-catkin.png',
    width: 512,
    height: 512,
    maxBytes: 250 * 1024,
  },
];

async function validate({ file, width, height, maxBytes }) {
  const absolute = resolve(file);
  const [{ data, info }, metadata, fileInfo] = await Promise.all([
    sharp(absolute).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(absolute).metadata(),
    stat(absolute),
  ]);
  if (metadata.width !== width || metadata.height !== height || metadata.channels !== 4) {
    throw new Error(
      `${file} 规格错误：${metadata.width}×${metadata.height} channels=${metadata.channels}`,
    );
  }
  if (fileInfo.size > maxBytes) {
    throw new Error(`${file} 体积 ${fileInfo.size} 超过 ${maxBytes}`);
  }
  const corners = [
    3,
    (info.width - 1) * info.channels + 3,
    (info.height - 1) * info.width * info.channels + 3,
    (info.height * info.width - 1) * info.channels + 3,
  ];
  if (corners.some((offset) => data[offset] !== 0)) {
    throw new Error(`${file} 四角必须完全透明`);
  }

  let visible = 0;
  let chroma = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const alpha = data[offset + 3];
    if (alpha > 8) visible++;
    if (alpha > 0 && green > 120 && green > red * 1.35 && green > blue * 1.35) {
      chroma++;
    }
  }
  if (visible < width * height * 0.005) throw new Error(`${file} 可见主体过少`);
  if (chroma > 0) throw new Error(`${file} 有 ${chroma} 个绿幕污染像素`);
}

for (const spec of specs) await validate(spec);

const motionQaFile = 'art-source/qa/catkin-motion-extremes.png';
const [motionQa, motionQaStat] = await Promise.all([
  sharp(resolve(motionQaFile)).metadata(),
  stat(resolve(motionQaFile)),
]);
if (motionQa.width !== 1080 || motionQa.height !== 720) {
  throw new Error(`${motionQaFile} 规格错误：${motionQa.width}×${motionQa.height}`);
}
if (motionQaStat.size > 900 * 1024) {
  throw new Error(`${motionQaFile} 体积 ${motionQaStat.size} 超过 ${900 * 1024}`);
}

console.log(`纸箱键帽摸鱼套资产审计通过：${specs.length} 个运行时文件 + 九动作 QA`);
