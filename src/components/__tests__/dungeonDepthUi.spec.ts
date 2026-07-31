// @vitest-environment jsdom
/**
 * 深度阶梯 UI 的契约断言 + 适配器单测 + 挂载冒烟（docs/66 §八 第 6 步）。
 *
 * 钉死三件事：
 *   1. 激活开关现在是 false —— stub 期对玩家零可见变化，
 *      翻 true 必须连带删 stub（dungeonDepthAdapter.ts），
 *      防止「开关开着、stub 还在」的半成品上线（照烙印批次先例）
 *   2. 展示红线落在源码与渲染结果里：
 *      「失败不扣次数」「区域 8 开放后解锁」必在；
 *      not-opened 分支**不显示任何门槛数字**（K5 同款，docs/57）；
 *      **没有任何负向奇迹措辞**（docs/66 §4.3 / G-9 / docs/40 损失厌恶红线）
 *   3. stub 的三条假设与 docs/66 §五 迁移规则一致（接线前后 UI 不跳变）：
 *      progress 推导（首通 ⇒ d1，绝不伪造更高）、reason 优先级链、
 *      contentTopLevel 与 arenaEquipment 同源、run 在 stub 期不开放
 */

import { readFileSync } from 'node:fs';
import { createApp, h, type App } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import type { EquipmentDungeonState } from '@/core/equipmentDungeon';
import { createEquipmentDungeonState } from '@/core/equipmentDungeon';
import type { EquipmentDungeonDepthProgress } from '@/core/equipmentDungeonDepth';
import { DEPTH_PER_TIER } from '@/data/equipmentDungeonDepthRules';
import { EQUIPMENT_DUNGEON_TIERS } from '@/data/equipmentDungeonGear';
import { ALL_CHAPTERS } from '@/data/regions';
import { DUNGEON_DEPTH_UI_ACTIVE } from '@/ui/dungeonDepthActivation';
import {
  dungeonDepthContentTopLevel,
  dungeonDepthProgressStub,
  evaluateDungeonDepthStub,
  runEquipmentDungeonDepthStub,
} from '@/ui/dungeonDepthAdapter';
import DungeonDepthPanel from '../dungeon/DungeonDepthPanel.vue';

