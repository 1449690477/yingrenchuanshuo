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
import {
  KENSHI_PASTE_Y,
  computeBodyRemovalMask,
  computeShoeShift,
  computeWeaponAlign,
  rawRgba,
  translate,
} from './ice-snow-fix-params.mjs';

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


// 2026-08-04 收紧项（小刃）：超预算时不再降 RGBA 调色板，改走 RGB-only 量化 + RGB 中值阶梯，
// alpha 通道逐字节保留——雪纺/薄纱/冰晶的半透明轮廓零失真，量化噪声只落在颜色上，
// 由 validate 的保真容差（alphaMAE 收紧回 0.1）封顶。
function quantizeRgb(data, info, bits) {
  const step = 256 >> bits;
  const half = step >> 1;
  const out = Buffer.from(data);
  for (let offset = 0; offset < out.length; offset += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      out[offset + channel] = Math.min(
        255,
        Math.max(0, Math.round((out[offset + channel] - half) / step) * step + half),
      );
    }
  }
  return out;
}

async function medianRgbOnly(data, info, size, bits, clampFactor = 1) {
  const rgb = Buffer.alloc(info.width * info.height * 3);
  const alpha = Buffer.alloc(info.width * info.height);
  for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
    const s = pixel * 4;
    const d = pixel * 3;
    rgb[d] = data[s];
    rgb[d + 1] = data[s + 1];
    rgb[d + 2] = data[s + 2];
    alpha[pixel] = data[s + 3];
  }
  const med = await sharp(rgb, { raw: { width: info.width, height: info.height, channels: 3 } })
    .median(size)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const half = bits > 0 ? 256 >> (bits + 1) : 0;
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
    const s = pixel * 4;
    const d = pixel * 3;
    for (let channel = 0; channel < 3; channel += 1) {
      const origin = data[s + channel];
      const value = med.data[d + channel];
      out[s + channel] = Math.min(255, Math.max(0, half > 0 ? Math.min(origin + Math.round(half * clampFactor), Math.max(origin - Math.round(half * clampFactor), value)) : value));
    }
    out[s + 3] = alpha[pixel];
  }
  return { data: out, info };
}

async function encodeTruecolor(buffer, info) {
  return sharp(buffer, { raw: info })
    .png({ compressionLevel: 9, palette: false, effort: 10 })
    .toBuffer();
}

async function writePng(buffer, output, budget = WEARABLE_SIZE_BUDGET) {
  await mkdir(dirname(output), { recursive: true });
  const raw = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let encoded = await encodeTruecolor(raw.data, raw.info);
  const ladder = [
    { bits: 6, median: 0 },
    { bits: 6, median: 3 },
    { bits: 5, median: 0 },
    { bits: 5, median: 5 },
    { bits: 5, median: 7 },
    { bits: 4, median: 5, clampFactor: 2.0 },
  ];
  for (const step of ladder) {
    if (encoded.length <= budget) break;
    let data = quantizeRgb(raw.data, raw.info, step.bits);
    if (step.median > 0) data = (await medianRgbOnly(data, raw.info, step.median, step.bits, step.clampFactor ?? 1)).data;
    encoded = await encodeTruecolor(data, raw.info);
  }
  await writeFile(output, encoded);
}


/**
 * 老四职业的衣裙层在独立鞋层的落点上让位（Alpha 置零）。
 * 运行时 z 序是 body < shoes（characterAppearance 的 slotOrder），靴子画在
 * 裙摆之上；v2 长裙如原样落位，靴口会穿透裙面。与 v1 同一契约：
 * 「长裙可以下垂，但不得与同主题独立鞋层逐像素重叠」（shopAppearanceVisual.spec）。
 * 樱酱不走这里——她的 body 是整身 replacement，走底模垫层构型
 * （underlayKenshiBase），独立鞋层画在长裙之上，无需让位。
 */
