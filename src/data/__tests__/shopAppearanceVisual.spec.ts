import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { CLASS_IDS, type ClassId, type EquipmentInstance } from '@/core/types';
import { ARENA_EQUIPMENT_LIST } from '../arenaEquipment';
import { ARENA_SHOP_ENTRIES } from '../arenaShop';
import { boutiqueAppearanceId, boutiqueEquipmentId } from '../boutique';
import { ENHANCE_MAX } from '../constants';
import { requireEquipment } from '../equipment';
import { equipmentDisplayPresentation } from '../equipmentPresentation';
import { SHOP_OFFERS } from '../shop';
import {
  requireEquipmentAppearance,
  resolveCharacterAppearance,
  type EquippedRecord,
} from '../characterAppearance';

const THEMES = ['berry-cream', 'moon-sugar', 'rose-night', 'ice-snow'] as const;
const VISIBLE_SLOTS = ['body', 'head', 'shoes', 'weapon'] as const;

const WEAPON_ANCHORS: Readonly<
  Record<ClassId, readonly [x: number, y: number, width: number, height: number][]>
> = {
  swordsman: [
    [145, 385, 105, 115],
    [440, 265, 135, 145],
  ],
  witch: [
    [215, 315, 105, 110],
    [450, 250, 135, 125],
  ],
  shaman: [
    [275, 300, 110, 115],
    [450, 240, 140, 125],
  ],
  catkin: [
    [145, 375, 120, 130],
    [435, 250, 145, 180],
  ],
  kenshi: [[170, 520, 240, 200]],
};
const ARENA_KENSHI_RING_ANCHOR = [400, 340, 140, 180] as const;

function emptyEquipped(): EquippedRecord {
  return {
    weapon: null,
    head: null,
    body: null,
    necklace: null,
    bracelet: null,
    ring: null,
    belt: null,
    shoes: null,
  };
}

function instance(defId: string): EquipmentInstance {
  return {
    uid: `shop-appearance-${defId}`,
    defId,
    enhance: 0,
    baseRollPermille: 1000,
    enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(0),
    enhanceLuck: {},
    affixes: [],
    reforgeResonance: 0,
    locked: false,
  };
}

function equippedSuite(theme: (typeof THEMES)[number], classId: ClassId): EquippedRecord {
  return {
    ...emptyEquipped(),
    body: instance(boutiqueEquipmentId(theme, 'body')),
    head: instance(boutiqueEquipmentId(theme, 'head')),
    shoes: instance(boutiqueEquipmentId(theme, 'shoes')),
    weapon: instance(boutiqueEquipmentId(theme, 'weapon', classId)),
  };
}

function mixedSuite(
  bodyTheme: (typeof THEMES)[number],
  shoesTheme: (typeof THEMES)[number],
  headTheme: (typeof THEMES)[number],
  weaponTheme: (typeof THEMES)[number],
  classId: ClassId,
): EquippedRecord {
  return {
    ...emptyEquipped(),
    body: instance(boutiqueEquipmentId(bodyTheme, 'body')),
    shoes: instance(boutiqueEquipmentId(shoesTheme, 'shoes')),
    head: instance(boutiqueEquipmentId(headTheme, 'head')),
    weapon: instance(boutiqueEquipmentId(weaponTheme, 'weapon', classId)),
  };
}

async function layerStats(asset: string) {
  const { data, info } = await sharp(resolve('public', asset))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  let alphaPixels = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * info.channels + 3];
      if (!alpha) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      alphaPixels += 1;
    }
  }
  return { data, info, bbox: [minX, minY, maxX, maxY] as const, alphaPixels };
}

type LayerStats = Awaited<ReturnType<typeof layerStats>>;

function alphaDigest(stats: Awaited<ReturnType<typeof layerStats>>): string {
  const alpha = Buffer.alloc(stats.info.width * stats.info.height);
  for (let pixel = 0, offset = 3; pixel < alpha.length; pixel += 1, offset += stats.info.channels) {
    alpha[pixel] = stats.data[offset];
  }
  return createHash('sha256').update(alpha).digest('hex');
}

