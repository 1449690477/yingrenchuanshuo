import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearSave, loadSave } from '@/save/storage';
import { createSave } from '@/save/schema';
import { skillsFor } from '@/data/skills';
import { SKILL_BOOK_ITEM_ID } from '@/data/skillUpgradeRules';
import { useGameStore } from '../game';

const NOW = Date.parse('2026-08-02T12:00:00+08:00');

beforeEach(async () => {
  setActivePinia(createPinia());
  await clearSave();
});

afterEach(async () => {
  await clearSave();
});

function loadedGame() {
  const game = useGameStore();
  const save = createSave('研习剑姬', 'swordsman', 2424, NOW);
  save.player.level = 40;
  save.player.gold = 100_000;
  save.bag.items[SKILL_BOOK_ITEM_ID] = 20;
  game.loadFrom(save);
  return game;
}

describe('技能升级 store 与存档闭环', () => {
  it('成功升级会同时扣书、扣金币、改变真实战斗技能等级并落盘', async () => {
    const game = loadedGame();
    const skillId = game.playerSkillKit!.active[0]!.skill.id;
    const skill = skillsFor('swordsman').find((entry) => entry.id === skillId)!;
    const quote = game.assessSkillUpgradeById(skill.id)!;
    const beforeGold = game.save!.player.gold;
    const beforeBooks = game.save!.bag.items[SKILL_BOOK_ITEM_ID]!;

    const result = game.upgradeSkill(skill.id);

    expect(result).toEqual({ ok: true, assessment: quote });
    expect(game.save!.player.skillLevels[skill.id]).toBe(2);
    expect(game.save!.player.gold).toBe(beforeGold - quote.cost.gold);
    expect(game.save!.bag.items[SKILL_BOOK_ITEM_ID]).toBe(beforeBooks - quote.cost.books);
    expect(game.playerSkillKit!.active.find((entry) => entry.skill.id === skill.id)?.level).toBe(2);

    await game.persist();
    expect((await loadSave())?.player.skillLevels[skill.id]).toBe(2);
  });

  it('到上限或资源不足时整份资产保持不变', () => {
    const game = loadedGame();
    const skill = skillsFor('swordsman').find((entry) => entry.unlockLevel <= 40)!;
    game.save!.player.skillLevels[skill.id] = 20;
    const atCap = JSON.parse(JSON.stringify(game.save!));
    expect(game.upgradeSkill(skill.id)).toMatchObject({ ok: false, reason: 'level-cap' });
    expect(game.save).toEqual(atCap);

    game.save!.player.skillLevels[skill.id] = 1;
    game.save!.bag.items[SKILL_BOOK_ITEM_ID] = 0;
    const poor = JSON.parse(JSON.stringify(game.save!));
    expect(game.upgradeSkill(skill.id)).toMatchObject({
      ok: false,
      reason: 'insufficient-books',
    });
    expect(game.save).toEqual(poor);
  });

  it('当前职业之外的技能 id 不能通过 store 升级', () => {
    const game = loadedGame();
    const foreign = skillsFor('witch')[0]!;
    expect(game.upgradeSkill(foreign.id)).toEqual({ ok: false, reason: 'unknown-skill' });
  });
});
