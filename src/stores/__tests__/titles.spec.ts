import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TITLES } from '@/data/titles';
import { createSave } from '@/save/schema';
import { clearSave, loadSave } from '@/save/storage';
import { useGameStore } from '../game';
import { useTitleStore } from '../titles';

beforeEach(async () => {
  setActivePinia(createPinia());
  await clearSave();
});

afterEach(async () => {
  await clearSave();
});

function unlockedSave() {
  const save = createSave('称号测试', 'swordsman', 20260804, Date.now());
  save.stats.totalKills = 20_000; // slayer_10k 解锁，slayer_100k 未解锁
  return save;
}

describe('title store 装备位（M4-9 equippedTitleId）', () => {
  it('装备已解锁称号：写入存档并持久化，equippedTitle 解析出定义', async () => {
    const game = useGameStore();
    game.loadFrom(unlockedSave());
    const titles = useTitleStore();
    expect(titles.equippedTitleId).toBeNull();

    expect(titles.equip('slayer_10k')).toBe(true);
    expect(game.save!.equippedTitleId).toBe('slayer_10k');
    expect(titles.equippedTitle?.name).toBe(
      TITLES.find((title) => title.id === 'slayer_10k')!.name,
    );

    await game.persist();
    expect((await loadSave())?.equippedTitleId).toBe('slayer_10k');
  });

  it('拒绝装备未解锁 / 未知称号，存档装备位不变', () => {
    const game = useGameStore();
    game.loadFrom(unlockedSave());
    const titles = useTitleStore();

    expect(titles.equip('legend_80')).toBe(false);
    expect(titles.equip('no_such_title')).toBe(false);
    expect(game.save!.equippedTitleId).toBeNull();
  });

  it('卸下称号：置 null 并持久化；重复装备同款仍可（纯展示身份）', async () => {
    const game = useGameStore();
    const save = unlockedSave();
    save.equippedTitleId = 'slayer_10k';
    game.loadFrom(save);
    const titles = useTitleStore();

    expect(titles.equip('slayer_10k')).toBe(true);
    expect(titles.unequip()).toBe(true);
    expect(game.save!.equippedTitleId).toBeNull();

    await game.persist();
    expect((await loadSave())?.equippedTitleId).toBeNull();
  });

  it('无存档时装备 / 卸下都返回 false', () => {
    const titles = useTitleStore();
    expect(titles.equip('slayer_10k')).toBe(false);
    expect(titles.unequip()).toBe(false);
  });
});