function readSource(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

// ─────────── 1. 源码契约断言 ───────────

describe('深度 UI 源码契约', () => {
  it('激活开关当前为 false，且有契约测试锁死（翻 true 须删 stub）', () => {
    const source = readSource('../../ui/dungeonDepthActivation.ts');
    expect(source).toContain('DUNGEON_DEPTH_UI_ACTIVE = false');
    // 运行时值与源码一致，防止有人只改断言不改常量
    expect(DUNGEON_DEPTH_UI_ACTIVE).toBe(false);
  });

  it('DungeonView 把面板挂在开关后面：flag off 时模板根本不渲染', () => {
    const source = readSource('../../views/DungeonView.vue');
    expect(source).toContain('DUNGEON_DEPTH_UI_ACTIVE');
    expect(source).toContain('v-if="depthUiActive"');
    /*
     * 接线完成后（claude-drops）：挑战入口**已经真正接通**，
     * 原来的「深度挑战随接线批次开放」占位文案随之删除。
     *
     * 这条断言从「锁 stub 状态」改为「锁已接线状态」：
     * DungeonView 必须调 store 的 runEquipmentDungeonDepth，
     * 且**不得再引用 stub** —— 生产代码与 stub 是同口径的两处实现，
     * 同时存在两条路径正是「同一口径两处实现」那类事故的温床。
     */
    expect(source).toContain('runEquipmentDungeonDepth');
    expect(source).not.toContain('深度挑战随接线批次开放');
    expect(source).not.toContain('dungeonDepthAdapter');
  });

  it('面板必含承重文案：失败不扣次数 / 区域 8 开放后解锁 / 首破必掉', () => {
    const source = readSource('../dungeon/DungeonDepthPanel.vue');
    expect(source).toContain('失败不扣次数');
    expect(source).toContain('每日 3 次限的是奖励，不是尝试');
    expect(source).toContain('区域 8 开放后解锁');
    expect(source).toContain('首破必掉 1 件胚子');
    expect(source).toContain('先突破上一层');
  });

  it('not-opened 分支不显示任何门槛数字（K5 同款红线）', () => {
    const source = readSource('../dungeon/DungeonDepthPanel.vue');
    // 找到 not-opened 的文案分支，里面不允许出现 Lv / unlockLevel / 推荐战力
    const notOpenedBranch = source.match(/case 'not-opened':[\s\S]*?return '区域 8 开放后解锁';/);
    expect(notOpenedBranch).not.toBeNull();
    expect(notOpenedBranch![0]).not.toMatch(/Lv|unlockLevel|recommendCp|recommend/);
  });

  it('红线：不做「这次没出奇迹」一类负向提示（docs/66 §4.3 / G-9）', () => {
    const panel = readSource('../dungeon/DungeonDepthPanel.vue');
    const view = readSource('../../views/DungeonView.vue');
    for (const source of [panel, view]) {
      expect(source).not.toMatch(/没出|未出奇迹|错过|差一点|空手而归|运气不好/);
    }
  });
});

// ─────────── 2. stub 适配器单测 ───────────

const NOW = Date.parse('2026-07-31T10:00:00+08:00');

function stateWithRecords(recordIds: string[]): EquipmentDungeonState {
  const state = createEquipmentDungeonState(NOW);
  for (const id of recordIds) {
    state.records[id] = { clears: 1, firstClearedAt: NOW - 1000, bestDurationMs: 12_300 };
  }
  return state;
}

describe('dungeonDepthProgressStub：与 docs/66 §五 迁移规则同口径', () => {
  it('空存档 / 无记录 ⇒ 每档深度 0（不出现该档的键）', () => {
    expect(dungeonDepthProgressStub(null)).toEqual({});
    expect(dungeonDepthProgressStub(createEquipmentDungeonState(NOW))).toEqual({});
  });

  it('该档任一部位有首通记录 ⇒ 视为 d1 已过', () => {
    expect(dungeonDepthProgressStub(stateWithRecords(['equipment_weapon_azure']))).toEqual({
      azure: 1,
    });
    expect(
      dungeonDepthProgressStub(
        stateWithRecords(['equipment_weapon_azure', 'equipment_ring_violet']),
      ),
    ).toEqual({ azure: 1, violet: 1 });
  });

  it('绝不伪造更高深度：四部位全首通也只记 d1', () => {
    const progress = dungeonDepthProgressStub(
      stateWithRecords([
        'equipment_weapon_azure',
        'equipment_head_azure',
        'equipment_body_azure',
        'equipment_ring_azure',
      ]),
    );
    expect(progress).toEqual({ azure: 1 });
  });
});

describe('evaluateDungeonDepthStub：reason 优先级链', () => {
  const base = { playerLevel: 90, attemptsRemaining: 3 };

  it('可打 ⇒ ok；未破链 ⇒ previous-depth；未开放 ⇒ not-opened；次数尽 ⇒ daily-limit', () => {
    const progress = { azure: 1 };
    expect(evaluateDungeonDepthStub({ progress, tierId: 'azure', depth: 2, ...base }).reason).toBe(
      'ok',
    );
    expect(evaluateDungeonDepthStub({ progress, tierId: 'azure', depth: 4, ...base }).reason).toBe(
      'previous-depth',
    );
    expect(
      evaluateDungeonDepthStub({ progress, tierId: 'crimson', depth: 3, ...base }).reason,
    ).toBe('not-opened');
    expect(
      evaluateDungeonDepthStub({ progress, tierId: 'azure', depth: 2, playerLevel: 90, attemptsRemaining: 0 })
        .reason,
    ).toBe('daily-limit');
  });

  it('优先级 not-opened > previous-depth：crimson 深层无论如何都是 not-opened', () => {
    expect(
      evaluateDungeonDepthStub({ progress: {}, tierId: 'crimson', depth: 5, ...base }).reason,
    ).toBe('not-opened');
    // crimson d1 是开放的：进度 0 时它是「下一层可打」
    expect(
      evaluateDungeonDepthStub({ progress: {}, tierId: 'crimson', depth: 1, ...base }).reason,
    ).toBe('ok');
  });

  it('首破标记：超过已破层 ⇒ isFirstBreak，已破层重刷 ⇒ 不是首破', () => {
    const progress = { azure: 2 };
    expect(evaluateDungeonDepthStub({ progress, tierId: 'azure', depth: 3, ...base }).isFirstBreak)
      .toBe(true);
    expect(evaluateDungeonDepthStub({ progress, tierId: 'azure', depth: 1, ...base }).isFirstBreak)
      .toBe(false);
  });

  it('contentTopLevel 与 arenaEquipment 同源：max(ALL_CHAPTERS.levelTo)', () => {
    expect(dungeonDepthContentTopLevel()).toBe(
      Math.max(...ALL_CHAPTERS.map((chapter) => chapter.levelTo)),
    );
  });

  it('run 在 stub 期不开放', () => {
    expect(runEquipmentDungeonDepthStub()).toEqual({ ok: false, reason: 'not-wired' });
  });
});

// ─────────── 3. 面板挂载冒烟（jsdom） ───────────

let app: App | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  app?.unmount();
  app = null;
  host?.remove();
  host = null;
});

