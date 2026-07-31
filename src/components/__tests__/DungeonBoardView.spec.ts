/**
 * 秘境榜 UI 的源码契约（docs/64 §三 的三条口径 + 展示红线）。
 *
 * 为什么用源码断言而不是只挂载渲染：这几条要求「某句话必须在界面上」，
 * 而它们最可能的坏法是**有人重写文案时顺手删掉**，那时渲染依然正常、
 * 测试依然全绿、只是玩家再也看不到那句解释了。源码断言能拦住这种删除。
 */

import { readFileSync } from 'node:fs';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { formatDungeonDuration } from '@/core/dungeonBoard';

function readSource(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const boardSource = readSource('../DungeonBoardView.vue');
const rankSource = readSource('../../views/RankView.vue');

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('docs/64 §3.2 · 并列规则必须写在榜上', () => {
  /**
   * 同为 0.2 秒的成绩按首通时刻升序排。不把这条告诉玩家，
   * 并列的人会以为名次是随机的 —— 这正是契约里点名要求 UI 写明的原因。
   */
  it('榜单上写明了「用时相同时更早首通者在前」', () => {
    expect(boardSource).toContain('更早首通者在前');
  });
});

describe('空态不是一个空列表', () => {
  it('没有人上榜时给的是一句邀请，不是空白', () => {
    expect(boardSource).toContain('还没有人上榜');
    expect(boardSource).toContain('你的记录会是第一个');
  });

  it('未联机与离线各有自己的说法，且都说明本地数据没丢', () => {
    expect(boardSource).toContain('单机模式');
    expect(boardSource).toContain('本地安然无恙');
  });
});

describe('展示红线：弱化名次（与羁绊榜/进度榜同口径）', () => {
  it('名次是暗色小号，没有奖牌台与皇冠', () => {
    expect(boardSource).toContain('rank-no soft');
    expect(boardSource).not.toContain('podium');
    expect(boardSource).not.toContain('crown');
  });

  it('页脚写明名次不发奖励', () => {
    expect(boardSource).toContain('名次不发放任何奖励');
  });
});

describe('用时展示只有一份实现', () => {
  /**
   * 契约明写「展示用时一律走 formatDungeonDuration，别在 UI 里再写一份」。
   * 两处实现必然分叉，这个项目今天已经在别处踩过一次。
   */
  it('UI 走 core 的 formatDungeonDuration，没有自己算秒数', () => {
    expect(boardSource).toContain('formatDungeonDuration');
    expect(boardSource).not.toContain('/ 1000).toFixed');
  });

  it('formatDungeonDuration 的口径本身没被改坏', () => {
    expect(formatDungeonDuration(200)).toBe('0.2 秒');
    expect(formatDungeonDuration(37_100)).toBe('37.1 秒');
  });
});

describe('RankView 第五页签', () => {
  it('秘境榜已挂进页签表并接了组件', () => {
    expect(rankSource).toContain("{ key: 'dungeon', label: '秘境榜' }");
    expect(rankSource).toContain("viewTab === 'dungeon'");
    expect(rankSource).toContain('DungeonBoardView');
  });

  /**
   * ★ 胶囊宽度与页签数必须一起改。
   *
   * 只加页签不改宽度，滑块会停在错的格子上 —— 界面不会报错，
   * 只是从第四个页签起，高亮块和文字对不上。这条断言的作用是：
   * 将来再加第六个榜时，这里会立刻红，而不是等有人截图来问。
   */
  it('滑块宽度是五等分，与页签数一致', () => {
    // 只数 VIEW_TABS（页面顶部那排）—— 榜内还有一组 BOARD_TABS，别数混了
    const viewTabsBlock = rankSource.match(/const VIEW_TABS = \[([\s\S]*?)\] as const;/);
    expect(viewTabsBlock).not.toBeNull();
    const tabCount = (viewTabsBlock![1]!.match(/\{ key: '[a-z]+', label: '[^']+' \}/g) ?? []).length;

    expect(tabCount).toBe(5);
    expect(rankSource).toContain('width: calc(100% / 5)');
  });
});
