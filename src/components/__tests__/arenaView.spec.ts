/**
 * 竞技场 UI 的结构与红线门禁（docs/54 §十 / docs/40）。
 *
 * 本仓库组件测试的既有形态是源码级契约断言（见 collapsibleCardLayout.spec）：
 * 不是检查「长得像不像」，而是把设计红线变成 CI 可卡的硬约束 ——
 * 谁以后改文案或删适配，测试直接红。
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const view = () => readFile(resolve('src/views/ArenaView.vue'), 'utf8');
const rank = () => readFile(resolve('src/views/RankView.vue'), 'utf8');
const scene = () => readFile(resolve('src/components/arena/ArenaBattleScene.vue'), 'utf8');
const shop = () => readFile(resolve('src/components/arena/ArenaHonorShop.vue'), 'utf8');
const affection = () => readFile(resolve('src/components/AffectionBoardView.vue'), 'utf8');

describe('ArenaView 结构（docs/54 §十 草图）', () => {
  /** 只断言模板区：脚本头部注释在解释红线时自然会引用红线原文 */
  const template = async () => (await view()).split('</script>')[1] ?? '';

  it('一屏五段：英雄卡 / 反击条 / 今日对手 / 押注挑战 / 防线战报', async () => {
    const source = await view();
    expect(source).toContain('hero-card');
    expect(source).toContain('revenge-strip');
    expect(source).toContain('今日对手');
    expect(source).toContain('发起挑战');
    expect(source).toContain('昨日防线');
    expect(source).toContain('ArenaHonorShop');
    expect(source).toContain('ArenaBattleScene');
  });

  it('红线文案：没有「购买次数」，次数用完是中性「明天见」', async () => {
    const tpl = await template();
    expect(tpl).not.toContain('购买次数');
    expect(tpl).not.toContain('排名下降');
    expect(tpl).not.toContain('超越了你');
    // 文案本身定义在 script 里（按钮文案函数），存在性断言扫全文件
    const whole = await view();
    expect(whole).toContain('明天见');
    // 反击措辞中性：只写「反击机会 ×1」，不写「XXX 打败了你」（docs/40）
    expect(whole).toContain('反击机会 ×1');
    expect(tpl).not.toContain('打败了你');
  });

  it('三档押注来自同一份数据（ARENA_STAKES），不硬编码档位', async () => {
    const source = await view();
    expect(source).toContain('ARENA_STAKES');
  });

  it('胜率条按服务端预估值分档显示（把赌变成决策）', async () => {
    const source = await view();
    expect(source).toContain('winRatePct');
    expect(source).toContain('胜率');
  });

  it('小屏适配与减弱动效都落实', async () => {
    const source = await view();
    expect(source).toContain('@media (max-width: 340px)');
    expect(source).toContain('prefers-reduced-motion');
  });
});

describe('入口：RankView 顶部视图切换', () => {
  it('试炼榜 | 羁绊榜 | 竞技场三档切换，胶囊三等分', async () => {
    const source = await rank();
    expect(source).toContain("'试炼榜'");
    expect(source).toContain("'羁绊榜'");
    expect(source).toContain("'竞技场'");
    expect(source).toContain('ArenaView');
    expect(source).toContain('AffectionBoardView');
    expect(source).toContain('.view-seg .seg-pill');
    expect(source).toContain('width: calc(100% / 3)');
  });
});

describe('AffectionBoardView 羁绊榜（docs/63 §三 红线）', () => {
  it('弱化名次：无奖牌无皇冠无点击查看他人，名次只是找到自己的锚点', async () => {
    /** 只断言模板区：脚本头部注释在解释红线时自然会引用红线原文 */
    const tpl = (await affection()).split('</script>')[1] ?? '';
    expect(tpl).toContain('rank-no soft');
    expect(tpl).not.toContain('podium');
    expect(tpl).not.toContain('皇冠');
    // 行不可点：不提供「查看他人」入口（谁陪伴了谁是私事）
    expect(tpl).not.toContain('openPeek');
    expect(tpl).not.toContain('report-entry');
  });

  it('榜上只有心意之和：不渲染任何单角色字段', async () => {
    const source = await affection();
    // 网络行类型只有 affectionTotal，不得出现角色级字段
    expect(source).not.toContain('characters[');
    expect(source).toContain('affectionTotal');
    // 隐私说明必须在 UI 上明说
    expect(source).toContain('是彼此的秘密');
  });

  it('小屏适配与减弱动效都落实', async () => {
    const source = await affection();
    expect(source).toContain('@media (max-width: 340px)');
    expect(source).toContain('prefers-reduced-motion');
    expect(source).toContain('motionReduced');
  });
});

describe('ArenaBattleScene 战报回放（§5.4 红线）', () => {
  it('只消费服务端日志：不重算伤害、不用随机数', async () => {
    const source = await scene();
    expect(source).not.toContain('Math.random');
    expect(source).not.toContain('simulateDuel');
    expect(source).toContain('battle.log');
  });

  it('演出要素齐全：双方血条 / 伤害飘字 / 暴击 / 闪避 / 跳过 / 胜负横幅', async () => {
    const source = await scene();
    for (const token of ['hp-fill', 'floater', 'crit', 'miss', '跳过', 'result-banner']) {
      expect(source).toContain(token);
    }
  });

  it('终结横幅荣誉文案中性：负值写「防线告破」不写羞辱性措辞', async () => {
    const source = await scene();
    expect(source).toContain('挑战成功');
    expect(source).toContain('防线告破');
    expect(source).not.toContain('你输了');
  });
});

describe('ArenaHonorShop 荣誉商店（docs/53 §4.1）', () => {
  it('每格两条路：荣誉直购 + 碎片 40 换 1（非独占快车道）', async () => {
    const source = await shop();
    expect(source).toContain('ARENA_FRAGMENT_EXCHANGE_COST');
    expect(source).toContain('buyShopEntry');
    expect(source).toContain('exchangeStigmaFragments');
  });

  it('明示套装效果只在竞技场内生效', async () => {
    const source = await shop();
    expect(source).toContain('仅在竞技场内生效');
  });
});
