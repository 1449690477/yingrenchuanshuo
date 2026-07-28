import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '@/core/types';
import { SLOT_ORDER } from '../constants';
import {
  EQUIPMENT_DUNGEON_GEAR_LIST,
  EQUIPMENT_DUNGEON_TIERS,
  equipmentDungeonGearFor,
} from '../equipmentDungeonGear';
import {
  EQUIPMENT_DUNGEON_PORTALS,
  EQUIPMENT_DUNGEON_STAGE_LIST,
  equipmentDungeonDropsForClass,
  equipmentDungeonStagesForSlot,
} from '../equipmentDungeons';
import { EQUIPMENT_DUNGEON_SETS } from '../equipmentDungeonSets';

describe('装备副本 80 件装备矩阵', () => {
  it('精确生成 80 件且 ID、名称、图标路径各自唯一', () => {
    expect(EQUIPMENT_DUNGEON_GEAR_LIST).toHaveLength(80);
    for (const field of ['id', 'name', 'icon'] as const) {
      expect(new Set(EQUIPMENT_DUNGEON_GEAR_LIST.map((item) => item[field])).size).toBe(80);
    }
  });

  it('每档 20 件：4 职业武器 + 4 职业礼服 + 6 部位各 2 款', () => {
    for (const tier of EQUIPMENT_DUNGEON_TIERS) {
      const tierItems = EQUIPMENT_DUNGEON_GEAR_LIST.filter(
        (item) => item.quality === tier.quality,
      );
      expect(tierItems, tier.id).toHaveLength(20);
      expect(tierItems.filter((item) => item.slot === 'weapon')).toHaveLength(4);
      expect(tierItems.filter((item) => item.slot === 'body')).toHaveLength(4);
      for (const slot of SLOT_ORDER.filter(
        (candidate) => candidate !== 'weapon' && candidate !== 'body',
      )) {
        expect(tierItems.filter((item) => item.slot === slot), `${tier.id}/${slot}`).toHaveLength(
          2,
        );
      }
    }
  });

  it('四职业在四档都能取得完整 8 槽，且不会混入其他职业专属件', () => {
    for (const tier of EQUIPMENT_DUNGEON_TIERS) {
      for (const classId of CLASS_IDS) {
        for (const slot of SLOT_ORDER) {
          const eligible = equipmentDungeonGearFor(tier.id, slot, classId);
          expect(eligible.length, `${tier.id}/${classId}/${slot}`).toBeGreaterThan(0);
          expect(
            eligible.every((item) => item.classId === undefined || item.classId === classId),
          ).toBe(true);
          expect(eligible.every((item) => item.slot === slot && item.quality === tier.quality)).toBe(
            true,
          );
        }
      }
    }
  });

  it('所有装备固定一条真实属性词条，其余词条仍由现有随机实例规则补齐', () => {
    for (const item of EQUIPMENT_DUNGEON_GEAR_LIST) {
      expect(item.fixedAffixes, item.id).toHaveLength(1);
      expect(item.uniqueEffect, item.id).toMatch(/^专属视觉：/);
      expect(item.setId, item.id).toMatch(/^set_dungeon_/);
    }
  });

  it('四档套装均有 2/4/6/8 件真实结算节点', () => {
    expect(Object.values(EQUIPMENT_DUNGEON_SETS)).toHaveLength(4);
    for (const tier of EQUIPMENT_DUNGEON_TIERS) {
      const set = EQUIPMENT_DUNGEON_SETS[tier.setId];
      expect(set, tier.setId).toBeDefined();
      expect(set?.tierId).toBe(tier.id);
      expect(set?.bonuses.map((bonus) => bonus.pieces)).toEqual([2, 4, 6, 8]);
      expect(set?.bonuses.every((bonus) => bonus.description.length >= 5)).toBe(true);
    }
  });
});

