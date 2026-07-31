import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * docs/57 数值重构 kimi 侧 UI 任务书（K1~K7）的源码契约测试。
 *
 * 门槛 / 体力 / 战败 / 软上限的 core 实现由 claude 落地（docs/56）：
 *   - game.evaluateStageEntry(stageId) → { gate, cost }
 *   - game.defeatReport / game.dismissDefeatReport()
 *   - game.levelCapInfo
 * UI 一律读 store 暴露面，不自行复算战力或门槛（docs/57 §四）。
 */

const stageSelectSource = readFileSync(new URL('../StageSelect.vue', import.meta.url), 'utf8');
const idleViewSource = readFileSync(new URL('../../views/IdleView.vue', import.meta.url), 'utf8');
const topBarSource = readFileSync(new URL('../TopBar.vue', import.meta.url), 'utf8');
const dungeonViewSource = readFileSync(
  new URL('../../views/DungeonView.vue', import.meta.url),
  'utf8',
);
const defeatReportSource = readFileSync(new URL('../DefeatReport.vue', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../../App.vue', import.meta.url), 'utf8');

describe('K1 · 章节锁定卡（指路牌不是墙）', () => {
  it('锁定卡给出所需战力、还差多少与去养成入口', () => {
    expect(stageSelectSource).toContain('gate-card');
    expect(stageSelectSource).toContain('进入需要战力');
    expect(stageSelectSource).toContain('还差');
    expect(stageSelectSource).toContain('试试强化武器或洗练词条');
    expect(stageSelectSource).toContain('去养成');
    expect(stageSelectSource).toContain("ui.setTab('growth')");
  });

  it('门槛判定一律走 store 暴露面，老档后门放行不显示门槛条', () => {
    expect(stageSelectSource).toContain('game.evaluateStageEntry(first.id).gate');
    expect(stageSelectSource).toContain("gate.reason === 'cp' ? gate : null");
    // 不自己用顺序解锁状态预判门槛（已解锁未通关的首关正是门槛生效处）
    expect(stageSelectSource).not.toContain('stage.isUnlocked(first.id)');
  });

  it('没有冷拒绝文案，且 320px 小屏锁定卡按钮通栏可读', () => {
    expect(stageSelectSource).not.toContain('无法进入');
    expect(stageSelectSource).not.toContain('战力不足，无法进入');
    expect(stageSelectSource).toContain('@media (max-width: 340px)');
  });
});

describe('K2 · 挑战体力显示', () => {
  it('未通关关卡显示挑战消耗，已通关恒 0 不显示', () => {
    expect(stageSelectSource).toContain('isStageCleared');
    expect(stageSelectSource).toContain('clearedStageIds');
    expect(stageSelectSource).toContain('挑战');
    expect(idleViewSource).toContain('showChallengeCost');
    expect(idleViewSource).toContain('!stage.cleared && challengeCost.value.ok');
  });

  it('体力不足：置灰 + 距可挑战分钟数（nextPointInSeconds 推算）', () => {
    expect(stageSelectSource).toContain('staminaBlocked');
    expect(stageSelectSource).toContain('分钟后可挑战');
    expect(stageSelectSource).toContain('minutesToChallenge');
    expect(idleViewSource).toContain('体力恢复中');
    // 体力核算走 store 暴露面
    expect(stageSelectSource).toContain('game.evaluateStageEntry(stageId).cost');
    expect(idleViewSource).toContain('game.evaluateStageEntry(stage.current.id).cost');
  });

  it('倒计时有低频跳秒驱动，且不出现付费/广告恢复入口', () => {
    expect(stageSelectSource).toContain('useNowTick');
    expect(idleViewSource).toContain('useNowTick');
    for (const source of [stageSelectSource, idleViewSource]) {
      expect(source).not.toContain('购买体力');
      expect(source).not.toContain('看广告');
    }
  });
});

describe('K3 · 战败战报弹层', () => {
  it('结构：元凶 + 有温度的败退文案 + 退回关卡 + 两个按钮', () => {
    expect(defeatReportSource).toContain('report.monsterName');
    expect(defeatReportSource).toContain('report.toStageName');
    expect(defeatReportSource).toContain('先养成');
    expect(defeatReportSource).toContain('知道了');
    expect(defeatReportSource).toContain("ui.setTab('growth')");
  });

  it('复用全局 overlay 模式并全局挂载，关闭走 store 的 dismiss', () => {
    expect(defeatReportSource).toContain('class="overlay"');
    expect(defeatReportSource).toContain('game.dismissDefeatReport()');
    expect(appSource).toContain('<DefeatReport />');
  });

  it('单值战报不叠多层，且不出现损失类字样', () => {
    expect(defeatReportSource).toContain('computed(() => game.defeatReport)');
    expect(defeatReportSource).not.toContain('损失');
    expect(defeatReportSource).not.toContain('扣除');
  });
});

describe('K4 · 经验条冻结态', () => {
  it('直连 game store 的 levelCapInfo', () => {
    expect(topBarSource).toContain('gameStore.levelCapInfo');
  });

  it('冻结时满格呼吸 + 区域顶点角标 + 点击 tooltip', () => {
    expect(topBarSource).toContain('frozen: expFrozen');
    expect(topBarSource).toContain('exp-frozen-breathe');
    expect(topBarSource).toContain('区域顶点');
    expect(topBarSource).toContain('已达当前区域顶点');
    expect(topBarSource).toContain('capInfo.softCap');
    expect(topBarSource).toContain('capInfo.pendingExp');
    expect(topBarSource).toContain('toggleCapTip');
  });

  it('冻结态停播普通经验流光（「停住了」要成立），解冻自动收起 tooltip', () => {
    expect(topBarSource).toContain('.expbar.frozen .expbar-fill::after');
    expect(topBarSource).toContain('if (!frozen) capTipOpen.value = false');
  });

  it('经验条不裁剪向上浮出的区域顶点角标', () => {
    const expbarCss = topBarSource.match(/\.expbar\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(expbarCss).toContain('overflow: visible');
    expect(expbarCss).not.toContain('overflow: hidden');
  });
});

describe('K5 · crimson 档敬请期待', () => {
  it('防御式读取 comingSoon，暗色卡 + 区域 7 开放后解锁 + 不可点击', () => {
    expect(dungeonViewSource).toContain('tierComingSoon');
    expect(dungeonViewSource).toContain('comingSoon?: boolean');
    expect(dungeonViewSource).toContain('区域 7 开放后解锁');
    expect(dungeonViewSource).toContain(':disabled="tierComingSoon(candidate.tierId)"');
    expect(dungeonViewSource).toContain('coming-soon');
  });

  it('敬请期待卡不显示门槛数字，其余三档交互不受影响', () => {
    expect(dungeonViewSource).toContain('<small v-if="tierComingSoon(candidate.tierId)">');
    expect(dungeonViewSource).toContain('<small v-else>Lv{{ candidate.unlockLevel }}</small>');
  });
});

describe('K7 · 红线自检（docs/40 §三）', () => {
  it('全部新 UI 没有攀比/倒计时施压/付费恢复/冷拒绝表述', () => {
    const all = [
      stageSelectSource,
      idleViewSource,
      topBarSource,
      dungeonViewSource,
      defeatReportSource,
    ];
    for (const source of all) {
      expect(source).not.toContain('被超越');
      expect(source).not.toContain('你退步了');
      expect(source).not.toContain('仅剩');
      expect(source).not.toContain('购买体力');
      expect(source).not.toContain('看广告');
      expect(source).not.toContain('无法进入');
    }
  });
});

describe('M5-7 · 属性克制教学', () => {
  it('关卡选择与挂机窗口都消费统一属性关系组件', () => {
    expect(stageSelectSource).toContain('ElementMatchupGuide');
    expect(stageSelectSource).toContain(':defender-element="c.element"');
    expect(stageSelectSource).toContain('player.playerCombatElement');
    expect(idleViewSource).toContain('ElementMatchupGuide');
    expect(idleViewSource).toContain(':defender-element="stage.current.element"');
    expect(idleViewSource).toContain(':attacker-element="player.playerCombatElement"');
  });

  it('有属性章节在折叠标题上也明确展示关卡属性', () => {
    expect(stageSelectSource).toContain("c.element !== 'none'");
    expect(stageSelectSource).toContain('ELEMENT_LABELS[c.element]');
    expect(stageSelectSource).toContain('属性');
  });
});
