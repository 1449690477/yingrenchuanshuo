import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * M5-5 套装图鉴（套装预览页：已集齐 / 缺哪件 / 从哪掉）契约测试。
 *
 * 口径纪律：图鉴是只读装配层，套装数值一律引用 data 权威表（equipmentSets /
 * equipmentSetCrafting / equipmentDungeonGear / arenaEquipment），本测试锁定
 * 「图鉴不得复制数值、不得写死套数与成本」这条红线 —— 新增套装时图鉴必须
 * 自动收录，这些断言应当随之自然更新而不是被改写。
 */

import { CLASS_IDS, type EquipmentInstance } from '@/core/types';
import { EQUIPMENT, getEquipment } from '@/data/equipment';
import { getEquipmentSet } from '@/data/equipmentSets';
import { EQUIPMENT_SET_CRAFTING_RECIPES } from '@/data/equipmentSetCrafting';
import {
  equipmentDungeonGearFor,
  requireEquipmentDungeonTier,
} from '@/data/equipmentDungeonGear';
import { EQUIPMENT_DUNGEON_SETS } from '@/data/equipmentDungeonSets';
import { ARENA_SET_ID } from '@/data/arenaEquipment';
import { requireItem } from '@/data/items';
import { REGION_7_COMPLETION_BADGE, REGION_7_COMPLETION_TITLE } from '@/data/region7';
import { IMPRINT_BATCH_ACTIVE } from '@/ui/imprintActivation';
import {
  buildSetCodex,
  SET_CODEX_GROUP_LABELS,
  setProgressFor,
  type SetCodexEntry,
  type SetCollectionInput,
} from '../setCodex/setCodexData';

const moreViewSource = readFileSync(new URL('../../views/MoreView.vue', import.meta.url), 'utf8');
const bagViewSource = readFileSync(new URL('../../views/BagView.vue', import.meta.url), 'utf8');
const codexViewSource = readFileSync(new URL('../../views/SetCodexView.vue', import.meta.url), 'utf8');
const codexCardSource = readFileSync(
  new URL('../setCodex/SetCodexCard.vue', import.meta.url),
  'utf8',
);

function entryOf(entries: SetCodexEntry[], setId: string): SetCodexEntry {
  const entry = entries.find((candidate) => candidate.setId === setId);
  if (!entry) throw new Error(`图鉴缺少套装：${setId}`);
  return entry;
}

function emptyInput(): SetCollectionInput {
  return { bagEquipment: [], equipped: [], bagItems: {} };
}

