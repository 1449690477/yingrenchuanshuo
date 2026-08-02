// @vitest-environment jsdom
/**
 * 主动技能编成面板（M3-5b「配四栏」）的契约断言 + 挂载冒烟。
 *
 * 钉死的核心只有一条，其余都是围着它的保险：
 * **「没编排过」与「明确清空」在界面上必须是两个能看出区别的状态。**
 *
 * 存档层特意把它们存成了两件事（`player.activeSkillIds` 不存在 vs `[]`），
 * 目的是让老玩家行为逐字不变、同时让新玩家能真的清空。**只要 UI 把这两个
 * 状态显示成同一句话，那层区分就白做了** —— 玩家清空后会以为自己没改过，
 * 然后困惑于为什么上场不放技能，而这种困惑不会产生任何报错。
 */

import { createApp, h, type App } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ACTIVE_SKILL_SLOTS,
  resolveActiveSkillSlots,
  selectableActiveSkillIds,
} from '@/core/skillSlots';
import { CLASS_IDS, type ClassId } from '@/core/types';
import { skillsFor } from '@/data/skills';
import SkillLoadoutPanel from '../SkillLoadoutPanel.vue';

let app: App | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  app?.unmount();
  app = null;
  host?.remove();
  host = null;
});

/** 取一个真的有主动技可选的等级；写死等级会在数据调整后悄悄失效。 */
function levelWithActives(classId: ClassId): number {
  for (let level = 1; level <= 120; level += 1) {
    if (selectableActiveSkillIds(classId, level).length > 0) return level;
  }
  throw new Error(`${classId} 在 1~120 级都没有可选主动技，测试前提不成立`);
}

function mountPanel(options: {
  classId: ClassId;
  level: number;
  modelValue?: readonly string[];
  onUpdate?: (value: string[] | undefined) => void;
}): HTMLElement {
  host = document.createElement('div');
  document.body.appendChild(host);
  app = createApp({
    render: () =>
      h(SkillLoadoutPanel, {
        classId: options.classId,
        level: options.level,
        modelValue: options.modelValue,
        'onUpdate:modelValue': options.onUpdate,
      }),
  });
  app.mount(host);
  return host;
}

