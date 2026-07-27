import { mkdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const sourceRoot = resolve('art-source/effects/catkin');
const effectRoot = resolve('public/assets/effects');
const iconRoot = resolve('public/assets/icons/skills');

const activeSkills = [
  ['paw-combo', 'catkin-paw-combo'],
  ['light-pounce', 'catkin-light-pounce'],
  ['scratch-frenzy', 'catkin-scratch-frenzy'],
  ['bristle-counter', 'catkin-bristle-counter'],
  ['tail-sweep', 'catkin-tail-sweep'],
  ['box-ambush', 'catkin-box-ambush'],
  ['nine-life-spin', 'catkin-nine-life-spin'],
  ['moonshadow-step', 'catkin-moonshadow-step'],
  ['furball-storm', 'catkin-furball-storm'],
  ['hundred-claw', 'catkin-hundred-claw'],
];

const passiveSkills = [
  ['catkin-keen-whiskers', 0, 0],
  ['catkin-nimble-step', 1, 0],
  ['catkin-claw-mark', 0, 1],
  ['catkin-hunting-instinct', 1, 1],
];

const boutiqueThemes = ['berry-cream', 'moon-sugar', 'rose-night'];

async function inspectTransparentAsset(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const cornerOffsets = [
    0,
    (info.width - 1) * 4,
    (info.height - 1) * info.width * 4,
    (info.height * info.width - 1) * 4,
  ];
  if (cornerOffsets.some((offset) => data[offset + 3] !== 0)) {
    throw new Error(`${file} 四角必须完全透明`);
  }

  let visiblePixels = 0;
  let chromaPixels = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const alpha = data[offset + 3];
    if (alpha > 8) visiblePixels++;
    // 樱金描边在调色板压缩后可能呈黄绿色，需按“荧光绿显著占优”的比例识别绿幕，
    // 不能用简单通道差值误杀正常金色边缘。
    if (alpha > 8 && green > 120 && green > red * 1.35 && green > blue * 1.35) {
      chromaPixels++;
    }
  }
  if (visiblePixels === 0) throw new Error(`${file} 没有可见主体`);
  if (chromaPixels > 0) throw new Error(`${file} 仍有 ${chromaPixels} 个绿幕污染像素`);
}

async function transparentCanvas(width, height) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });
}

async function writeEffect(source, output) {
  await sharp(source)
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9, palette: true, colours: 192, quality: 92 })
    .toFile(output);
}

async function writeIconFromBuffer(sourceBuffer, output) {
  const icon = await sharp(sourceBuffer)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(220, 220, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9, palette: true, colours: 160, quality: 92 })
    .toBuffer();

  await (await transparentCanvas(256, 256))
    .composite([{ input: icon, left: 18, top: 18 }])
    .png({ compressionLevel: 9, palette: true, colours: 160, quality: 92 })
    .toFile(output);
}

await Promise.all([
  mkdir(effectRoot, { recursive: true }),
  mkdir(iconRoot, { recursive: true }),
  mkdir(resolve(effectRoot, 'basic'), { recursive: true }),
  mkdir(resolve(effectRoot, 'boutique'), { recursive: true }),
]);

for (const [sourceName, assetName] of activeSkills) {
  const source = resolve(sourceRoot, `${sourceName}-alpha.png`);
  await Promise.all([
    writeEffect(source, resolve(effectRoot, `${assetName}.png`)),
    sharp(source)
      .png()
      .toBuffer()
      .then((buffer) => writeIconFromBuffer(buffer, resolve(iconRoot, `${assetName}.png`))),
  ]);
}

await writeEffect(
  resolve(sourceRoot, 'basic-attack-alpha.png'),
  resolve(effectRoot, 'basic/catkin-paw.png'),
);

const passiveSheet = resolve(sourceRoot, 'passive-icons-alpha.png');
const passiveMetadata = await sharp(passiveSheet).metadata();
const sheetWidth = passiveMetadata.width ?? 1254;
const sheetHeight = passiveMetadata.height ?? 1254;
const halfWidth = Math.floor(sheetWidth / 2);
const halfHeight = Math.floor(sheetHeight / 2);

for (const [assetName, column, row] of passiveSkills) {
  const left = column === 0 ? 0 : halfWidth;
  const top = row === 0 ? 0 : halfHeight;
  const width = column === 0 ? halfWidth : sheetWidth - halfWidth;
  const height = row === 0 ? halfHeight : sheetHeight - halfHeight;
  const quadrant = await sharp(passiveSheet)
    .extract({ left, top, width, height })
    .png()
    .toBuffer();
  await writeIconFromBuffer(quadrant, resolve(iconRoot, `${assetName}.png`));
}

for (const theme of boutiqueThemes) {
  await writeEffect(
    resolve(`art-source/shop/${theme}/catkin-effect-alpha.png`),
    resolve(effectRoot, `boutique/${theme}-catkin.png`),
  );
}

const generatedFiles = [
  ...activeSkills.flatMap(([, assetName]) => [
    resolve(effectRoot, `${assetName}.png`),
    resolve(iconRoot, `${assetName}.png`),
  ]),
  ...passiveSkills.map(([assetName]) => resolve(iconRoot, `${assetName}.png`)),
  resolve(effectRoot, 'basic/catkin-paw.png'),
  ...boutiqueThemes.map((theme) => resolve(effectRoot, `boutique/${theme}-catkin.png`)),
];

for (const file of generatedFiles) {
  const info = await stat(file);
  const metadata = await sharp(file).metadata();
  const isIcon = file.includes(resolve('public/assets/icons'));
  const expectedSize = isIcon ? 256 : 512;
  const maxBytes = isIcon ? 120 * 1024 : 250 * 1024;

  if (metadata.width !== expectedSize || metadata.height !== expectedSize) {
    throw new Error(`${file} 尺寸错误：${metadata.width}x${metadata.height}`);
  }
  if (metadata.channels !== 4) {
    throw new Error(`${file} 必须保留 RGBA 透明通道`);
  }
  if (info.size > maxBytes) {
    throw new Error(`${file} 体积 ${info.size} 超过预算 ${maxBytes}`);
  }
  await inspectTransparentAsset(file);
}

console.log(`喵喵技能资产已生成并通过规格检查：${generatedFiles.length} 个文件`);