describe('套装图鉴装配（buildSetCodex）', () => {
  it('收录全部套装：3 区域 + 4 副本 + 1 竞技场，分组顺序固定', () => {
    for (const classId of CLASS_IDS) {
      const entries = buildSetCodex(classId);
      const expectedGroups = [
        'region',
        'region',
        'region',
        'dungeon',
        'dungeon',
        'dungeon',
        'dungeon',
        ...(classId === 'kenshi' ? [] : ['arena']),
      ];
      expect(entries.map((entry) => entry.group)).toEqual(expectedGroups);
      expect(new Set(entries.map((entry) => entry.setId)).size).toBe(entries.length);
    }
  });

  it('每套的图鉴部位与权威定义逐槽一致，不写死件数', () => {
    const entries = buildSetCodex('swordsman');
    for (const entry of entries) {
      const definition = getEquipmentSet(entry.setId);
      expect(definition, `套装 ${entry.setId} 必须在总表登记`).toBeTruthy();
      expect(entry.pieces.map((piece) => piece.slot)).toEqual([...definition!.pieceSlots]);
      expect(entry.bonuses.length).toBe(definition!.bonuses.length);
      expect(entry.bonuses.map((bonus) => bonus.pieces)).toEqual(
        definition!.bonuses.map((bonus) => bonus.pieces),
      );
    }
  });

  it('区域套的碎片与成本直接来自合成配方表（零手填）', () => {
    const entries = buildSetCodex('swordsman').filter((entry) => entry.group === 'region');
    expect(entries.length).toBe(3);
    const recipes = Object.values(EQUIPMENT_SET_CRAFTING_RECIPES);
    for (const entry of entries) {
      const recipe = recipes.find((candidate) => candidate.setId === entry.setId);
      expect(recipe, `区域套 ${entry.setId} 必须有合成配方`).toBeTruthy();
      expect(entry.craft).not.toBeNull();
      expect(entry.craft!.fragmentItemId).toBe(recipe!.fragmentItemId);
      expect(entry.craft!.cost).toBe(recipe!.fragmentCount);
      expect(entry.craft!.fragmentName).toBe(requireItem(recipe!.fragmentItemId).name);
      // 每个槽位的代表装备就是配方目标装备本身
      for (const piece of entry.pieces) {
        expect(piece.def.id).toBe(recipe!.targetDefIds[piece.slot]);
        expect(piece.altDefIds).toEqual([recipe!.targetDefIds[piece.slot]]);
      }
    }
  });

  it('副本套的来源文案与绝版标是同一个开关的两面，两种状态都不写死档位数值', () => {
    // 原来这里有一条 expect(IMPRINT_BATCH_ACTIVE).toBe(false) 的哨兵，
    // 烙印激活批次落地时它如约报警了。改成断言「开关与文案的对应关系」而不是
    // 断言开关当前的值 —— 后者每翻一次开关就要来改一次，而关系断言两个方向都守得住。
    const entries = buildSetCodex('swordsman').filter((entry) => entry.group === 'dungeon');
    expect(entries.length).toBe(Object.keys(EQUIPMENT_DUNGEON_SETS).length);
    for (const entry of entries) {
      const tier = requireEquipmentDungeonTier(
        EQUIPMENT_DUNGEON_SETS[entry.setId]!.tierId,
      );
      expect(entry.subtitle).toContain(tier.name);
      expect(entry.legacy).toBe(IMPRINT_BATCH_ACTIVE);

      const source = entry.sourceLines.join('');
      if (IMPRINT_BATCH_ACTIVE) {
        // 激活后整装不再产出：不能再对玩家说「通关掉落」，
        // 也不该再提解锁等级 —— 那会把人骗去刷一个已经不掉整装的副本
        expect(source).toContain('绝版');
        expect(source).not.toContain(String(tier.unlockLevel));
      } else {
        // 未激活时解锁等级必须取自档位表而不是写死在图鉴里
        expect(source).toContain(String(tier.unlockLevel));
      }
    }
  });

  it('副本套部位展示：职业装取当前职业，共享槽收齐全部变体', () => {
    const entries = buildSetCodex('witch').filter((entry) => entry.group === 'dungeon');
    for (const entry of entries) {
      const tierId = EQUIPMENT_DUNGEON_SETS[entry.setId]!.tierId;
      for (const piece of entry.pieces) {
        const expected =
          piece.slot === 'weapon' || piece.slot === 'body'
            ? equipmentDungeonGearFor(tierId, piece.slot, 'witch')
            : equipmentDungeonGearFor(tierId, piece.slot);
        expect(piece.altDefIds).toEqual(expected.map((def) => def.id));
        expect(piece.def.id).toBe(expected[0]!.id);
      }
    }
  });

  it('血月套带称号与徽记，其余套装不带', () => {
    const entries = buildSetCodex('catkin');
    const bloodmoon = entryOf(entries, 'set_region_bloodmoon');
    expect(bloodmoon.completionTitle).toBe(REGION_7_COMPLETION_TITLE);
    expect(bloodmoon.completionBadge).toBe(REGION_7_COMPLETION_BADGE);
    for (const entry of entries) {
      if (entry.setId !== 'set_region_bloodmoon') {
        expect(entry.completionTitle).toBeNull();
        expect(entry.completionBadge).toBeNull();
      }
    }
  });

  it('圣痕套标注仅竞技场生效，部位按当前职业出四件', () => {
    for (const classId of CLASS_IDS.filter((id) => id !== 'kenshi')) {
      const arena = entryOf(buildSetCodex(classId), ARENA_SET_ID);
      expect(arena.group).toBe('arena');
      expect(arena.arenaOnly).toBe(true);
      expect(arena.pieces.length).toBe(4);
      expect(arena.pieces.every((piece) => piece.def.classId === classId)).toBe(true);
      expect(arena.sourceLines.join('')).toContain('荣誉商店');
      expect(arena.sourceLines.join('')).toContain('只在竞技场');
    }
    expect(buildSetCodex('kenshi').some((entry) => entry.setId === ARENA_SET_ID)).toBe(false);
  });

  it('分组标签覆盖全部组且无遗漏', () => {
    expect(Object.keys(SET_CODEX_GROUP_LABELS).sort()).toEqual(['arena', 'dungeon', 'region']);
  });
});