function maskedPixelDifference(
  actual: Awaited<ReturnType<typeof layerStats>>,
  expected: Awaited<ReturnType<typeof layerStats>>,
  mask: Awaited<ReturnType<typeof layerStats>>,
): { checked: number; premultipliedMae: number; alphaMae: number } {
  let checked = 0;
  let premultipliedError = 0;
  let alphaError = 0;
  for (let offset = 0; offset < mask.data.length; offset += mask.info.channels) {
    if (mask.data[offset + 3] <= 20) continue;
    checked += 1;
    const actualAlpha = actual.data[offset + 3] / 255;
    const expectedAlpha = expected.data[offset + 3] / 255;
    alphaError += Math.abs(actual.data[offset + 3] - expected.data[offset + 3]);
    for (let channel = 0; channel < 3; channel += 1) {
      premultipliedError += Math.abs(
        actual.data[offset + channel] * actualAlpha -
          expected.data[offset + channel] * expectedAlpha,
      );
    }
  }
  return {
    checked,
    premultipliedMae: premultipliedError / (checked * 3),
    alphaMae: alphaError / checked,
  };
}

function alphaOverlapPixels(first: LayerStats, second: LayerStats): number {
  let overlap = 0;
  for (let offset = 0; offset < first.data.length; offset += first.info.channels) {
    if (first.data[offset + 3] > 20 && second.data[offset + 3] > 20) overlap += 1;
  }
  return overlap;
}

function alphaInRect(
  stats: Awaited<ReturnType<typeof layerStats>>,
  [left, top, width, height]: readonly [number, number, number, number],
): number {
  let count = 0;
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      if (stats.data[(y * stats.info.width + x) * stats.info.channels + 3] > 20) count += 1;
    }
  }
  return count;
}

function whiteBackgroundContrast(stats: Awaited<ReturnType<typeof layerStats>>) {
  let visible = 0;
  let luminanceSum = 0;
  let chromaSum = 0;
  let nearWhite = 0;
  let darkPixels = 0;
  for (let offset = 0; offset < stats.data.length; offset += stats.info.channels) {
    const alpha = stats.data[offset + 3] / 255;
    if (alpha <= 0.06) continue;
    const red = stats.data[offset] * alpha + 255 * (1 - alpha);
    const green = stats.data[offset + 1] * alpha + 255 * (1 - alpha);
    const blue = stats.data[offset + 2] * alpha + 255 * (1 - alpha);
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
    visible += 1;
    luminanceSum += luminance;
    chromaSum += chroma;
    if (luminance > 235) nearWhite += 1;
    if (luminance <= 200) darkPixels += 1;
  }
  return {
    meanLuminance: visible ? luminanceSum / visible : 255,
    meanChroma: visible ? chromaSum / visible : 0,
    nearWhiteRatio: visible ? nearWhite / visible : 1,
    darkPixelRatio: visible ? darkPixels / visible : 0,
  };
}

