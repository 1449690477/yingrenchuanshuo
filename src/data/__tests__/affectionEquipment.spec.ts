import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { CLASS_IDS, type EquipSlot } from '@/core/types';
import { requireEquipmentAppearance } from '../characterAppearance';
import { EQUIPMENT, requireEquipment } from '../equipment';
import {
  AFFECTION_EQUIPMENT_LIST,
  affectionEquipmentForClass,
  affectionEquipmentIdsForClass,
  eligibleAffectionEquipmentIds,
  requireAffectionEquipment,
} from '../affectionEquipment';

const AFFECTION_EQUIPMENT_CLASS_IDS = CLASS_IDS;

describe('心虹好感专属装备', () => {
  it('五位角色各有十件，覆盖八个部位与两件替换款', () => {
    expect(AFFECTION_EQUIPMENT_LIST).toHaveLength(50);
    expect(new Set(AFFECTION_EQUIPMENT_LIST.map((entry) => entry.definition.id)).size).toBe(50);
    expect(new Set(AFFECTION_EQUIPMENT_LIST.map((entry) => entry.definition.name)).size).toBe(50);

    const requiredSlots = new Set<EquipSlot>([
      'weapon',
      'head',
      'body',
      'necklace',
      'bracelet',
      'ring',
      'belt',
      'shoes',
    ]);
    for (const classId of AFFECTION_EQUIPMENT_CLASS_IDS) {
      const entries = affectionEquipmentForClass(classId);
      expect(entries, classId).toHaveLength(10);
      expect(new Set(entries.map((entry) => entry.definition.slot)), classId).toEqual(
        requiredSlots,
      );
      expect(
        entries.filter((entry) => entry.definition.slot === 'body'),
        classId,
      ).toHaveLength(2);
      expect(
        entries.filter((entry) => entry.definition.slot === 'weapon'),
        classId,
      ).toHaveLength(2);
      expect(affectionEquipmentIdsForClass(classId)).toHaveLength(10);
    }
  });

  it('全部是职业绑定心虹珍藏，并写满六条确定词条', () => {
    for (const entry of AFFECTION_EQUIPMENT_LIST) {
      const definition = entry.definition;
      expect(EQUIPMENT[definition.id], definition.id).toBe(definition);
      expect(requireEquipment(definition.id)).toBe(definition);
      expect(definition.quality, definition.id).toBe('prismatic');
      expect(definition.classId, definition.id).toBe(entry.classId);
      expect(definition.fixedAffixes, definition.id).toHaveLength(6);
      expect(definition.fixedTemplate, definition.id).toBe(true);
      expect(new Set(definition.fixedAffixes!.map((affix) => affix.key)).size, definition.id).toBe(
        6,
      );
      expect(definition.boutiqueTheme, definition.id).toBeDefined();
      expect(definition.uniqueEffect, definition.id).toContain('攻击换肤');
      expect(entry.flavorText.length, definition.id).toBeGreaterThanOrEqual(18);
      const appearance = requireEquipmentAppearance(definition.appearanceId);
      expect(appearance.slot, definition.id).toBe(definition.slot);
      expect(requireAffectionEquipment(definition.id)).toBe(entry);
    }
  });

  it('四职业各十件的等级、解锁门槛与固定词条数值逐步成长', () => {
    for (const classId of AFFECTION_EQUIPMENT_CLASS_IDS) {
      const entries = affectionEquipmentForClass(classId);
      expect(entries).toHaveLength(10);
      for (const [index, entry] of entries.entries()) {
        expect(entry.collectionIndex, entry.definition.id).toBe(index);
        expect(
          entry.definition.fixedAffixes!.every((affix) => affix.value > 0),
          `${entry.definition.id} 存在无效固定词条`,
        ).toBe(true);
        if (index === 0) continue;
        expect(entry.definition.level, entry.definition.id).toBeGreaterThan(
          entries[index - 1]!.definition.level,
        );
        expect(entry.unlockPoints, entry.definition.id).toBeGreaterThan(
          entries[index - 1]!.unlockPoints,
        );
      }
    }
  });

  it('掉落池随好感与等级逐步开放，第一件从新手期就可获得', () => {
    for (const classId of AFFECTION_EQUIPMENT_CLASS_IDS) {
      expect(eligibleAffectionEquipmentIds(classId, 0, 1)).toEqual([
        affectionEquipmentForClass(classId)[0]!.definition.id,
      ]);
      expect(eligibleAffectionEquipmentIds(classId, 1_099, 99)).toHaveLength(9);
      expect(eligibleAffectionEquipmentIds(classId, 1_100, 99)).toHaveLength(10);
    }
    expect(() => eligibleAffectionEquipmentIds('witch', -1, 1)).toThrow('好感点数');
    expect(() => eligibleAffectionEquipmentIds('witch', 0, 0)).toThrow('玩家等级');
  });

  it('樱酱具备完整十件心虹珍藏并按进度开放', () => {
    const entries = affectionEquipmentForClass('kenshi');
    expect(entries).toHaveLength(10);
    expect(affectionEquipmentIdsForClass('kenshi')).toHaveLength(10);
    expect(eligibleAffectionEquipmentIds('kenshi', 1_100, 99)).toHaveLength(10);
    expect(new Set(entries.map((entry) => entry.definition.appearanceId)).size).toBe(10);
    for (const entry of entries) {
      const appearance = requireEquipmentAppearance(entry.definition.appearanceId);
      expect(appearance.renderMode, entry.definition.id).toBe(
        entry.definition.slot === 'body' ? 'replacement' : 'layer',
      );
    }
  });

  it('五十张运行时图标均存在、透明且尺寸统一', async () => {
    for (const entry of AFFECTION_EQUIPMENT_LIST) {
      const asset = entry.definition.icon;
      const assetPath = resolve('public', asset);
      expect(existsSync(assetPath), `${entry.definition.id} → ${asset}`).toBe(true);
      const { data, info } = await sharp(assetPath).ensureAlpha().raw().toBuffer({
        resolveWithObject: true,
      });
      expect(
        { width: info.width, height: info.height, channels: info.channels },
        entry.definition.id,
      ).toEqual({ width: 256, height: 256, channels: 4 });
      const cornerAlpha = [
        data[3],
        data[(info.width - 1) * info.channels + 3],
        data[(info.height - 1) * info.width * info.channels + 3],
        data[(info.height * info.width - 1) * info.channels + 3],
      ];
      expect(cornerAlpha, `${entry.definition.id} 四角透明`).toEqual([0, 0, 0, 0]);
    }
  });
});
