import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const CLASS_IDS = ['swordsman', 'witch', 'shaman', 'catkin', 'kenshi'];
const APPEARANCE_IDS = [
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
const MAX_ICON_BYTES = 82 * 1024;

for (const appearanceId of APPEARANCE_IDS) {
  for (const classId of CLASS_IDS) {
    const relative = `assets/equipment/weapons/${appearanceId}/${classId}.png`;
    const path = resolve('public', relative);
    const metadata = await sharp(path).metadata();
    if (metadata.width !== 256 || metadata.height !== 256 || metadata.channels !== 4) {
      throw new Error(
        `${relative} 规格错误：${metadata.width}×${metadata.height}×${metadata.channels}`,
      );
    }
    const { data, info } = await sharp(path)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const cornerAlpha = [
      data[3],
      data[(info.width - 1) * info.channels + 3],
      data[(info.height - 1) * info.width * info.channels + 3],
      data[(info.height * info.width - 1) * info.channels + 3],
    ];
    if (cornerAlpha.some((alpha) => alpha !== 0)) {
      throw new Error(`${relative} 四角必须透明`);
    }
    const opaquePixels = data.reduce(
      (count, _value, index) =>
        index % info.channels === 3 && data[index] > 20 ? count + 1 : count,
      0,
    );
    if (opaquePixels < 1_200) {
      throw new Error(`${relative} 有效武器像素过少：${opaquePixels}`);
    }
    const size = (await stat(path)).size;
    if (size >= MAX_ICON_BYTES) {
      throw new Error(`${relative} 体积 ${size} B 超过 ${MAX_ICON_BYTES} B`);
    }
  }
}

console.log(
  `✓ 职业武器图标 ${APPEARANCE_IDS.length * CLASS_IDS.length} / ${
    APPEARANCE_IDS.length * CLASS_IDS.length
  } 通过尺寸、透明边缘、有效像素和体积门禁`,
);