describe('商城五职业换装视觉合同', () => {
  it('四套商城的五职业四个可见槽均使用独立 640×960 RGBA 图层', async () => {
    const hashes = new Map<string, string>();
    const alphaHashes = new Map<string, string>();

    for (const theme of THEMES) {
      for (const classId of CLASS_IDS) {
        for (const slot of VISIBLE_SLOTS) {
          const appearanceId = boutiqueAppearanceId(
            theme,
            slot,
            slot === 'weapon' ? classId : undefined,
          );
          const appearance = requireEquipmentAppearance(appearanceId);
          expect(appearance.renderMode, appearanceId).toBe('layer');
          if (appearance.renderMode !== 'layer') continue;
          expect(appearance.slot, appearanceId).toBe(slot);
          expect(appearance.assets[classId], appearanceId).toBe(
            `assets/characters/modular/shop/${theme}/${classId}-${slot}.png`,
          );
          if (slot === 'body') {
            expect(appearance.replacementClasses, appearanceId).toEqual(['kenshi']);
          }

          const asset = appearance.assets[classId]!;
          const file = resolve('public', asset);
          expect(existsSync(file), asset).toBe(true);
          const stats = await layerStats(asset);
          expect(
            { width: stats.info.width, height: stats.info.height, channels: stats.info.channels },
            asset,
          ).toEqual({ width: 640, height: 960, channels: 4 });
          // 现有最小合法头饰是 ice-snow/kenshi 的 2746 像素；门槛紧贴该样本。
          expect(stats.alphaPixels, asset).toBeGreaterThan(slot === 'head' ? 2_700 : 3_500);
          const [minX, minY, maxX, maxY] = stats.bbox;
          expect(minX, asset).toBeGreaterThanOrEqual(0);
          expect(maxX, asset).toBeLessThan(640);
          if (slot === 'head') {
            expect(minY, asset).toBeLessThanOrEqual(24);
            expect(maxY, asset).toBeLessThanOrEqual(210);
          }
          if (slot === 'shoes') {
            // 680 → 640（2026-08-03 冰雪批裁定）：冰雪 v2 高筒靴是合法设计
            // （修复对齐鞋底边后靴顶更高，五职业实测最低 655），
            // 合同留 15px 缓冲；鞋层真正的硬闸是脚底锚点 ±8px。
            expect(minY, asset).toBeGreaterThanOrEqual(640);
            expect(maxY, asset).toBeLessThanOrEqual(950);
          }
          if (slot === 'body' && classId === 'kenshi') {
            expect(minY, asset).toBeLessThanOrEqual(30);
            expect(maxY, asset).toBeGreaterThanOrEqual(880);
          }
          if (slot === 'weapon') {
            expect(
              Math.max(...WEAPON_ANCHORS[classId].map((rect) => alphaInRect(stats, rect))),
              `${asset} 未命中 ${classId} 持握/佩刀锚点`,
            ).toBeGreaterThan(500);
          }

          const digest = createHash('sha256').update(readFileSync(file)).digest('hex');
          expect(hashes.has(digest), `${asset} 与 ${hashes.get(digest)} 复用了同一图层`).toBe(
            false,
          );
          hashes.set(digest, asset);
          const shapeDigest = alphaDigest(stats);
          expect(
            alphaHashes.has(shapeDigest),
            `${asset} 与 ${alphaHashes.get(shapeDigest)} 复用了同一透明轮廓（疑似改色复制）`,
          ).toBe(false);
          alphaHashes.set(shapeDigest, asset);
        }
      }
    }
    expect(hashes.size).toBe(80);
    expect(alphaHashes.size).toBe(80);
  });

  it('老四职业长裙可以下垂，但不得与同主题独立鞋层逐像素重叠', async () => {
    for (const theme of THEMES) {
      for (const classId of CLASS_IDS.filter((entry) => entry !== 'kenshi')) {
        const [body, shoes] = await Promise.all([
          layerStats(`assets/characters/modular/shop/${theme}/${classId}-body.png`),
          layerStats(`assets/characters/modular/shop/${theme}/${classId}-shoes.png`),
        ]);
        expect(
          alphaOverlapPixels(body, shoes),
          `${theme}/${classId} 衣裙与鞋层重叠，疑似内置鞋`,
        ).toBe(0);
      }
    }
  });

  it('樱酱商城衣裙按整身替换解析，不再把旧底模脸覆盖回新衣裙', () => {
    for (const theme of THEMES) {
      const resolved = resolveCharacterAppearance('kenshi', 78, equippedSuite(theme, 'kenshi'));
      expect(resolved.baseAsset).toBe(`assets/characters/modular/shop/${theme}/kenshi-body.png`);
      expect(resolved.layers.map((layer) => layer.slot)).toEqual(['shoes', 'head', 'weapon']);
      expect(resolved.visibleEquippedCount).toBe(4);
      expect(resolved.silentVisualSlots).toEqual([]);
      expect(resolved.signature).toContain(`body:boutique-${theme}-body`);
      expect(resolved.baseAsset).not.toContain('base-noshoes');

      const bodyOnly = resolveCharacterAppearance('kenshi', 78, {
        ...emptyEquipped(),
        body: instance(boutiqueEquipmentId(theme, 'body')),
      });
      expect(bodyOnly.baseAsset).toBe(`assets/characters/modular/shop/${theme}/kenshi-body.png`);
      expect(bodyOnly.layers).toEqual([]);
      expect(bodyOnly.visibleEquippedCount).toBe(1);
      expect(bodyOnly.silentVisualSlots).toEqual([]);
    }
  });

  it('樱酱四套 replacement 已剔除内置鞋，跨主题鞋履不会形成双鞋', async () => {
    const baseNoShoes = await layerStats('assets/characters/modular/kenshi/base-noshoes.png');
    for (const theme of THEMES) {
      const [body, shoes] = await Promise.all([
        layerStats(`assets/characters/modular/shop/${theme}/kenshi-body.png`),
        layerStats(`assets/characters/modular/shop/${theme}/kenshi-shoes.png`),
      ]);
      const pixels = maskedPixelDifference(body, baseNoShoes, shoes);
      expect(pixels.checked, theme).toBeGreaterThan(2_000);
      // 阈值 0.6：冰雪 v2 母版超预算，kenshi-body 出口降级为 RGBA 调色板
      // （build-ice-snow-assets 的 writePng），量化让回填区偏离 base-noshoes
      // 实测 premulMAE≈0.33 / alphaMAE≈0.15（2026-08-03）。真实内置鞋违规是
      // 几十 MAE 量级，0.6 仍留有两个数量级的判别余量。
      expect(pixels.premultipliedMae, `${theme} 的 replacement 仍画着内置鞋`).toBeLessThanOrEqual(
        0.6,
      );
      expect(pixels.alphaMae, `${theme} 的 replacement 鞋区 alpha 未还原`).toBeLessThanOrEqual(0.6);
    }
  });

  it('四套主题任意混穿时，五职业仍保持正确底模、图层顺序和素材来源', () => {
    let checkedMixes = 0;
    for (const bodyTheme of THEMES) {
      for (const shoesTheme of THEMES) {
        for (const headTheme of THEMES) {
          for (const weaponTheme of THEMES) {
            for (const classId of CLASS_IDS) {
              const resolved = resolveCharacterAppearance(
                classId,
                78,
                mixedSuite(bodyTheme, shoesTheme, headTheme, weaponTheme, classId),
              );
              expect(resolved.visibleEquippedCount).toBe(4);
              expect(resolved.silentVisualSlots).toEqual([]);
              expect(resolved.layers.map((layer) => layer.slot)).toEqual(
                classId === 'kenshi'
                  ? ['shoes', 'head', 'weapon']
                  : ['body', 'shoes', 'head', 'weapon'],
              );
              expect(resolved.baseAsset).toBe(
                classId === 'kenshi'
                  ? `assets/characters/modular/shop/${bodyTheme}/kenshi-body.png`
                  : `assets/characters/modular/${classId}/base-noshoes.png`,
              );
              expect(resolved.layers.map((layer) => layer.asset)).toEqual(
                [
                  classId === 'kenshi'
                    ? null
                    : `assets/characters/modular/shop/${bodyTheme}/${classId}-body.png`,
                  `assets/characters/modular/shop/${shoesTheme}/${classId}-shoes.png`,
                  `assets/characters/modular/shop/${headTheme}/${classId}-head.png`,
                  `assets/characters/modular/shop/${weaponTheme}/${classId}-weapon.png`,
                ].filter((asset): asset is string => asset !== null),
              );
              checkedMixes += 1;
            }
          }
        }
      }
    }
    expect(checkedMixes).toBe(1_280);
  });

  it('全部 50 件在售商品按可用职业展示与实穿同源且白底可辨的图标', async () => {
    const checkedIcons = new Map<string, string>();
    expect(SHOP_OFFERS).toHaveLength(50);
    expect(new Set(SHOP_OFFERS.map((offer) => offer.id)).size).toBe(SHOP_OFFERS.length);

    for (const offer of SHOP_OFFERS) {
      const definition = requireEquipment(offer.defId);
      const compatibleClasses = definition.classId ? [definition.classId] : CLASS_IDS;
      const appearance = requireEquipmentAppearance(definition.appearanceId);
      expect(appearance.slot, definition.id).toBe(definition.slot);

      for (const classId of compatibleClasses) {
        const presentation = equipmentDisplayPresentation(definition, classId);
        const expected =
          definition.slot === 'body' && classId === 'kenshi'
            ? `assets/equipment/bodies/${definition.appearanceId}/kenshi.png`
            : definition.icon;
        expect(presentation.icon, `${definition.id}:${classId}`).toBe(expected);
        const iconPath = resolve('public', expected);
        expect(existsSync(iconPath), expected).toBe(true);
        if (checkedIcons.has(expected)) continue;
        const stats = await layerStats(expected);
        expect(
          { width: stats.info.width, height: stats.info.height, channels: stats.info.channels },
          expected,
        ).toEqual({ width: 256, height: 256, channels: 4 });
        const contrast = whiteBackgroundContrast(stats);
        expect(contrast.meanLuminance, `${expected} 白底平均亮度`).toBeLessThanOrEqual(228);
        expect(contrast.nearWhiteRatio, `${expected} 白底近白像素比例`).toBeLessThanOrEqual(0.45);
        expect(
          contrast.meanLuminance <= 205 ||
            contrast.meanChroma >= 16 ||
            contrast.darkPixelRatio >= 0.4,
          `${expected} 在白底卡片同时缺少明暗与颜色对比`,
        ).toBe(true);
        const digest = createHash('sha256').update(readFileSync(iconPath)).digest('hex');
        expect(
          [...checkedIcons.values()].includes(digest),
          `${expected} 复用了另一件商品的同一张图标`,
        ).toBe(false);
        checkedIcons.set(expected, digest);
      }
    }
    expect(checkedIcons.size).toBe(54);
  });

  it('老四职业商城衣裙继续作为独立层，并在穿鞋时使用无鞋底模', () => {
    for (const theme of THEMES) {
      for (const classId of CLASS_IDS.filter((candidate) => candidate !== 'kenshi')) {
        const resolved = resolveCharacterAppearance(classId, 78, equippedSuite(theme, classId));
        expect(resolved.baseAsset).toBe(`assets/characters/modular/${classId}/base-noshoes.png`);
        expect(resolved.layers.map((layer) => layer.slot)).toEqual([
          'body',
          'shoes',
          'head',
          'weapon',
        ]);
      }
    }
  });

  it('四个饰品槽不伪装成纸娃娃层，但单件装备仍会激活同系列攻击演出', () => {
    for (const theme of THEMES) {
      for (const classId of CLASS_IDS) {
        for (const slot of ['necklace', 'bracelet', 'ring', 'belt'] as const) {
          const definition = requireEquipment(boutiqueEquipmentId(theme, slot));
          const appearance = requireEquipmentAppearance(definition.appearanceId);
          expect(appearance.renderMode, definition.id).toBe('slot-only');

          const resolved = resolveCharacterAppearance(classId, 78, {
            ...emptyEquipped(),
            [slot]: instance(definition.id),
          });
          expect(resolved.layers, `${definition.id}:${classId}`).toEqual([]);
          expect(resolved.visibleEquippedCount, `${definition.id}:${classId}`).toBe(0);
          expect(resolved.silentVisualSlots, `${definition.id}:${classId}`).toEqual([]);
          expect(resolved.activeBoutiqueTheme, `${definition.id}:${classId}`).toBe(theme);
          expect(resolved.boutiqueEffectAsset, `${definition.id}:${classId}`).toBe(
            `assets/effects/boutique/${theme}-${classId}.png`,
          );
        }
      }
    }
  });

  it('四套五职业与纸箱猫的 21 张攻击演出均为独立 512×512 RGBA 设计', async () => {
    const effectPaths = [
      ...THEMES.flatMap((theme) =>
        CLASS_IDS.map((classId) => `assets/effects/boutique/${theme}-${classId}.png`),
      ),
      'assets/effects/boutique/cardboard-cat-catkin.png',
    ];
    const rgbaHashes = new Map<string, string>();
    const alphaHashes = new Map<string, string>();

    for (const asset of effectPaths) {
      const stats = await layerStats(asset);
      expect(
        { width: stats.info.width, height: stats.info.height, channels: stats.info.channels },
        asset,
      ).toEqual({ width: 512, height: 512, channels: 4 });
      expect(stats.alphaPixels, asset).toBeGreaterThan(3_500);

      const file = resolve('public', asset);
      const rgbaDigest = createHash('sha256').update(readFileSync(file)).digest('hex');
      expect(rgbaHashes.has(rgbaDigest), `${asset} 与 ${rgbaHashes.get(rgbaDigest)} 完全重复`).toBe(
        false,
      );
      rgbaHashes.set(rgbaDigest, asset);

      const shapeDigest = alphaDigest(stats);
      expect(
        alphaHashes.has(shapeDigest),
        `${asset} 与 ${alphaHashes.get(shapeDigest)} 复用了同一演出轮廓（疑似改色复制）`,
      ).toBe(false);
      alphaHashes.set(shapeDigest, asset);
    }

    expect(rgbaHashes.size).toBe(21);
    expect(alphaHashes.size).toBe(21);
  });

  it('竞技场荣誉商店 20 件商品完整覆盖五职业，16 张可穿层与 20 张图标均独立', async () => {
    expect(ARENA_SHOP_ENTRIES).toHaveLength(20);
    expect(ARENA_EQUIPMENT_LIST).toHaveLength(20);
    const layerHashes = new Map<string, string>();
    const layerAlphaHashes = new Map<string, string>();
    const iconHashes = new Map<string, string>();

    for (const entry of ARENA_SHOP_ENTRIES) {
      const definitions = ARENA_EQUIPMENT_LIST.filter(
        (definition) => definition.classId === entry.classId && definition.slot === entry.slot,
      );
      expect(definitions, entry.id).toHaveLength(1);
      const definition = definitions[0]!;
      const appearance = requireEquipmentAppearance(definition.appearanceId);
      expect(appearance.slot, definition.id).toBe(definition.slot);

      const iconStats = await layerStats(definition.icon);
      expect(
        {
          width: iconStats.info.width,
          height: iconStats.info.height,
          channels: iconStats.info.channels,
        },
        definition.icon,
      ).toEqual({ width: 256, height: 256, channels: 4 });
      const iconHash = createHash('sha256')
        .update(readFileSync(resolve('public', definition.icon)))
        .digest('hex');
      expect(
        iconHashes.has(iconHash),
        `${definition.icon} 与 ${iconHashes.get(iconHash)} 完全重复`,
      ).toBe(false);
      iconHashes.set(iconHash, definition.icon);

      if (definition.slot === 'ring' && definition.classId !== 'kenshi') {
        expect(appearance.renderMode, definition.id).toBe('slot-only');
        continue;
      }
      expect(appearance.renderMode, definition.id).not.toBe('slot-only');
      if (appearance.renderMode === 'slot-only') continue;
      const expectedAsset = definition.icon.replace(
        'assets/equipment/arena/',
        'assets/characters/modular/arena/',
      );
      expect(appearance.assets[definition.classId!], definition.id).toBe(expectedAsset);
      const layer = await layerStats(expectedAsset);
      expect(
        { width: layer.info.width, height: layer.info.height, channels: layer.info.channels },
        expectedAsset,
      ).toEqual({ width: 640, height: 960, channels: 4 });
      expect(layer.alphaPixels, expectedAsset).toBeGreaterThan(2_000);
      if (definition.slot === 'ring') {
        expect(
          alphaInRect(layer, ARENA_KENSHI_RING_ANCHOR),
          `${expectedAsset} 未贴合樱酱右手/手腕锚点`,
        ).toBeGreaterThanOrEqual(900);
      }
      const layerHash = createHash('sha256')
        .update(readFileSync(resolve('public', expectedAsset)))
        .digest('hex');
      expect(
        layerHashes.has(layerHash),
        `${expectedAsset} 与 ${layerHashes.get(layerHash)} 完全重复`,
      ).toBe(false);
      layerHashes.set(layerHash, expectedAsset);
      const shapeHash = alphaDigest(layer);
      expect(
        layerAlphaHashes.has(shapeHash),
        `${expectedAsset} 与 ${layerAlphaHashes.get(shapeHash)} 复用了同一透明轮廓`,
      ).toBe(false);
      layerAlphaHashes.set(shapeHash, expectedAsset);
    }

    expect(iconHashes.size).toBe(20);
    expect(layerHashes.size).toBe(16);
    expect(layerAlphaHashes.size).toBe(16);

    for (const classId of CLASS_IDS) {
      const equipped = emptyEquipped();
      for (const definition of ARENA_EQUIPMENT_LIST.filter(
        (candidate) => candidate.classId === classId,
      )) {
        equipped[definition.slot] = instance(definition.id);
      }
      const resolved = resolveCharacterAppearance(classId, 78, equipped);
      expect(resolved.equippedCount, classId).toBe(4);
      expect(resolved.silentVisualSlots, classId).toEqual([]);
      expect(resolved.visibleEquippedCount, classId).toBe(classId === 'kenshi' ? 4 : 3);
      expect(
        resolved.layers.map((layer) => layer.slot),
        classId,
      ).toEqual(classId === 'kenshi' ? ['head', 'weapon', 'ring'] : ['body', 'head', 'weapon']);
      if (classId === 'kenshi') {
        expect(resolved.baseAsset).toBe(
          'assets/characters/modular/arena/kenshi/blinkbloom-whitefeather-garb.png',
        );
      }
    }
  });

  it('珍品店与荣誉商店跨店混穿不会双脸、双底模或打乱部位层序', () => {
    for (const classId of CLASS_IDS) {
      const arenaForClass = ARENA_EQUIPMENT_LIST.filter(
        (definition) => definition.classId === classId,
      );
      const arenaBody = arenaForClass.find((definition) => definition.slot === 'body')!;
      const arenaHead = arenaForClass.find((definition) => definition.slot === 'head')!;
      const arenaWeapon = arenaForClass.find((definition) => definition.slot === 'weapon')!;

      const boutiqueBody = resolveCharacterAppearance(classId, 78, {
        ...emptyEquipped(),
        body: instance(boutiqueEquipmentId('berry-cream', 'body')),
        shoes: instance(boutiqueEquipmentId('ice-snow', 'shoes')),
        head: instance(arenaHead.id),
        weapon: instance(arenaWeapon.id),
      });
      expect(boutiqueBody.visibleEquippedCount, classId).toBe(4);
      expect(boutiqueBody.silentVisualSlots, classId).toEqual([]);
      expect(
        boutiqueBody.layers.map((layer) => layer.slot),
        classId,
      ).toEqual(
        classId === 'kenshi' ? ['shoes', 'head', 'weapon'] : ['body', 'shoes', 'head', 'weapon'],
      );

      const arenaBodyMixed = resolveCharacterAppearance(classId, 78, {
        ...emptyEquipped(),
        body: instance(arenaBody.id),
        shoes: instance(boutiqueEquipmentId('ice-snow', 'shoes')),
        head: instance(boutiqueEquipmentId('moon-sugar', 'head')),
        weapon: instance(boutiqueEquipmentId('rose-night', 'weapon', classId)),
      });
      expect(arenaBodyMixed.visibleEquippedCount, classId).toBe(4);
      expect(arenaBodyMixed.silentVisualSlots, classId).toEqual([]);
      expect(
        arenaBodyMixed.layers.map((layer) => layer.slot),
        classId,
      ).toEqual(
        classId === 'kenshi' ? ['shoes', 'head', 'weapon'] : ['body', 'shoes', 'head', 'weapon'],
      );
    }

    const cardboardMixed = resolveCharacterAppearance('catkin', 78, {
      ...emptyEquipped(),
      body: instance(boutiqueEquipmentId('cardboard-cat', 'body', 'catkin')),
      shoes: instance(boutiqueEquipmentId('ice-snow', 'shoes')),
      head: instance(
        ARENA_EQUIPMENT_LIST.find((d) => d.classId === 'catkin' && d.slot === 'head')!.id,
      ),
      weapon: instance(
        ARENA_EQUIPMENT_LIST.find((d) => d.classId === 'catkin' && d.slot === 'weapon')!.id,
      ),
    });
    expect(cardboardMixed.baseAsset).toBe(
      'assets/characters/modular/shop/cardboard-cat/catkin-body.png',
    );
    expect(cardboardMixed.layers.map((layer) => layer.slot)).toEqual(['head', 'weapon']);
    expect(cardboardMixed.visibleEquippedCount).toBe(3);
    expect(cardboardMixed.silentVisualSlots).toEqual(['shoes']);
  });

  it('纸箱猫专属套保持整身替换且不向其他职业暴露', () => {
    const body = requireEquipmentAppearance('boutique-cardboard-cat-body-catkin');
    const weapon = requireEquipmentAppearance('boutique-cardboard-cat-weapon-catkin');
    expect(body).toMatchObject({
      renderMode: 'replacement',
      replacementIncludes: ['shoes'],
      assets: {
        catkin: 'assets/characters/modular/shop/cardboard-cat/catkin-body.png',
      },
    });
    expect(weapon).toMatchObject({
      renderMode: 'layer',
      assets: {
        catkin: 'assets/characters/modular/shop/cardboard-cat/catkin-weapon.png',
      },
    });
    const resolved = resolveCharacterAppearance('catkin', 78, {
      ...emptyEquipped(),
      body: instance('eq_shop_cardboard-cat_body_catkin'),
      weapon: instance('eq_shop_cardboard-cat_weapon_catkin'),
    });
    expect(resolved.baseAsset).toBe('assets/characters/modular/shop/cardboard-cat/catkin-body.png');
    expect(resolved.layers.map((layer) => layer.slot)).toEqual(['weapon']);
    expect(resolved.silentVisualSlots).toEqual([]);
    expect(
      equipmentDisplayPresentation(requireEquipment('eq_shop_cardboard-cat_body_catkin'), 'catkin')
        .icon,
    ).toBe('assets/equipment/shop/cardboard-cat/body-catkin.png');
    expect(
      equipmentDisplayPresentation(
        requireEquipment('eq_shop_cardboard-cat_weapon_catkin'),
        'catkin',
      ).icon,
    ).toBe('assets/equipment/shop/cardboard-cat/weapon-catkin.png');
  });

  it('绯樱星愿剑士礼帽停在眼睛上方', async () => {
    const rebuiltTrim = await sharp('art-source/shop/rose-night/swordsman-head-alpha.png')
      .ensureAlpha()
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize({ width: 130, withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: false })
      .toBuffer();
    const rebuilt = await sharp({
      create: {
        width: 640,
        height: 960,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: rebuiltTrim, left: 258, top: 0 }])
      .ensureAlpha()
      .raw()
      .toBuffer();
    const runtime = await sharp(
      'public/assets/characters/modular/shop/rose-night/swordsman-head.png',
    )
      .ensureAlpha()
      .raw()
      .toBuffer();
    expect(runtime.equals(rebuilt)).toBe(true);

    const stats = await layerStats('assets/characters/modular/shop/rose-night/swordsman-head.png');
    expect(stats.bbox).toEqual([258, 0, 387, 114]);
  });
});
