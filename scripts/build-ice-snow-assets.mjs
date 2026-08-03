/**
 * 「冰雪华年」精品套可复现资产构建器。
 *
 * v2（2026-08-03，复核：小Q）：母版是全新生成的最终稿
 * （docs/art/ice-snow-v2/SOURCE-MAPPING.csv 逐件可溯源），构建=忠实落位，
 * 不再换色、不再叠加模板时代的装饰 SVG——那套管线属于 v1「绯夜模板改造」
 * 工作流，已随母版换代整体退役（见 git 历史）。仍保留的确定性加工：
 * 帽层顶部 180px 纵向收至 100px（实穿校准）、樱酱 body 鞋区回填 base-noshoes
 * （无内置鞋合同）、图标可读性描边、超预算时的出口降级压缩。
 * 五职业攻击特效仍从独立绿幕原画抠图，禁止从任何旧套装调色复用。
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const TARGET_THEME = 'ice-snow';
const CLASSES = ['swordsman', 'witch', 'shaman', 'catkin', 'kenshi'];
const WEARABLE_SLOTS = ['body', 'head', 'shoes', 'weapon'];
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

// 冰雪的锚点母版随任务归档，禁止读取仍会被其它主题修订的运行时 rose-night。
const sourceWearableRoot = resolve(ROOT, 'art-source/shop/ice-snow/wearable-base');
const targetWearableRoot = resolve(ROOT, 'public/assets/characters/modular/shop', TARGET_THEME);
const sourceIconRoot = resolve(ROOT, 'art-source/shop/ice-snow/icon-base');
const targetIconRoot = resolve(ROOT, 'public/assets/equipment/shop', TARGET_THEME);
const sourceEffectChromaRoot = resolve(ROOT, 'art-source/shop/ice-snow/effect-chroma');
const sourceEffectRoot = resolve(ROOT, 'art-source/shop/ice-snow/effect-base');
const effectRoot = resolve(ROOT, 'public/assets/effects/boutique');
const sceneSource = resolve(ROOT, 'art-source/shop/ice-snow/shelf-source.png');
const sceneOutput = resolve(ROOT, 'public/assets/shops/ice-snow-shelf.webp');
const kenshiBodyIconOutput = resolve(
  ROOT,
  'public/assets/equipment/bodies/boutique-ice-snow-body/kenshi.png',
);

/**
 * 将 ImageGen 的纯绿背景还原为软 Alpha，同时清除半透明边缘的绿色溢色。
 * 这里读取任务内 effect-chroma 原画，而不是读取任何旧主题运行时特效。
 */
async function removeGreenChroma(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const smoothstep = (value) => {
    const clamped = Math.max(0, Math.min(1, value));
    return clamped * clamped * (3 - 2 * clamped);
  };

  for (let offset = 0; offset < data.length; offset += 4) {
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const sourceAlpha = data[offset + 3];
    const nonGreen = Math.max(r, b);
    const dominance = g - nonGreen;
    const keyDistance = Math.max(r, Math.abs(255 - g), b);
    let matte = 255;

    if (keyDistance <= 24) {
      matte = 0;
    } else if (g > 105 && dominance > 18) {
      const distanceAlpha = Math.round(255 * smoothstep((keyDistance - 20) / 105));
      const dominanceAlpha = Math.round(
        255 * (1 - Math.min(1, dominance / Math.max(1, 255 - nonGreen))),
      );
      matte = Math.min(distanceAlpha, dominanceAlpha);
    }

    const alpha = Math.round((sourceAlpha * matte) / 255);
    data[offset + 3] = alpha <= 6 ? 0 : alpha;
    if (data[offset + 3] === 0) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
    } else if (g > 105 && dominance > 18) {
      data[offset + 1] = Math.min(g, Math.max(0, nonGreen - 1));
    }
  }

  return sharp(data, { raw: info }).png().toBuffer();
}

/**
 * 商店卡片是近白玻璃底，单纯把绯夜图标换成象牙白会让武器主体消失。
 * 先保留冰雪白，再整体压一档亮度，并用原 alpha 膨胀出 3px 霁蓝银灰描边；
 * 这是图标自己的可读性合同，不依赖某一张 UI 背景兜底。
 */
