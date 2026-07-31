// @vitest-environment jsdom
/**
 * 秘境榜 UI 的源码契约（docs/64 §三 的三条口径 + 展示红线）+ 挂载冒烟。
 *
 * 为什么用源码断言而不是只挂载渲染：这几条要求「某句话必须在界面上」，
 * 而它们最可能的坏法是**有人重写文案时顺手删掉**，那时渲染依然正常、
 * 测试依然全绿、只是玩家再也看不到那句解释了。源码断言能拦住这种删除。
 */

import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { createApp, h, nextTick, type App } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatDungeonDuration } from '@/core/dungeonBoard';
import { createSave } from '@/save/schema';
import { clearSave } from '@/save/storage';
import { useGameStore } from '@/stores/game';
import DungeonBoardView from '../DungeonBoardView.vue';

function readSource(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const boardSource = readSource('../DungeonBoardView.vue');
const rankSource = readSource('../../views/RankView.vue');

let app: App | null = null;
let host: HTMLElement | null = null;

beforeEach(async () => {
  setActivePinia(createPinia());
  await clearSave();
});

afterEach(async () => {
  app?.unmount();
  host?.remove();
  app = null;
  host = null;
  await clearSave();
});

/** 真挂载一次 —— 源码断言拦得住删文案，拦不住「渲染时就炸了」。 */
async function mountBoard(): Promise<HTMLElement> {
  const game = useGameStore();
  game.loadFrom(createSave('验证用', 'swordsman', 40, Date.now() - 100_000));
  host = document.createElement('div');
  document.body.appendChild(host);
  app = createApp({ render: () => h(DungeonBoardView) });
  app.mount(host);
  // onMounted 里的 openBoard 会同步选好默认层，等一次重渲染再断言
  await nextTick();
  return host;
}

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

describe('docs/64 §二之一 · 「没进步」与「没被采信」必须分开说', () => {
  /**
   * improved=false 有两种含义，只看它无法区分。若哪天有人把这段简化回
   * 「improved ? A : B」，玩家就再也看不到「你这条没被采信」——
   * 而那正是最难被发现的坏法：他会以为自己只是没打得更快。
   */
  it('UI 读了 claimVerified，而不是只看 improved', () => {
    expect(boardSource).toContain('claimVerified');
    expect(boardSource).toContain('没有被采信');
  });

  it('没被采信时同时换措辞与样式，不只是换一句话', () => {
    expect(boardSource).toContain('warn: true');
    expect(boardSource).toContain('.depths-hint.warn');
  });

  it('没被采信时明确告诉玩家本地记录还在', () => {
    expect(boardSource).toContain('记录仍在本地保留');
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

describe('挂载冒烟：新档玩家打开秘境榜', () => {
  it('渲染不炸，三级选择器都在（档位 4 / 部位 8 / 层 5）', async () => {
    const el = await mountBoard();
    const rows = [...el.querySelectorAll('.picker-row')];

    expect(rows).toHaveLength(3);
    // 档位：晴蓝/月紫/琥珀/绯樱
    expect(rows[0]!.querySelectorAll('button')).toHaveLength(4);
    // 部位：8 个装备门户
    expect(rows[1]!.querySelectorAll('button')).toHaveLength(8);
    // 层：该档开放的深度
    expect(rows[2]!.querySelectorAll('button').length).toBeGreaterThan(0);
  });

  it('三级选择器有玩家可读的步骤标签与稳定网格，不再靠窄胶囊自然换行', async () => {
    const el = await mountBoard();

    expect(el.textContent).toContain('STEP 1选择秘匣档位');
    expect(el.textContent).toContain('STEP 2选择定向部位');
    expect(el.textContent).toContain('STEP 3选择挑战深度');
    expect(boardSource).toContain('grid-template-columns: repeat(4, minmax(0, 1fr))');
    expect(boardSource).toContain('grid-template-columns: repeat(5, minmax(0, 1fr))');
    expect(boardSource).toContain('min-height: 40px');
  });

  it('一层没打过时不假装有成绩，且空态给的是邀请', async () => {
    const el = await mountBoard();

    expect(el.textContent).toContain('尚未通关');
    expect(el.textContent).toContain('你的记录会是第一个');
    // §3.2 的并列规则必须真的渲染出来，不只是躺在源码里
    expect(el.textContent).toContain('更早首通者在前');
  });

  it('单机模式下明确告诉玩家成绩在本地，不是坏了', async () => {
    const el = await mountBoard();
    expect(el.textContent).toContain('单机模式');
  });
});

describe('RankView 第五页签', () => {
  it('秘境榜已挂进页签表并接了组件', () => {
    expect(rankSource).toContain("{ key: 'dungeon', label: '秘境榜' }");
    expect(rankSource).toContain("viewTab === 'dungeon'");
    expect(rankSource).toContain('DungeonBoardView');
  });

  /**
   * ★ 胶囊宽度必须由页签数组的真实长度驱动。
   *
   * 旧实现是手写 `calc(100% / 5)`，只加页签不改宽度，滑块会停在错的格子上 ——
   * 界面不会报错，只是高亮块和文字对不上。现改为 `--seg-count` 直接注入
   * `VIEW_TABS.length` / `BOARD_TABS.length`，这条断言保证以后新增页签
   * 时宽度自动跟随，不再需要人工改分母。
   */
  it('滑块宽度由页签数组长度驱动，与页签数一致', () => {
    // 只数 VIEW_TABS（页面顶部那排）—— 榜内还有一组 BOARD_TABS，别数混了
    const viewTabsBlock = rankSource.match(/const VIEW_TABS = \[([\s\S]*?)\] as const;/);
    expect(viewTabsBlock).not.toBeNull();
    const tabCount = (viewTabsBlock![1]!.match(/\{ key: '[a-z]+', label: '[^']+' \}/g) ?? [])
      .length;

    // 6 = 试炼 / 进度 / 羁绊 / 秘境 / 竞技场 / 封神榜（docs/78）。
    // 这个数字被钉住不是为了防止新增页签，而是为了**逼下一个加页签的人
    // 亲自看一眼 320px 窄屏**：分母越大每格越窄，六格时单格已到 ~53px，
    // 再加就要改成可横滑而不是继续等分。改这个数前先跑窄屏截图。
    expect(tabCount).toBe(6);
    expect(rankSource).toContain("'--seg-count': VIEW_TABS.length");
    expect(rankSource).toContain('width: calc(100% / var(--seg-count))');
  });
});
