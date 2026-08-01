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
  equipmentDungeonStagesForSlot,
} from '../equipmentDungeons';
import { EQUIPMENT_DUNGEON_SETS } from '../equipmentDungeonSets';
import { requireEquipment } from '../equipment';
import {
  EQUIPMENT_DUNGEON_CORE_PITY,
  EQUIPMENT_DUNGEON_CRYSTAL_MAX,
  EQUIPMENT_DUNGEON_CRYSTAL_MIN,
  IMPRINT_CORE_ID,
  IMPRINT_CRYSTAL_IDS,
} from '../imprintRules';

describe('装备副本 88 件装备矩阵', () => {
  it('精确生成 88 件，ID、名称与五职业核心图标全部唯一', () => {
    expect(EQUIPMENT_DUNGEON_GEAR_LIST).toHaveLength(88);
    for (const field of ['id', 'name', 'icon'] as const) {
      const expectedUniqueCount = 88;
      expect(new Set(EQUIPMENT_DUNGEON_GEAR_LIST.map((item) => item[field])).size).toBe(
        expectedUniqueCount,
      );
    }
  });

  it('每档 22 件：5 职业武器 + 5 职业礼服 + 6 部位各 2 款', () => {
    for (const tier of EQUIPMENT_DUNGEON_TIERS) {
      const tierItems = EQUIPMENT_DUNGEON_GEAR_LIST.filter((item) => item.quality === tier.quality);
      expect(tierItems, tier.id).toHaveLength(22);
      expect(tierItems.filter((item) => item.slot === 'weapon')).toHaveLength(5);
      expect(tierItems.filter((item) => item.slot === 'body')).toHaveLength(5);
      for (const slot of SLOT_ORDER.filter(
        (candidate) => candidate !== 'weapon' && candidate !== 'body',
      )) {
        expect(
          tierItems.filter((item) => item.slot === slot),
          `${tier.id}/${slot}`,
        ).toHaveLength(2);
      }
    }
  });

  it('五职业在四档都能取得完整 8 槽，且不会混入其他职业专属件', () => {
    for (const tier of EQUIPMENT_DUNGEON_TIERS) {
      for (const classId of CLASS_IDS) {
        for (const slot of SLOT_ORDER) {
          const eligible = equipmentDungeonGearFor(tier.id, slot, classId);
          expect(eligible.length, `${tier.id}/${classId}/${slot}`).toBeGreaterThan(0);
          expect(
            eligible.every((item) => item.classId === undefined || item.classId === classId),
          ).toBe(true);
          expect(
            eligible.every((item) => item.slot === slot && item.quality === tier.quality),
          ).toBe(true);
        }
      }
    }
  });

  it('所有装备固定一条真实属性词条，其余词条仍由现有随机实例规则补齐', () => {
    for (const item of EQUIPMENT_DUNGEON_GEAR_LIST) {
      expect(item.fixedAffixes, item.id).toHaveLength(1);
      expect(item.fixedTemplate, item.id).not.toBe(true);
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

  it('8 件档只给称号与外观，一分战斗收益都不给（docs/58 §四）', () => {
    // 烙印让「集齐 8 件」变得容易 —— 任何主线装备都能烙成这一套。
    // 8 件若还给战斗加成，就是白送一级战力台阶，而且是能被反复领取的。
    // 所以战斗收益整条删掉，只留称号与徽记外观。
    //
    // 这条锁的是「后人顺手补一个 statPercent 回去」：`没配战斗字段` 和
    // `故意不配` 在代码里长得一样，必须靠 cosmeticOnly 显式声明 + 本测试守住。
    for (const set of Object.values(EQUIPMENT_DUNGEON_SETS)) {
      const eight = set.bonuses.find((bonus) => bonus.pieces === 8);
      expect(eight, `${set.id} 缺 8 件档`).toBeDefined();
      expect(eight!.cosmeticOnly, `${set.id} 8 件档必须显式声明纯外观`).toBe(true);
      expect(eight!.title, `${set.id} 8 件档必须有称号`).toBeTruthy();

      // 任何一种战斗收益都不许出现
      expect(eight!.statPercent).toBeUndefined();
      expect(eight!.statFlat).toBeUndefined();
      expect(eight!.combatBonuses).toBeUndefined();
      expect(eight!.onHitTriggers).toBeUndefined();
      expect(eight!.onLethalTriggers).toBeUndefined();
      expect(eight!.onCritTriggers).toBeUndefined();
      expect(eight!.skillMultiplierBonus).toBeUndefined();
    }
  });

  it('2/4/6 件档仍然给真实战斗收益 —— 降级的只有 8 件', () => {
    // 防止有人把「8 件不给收益」误读成「副本套装不再给收益」。
    for (const set of Object.values(EQUIPMENT_DUNGEON_SETS)) {
      for (const bonus of set.bonuses.filter((b) => b.pieces !== 8)) {
        const hasCombat =
          bonus.statPercent !== undefined ||
          bonus.statFlat !== undefined ||
          bonus.combatBonuses !== undefined ||
          bonus.onHitTriggers !== undefined ||
          bonus.onLethalTriggers !== undefined ||
          bonus.onCritTriggers !== undefined ||
          bonus.skillMultiplierBonus !== undefined;
        expect(hasCombat, `${set.id} ${bonus.pieces} 件档没有任何战斗收益`).toBe(true);
        expect(bonus.cosmeticOnly).toBeUndefined();
      }
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
      expect(stages.map((stage) => stage.quality)).toEqual(['rare', 'epic', 'legendary', 'mythic']);
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

  // ── 烙印重构后的掉落契约（docs/58 §3.3 / §七）──
  //
  // 副本从「第二条装备生产线」变成「主线装备的深度加工坊」：只掉烙印材料，
  // 一件装备都不掉。原来那条「掉落只含目标品质/部位/职业装备」的断言
  // 描述的正是被这次重构取代的设计，因此整条重写而不是修补。

  it('副本掉落表里一件装备都没有 —— 这是烙印重构的核心红线', () => {
    const gearIds = new Set(EQUIPMENT_DUNGEON_GEAR_LIST.map((item) => item.id));
    for (const stage of EQUIPMENT_DUNGEON_STAGE_LIST) {
      for (const entry of stage.lootTable.entries) {
        expect(gearIds.has(entry.itemId), `${stage.id} 掉落了装备 ${entry.itemId}`).toBe(false);
      }
    }
  });

  it('每档只掉该档烙印晶与通用星纹核，数量与保底锁死 docs/58 §3.2', () => {
    for (const stage of EQUIPMENT_DUNGEON_STAGE_LIST) {
      const byId = Object.fromEntries(stage.lootTable.entries.map((e) => [e.itemId, e]));
      const crystalId = IMPRINT_CRYSTAL_IDS[stage.tierId];

      // 该档的晶：正常掉落，2~3 个
      const crystal = byId[crystalId];
      expect(crystal, `${stage.id} 缺少 ${crystalId}`).toBeDefined();
      expect(crystal!.minCount).toBe(EQUIPMENT_DUNGEON_CRYSTAL_MIN);
      expect(crystal!.maxCount).toBe(EQUIPMENT_DUNGEON_CRYSTAL_MAX);
      expect(crystal!.weight).toBeGreaterThan(0);

      // 星纹核：只走保底，权重必须为 0，否则会额外白掉
      const core = byId[IMPRINT_CORE_ID];
      expect(core, `${stage.id} 缺少星纹核保底`).toBeDefined();
      expect(core!.weight).toBe(0);
      expect(core!.pityCount).toBe(EQUIPMENT_DUNGEON_CORE_PITY);

      // 不掉别的东西
      expect(Object.keys(byId).sort()).toEqual([crystalId, IMPRINT_CORE_ID].sort());
    }
  });

  it('星纹核排在权重条目之前 —— Rng.weighted 的浮点兜底会返回最后一项', () => {
    // rng.ts 的加权选择在浮点边界会回退到数组最后一项。权重 0 的保底条目
    // 若排在最后，理论上存在被兜底选中的路径。这条锁死顺序，防止后人调换。
    for (const stage of EQUIPMENT_DUNGEON_STAGE_LIST) {
      const last = stage.lootTable.entries[stage.lootTable.entries.length - 1]!;
      expect(last.weight, `${stage.id} 最后一个条目权重不能为 0`).toBeGreaterThan(0);
    }
  });

  it('材料掉落与职业无关 —— 旧设计按职业过滤后每门户只剩一个候选，毫无变量奖励', () => {
    for (const stage of EQUIPMENT_DUNGEON_STAGE_LIST) {
      for (const entry of stage.lootTable.entries) {
        expect(entry.classId, `${stage.id}/${entry.itemId} 不该带职业限制`).toBeUndefined();
      }
    }
  });

  it('旧副本装备定义全部保留注册，只是不再掉落（老档不能读不出来）', () => {
    // docs/58 §5.2：已掉落的旧副本整装可穿、可强化、可洗练，定义级 setId
    // 继续走原路径，UI 打「绝版」标。所以定义必须留着 —— 删定义 = 废存档。
    const highGear = EQUIPMENT_DUNGEON_GEAR_LIST.filter(
      (item) => item.quality === 'legendary' || item.quality === 'mythic',
    );
    expect(highGear).toHaveLength(44);
    for (const item of highGear) {
      expect(requireEquipment(item.id).id).toBe(item.id);
    }

    // 但它们一件都不该出现在任何掉落表里
    const dropIds = new Set(
      EQUIPMENT_DUNGEON_STAGE_LIST.flatMap((stage) =>
        stage.lootTable.entries.map((entry) => entry.itemId),
      ),
    );
    expect(highGear.some((item) => dropIds.has(item.id))).toBe(false);
  });

  it('8 张地图、16 个怪物与 88 个独立装备图标均达到运行规格', async () => {
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
    expect(icons).toHaveLength(88);

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
      expect({ width: info.width, height: info.height, channels: info.channels }, asset).toEqual({
        width: expectedSize,
        height: expectedSize,
        channels: 4,
      });
      expect(
        [
          data[3],
          data[(info.width - 1) * info.channels + 3],
          data[(info.height - 1) * info.width * info.channels + 3],
          data[(info.height * info.width - 1) * info.channels + 3],
        ],
        `${asset} 四角透明`,
      ).toEqual([0, 0, 0, 0]);
      expect(statSync(path).size, asset).toBeLessThanOrEqual((isMonster ? 140 : 120) * 1024);
    }
  });
});