async function addIconContrast(base, { strongIceCore = false } = {}) {
  let adjusted = await sharp(base)
    .modulate({ brightness: strongIceCore ? 0.82 : 0.88, saturation: 1.12 })
    .png()
    .toBuffer();
  if (strongIceCore) {
    const rgba = await sharp(adjusted).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let offset = 0; offset < rgba.data.length; offset += rgba.info.channels) {
      if (rgba.data[offset + 3] <= 4) continue;
      const luminance = (
        0.2126 * rgba.data[offset] +
        0.7152 * rgba.data[offset + 1] +
        0.0722 * rgba.data[offset + 2]
      ) / 255;
      const shade = luminance ** 1.8;
      rgba.data[offset] = Math.round(60 + 150 * shade);
      rgba.data[offset + 1] = Math.round(96 + 136 * shade);
      rgba.data[offset + 2] = Math.round(145 + 105 * shade);
    }
    adjusted = await sharp(rgba.data, { raw: rgba.info }).png().toBuffer();
  }
  const { data: outlineAlpha, info } = await sharp(adjusted)
    .ensureAlpha()
    .extractChannel('alpha')
    .dilate(3)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let pixel = 0; pixel < outlineAlpha.length; pixel += 1) {
    const offset = pixel * 4;
    rgba[offset] = 73;
    rgba[offset + 1] = 126;
    rgba[offset + 2] = 166;
    rgba[offset + 3] = Math.min(210, Math.round(outlineAlpha[pixel] * 0.84));
  }
  return sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .composite([{ input: adjusted, blend: 'over' }])
    .png()
    .toBuffer();
}

