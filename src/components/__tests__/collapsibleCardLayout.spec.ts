import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 布局挤压回归门禁（第五轮用户实报 bug：副本页部位网格被裁成一行半）。
 *
 * 根因：固定高度 flex 列（height: 100% + flex-direction: column）里，
 * overflow:hidden 的卡片自动最小高度为 0，会被兄弟内容压扁裁断。
 *
 * 两条防线：
 * 1. 折叠卡自身 flex-shrink: 0 —— 它自己管理高度，绝不接受挤压；
 * 2. 各主视图根容器用 min-height: 100% 撑满一屏即可，
 *    装不下的交给 main（.scroll-y）滚动，绝不能用 height: 100% 锁死。
 */
describe('固定高度 flex 列防挤压门禁', () => {
  it('CollapsibleCard 折叠卡声明 flex-shrink: 0，拒绝负空间挤压', async () => {
    const source = await readFile(resolve('src/components/CollapsibleCard.vue'), 'utf8');
    expect(source).toContain('flex-shrink: 0');
  });

  it.each(['DungeonView', 'MoreView', 'RankView', 'IdleView'])(
    '%s 根容器用 min-height: 100%% 保底，不锁死 height',
    async (view) => {
      const source = await readFile(resolve(`src/views/${view}.vue`), 'utf8');
      const rootClass = {
        DungeonView: 'dungeon',
        MoreView: 'more',
        RankView: 'rank',
        IdleView: 'idle',
      }[view];
      const block = source.match(new RegExp(`\\.${rootClass} \\{[^}]+\\}`))?.[0] ?? '';
      expect(block).toContain('min-height: 100%');
      // 用否定后行断言排除 min-height 自身的子串，只抓独立的 height: 100%
      expect(block).not.toMatch(/(?<!-)height: 100%;/);
    },
  );
});
