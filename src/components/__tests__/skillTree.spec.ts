// @vitest-environment jsdom
import { createApp, nextTick, type App } from 'vue';
import { createPinia } from 'pinia';
import { afterEach, describe, expect, it } from 'vitest';
import { createSave } from '@/save/schema';
import { skillsFor } from '@/data/skills';
import type { ClassId } from '@/core/types';
import { SKILL_BOOK_ITEM_ID } from '@/data/skillUpgradeRules';
import { useGameStore } from '@/stores/game';
import SkillTreePanel from '../SkillTreePanel.vue';

let app: App | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  app?.unmount();
  host?.remove();
  app = null;
  host = null;
});

function mountTree(options: { books?: number; gold?: number; classId?: ClassId } = {}) {
  host = document.createElement('div');
  document.body.appendChild(host);
  const pinia = createPinia();
  app = createApp(SkillTreePanel);
  app.use(pinia);
  const game = useGameStore(pinia);
  const save = createSave('技能树测试', options.classId ?? 'swordsman', 24, Date.now());
  save.player.level = 40;
  save.player.gold = options.gold ?? 100_000;
  save.bag.items[SKILL_BOOK_ITEM_ID] = options.books ?? 20;
  game.loadFrom(save);
  app.mount(host);
  return { game, element: host };
}

describe('技能树升级 UI', () => {
  it('列出当前职业全部 14 个技能，不因缺少演出定义漏项', () => {
    const { element } = mountTree();
    const skills = skillsFor('swordsman');
    expect(skills).toHaveLength(14);
    expect(element.querySelectorAll('.skill-node')).toHaveLength(skills.length);
    for (const skill of skills) expect(element.textContent).toContain(skill.name);
  });

  it('展开后显示当前级、下一档效果与真实成本，点击会完成升级', async () => {
    const { game, element } = mountTree();
    const skill = skillsFor('swordsman')[0]!;
    const firstButton = element.querySelector<HTMLButtonElement>('.skill-main')!;
    firstButton.click();
    await nextTick();

    expect(element.textContent).toContain('Lv1/20');
    expect(element.textContent).toContain('→');
    const upgrade = element.querySelector<HTMLButtonElement>('.upgrade-button')!;
    expect(upgrade.disabled).toBe(false);
    upgrade.click();
    await nextTick();

    expect(game.save!.player.skillLevels[skill.id]).toBe(2);
    expect(element.textContent).toContain(`${skill.name} 已提升到 Lv2`);
    expect(element.textContent).toContain('Lv2/20');
  });

  it('资源不足时明确显示原因并禁用按钮，不会产生假交互', async () => {
    const { game, element } = mountTree({ books: 0, gold: 0 });
    element.querySelector<HTMLButtonElement>('.skill-main')!.click();
    await nextTick();

    const upgrade = element.querySelector<HTMLButtonElement>('.upgrade-button')!;
    expect(upgrade.disabled).toBe(true);
    expect(upgrade.textContent).toContain('技能书不足');
    upgrade.click();
    expect(game.save!.player.skillLevels).toEqual({});
  });

  it('百分点不放大 100 倍，嵌套成长值按真实单位展示', async () => {
    const { element } = mountTree({ classId: 'shaman' });
    const concealment = Array.from(element.querySelectorAll<HTMLElement>('.skill-node')).find(
      (node) => node.textContent?.includes('隐身术'),
    )!;
    concealment.querySelector<HTMLButtonElement>('.skill-main')!.click();
    await nextTick();

    expect(concealment.textContent).toContain('闪避率 +10 → +10.2 个百分点');
    expect(concealment.textContent).not.toContain('1000%');
  });
});
