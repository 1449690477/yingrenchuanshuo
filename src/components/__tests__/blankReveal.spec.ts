// @vitest-environment jsdom
/**
 * 奇迹胚子显影的契约测试（docs/66 §4.3 · UI ②）。
 *
 * 钉死四件事：
 *   1. 掉落卡演出按胚子档升级：奇迹卡有 ribbon / 金边 / 光带 / burst，
 *      精工卡有紫边轻 halo，稳定卡**完全安静**（稀缺感靠对比撑起来）
 *   2. 胚子档阈值从 EQUIPMENT_BASE_ROLL_TIERS 推导 —— 边界上下各取一点，
 *      绝不接受手写数字（docs/61 §2.2：同一份口径不许两处实现）
 *   3. 留痕行（当前持有奇迹胚子 ×N）：N>0 才渲染、写明持有口径；
 *      N=0 整行不渲染（「0」是一种嘲讽，不给）
 *   4. G-9 红线：两个组件源码**没有任何负向措辞**（只做正向峰），
 *      减弱动效下动画停但信息（ribbon/描边/留痕行）不丢
 */

import { readFileSync } from 'node:fs';
import { createApp, h, type App } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import type { EquipmentInstance } from '@/core/types';
import {
  evaluateDungeonDepth,
  type EquipmentDungeonDepthProgress,
} from '@/core/equipmentDungeonDepth';
import { EQUIPMENT_BASE_ROLL_TIERS } from '@/data/constants';
import { DEPTH_PER_TIER } from '@/data/equipmentDungeonDepthRules';
import { EQUIPMENT_DUNGEON_TIERS } from '@/data/equipmentDungeonGear';
import { ALL_CHAPTERS } from '@/data/regions';
import EquipmentDungeonReward from '../EquipmentDungeonReward.vue';
import DungeonDepthPanel from '../dungeon/DungeonDepthPanel.vue';

function readSource(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const MIRACLE_MIN = EQUIPMENT_BASE_ROLL_TIERS.find((tier) => tier.id === 'miracle')!.min;
const REFINED_MIN = EQUIPMENT_BASE_ROLL_TIERS.find((tier) => tier.id === 'refined')!.min;
const CONTENT_TOP_LEVEL = Math.max(...ALL_CHAPTERS.map((chapter) => chapter.levelTo));

let app: App | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  app?.unmount();
  app = null;
  host?.remove();
  host = null;
});

// ─────────── 1. 掉落卡演出（EquipmentDungeonReward） ───────────

function fakeInstance(uid: string, baseRollPermille: number): EquipmentInstance {
  return {
    uid,
    defId: 'eq_r1_weapon_rare',
    enhance: 0,
    baseRollPermille,
    enhanceGainPermille: [],
    enhanceLuck: {},
    affixes: [],
    reforgeResonance: 0,
    locked: false,
  };
}

function mountReward(instances: readonly EquipmentInstance[], reduceMotion = false): HTMLElement {
  host = document.createElement('div');
  document.body.appendChild(host);
  app = createApp({
    render: () =>
      h(EquipmentDungeonReward, {
        instances,
        classId: 'swordsman',
        firstClear: false,
        reduceMotion,
      }),
  });
  app.mount(host);
  return host;
}