describe('技能编成面板 · 三个状态必须分得开', () => {
  const CLASS: ClassId = 'swordsman';

  it('★ 「没编排过」与「明确清空」显示的不是同一句话', () => {
    const level = levelWithActives(CLASS);

    const neverChose = mountPanel({ classId: CLASS, level }).textContent ?? '';
    app?.unmount();
    host?.remove();

    const cleared = mountPanel({ classId: CLASS, level, modelValue: [] }).textContent ?? '';

    expect(
      neverChose,
      '「没编排过」没有显示「跟随默认」，玩家看不出自己正在用默认编成',
    ).toContain('跟随默认');
    expect(cleared, '「明确清空」没有显示「已清空」').toContain('已清空');
    expect(
      cleared.includes('跟随默认'),
      '清空后仍显示「跟随默认」—— 存档层区分的两个状态在界面上被合并了',
    ).toBe(false);
  });

  it('未编排时四个栏位显示的就是职业默认编成', () => {
    const level = levelWithActives(CLASS);
    const el = mountPanel({ classId: CLASS, level });
    const expected = resolveActiveSkillSlots(CLASS, level, undefined);

    expect(expected.selected.length, '默认编成是空的，这条断言会退化成空对空').toBeGreaterThan(0);
    const byId = new Map(skillsFor(CLASS).map((skill) => [skill.id, skill]));
    for (const skillId of expected.selected) {
      expect(el.textContent ?? '').toContain(byId.get(skillId)?.name ?? skillId);
    }
  });

  it('清空后栏位全空，且不再显示任何已上阵技能', () => {
    const level = levelWithActives(CLASS);
    const el = mountPanel({ classId: CLASS, level, modelValue: [] });
    const emptySlots = el.querySelectorAll('.slot.empty');
    expect(emptySlots.length).toBe(ACTIVE_SKILL_SLOTS);
  });

  it('★ 「恢复默认」发出的是 undefined，不是把默认技能再排一遍', () => {
    const level = levelWithActives(CLASS);
    const seen: Array<string[] | undefined> = [];
    const el = mountPanel({
      classId: CLASS,
      level,
      modelValue: [],
      onUpdate: (value) => seen.push(value),
    });

    const restore = [...el.querySelectorAll('button.act')].find((button) =>
      (button.textContent ?? '').includes('恢复默认'),
    ) as HTMLButtonElement | undefined;
    expect(restore, '找不到「恢复默认」按钮').toBeTruthy();
    restore!.click();

    expect(seen.length).toBe(1);
    expect(
      seen[0],
      '恢复默认发出了一个数组。那是「自定义成默认的样子」，日后不会再跟随默认表；' +
        '要恢复的是「没编排过」这个状态本身。',
    ).toBeUndefined();
  });

  it('未编排时点一个技能会固化当前编成，而不是只发出这一个技能', () => {
    const level = levelWithActives(CLASS);
    const seen: Array<string[] | undefined> = [];
    const el = mountPanel({ classId: CLASS, level, onUpdate: (value) => seen.push(value) });
    const base = resolveActiveSkillSlots(CLASS, level, undefined).selected;

    const equipped = el.querySelector('button.pick.on') as HTMLButtonElement | null;
    expect(equipped, '默认编成里的技能没有显示成已上阵').toBeTruthy();
    equipped!.click();

    expect(seen.length).toBe(1);
    // 点的是「已上阵」的那个 ⇒ 移出；其余默认技能必须保留下来
    expect(seen[0]).toHaveLength(Math.max(0, base.length - 1));
  });

  it('栏位满了以后未上阵的技能不可再点 —— 溢出应当在点之前就被挡住', () => {
    const level = 120;
    const pool = selectableActiveSkillIds(CLASS, level);
    if (pool.length <= ACTIVE_SKILL_SLOTS) return; // 可选技能还不够多，这条不适用
    const full = pool.slice(0, ACTIVE_SKILL_SLOTS);
    const el = mountPanel({ classId: CLASS, level, modelValue: full });
    const offButtons = [...el.querySelectorAll('button.pick:not(.on)')] as HTMLButtonElement[];
    expect(offButtons.length).toBeGreaterThan(0);
    for (const button of offButtons) expect(button.disabled).toBe(true);
  });
});

describe('技能编成面板 · 每个职业都能用', () => {
  it('五职业都有可选主动技，且都能挂载出四个栏位', () => {
    expect(CLASS_IDS.length).toBeGreaterThan(0);
    for (const classId of CLASS_IDS) {
      const level = levelWithActives(classId);
      const el = mountPanel({ classId, level });
      expect(el.querySelectorAll('.slot').length, `${classId} 没渲染出栏位`).toBe(
        ACTIVE_SKILL_SLOTS,
      );
      app?.unmount();
      host?.remove();
      app = null;
      host = null;
    }
  });

  /**
   * ⚠ 别把这条写成「可选 id 都能在 skillsFor 里找到」：`selectableActiveSkillIds`
   * 本来就是从 `skillsFor` 派生的，那样断言**恒成立**，是一条永远绿的空测试。
   * （第一版正是这么写的——最初拿 `visualSkillsFor` 比时它是有意义的，
   * 换数据源之后就退化成了同义反复。）
   * 真正要保证的是**面板渲染需要的那几个字段都在**：缺 name 会显示空白，
   * 缺 icon 会渲染出裂图，缺 desc 会让整行只剩一个名字。
   */
  it('可选主动技的展示字段必须齐全 —— 缺了会显示空白或裂图', () => {
    for (const classId of CLASS_IDS) {
      const byId = new Map(skillsFor(classId).map((skill) => [skill.id, skill]));
      const ids = selectableActiveSkillIds(classId, 120);
      expect(ids.length, `${classId} 在 120 级都没有可选主动技`).toBeGreaterThan(0);
      for (const id of ids) {
        const skill = byId.get(id)!;
        expect(skill.name?.length ?? 0, `${classId} 的 ${id} 没有名字`).toBeGreaterThan(0);
        expect(skill.icon?.length ?? 0, `${classId} 的 ${id} 没有图标路径`).toBeGreaterThan(0);
        expect(skill.desc?.length ?? 0, `${classId} 的 ${id} 没有描述`).toBeGreaterThan(0);
      }
    }
  });
});
