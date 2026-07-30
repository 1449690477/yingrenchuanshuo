// @vitest-environment jsdom
/**
 * 羁绊榜组件的挂载冒烟测试（jsdom，不打真实网络）。
 *
 * 验证 docs/63 §三 的展示红线真的落在渲染结果里：
 *   - 你的陪伴卡：心意总值是四角色之和，强调「相伴了多少次」
 *   - 未配置 Supabase 时静默降级为单机横幅，不报错不白屏
 *   - 榜单行只出现总分，没有单角色字段、没有查看他人入口
 *   - 减弱动效开关一开，粒子整个不渲染（不是只停动画）
 */

import 'fake-indexeddb/auto';
import { createApp, h, nextTick, type App } from 'vue';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearSave } from '@/save/storage';
import { createSave } from '@/save/schema';
import { useGameStore } from '@/stores/game';
import { useAffectionBoardStore } from '@/stores/affectionBoard';
import AffectionBoardView from '../AffectionBoardView.vue';

const NOW = Date.parse('2026-07-29T17:56:00+08:00');

let pinia: Pinia;
let app: App | null = null;
let host: HTMLElement | null = null;

beforeEach(async () => {
  pinia = createPinia();
  setActivePinia(pinia);
  await clearSave();
});

afterEach(async () => {
  app?.unmount();
  app = null;
  host?.remove();
  host = null;
  await clearSave();
});

async function setupGame(reduceMotion = false) {
  const game = useGameStore();
  const save = createSave('夜见', 'swordsman', 42, NOW - 100_000);
  save.settings.reduceMotion = reduceMotion;
  save.affection.characters.swordsman.points = 300;
  save.affection.characters.swordsman.totalInteractions = 20;
  save.affection.characters.swordsman.completedStoryIds = ['aff_swordsman_01_dawn'];
  save.affection.characters.swordsman.choiceHistory = { aff_swordsman_01_dawn: 'watch_breath' };
  save.affection.characters.witch.points = 120;
  save.affection.characters.witch.totalInteractions = 8;
  save.affection.characters.witch.completedStoryIds = ['aff_witch_01_star'];
  save.affection.characters.witch.choiceHistory = { aff_witch_01_star: 'ask_both' };
  game.loadFrom(save);
  return game;
}

async function mountView(): Promise<HTMLElement> {
  host = document.createElement('div');
  document.body.appendChild(host);
  app = createApp({ render: () => h(AffectionBoardView) });
  app.use(pinia);
  app.mount(host);
  await nextTick();
  await nextTick();
  return host;
}

describe('你的陪伴卡', () => {
  it('心意总值是四角色之和，并强调相伴次数', async () => {
    await setupGame();
    const el = await mountView();

    expect(el.textContent).toContain('羁绊长卷');
    expect(el.textContent).toContain('心意总值');
    expect(el.textContent).toContain('420');
    expect(el.textContent).toContain('已累计相伴 28 次');
    // 任何位置都不许拆出单角色明细
    expect(el.textContent).not.toContain('剑姬');
    expect(el.textContent).not.toContain('魔女');
  });

  it('同步超过百分比以弱名次口径展示', async () => {
    await setupGame();
    const board = useAffectionBoardStore();
    board.lastSync = { updated: true, affectionTotal: 420, rank: 3, total: 12 };
    const el = await mountView();

    expect(el.textContent).toContain('心意超过 75% 的旅人');
    expect(el.textContent).not.toContain('第 3 名');
  });

  it('未配置 Supabase：单机横幅 + 同步按钮禁用，不报错不白屏', async () => {
    await setupGame();
    const el = await mountView();

    expect(el.textContent).toContain('当前是单机模式');
    const syncBtn = el.querySelector<HTMLButtonElement>('.bond-actions .btn');
    expect(syncBtn?.disabled).toBe(true);
  });
});

describe('心意同行榜', () => {
  it('榜单行只有总分与名字，没有查看他人入口', async () => {
    await setupGame();
    const board = useAffectionBoardStore();
    board.boardCache = {
      at: Date.now(),
      rows: [
        {
          rank: 1,
          userId: 'a',
          displayName: '先行者',
          avatarUrl: null,
          classId: 'witch',
          affectionTotal: 999,
          isMe: false,
        },
        {
          rank: 2,
          userId: 'me',
          displayName: '夜见',
          avatarUrl: null,
          classId: 'swordsman',
          affectionTotal: 420,
          isMe: true,
        },
      ],
    };
    const el = await mountView();

    expect(el.textContent).toContain('先行者');
    expect(el.textContent).toContain('999');
    expect(el.textContent).toContain('夜见');
    // 我的行有「你」标与高亮类
    expect(el.querySelector('.row.me')).not.toBeNull();
    expect(el.querySelector('.row.me')?.textContent).toContain('你');
    // 行不可点、无举报入口
    expect(el.querySelector('[role="button"]')).toBeNull();
    expect(el.querySelector('.report-entry')).toBeNull();
  });

  it('空榜给的是鼓励而不是嘲讽', async () => {
    await setupGame();
    const el = await mountView();

    expect(el.textContent).toContain('你的第一次同步');
  });
});

describe('减弱动效', () => {
  it('设置开启后粒子整个不渲染', async () => {
    await setupGame(true);
    const el = await mountView();

    expect(el.querySelector('.petal')).toBeNull();
    expect(el.querySelector('.bond-aura')).toBeNull();
  });

  it('默认渲染 10 颗粒子', async () => {
    await setupGame();
    const el = await mountView();

    expect(el.querySelectorAll('.petal').length).toBe(10);
  });
});