describe('掉落卡演出按胚子档升级', () => {
  it('阈值从掉率表推导：miracle.min 是奇迹、min-1 是精工、refined.min-1 是稳定', () => {
    const el = mountReward([
      fakeInstance('e1', MIRACLE_MIN),
      fakeInstance('e2', MIRACLE_MIN - 1),
      fakeInstance('e3', REFINED_MIN - 1),
    ]);
    const cards = [...el.querySelectorAll<HTMLElement>('.reward-item')];
    expect(cards).toHaveLength(3);
    expect(cards[0]!.classList.contains('is-miracle')).toBe(true);
    expect(cards[1]!.classList.contains('is-refined')).toBe(true);
    expect(cards[1]!.classList.contains('is-miracle')).toBe(false);
    // 稳定卡完全安静：两档升级类都不沾（稀缺感靠对比撑起来）
    expect(cards[2]!.classList.contains('is-miracle')).toBe(false);
    expect(cards[2]!.classList.contains('is-refined')).toBe(false);
  });

  it('奇迹卡：ribbon、光带、burst 都在；一屏扫视可读', () => {
    const el = mountReward([fakeInstance('e1', MIRACLE_MIN)]);
    expect(el.querySelector('.blank-ribbon.miracle')?.textContent).toContain('奇迹胚子');
    expect(el.querySelector('.miracle-shine')).not.toBeNull();
    expect(el.querySelector('.reward-burst')).not.toBeNull();
  });

  it('精工卡：只有紫边 ribbon，不光带不 burst（不抢奇迹的戏）', () => {
    const el = mountReward([fakeInstance('e1', REFINED_MIN)]);
    expect(el.querySelector('.blank-ribbon.refined')?.textContent).toContain('精工胚子');
    expect(el.querySelector('.miracle-shine')).toBeNull();
    expect(el.querySelector('.reward-burst')).toBeNull();
  });

  it('稳定卡：没有 ribbon，没有 burst', () => {
    const el = mountReward([fakeInstance('e1', REFINED_MIN - 1)]);
    expect(el.querySelector('.blank-ribbon')).toBeNull();
    expect(el.querySelector('.reward-burst')).toBeNull();
  });

  it('减弱动效：光带与 burst 不渲染，但金边类与 ribbon 保留（信息不丢）', () => {
    const el = mountReward([fakeInstance('e1', MIRACLE_MIN)], true);
    expect(el.querySelector('.miracle-shine')).toBeNull();
    expect(el.querySelector('.reward-burst')).toBeNull();
    expect(el.querySelector('.reward-item')!.classList.contains('is-miracle')).toBe(true);
    expect(el.querySelector('.blank-ribbon.miracle')).not.toBeNull();
  });
});

// ─────────── 2. 留痕行（DungeonDepthPanel） ───────────

function mountPanel(miracleCount: number): HTMLElement {
  const tier = EQUIPMENT_DUNGEON_TIERS.find((candidate) => candidate.id === 'azure')!;
  const progress: EquipmentDungeonDepthProgress = { azure: 1 };
  const evaluations = Array.from({ length: DEPTH_PER_TIER }, (_, index) =>
    evaluateDungeonDepth({
      progress,
      tierId: 'azure',
      depth: index + 1,
      playerLevel: 90,
      contentTopLevel: CONTENT_TOP_LEVEL,
      attemptsRemaining: 3,
    }),
  );
  host = document.createElement('div');
  document.body.appendChild(host);
  app = createApp({
    render: () =>
      h(DungeonDepthPanel, {
        tier,
        evaluations,
        clearedDepth: 1,
        selectedDepth: 2,
        reduceMotion: false,
        miracleCount,
      }),
  });
  app.mount(host);
  return host;
}

describe('留痕行：当前持有奇迹胚子', () => {
  it('N>0 时渲染 ×N，并写明持有口径', () => {
    const el = mountPanel(2);
    expect(el.querySelector('.depth-miracle')?.textContent).toContain('当前持有奇迹胚子 ×2');
    expect(el.querySelector('.depth-miracle')?.textContent).toContain('背包与身上');
  });

  it('N=0 时整行不渲染（「0」是一种嘲讽，不给）', () => {
    const el = mountPanel(0);
    expect(el.querySelector('.depth-miracle')).toBeNull();
    expect(el.textContent).not.toContain('持有奇迹胚子');
  });

  it('留痕不妨碍既有承重句：失败不扣次数仍在页脚', () => {
    const el = mountPanel(3);
    expect(el.textContent).toContain('失败不扣次数');
    expect(el.textContent).toContain('每日 3 次限的是奖励，不是尝试');
  });
});

// ─────────── 3. G-9 红线：没有负向措辞 ───────────

describe('红线：只做正向峰（docs/66 §4.3 / G-9 / docs/40 损失厌恶）', () => {
  it('奖励卡与深度面板源码都没有负向措辞', () => {
    const reward = readSource('../EquipmentDungeonReward.vue');
    const panel = readSource('../dungeon/DungeonDepthPanel.vue');
    for (const source of [reward, panel]) {
      expect(source).not.toMatch(/没出|未出奇迹|错过|差一点|空手而归|运气不好/);
    }
  });

  it('留痕行是持有口径：不提「收集史」「曾经」，不给分解压力', () => {
    const panel = readSource('../dungeon/DungeonDepthPanel.vue');
    expect(panel).toContain('当前持有');
    expect(panel).not.toMatch(/收集史|曾经拥有|累计获得/);
  });
});