describe('8 门户 × 4 档装备副本', () => {
  it('精确生成 8 个部位门户和 32 个关卡', () => {
    expect(EQUIPMENT_DUNGEON_PORTALS).toHaveLength(8);
    expect(new Set(EQUIPMENT_DUNGEON_PORTALS.map((portal) => portal.slot))).toEqual(
      new Set(SLOT_ORDER),
    );
    expect(EQUIPMENT_DUNGEON_STAGE_LIST).toHaveLength(32);
    for (const slot of SLOT_ORDER) {
      const stages = equipmentDungeonStagesForSlot(slot);
      expect(stages).toHaveLength(4);
      expect(stages.map((stage) => stage.quality)).toEqual([
        'rare',
        'epic',
        'legendary',
        'mythic',
      ]);
      expect(stages[0]?.previousStageId).toBeUndefined();
      expect(stages[1]?.previousStageId).toBe(stages[0]?.id);
      expect(stages[2]?.previousStageId).toBe(stages[1]?.id);
      expect(stages[3]?.previousStageId).toBe(stages[2]?.id);
    }
  });

  it('每关两波各有明确怪物、视觉、地图和推荐战力', () => {
    for (const stage of EQUIPMENT_DUNGEON_STAGE_LIST) {
      expect(stage.encounters).toHaveLength(2);
      expect(stage.encounters.map((entry) => entry.role)).toEqual(['minion', 'boss']);
      expect(stage.encounters.every((entry) => entry.asset.endsWith('.webp'))).toBe(true);
      expect(stage.mapAsset).toMatch(/^assets\/dungeons\/equipment\/.+-battle\.webp$/);
      expect(stage.recommendCP).toBeGreaterThan(0);
      expect(stage.unlockLevel).toBe(stage.level);
    }
  });

  it('掉落只含目标品质、目标部位和当前职业可用装备', () => {
    for (const stage of EQUIPMENT_DUNGEON_STAGE_LIST) {
      for (const classId of CLASS_IDS) {
        const ids = equipmentDungeonDropsForClass(stage, classId);
        expect(ids.length, `${stage.id}/${classId}`).toBeGreaterThan(0);
        const items = EQUIPMENT_DUNGEON_GEAR_LIST.filter((item) => ids.includes(item.id));
        expect(items).toHaveLength(ids.length);
        expect(
          items.every(
            (item) =>
              item.slot === stage.slot &&
              item.quality === stage.quality &&
              (item.classId === undefined || item.classId === classId),
          ),
        ).toBe(true);
      }
    }
  });

  it('全部橙装与红色典藏珍品都有明确直掉关卡', () => {
    const highGear = EQUIPMENT_DUNGEON_GEAR_LIST.filter(
      (item) => item.quality === 'legendary' || item.quality === 'mythic',
    );
    const dropIds = new Set(
      EQUIPMENT_DUNGEON_STAGE_LIST.flatMap((stage) =>
        stage.lootTable.entries.map((entry) => entry.itemId),
      ),
    );
    expect(highGear).toHaveLength(40);
    expect(highGear.every((item) => dropIds.has(item.id))).toBe(true);
  });

  it('8 张地图、16 个怪物与 80 个独立装备图标均达到运行规格', async () => {
    const maps = [...new Set(EQUIPMENT_DUNGEON_PORTALS.map((portal) => portal.mapAsset))];
    const monsters = [
      ...new Set(
        EQUIPMENT_DUNGEON_STAGE_LIST.flatMap((stage) =>
          stage.encounters.map((encounter) => encounter.asset),
        ),
      ),
    ];
    const icons = [...new Set(EQUIPMENT_DUNGEON_GEAR_LIST.map((item) => item.icon))];
    expect(maps).toHaveLength(8);
    expect(monsters).toHaveLength(16);
    expect(icons).toHaveLength(80);

    for (const asset of maps) {
      const path = resolve('public', asset);
      expect(existsSync(path), asset).toBe(true);
      const metadata = await sharp(path).metadata();
      expect(
        { width: metadata.width, height: metadata.height, format: metadata.format },
        asset,
      ).toEqual({ width: 1536, height: 1024, format: 'webp' });
      expect(statSync(path).size, asset).toBeLessThanOrEqual(520 * 1024);
    }

    for (const asset of [...monsters, ...icons]) {
      const isMonster = asset.includes('/monsters/');
      const expectedSize = isMonster ? 512 : 256;
      const path = resolve('public', asset);
      expect(existsSync(path), asset).toBe(true);
      const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({
        resolveWithObject: true,
      });
      expect(
        { width: info.width, height: info.height, channels: info.channels },
        asset,
      ).toEqual({ width: expectedSize, height: expectedSize, channels: 4 });
      expect(
        [
          data[3],
          data[(info.width - 1) * info.channels + 3],
          data[(info.height - 1) * info.width * info.channels + 3],
          data[(info.height * info.width - 1) * info.channels + 3],
        ],
        `${asset} 四角透明`,
      ).toEqual([0, 0, 0, 0]);
      expect(statSync(path).size, asset).toBeLessThanOrEqual(
        (isMonster ? 140 : 120) * 1024,
      );
    }
  });
});
