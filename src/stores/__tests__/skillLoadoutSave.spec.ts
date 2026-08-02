/**
 * 技能编成落盘（M3-5b 接线的验收）。
 *
 * 面板本身的三态渲染由 `components/__tests__/skillLoadout.spec.ts` 守；
 * 这里守的是**另一半**：玩家在界面上做的编排，**真的写进了存档**，
 * 而且 `undefined`（没编排过）与 `[]`（明确清空）**在存档里仍然是两件事**。
 *
 * 只验其中一半是这条链最容易出的错：面板显示得完全正确、玩家以为改好了，
 * 而存档里什么都没变 —— **没有任何报错，下次打开原样退回默认编成**。
 */

import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearSave } from '@/save/storage';
import { createSave } from '@/save/schema';
import { resolveActiveSkillSlots, selectableActiveSkillIds } from '@/core/skillSlots';
import { useGameStore } from '../game';

const NOW = Date.parse('2026-08-02T12:00:00+08:00');

beforeEach(async () => {
  setActivePinia(createPinia());
  await clearSave();
});

afterEach(async () => {
  await clearSave();
});

function loadedGame(level = 60) {
  const game = useGameStore();
  const save = createSave('夜见', 'swordsman', 42, NOW - 100_000);
  save.player.level = level;
  game.loadFrom(save);
  return game;
}

describe('技能编成写回存档', () => {
  it('新档一开始是「没编排过」—— 字段不存在，不是空数组', () => {
    const game = loadedGame();
    expect(Object.hasOwn(game.save!.player, 'activeSkillIds')).toBe(false);
  });

  it('★ 玩家排定的编成逐项写进存档', () => {
    const game = loadedGame();
    const picked = selectableActiveSkillIds('swordsman', 60).slice(0, 2);
    expect(picked.length, '测试前提：剑姬 Lv60 应有至少两个可选主动技').toBe(2);

    expect(game.setActiveSkillIds(picked)).toBe(true);
    expect(game.save!.player.activeSkillIds).toEqual(picked);
  });

  it('★ 「明确清空」写的是空数组，且能被判定层识别成「不带主动技」', () => {
    const game = loadedGame();
    game.setActiveSkillIds([]);

    expect(game.save!.player.activeSkillIds).toEqual([]);
    const resolved = resolveActiveSkillSlots('swordsman', 60, game.save!.player.activeSkillIds);
    expect(resolved.usedDefault, '空数组被当成了「没编排过」').toBe(false);
    expect(resolved.selected).toEqual([]);
  });

  it('★ 「恢复默认」把字段删掉，而不是写成空数组或写死当天的默认表', () => {
    const game = loadedGame();
    game.setActiveSkillIds([]);
    expect(Object.hasOwn(game.save!.player, 'activeSkillIds')).toBe(true);

    game.setActiveSkillIds(undefined);

    // 字段必须真的不存在：写成 [] 会变成「明确清空」，
    // 写成默认技能列表会把玩家钉死在今天的默认表上，升级解锁的新技能不再自动进栏。
    expect(
      Object.hasOwn(game.save!.player, 'activeSkillIds'),
      '恢复默认之后字段还在 —— 那不是「没编排过」，日后不会再跟随默认表',
    ).toBe(false);

    const resolved = resolveActiveSkillSlots('swordsman', 60, game.save!.player.activeSkillIds);
    expect(resolved.usedDefault).toBe(true);
    expect(resolved.selected.length).toBeGreaterThan(0);
  });

  it('写入的是副本 —— 面板后续改自己的数组不该悄悄改到存档', () => {
    const game = loadedGame();
    const draft = selectableActiveSkillIds('swordsman', 60).slice(0, 2);
    game.setActiveSkillIds(draft);
    draft.length = 0;
    expect(game.save!.player.activeSkillIds).toHaveLength(2);
  });

  it('没有存档时不写、不抛，返回 false', () => {
    const game = useGameStore();
    expect(game.setActiveSkillIds(['x'])).toBe(false);
  });
});