async function alignWearable(base, slot) {
  if (slot !== 'head') return base;
  return sharp(base)
    .extract({ left: 0, top: 0, width: 640, height: 180 })
    .resize({ width: 640, height: 100, fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .extend({
      top: 0,
      right: 0,
      bottom: 860,
      left: 0,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

// 预算取自最严的消费方并留余量：content.spec 要求商品图标 <82KB、
// 穿戴层 <305KB（资产门禁的 125KB/340KB 是更宽的上界）。
const WEARABLE_SIZE_BUDGET = 300_000;
const ICON_SIZE_BUDGET = 80_000;

async function writePng(buffer, output, budget = WEARABLE_SIZE_BUDGET) {
  await mkdir(dirname(output), { recursive: true });
  // 真彩优先：雪绒、薄纱和冰晶轮廓依赖连续的半透明抗锯齿。v2 全新母版
  // 体量远超 v1 换色件（最大 866KB），超预算时逐级降到 RGBA 调色板；
  // 降级引入的量化噪声由门禁的保真容差指标封顶（validate-ice-snow-assets.mjs）。
  let encoded = await sharp(buffer)
    .png({ compressionLevel: 9, palette: false, effort: 10 })
    .toBuffer();
  for (const colours of [256, 192, 128]) {
    if (encoded.length <= budget) break;
    encoded = await sharp(buffer)
      .png({ compressionLevel: 9, palette: true, colours, dither: 1.0, effort: 10 })
      .toBuffer();
  }
  await writeFile(output, encoded);
}

/**
 * 老四职业的衣裙层在独立鞋层的落点上让位（Alpha 置零）。
 * 运行时 z 序是 body < shoes（characterAppearance 的 slotOrder），靴子画在
 * 裙摆之上；v2 长裙如原样落位，靴口会穿透裙面。与 v1 同一契约：
 * 「长裙可以下垂，但不得与同主题独立鞋层逐像素重叠」（shopAppearanceVisual.spec）。
 * 樱酱不走这里——她的 body 是整身 replacement，由 removeKenshiEmbeddedShoes
 * 按无内置鞋合同回填 base-noshoes。
 */
async function yieldBodyToShoes(bodyBuffer, classId) {
  const shoesPath = resolve(sourceWearableRoot, `${classId}-shoes.png`);
  const [body, shoesAlpha] = await Promise.all([
    sharp(bodyBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(shoesPath).ensureAlpha().extractChannel('alpha').raw().toBuffer(),
  ]);
  for (let pixel = 0; pixel < shoesAlpha.length; pixel += 1) {
    if (shoesAlpha[pixel] <= 20) continue;
    const offset = pixel * 4;
    body.data[offset] = 0;
    body.data[offset + 1] = 0;
    body.data[offset + 2] = 0;
    body.data[offset + 3] = 0;
  }
  return sharp(body.data, { raw: body.info }).png().toBuffer();
}

async function removeKenshiEmbeddedShoes() {
  const bodyPath = resolve(targetWearableRoot, 'kenshi-body.png');
  const shoesPath = resolve(targetWearableRoot, 'kenshi-shoes.png');
  const baseNoShoesPath = resolve(ROOT, 'public/assets/characters/modular/kenshi/base-noshoes.png');
  const [body, shoes, baseNoShoes] = await Promise.all([
    sharp(bodyPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(shoesPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(baseNoShoesPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  const dimensions = [body, shoes, baseNoShoes].map(({ info }) =>
    `${info.width}x${info.height}x${info.channels}`,
  );
  if (new Set(dimensions).size !== 1) {
    throw new Error(`樱酱无鞋合同尺寸不一致：${dimensions.join(' / ')}`);
  }
  for (let offset = 0; offset < shoes.data.length; offset += shoes.info.channels) {
    if (shoes.data[offset + 3] <= 20) continue;
    for (let channel = 0; channel < 4; channel += 1) {
      body.data[offset + channel] = baseNoShoes.data[offset + channel];
    }
  }
  const composited = await sharp(body.data, { raw: body.info }).png().toBuffer();
  await writePng(composited, bodyPath);
}

for (const classId of CLASSES) {
  for (const slot of WEARABLE_SLOTS) {
    const input = resolve(sourceWearableRoot, `${classId}-${slot}.png`);
    const output = resolve(targetWearableRoot, `${classId}-${slot}.png`);
    let base = await sharp(input).ensureAlpha().png().toBuffer();
    if (slot === 'body' && classId !== 'kenshi') {
      base = await yieldBodyToShoes(base, classId);
    }
    await writePng(await alignWearable(base, slot), output);
  }

  const effectChromaInput = resolve(sourceEffectChromaRoot, `${classId}.png`);
  const effectBaseOutput = resolve(sourceEffectRoot, `${classId}.png`);
  const effectOutput = resolve(effectRoot, `${TARGET_THEME}-${classId}.png`);
  const keyedEffect = await removeGreenChroma(effectChromaInput);
  const resizedEffect = await sharp(keyedEffect)
    .resize({ width: 512, height: 512, fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  // Lanczos 会从完全透明像素的隐藏 RGB 取样；缩放后再清一次，避免绿边重新渗回。
  const effect = await removeGreenChroma(resizedEffect);
  await writePng(effect, effectBaseOutput);
  await mkdir(dirname(effectOutput), { recursive: true });
  await sharp(effect)
    // 战斗光效不承担纸娃娃逐像素锚点；256 色 RGBA 调色板保留透明渐变，
    // 同时把 512px 资源压进全仓 185KB 移动端硬上限。
    .png({ compressionLevel: 9, palette: true, colours: 256, dither: 0.4, effort: 10 })
    .toFile(effectOutput);
}

// 樱酱 body 是整身 replacement，而冰雪鞋是独立可穿层。鞋层实际覆盖的每个像素都必须
// 回到 base-noshoes，不能靠吞掉 shoes 图层掩盖旧鞋；否则商品买到后会形成双鞋。
await removeKenshiEmbeddedShoes();

for (const fileName of ICON_FILES) {
  const input = resolve(sourceIconRoot, fileName);
  const output = resolve(targetIconRoot, fileName);
  const base = await sharp(input).ensureAlpha().png().toBuffer();
  const strongIceCore = fileName === 'weapon-swordsman.png' || fileName === 'weapon-witch.png';
  await writePng(await addIconContrast(base, { strongIceCore }), output, ICON_SIZE_BUDGET);
}

// 樱酱的精品 body 是完整人物源，装备槽必须展示同源缩略图，不能退回通用空心裙。
await mkdir(dirname(kenshiBodyIconOutput), { recursive: true });
const kenshiBodyIcon = await sharp(resolve(targetWearableRoot, 'kenshi-body.png'))
  .resize({
    width: 240,
    height: 240,
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
    kernel: sharp.kernel.lanczos3,
  })
  .extend({
    top: 8,
    right: 8,
    bottom: 8,
    left: 8,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();
await writePng(await addIconContrast(kenshiBodyIcon), kenshiBodyIconOutput, ICON_SIZE_BUDGET);

await mkdir(dirname(sceneOutput), { recursive: true });
await sharp(sceneSource)
  .resize({ width: 960, height: 640, fit: 'cover', position: 'centre', kernel: sharp.kernel.lanczos3 })
  .webp({ quality: 89, effort: 6, smartSubsample: true })
  .toFile(sceneOutput);

console.log('冰雪华年资产已重建：20 穿戴层 + 13 图标 + 5 职业特效 + 1 独立货架。');