describe('套装收集进度（setProgressFor）', () => {
  const entries = buildSetCodex('swordsman');
  const crimson = entryOf(entries, 'set_region_crimson');
  const azure = entryOf(entries, 'set_dungeon_azure');

  it('拥有任一即点亮槽位：区域套按配方目标判定', () => {
    const owned = crimson.pieces.slice(0, 2).map((piece) => ({ defId: piece.def.id }));
    const progress = setProgressFor(crimson, { ...emptyInput(), bagEquipment: owned });
    expect(progress.ownedPieces).toBe(2);
    expect(progress.totalPieces).toBe(6);
    expect(progress.complete).toBe(false);
  });

  it('集齐整套返回 complete', () => {
    const owned = crimson.pieces.map((piece) => ({ defId: piece.def.id }));
    const progress = setProgressFor(crimson, { ...emptyInput(), bagEquipment: owned });
    expect(progress.ownedPieces).toBe(6);
    expect(progress.complete).toBe(true);
  });

  it('副本共享槽：拥有任意一个变体即点亮', () => {
    const ring = azure.pieces.find((piece) => piece.slot === 'ring')!;
    expect(ring.altDefIds.length).toBeGreaterThan(1);
    const variantTwo = ring.altDefIds[1]!;
    const progress = setProgressFor(azure, {
      ...emptyInput(),
      bagEquipment: [{ defId: variantTwo }],
    });
    expect(progress.ownedPieces).toBe(1);
  });

  it('职业槽只认当前职业的定义：别职业的同槽装备不计入', () => {
    const witchWeapon = equipmentDungeonGearFor('azure', 'weapon', 'witch')[0]!;
    const progress = setProgressFor(azure, {
      ...emptyInput(),
      bagEquipment: [{ defId: witchWeapon.id }],
    });
    expect(progress.ownedPieces).toBe(0);
  });

  it('穿戴中的装备同时计入拥有与套装件数', () => {
    const target = crimson.pieces[0]!.def;
    const equipped = [{ defId: target.id, imprintSetId: undefined }];
    const progress = setProgressFor(crimson, { ...emptyInput(), equipped });
    expect(progress.ownedPieces).toBe(1);
    expect(progress.equippedPieces).toBe(1);
  });

  it('烙印优先于定义：普通装备烙上套装后计入穿戴件数（与 core resolver 同口径）', () => {
    const plain = Object.values(EQUIPMENT).find((def) => !def.setId && def.slot === 'head');
    expect(plain, '需要一件无套装头盔作为烙印画布').toBeTruthy();
    const stamped: Pick<EquipmentInstance, 'defId' | 'imprintSetId'> = {
      defId: plain!.id,
      imprintSetId: 'set_region_crimson',
    };
    const progress = setProgressFor(crimson, { ...emptyInput(), equipped: [stamped] });
    expect(progress.equippedPieces).toBe(1);
    // 但「收集」只认真正的套装件：烙印件不点亮图鉴槽位
    expect(progress.ownedPieces).toBe(0);
  });

  it('碎片计数来自背包物品，非区域套恒为 null', () => {
    const withFrags = setProgressFor(crimson, {
      ...emptyInput(),
      bagItems: { [crimson.craft!.fragmentItemId]: 47 },
    });
    expect(withFrags.fragmentCount).toBe(47);
    expect(setProgressFor(crimson, emptyInput()).fragmentCount).toBe(0);
    expect(setProgressFor(azure, emptyInput()).fragmentCount).toBeNull();
  });

  it('穿戴引用不存在的装备定义时按配置错误抛出', () => {
    expect(() =>
      setProgressFor(crimson, {
        ...emptyInput(),
        equipped: [{ defId: 'eq_not_exists', imprintSetId: undefined }],
      }),
    ).toThrow('[配置错误]');
    expect(getEquipment('eq_not_exists')).toBeUndefined();
  });
});