function mountPanel(options: {
  tierId: 'azure' | 'crimson';
  cleared: number;
  selectedDepth: number;
  attemptsRemaining?: number;
  reduceMotion?: boolean;
  onSelect?: (depth: number) => void;
}): HTMLElement {
  const tier = EQUIPMENT_DUNGEON_TIERS.find((candidate) => candidate.id === options.tierId)!;
  const progress: EquipmentDungeonDepthProgress =
    options.cleared > 0 ? { [options.tierId]: options.cleared } : {};
  const evaluations = Array.from({ length: DEPTH_PER_TIER }, (_, index) =>
    evaluateDungeonDepthStub({
      progress,
      tierId: options.tierId,
      depth: index + 1,
      playerLevel: 90,
      attemptsRemaining: options.attemptsRemaining ?? 3,
    }),
  );
  host = document.createElement('div');
  document.body.appendChild(host);
  app = createApp({
    render: () =>
      h(DungeonDepthPanel, {
        tier,
        evaluations,
        clearedDepth: options.cleared,
        selectedDepth: options.selectedDepth,
        reduceMotion: options.reduceMotion ?? false,
        onSelect: options.onSelect,
      }),
  });
  app.mount(host);
  return host;
}

describe('DungeonDepthPanel 挂载冒烟', () => {
  it('azure 已破 d1：d1 显示稳定掉率、d2 是首破焦点、d3~d5 锁链', () => {
    const el = mountPanel({ tierId: 'azure', cleared: 1, selectedDepth: 2 });
    const nodes = [...el.querySelectorAll<HTMLElement>('.depth-node')];
    expect(nodes).toHaveLength(DEPTH_PER_TIER);
    expect(nodes[0]!.dataset.state).toBe('cleared');
    expect(nodes[0]!.textContent).toContain('胚子 12%');
    expect(nodes[1]!.dataset.state).toBe('next');
    expect(nodes[1]!.textContent).toContain('首破必掉 1 件胚子');
    expect(nodes[1]!.textContent).toContain('推荐');
    for (const node of nodes.slice(2)) {
      expect(node.dataset.state).toBe('previous-depth');
      expect(node.textContent).toContain('先突破上一层');
    }
    expect(el.textContent).toContain('当前深度 1/5');
    expect(el.textContent).toContain('失败不扣次数');
  });

  it('可打层点击发出 select；锁链层禁用不发出', () => {
    const picked: number[] = [];
    const el = mountPanel({
      tierId: 'azure',
      cleared: 1,
      selectedDepth: 2,
      onSelect: (depth) => picked.push(depth),
    });
    const nodes = [...el.querySelectorAll<HTMLButtonElement>('.depth-node')];
    nodes[1]!.click();
    expect(picked).toEqual([2]);
    expect(nodes[2]!.disabled).toBe(true);
    nodes[2]!.click();
    expect(picked).toEqual([2]);
  });

  it('crimson：d1 可打，d2~d5 显示「区域 8 开放后解锁」且没有任何门槛数字', () => {
    const el = mountPanel({ tierId: 'crimson', cleared: 0, selectedDepth: 1 });
    const nodes = [...el.querySelectorAll<HTMLElement>('.depth-node')];
    expect(nodes[0]!.dataset.state).toBe('next');
    for (const node of nodes.slice(1)) {
      expect(node.dataset.state).toBe('not-opened');
      expect(node.textContent).toContain('区域 8 开放后解锁');
      expect(node.textContent).not.toMatch(/Lv\d|推荐|等级/);
    }
  });

  it('今日次数尽：可打层转 daily-limit，已破层仍显示掉率但禁用', () => {
    const el = mountPanel({ tierId: 'azure', cleared: 1, selectedDepth: 2, attemptsRemaining: 0 });
    const nodes = [...el.querySelectorAll<HTMLButtonElement>('.depth-node')];
    expect(nodes[0]!.dataset.state).toBe('cleared');
    expect(nodes[0]!.disabled).toBe(true);
    expect(nodes[1]!.dataset.state).toBe('daily-limit');
    expect(nodes[1]!.textContent).toContain('今日奖励已领完');
  });

  it('减弱动效：粒子整个不渲染（不是只停动画）', () => {
    const animated = mountPanel({ tierId: 'azure', cleared: 1, selectedDepth: 2 });
    expect(animated.querySelector('.node-particles')).not.toBeNull();
    app?.unmount();
    host?.remove();
    const still = mountPanel({ tierId: 'azure', cleared: 1, selectedDepth: 2, reduceMotion: true });
    expect(still.querySelector('.node-particles')).toBeNull();
    expect(still.querySelector('.depth-panel')!.getAttribute('data-reduce-motion')).toBe('true');
  });
});
