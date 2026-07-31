// @vitest-environment jsdom
/**
 * 进度榜组件的挂载冒烟测试（jsdom，不打真实网络）。
 *
 * 验证 docs/63 §五 的展示红线真的落在渲染结果里：
 *   - 开荒长卷卡：最深首通关名 + 已通关数 + 首通时刻（无时刻如实说明）
 *   - 未配置 Supabase 时静默降级为单机横幅，不报错不白屏
 *   - 榜单行：弱名次（无奖牌无皇冠）、无时刻的行写「时刻未记录」
 *   - 减弱动效开关一开，粒子整个不渲染（不是只停动画）
 */

import 'fake-indexeddb/auto';
import { createApp, h, nextTick, type App } from 'vue';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearSave } from '@/save/storage';
import { createSave } from '@/save/schema';
import { ORDERED_STAGE_IDS, getStage } from '@/data/stages';
import { useGameStore } from '@/stores/game';
import { useProgressBoardStore } from '@/stores/progressBoard';
import ProgressBoardView from '../ProgressBoardView.vue';

const NOW = Date.parse('2026-07-29T17:56:00+08:00');
const DEEPEST = ORDERED_STAGE_IDS[2]!;

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
  save.progress.clearedStageIds = ORDERED_STAGE_IDS.slice(0, 3);
  save.progress.stageFirstClearedAt = { [DEEPEST]: NOW - 5000 };
  game.loadFrom(save);
  return game;
}

async function mountView(): Promise<HTMLElement> {
  host = document.createElement('div');
  document.body.appendChild(host);
  app = createApp({ render: () => h(ProgressBoardView) });
  app.use(pinia);
  app.mount(host);
  await nextTick();
  await nextTick();
  return host;
}

describe('开荒长卷卡', () => {
  it('最深首通关名 + 已通关数 + 首通时刻都在卡上', async () => {
    await setupGame();
    const el = await mountView();

    expect(el.textContent).toContain('开荒长卷');
    expect(el.textContent).toContain('最深首通');
    expect(el.textContent).toContain(getStage(DEEPEST)!.name);
    expect(el.textContent).toContain('第 3 关已通关');
    expect(el.textContent).toContain('首通于');
  });

  it('一关未通给的是邀请而不是嘲讽', async () => {
    const game = useGameStore();
    // createdAt 用当前时刻 —— 否则 loadFrom 的离线结算会按流逝时间自动推关
    game.loadFrom(createSave('夜见', 'swordsman', 1, Date.now()));
    const el = await mountView();

    expect(el.textContent).toContain('尚未启程');
    expect(el.textContent).toContain('去推第一关吧');
    expect(el.textContent).not.toContain('落后');
  });

  it('同步超过百分比以弱名次口径展示', async () => {
    await setupGame();
    const board = useProgressBoardStore();
    board.lastSync = {
      updated: true,
      deepestStageId: DEEPEST,
      deepestStageIndex: 2,
      firstClearedAt: NOW - 5000,
      verified: true,
      rank: 3,
      total: 12,
    };
    const el = await mountView();

    expect(el.textContent).toContain('进度超过 75% 的旅人');
    expect(el.textContent).not.toContain('第 3 名');
  });

  it('未配置 Supabase：单机横幅 + 同步按钮禁用，不报错不白屏', async () => {
    await setupGame();
    const el = await mountView();

    expect(el.textContent).toContain('当前是单机模式');
    const syncBtn = el.querySelector<HTMLButtonElement>('.rally-actions .btn');
    expect(syncBtn?.disabled).toBe(true);
  });
});

describe('开荒同行榜', () => {
  it('榜单行：弱名次无奖牌、无时刻的行如实写「时刻未记录」', async () => {
    await setupGame();
    const board = useProgressBoardStore();
    board.boardCache = {
      at: Date.now(),
      rows: [
        {
          rank: 1,
          userId: 'a',
          displayName: '先行者',
          avatarUrl: null,
          classId: 'witch',
          stageName: getStage(ORDERED_STAGE_IDS[9]!)!.name,
          stageLevel: 20,
          deepestStageIndex: 9,
          firstClearedAt: NOW - 86_400_000,
          isMe: false,
        },
        {
          rank: 2,
          userId: 'me',
          displayName: '夜见',
          avatarUrl: null,
          classId: 'swordsman',
          stageName: getStage(ORDERED_STAGE_IDS[9]!)!.name,
          stageLevel: 20,
          deepestStageIndex: 9,
          firstClearedAt: null,
          isMe: true,
        },
      ],
    };
    const el = await mountView();

    expect(el.textContent).toContain('先行者');
    expect(el.textContent).toContain('时刻未记录');
    // 我的行有「你」标与高亮类
    expect(el.querySelector('.row.me')).not.toBeNull();
    expect(el.querySelector('.row.me')?.textContent).toContain('你');
    // 弱名次：无奖牌、无皇冠、行不可点、无查看他人入口
    expect(el.textContent).not.toContain('🥇');
    expect(el.textContent).not.toContain('👑');
    expect(el.querySelector('[role="button"]')).toBeNull();
    expect(el.querySelector('.report-entry')).toBeNull();
    // 并列规则写在榜上：早到者在前
    expect(el.textContent).toContain('并列时早到者在前');
  });

  it('空榜给的是邀请而不是嘲讽', async () => {
    await setupGame();
    const el = await mountView();

    expect(el.textContent).toContain('你的第一次同步');
    expect(el.textContent).not.toContain('落后');
  });
});

describe('减弱动效', () => {
  it('设置开启后粒子整个不渲染', async () => {
    await setupGame(true);
    const el = await mountView();

    expect(el.querySelector('.petal')).toBeNull();
    expect(el.querySelector('.rally-aura')).toBeNull();
  });

  it('默认渲染 10 颗粒子', async () => {
    await setupGame();
    const el = await mountView();

    expect(el.querySelectorAll('.petal').length).toBe(10);
  });
});
