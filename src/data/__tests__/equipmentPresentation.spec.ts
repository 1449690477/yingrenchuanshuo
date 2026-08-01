import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  CLASS_IDS,
  type ClassId,
  type EquipmentDef,
} from '@/core/types';
import { EQUIPMENT, requireEquipment } from '../equipment';
import {
  EQUIPMENT_APPEARANCES,
  type EquipmentAppearance,
} from '../characterAppearance';
import {
  equipmentDisplayPresentation,
  equipmentPresentation,
} from '../equipmentPresentation';

const REGION_WEAPON_APPEARANCES = [
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
] as const;

const HAND_ANCHORS: Readonly<
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
  kenshi: [
    [145, 375, 120, 130],
    [435, 250, 145, 180],
  ],
};

function layerAppearance(id: string): Extract<EquipmentAppearance, { renderMode: 'layer' }> {
  const appearance = EQUIPMENT_APPEARANCES[id];
  if (!appearance || appearance.renderMode !== 'layer') {
    throw new Error(`[测试配置错误] ${id} 不是纸娃娃图层`);
  }
  return appearance;
}

async function alphaCountInRect(
  asset: string,
  [x, y, width, height]: readonly [number, number, number, number],
): Promise<number> {
  const { data, info } = await sharp(resolve('public', asset))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let count = 0;
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      if (data[(py * info.width + px) * info.channels + 3]! > 20) count += 1;
    }
  }
  return count;
}

describe('装备职业表现与手部对位', () => {
  it('所有全职业通用武器都完整登记四职业名称与真实图标', async () => {
    const sharedWeapons = Object.values(EQUIPMENT).filter(
      (definition) => definition.slot === 'weapon' && !definition.classId,
    );
    expect(sharedWeapons.length).toBeGreaterThan(0);

    for (const definition of sharedWeapons) {
      expect(Object.keys(definition.classPresentations ?? {}).sort(), definition.id).toEqual(
        [...CLASS_IDS].sort(),
      );
      for (const classId of CLASS_IDS) {
        const presentation = equipmentPresentation(definition, classId);
        expect(presentation.name.length, `${definition.id}:${classId} 名称`).toBeGreaterThan(3);
        expect(presentation.icon, `${definition.id}:${classId} 禁止复用通用图标`).not.toBe(
          definition.icon,
        );
        const iconPath = resolve('public', presentation.icon);
        expect(existsSync(iconPath), presentation.icon).toBe(true);
        const metadata = await sharp(iconPath).metadata();
        expect(
          {
            width: metadata.width,
            height: metadata.height,
            channels: metadata.channels,
          },
          presentation.icon,
        ).toEqual({ width: 256, height: 256, channels: 4 });
      }
    }
  });

  it('绯焰套武器按职业展示剑、杖、扇、爪，不再让喵喵显示誓焰刃', () => {
    const definition = requireEquipment('eq_set_region_crimson_weapon');
    expect(
      Object.fromEntries(
        CLASS_IDS.map((classId) => [
          classId,
          equipmentPresentation(definition, classId).name,
        ]),
      ),
    ).toEqual({
      swordsman: '维斯塔誓焰刃',
      witch: '维斯塔焰心杖',
      shaman: '维斯塔燎天扇',
      catkin: '维斯塔焰羽爪',
      kenshi: '维斯塔绯焰名刀',
    });
  });

  it('区域武器纸娃娃层必须与当前职业至少一个手部锚点真实相交', async () => {
    for (const appearanceId of REGION_WEAPON_APPEARANCES) {
      const appearance = layerAppearance(appearanceId);
      for (const classId of CLASS_IDS) {
        const asset = appearance.assets[classId];
        expect(asset, `${appearanceId}:${classId}`).toBeDefined();
        const counts = await Promise.all(
          HAND_ANCHORS[classId].map((anchor) => alphaCountInRect(asset!, anchor)),
        );
        expect(Math.max(...counts), `${appearanceId}:${classId} 手部没有武器像素`).toBeGreaterThan(
          150,
        );
        if (
          classId === 'catkin' &&
          [
            'r1-weapon',
            'r3-weapon',
            'r5-weapon',
            'r5-set-weapon',
            'r6-weapon',
            'r6-set-weapon',
            'r7-weapon',
            'r7-set-weapon',
          ].includes(appearanceId)
        ) {
          expect(
            counts.every((count) => count > 150),
            `${appearanceId}:catkin 双爪必须分别覆盖左右手`,
          ).toBe(true);
        }
      }
    }
  });

  it('配置缺失或跨职业展示直接报错，不回落成错误武器', () => {
    const missingPresentation = {
      ...requireEquipment('eq_r1_weapon_common'),
      classPresentations: undefined,
    } satisfies EquipmentDef;
    expect(() => equipmentPresentation(missingPresentation, 'catkin')).toThrow(
      '缺少 catkin 职业表现',
    );

    const witchOnly = requireEquipment('eq_shop_berry-cream_weapon_witch');
    expect(() => equipmentPresentation(witchOnly, 'catkin')).toThrow('不能按 catkin 展示');
  });

  it('跨职业背包装备按装备归属展示，通用武器才跟随当前职业', () => {
    const witchOnly = requireEquipment('eq_shop_berry-cream_weapon_witch');
    expect(equipmentDisplayPresentation(witchOnly, 'catkin')).toEqual({
      name: witchOnly.name,
      icon: witchOnly.icon,
    });

    const sharedWeapon = requireEquipment('eq_r2_weapon_epic');
    expect(equipmentDisplayPresentation(sharedWeapon, 'witch').name).toContain('魔杖');
    expect(equipmentDisplayPresentation(sharedWeapon, 'catkin').name).toContain('键帽锤');
  });
});