describe('套装图鉴入口接线（源码契约）', () => {
  it('MoreView 挂载图鉴页并提供入口按钮', () => {
    expect(moreViewSource).toContain("import SetCodexView from '@/views/SetCodexView.vue'");
    expect(moreViewSource).toContain('aria-label="进入套装图鉴"');
    expect(moreViewSource).toContain('<SetCodexView v-if="showCodex" @close="closeCodex" />');
    // 与珍品店 / 公会一致的 inert 幕后处理
    expect(moreViewSource).toContain('showCodex || codexLeaving');
  });

  it('BagView 套装合成区提供「全部套装」入口并挂载图鉴页', () => {
    expect(bagViewSource).toContain("import SetCodexView from '@/views/SetCodexView.vue'");
    expect(bagViewSource).toContain('class="atlas-all"');
    expect(bagViewSource).toContain('<SetCodexView v-if="showCodex" @close="closeCodex" />');
  });
});

/**
 * 口径诚实性红线（存档 v17 起）。
 *
 * 历史：账本落地之前，这一页只能按背包推导拥有关系，于是分解一件装备
 * 进度就会倒退（docs/40 红线）。当时的处置是把文案改成「当前持有」并
 * 加一条测试钉住它，同时写明「账本落地后应当连同文案一起升级，
 * 而不是把断言悄悄删掉」。现在账本落地了，这几条就是那次约定的兑现。
 */
describe('图鉴口径诚实性', () => {
  it('总览用「已收集」，并说明分解不会抹掉记录', () => {
    expect(codexViewSource).toContain('已收集');
    expect(codexViewSource).toContain('分解不会抹掉收集记录');
    // 账本从迁移当天开始记录，这个限制必须对玩家讲清楚，不能含糊
    expect(codexViewSource).toContain('此前已分解的装备无法追溯');
  });

  it('部位无障碍文案同样是收集口径', () => {
    expect(codexCardSource).toContain('已收集');
    expect(codexCardSource).toContain('未收集');
  });

  it('拥有关系确实取自永久账本，而不是只看背包', () => {
    // 这条防的是「文案改成已收集、实现却还在按背包推」——
    // 那种组合比之前更坏：话说满了，行为却照样倒退。
    expect(codexViewSource).toContain('inventory.discoveredDefIds');

    const entry = entryOf(buildSetCodex('swordsman'), 'set_region_crimson');
    const piece = entry.pieces[0]!;
    // 背包与穿戴全空，只有账本里有这件 —— 也必须算收集过
    const progress = setProgressFor(entry, {
      ...emptyInput(),
      discoveredDefIds: [piece.def.id],
    });
    expect(progress.ownedPieces).toBe(1);
  });

  it('账本缺省时退化成只看背包，老档与迁移中途都不会更差', () => {
    const entry = entryOf(buildSetCodex('swordsman'), 'set_region_crimson');
    const piece = entry.pieces[0]!;
    const progress = setProgressFor(entry, {
      ...emptyInput(),
      bagEquipment: [{ defId: piece.def.id }],
    });
    expect(progress.ownedPieces).toBe(1);
  });
});