async function yieldBodyToShoes(bodyBuffer, classId, shoesBuffer) {
  const [body, shoesAlpha] = await Promise.all([
    sharp(bodyBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(shoesBuffer).ensureAlpha().extractChannel('alpha').raw().toBuffer(),
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

/**
 * 老四职业 body 确定性切除（头区 C1/C2 + 脸椭圆 + 侧边条，小灯 2026-08-03
 * 事故修主刀）＋羽化坡（小尺 2026-08-04 打磨：剑士/萨满肩侧方角切边）。
 * 掩码与羽化实现在 ice-snow-fix-params.mjs 的 computeBodyRemovalMask ——
 * validate 的母版保真豁免用同一份掩码，两侧锁步。
 */
async function applyBodyRemoval(bodyBuffer, classId, baseRaw) {
  const mask = await computeBodyRemovalMask(classId, ROOT, baseRaw);
  const { data, info } = await sharp(bodyBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let pixel = 0; pixel < mask.feathered.length; pixel += 1) {
    const strength = mask.feathered[pixel];
    if (strength === 0) continue;
    const offset = pixel * 4;
    const alpha = Math.round((data[offset + 3] * (255 - strength)) / 255);
    data[offset + 3] = alpha;
    if (alpha === 0) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
    }
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

/**
 * 樱酱(kenshi) 补头：v2 母版把樱酱的头画丢了（头区是毛领/兜帽），
 * 确定性一步=把 base kenshi 头区（y<KENSHI_PASTE_Y 且 base 剪影有像素）贴回 body，
 * 同骨架直接复制、零重绘。
 */
async function pasteKenshiHead(bodyBuffer, baseRaw, deepY) {
  const { data, info } = await sharp(bodyBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let y = 0; y < Math.min(deepY, info.height); y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * 4;
      if (baseRaw.data[offset + 3] > 16) {
        data[offset] = baseRaw.data[offset];
        data[offset + 1] = baseRaw.data[offset + 1];
        data[offset + 2] = baseRaw.data[offset + 2];
        data[offset + 3] = baseRaw.data[offset + 3];
      }
    }
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

/**
 * 妖灵武器确定性对齐：等比缩放到 rose-night 扇带并居中（小Q5 22:29 终审）。
 */
async function alignShamanWeapon(buffer, align) {
  const resized = await sharp(buffer)
    .resize({ width: align.newW, height: align.newH, kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  return sharp({
    create: { width: 640, height: 960, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: resized, left: align.left, top: align.top }])
    .png()
    .toBuffer();
}

/**
 * 2026-08-04 换代：旧 removeKenshiEmbeddedShoes 按鞋遮罩把 body 像素**回填**
 * 成 base-noshoes——那是 v1 合同（v1 母版把靴子画进身体）。v2 母版是及地
 * 长裙、无内置鞋，鞋遮罩（高筒靴）与裙面重叠，回填等于在裙摆上挖洞：
 * y740 行裙宽 521→355px，老板线上单件试穿实测露腿（见 git 历史与频道
 * 2026-08-04 晨记录）。正确构型是**把底模垫在长裙之下**：裙面逐像素保真，
 * 裙摆之下（母版透明处）自然露出底模的腿脚，单穿不悬空；防双鞋由
 * base-noshoes 本身无鞋保证，跨主题鞋层照常画在裙上。
 */
async function underlayKenshiBase() {
  const bodyPath = resolve(targetWearableRoot, 'kenshi-body.png');
  const baseNoShoesPath = resolve(ROOT, 'public/assets/characters/modular/kenshi/base-noshoes.png');
  const [bodyMeta, baseMeta] = await Promise.all([
    sharp(bodyPath).metadata(),
    sharp(baseNoShoesPath).metadata(),
  ]);
  if (bodyMeta.width !== baseMeta.width || bodyMeta.height !== baseMeta.height) {
    throw new Error(
      `樱酱底模垫层尺寸不一致：${bodyMeta.width}x${bodyMeta.height} / ${baseMeta.width}x${baseMeta.height}`,
    );
  }
  const composited = await sharp(baseNoShoesPath)
    .composite([{ input: bodyPath, blend: 'over' }])
    .png()
    .toBuffer();
  await writePng(composited, bodyPath);
}

for (const classId of CLASSES) {
  const baseRaw = await rawRgba(
    resolve(ROOT, `public/assets/characters/modular/${classId}/base-noshoes.png`),
  );
  const shoeShift = await computeShoeShift(classId, ROOT);
  const shoesTranslated = await translate(
    resolve(sourceWearableRoot, `${classId}-shoes.png`),
    shoeShift.dx,
    shoeShift.dy,
  );
  for (const slot of WEARABLE_SLOTS) {
    const input = resolve(sourceWearableRoot, `${classId}-${slot}.png`);
    const output = resolve(targetWearableRoot, `${classId}-${slot}.png`);
    let base = await sharp(input).ensureAlpha().png().toBuffer();
    if (slot === 'body') {
      if (classId !== 'kenshi') {
        base = await yieldBodyToShoes(base, classId, shoesTranslated);
        base = await applyBodyRemoval(base, classId, baseRaw);
      } else {
        base = await pasteKenshiHead(base, baseRaw, KENSHI_PASTE_Y);
      }
    }
    if (slot === 'shoes') {
      base = shoesTranslated;
    }
    if (slot === 'weapon') {
      const align = await computeWeaponAlign(classId, ROOT);
      if (align) {
        base = await alignShamanWeapon(base, align);
      }
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

// 樱酱 body 是整身 replacement：长裙压在底模之上合成完整人物，
// 单穿有头有脚、裙面不缺一像素（合同细节见 underlayKenshiBase 注释）。
await underlayKenshiBase();

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
