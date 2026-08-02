import { describe, expect, it } from 'vitest';
import {
  advanceStageKillProgress,
  evaluateChapterGate,
  evaluateChallengeCost,
  evaluateSweepCost,
} from '../stageProgress';
import { ALL_CHAPTERS } from '@/data/regions';
import { stagesOfChapter } from '@/data/stages';
import {
  CHAPTER_GATE_CP_RATIO,
  GATE_LEGACY_LEVEL_MARGIN,
  REGION_GATE_CP_RATIO,
  STAGE_CHALLENGE_STAMINA_COST,
  STAMINA_RECOVER_SECONDS,
  SWEEP_STAMINA_COST,
} from '@/data/constants';

describe('关卡击杀进度', () => {
  it('普通关首通前累积，首通后保持满进度', () => {
    expect(advanceStageKillProgress(4, 3, 10, 1, false, false)).toEqual({
      progress: 7,
      clearedNow: false,
      bossKills: 0,
    });
    expect(advanceStageKillProgress(7, 5, 10, 1, false, false)).toEqual({
      progress: 10,
      clearedNow: true,
      bossKills: 0,
    });
    expect(advanceStageKillProgress(10, 50, 10, 1, true, false)).toEqual({
      progress: 10,
      clearedNow: false,
      bossKills: 0,
    });
  });

  it('BOSS 只在完整波次结束时计数，并保留下一轮余数', () => {
    expect(advanceStageKillProgress(8, 5, 10, 1, false, true)).toEqual({
      progress: 3,
      clearedNow: true,
      bossKills: 1,
    });
    expect(advanceStageKillProgress(3, 28, 10, 1, true, true)).toEqual({
      progress: 1,
      clearedNow: false,
      bossKills: 3,
    });
  });

  it('兼容旧存档中已通关 BOSS 关保存为满进度的状态', () => {
    expect(advanceStageKillProgress(10, 10, 10, 1, true, true)).toEqual({
      progress: 0,
      clearedNow: false,
      bossKills: 1,
    });
  });

  it('拒绝负数、小数和未通关越界状态', () => {
    expect(() => advanceStageKillProgress(-1, 1, 10, 1, false, true)).toThrow();
    expect(() => advanceStageKillProgress(0, 0.5, 10, 1, false, true)).toThrow();
    expect(() => advanceStageKillProgress(0, 1, 0, 1, false, true)).toThrow();
    expect(() => advanceStageKillProgress(10, 1, 10, 1, false, true)).toThrow();
  });
});

describe('章节进入门槛（docs/56 §3.3）', () => {
  it('游戏第一章永远敞开', () => {
    const g = evaluateChapterGate(0, 1, ALL_CHAPTERS[0]!.id);
    expect(g.ok).toBe(true);
    expect(g.requiredCp).toBe(0);
  });

  it('战力不足被拦，缺口精确；达标放行', () => {
    const chapter = ALL_CHAPTERS[1]!;
    const first = stagesOfChapter(chapter.id)[0]!;
    const ratio = chapter.id.endsWith('-1') ? REGION_GATE_CP_RATIO : CHAPTER_GATE_CP_RATIO;
    const need = Math.round(first.recommendCP * ratio);

    const blocked = evaluateChapterGate(need - 50, 1, chapter.id);
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toBe('cp');
    expect(blocked.gapCp).toBe(50);

    const passed = evaluateChapterGate(need, 1, chapter.id);
    expect(passed.ok).toBe(true);
    expect(passed.gapCp).toBe(0);
  });

  it('区域首章用更高的门槛比例', () => {
    const regionFirst = ALL_CHAPTERS.find((c, i) => i > 0 && c.id.endsWith('-1'))!;
    const inner = ALL_CHAPTERS.find((c, i) => i > 0 && !c.id.endsWith('-1'))!;
    const gr = evaluateChapterGate(0, 1, regionFirst.id);
    const gi = evaluateChapterGate(0, 1, inner.id);
    const firstR = stagesOfChapter(regionFirst.id)[0]!;
    const firstI = stagesOfChapter(inner.id)[0]!;
    expect(gr.requiredCp).toBe(Math.round(firstR.recommendCP * REGION_GATE_CP_RATIO));
    expect(gi.requiredCp).toBe(Math.round(firstI.recommendCP * CHAPTER_GATE_CP_RATIO));
  });

  it('老档等级后门：等级远超章节时放行且不显示缺口（docs/40 不没收已得进度）', () => {
    const chapter = ALL_CHAPTERS[3]!;
    const g = evaluateChapterGate(1, chapter.levelFrom + GATE_LEGACY_LEVEL_MARGIN, chapter.id);
    expect(g.ok).toBe(true);
    expect(g.reason).toBe('legacy-bypass');
    expect(g.gapCp).toBe(0);
  });

  it('未知章节直接暴露配置错误', () => {
    expect(() => evaluateChapterGate(0, 1, 'no-such')).toThrow('章节不存在');
  });
});

describe('通关循环数 clearCycles（docs/56 §8 节奏重排）', () => {
  it('首通需要打满 cycle × clearCycles，只跨一轮不算通', () => {
    // 循环 10 × 3 轮 = 首通目标 30
    const r = advanceStageKillProgress(8, 5, 10, 3, false, true);
    expect(r.clearedNow).toBe(false);
    expect(r.progress).toBe(13);
    // 8→13 跨过第 10 只：这一轮的 BOSS 照常出场掉落
    expect(r.bossKills).toBe(1);
  });

  it('未通关阶段 BOSS 按波次循环照常出场，掉落节奏与通关后一致', () => {
    // 一口气跨 2 个循环边界
    const r = advanceStageKillProgress(3, 20, 10, 5, false, true);
    expect(r.clearedNow).toBe(false);
    expect(r.bossKills).toBe(2);
  });

  it('打满全部循环即通关，进入余数循环模式', () => {
    const r = advanceStageKillProgress(25, 8, 10, 3, false, true);
    expect(r.clearedNow).toBe(true);
    expect(r.progress).toBe(3); // 33 % 10
    expect(r.bossKills).toBe(1); // 25→33 只跨了 30 这一个边界
  });

  it('未通关击杀数越界按新目标判定', () => {
    expect(() => advanceStageKillProgress(30, 1, 10, 3, false, true)).toThrow('越界');
    // 旧目标 10 会炸的值在 3 轮制下合法
    expect(advanceStageKillProgress(15, 1, 10, 3, false, false).clearedNow).toBe(false);
  });
});

describe('挑战体力核算（docs/56 §5）', () => {
  const NOW = 1_700_000_000_000;

  it('已通关关卡零消耗——挂机是本体，收体力费等于赶人', () => {
    const r = evaluateChallengeCost('s1', ['s1'], 0, 120, NOW, NOW);
    expect(r.ok).toBe(true);
    expect(r.cost).toBe(0);
  });

  it('未通关关卡收固定费，体力足够即放行', () => {
    const r = evaluateChallengeCost('s2', ['s1'], 120, 120, NOW, NOW);
    expect(r.ok).toBe(true);
    expect(r.cost).toBe(STAGE_CHALLENGE_STAMINA_COST);
  });

  it('体力不足给出精确的下一点倒计时', () => {
    const halfWay = NOW - (STAMINA_RECOVER_SECONDS / 2) * 1000;
    const r = evaluateChallengeCost('s2', [], 0, 120, halfWay, NOW);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('stamina');
    expect(r.nextPointInSeconds).toBe(STAMINA_RECOVER_SECONDS / 2);
  });
});

describe('扫荡体力', () => {
  const NOW = 1_700_000_000_000;

  it('未通关的关卡不给扫——扫荡是重复已通关的内容，不是跳关', () => {
    const r = evaluateSweepCost('s2', ['s1'], 1, 120, 120, NOW, NOW);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not-cleared');
    // 未通关时不报价：显示一个根本不该出现的价格会让玩家以为攒够体力就能扫
    expect(r.cost).toBe(0);
  });

  it('已通关且体力充足：按次数线性收费', () => {
    const one = evaluateSweepCost('s1', ['s1'], 1, 120, 120, NOW, NOW);
    expect(one.ok).toBe(true);
    expect(one.cost).toBe(SWEEP_STAMINA_COST);

    const ten = evaluateSweepCost('s1', ['s1'], 10, 120, 120, NOW, NOW);
    expect(ten.ok).toBe(true);
    expect(ten.cost).toBe(SWEEP_STAMINA_COST * 10);
  });

  it('★ 体力不足时给出「还能扫几次」，而不是只说不行', () => {
    // 体力 12 → 按每次 5 点，只够 2 次
    const r = evaluateSweepCost('s1', ['s1'], 10, 12, 120, NOW, NOW);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('stamina');
    expect(r.affordableTimes).toBe(2);
    // docs/40 红线：体力是限制器不是拦路收费，UI 要能把 ×10 降级成 ×2
  });

  it('体力为零时 affordableTimes 为 0，且仍给出恢复倒计时', () => {
    const halfWay = NOW - (STAMINA_RECOVER_SECONDS / 2) * 1000;
    const r = evaluateSweepCost('s1', ['s1'], 1, 0, 120, halfWay, NOW);
    expect(r.affordableTimes).toBe(0);
    expect(r.nextPointInSeconds).toBe(STAMINA_RECOVER_SECONDS / 2);
  });

  it('次数被规范化：小于 1 或小数都按至少 1 次算，不产生 0 消耗的免费扫荡', () => {
    for (const bad of [0, -3, 0.4, 1.9]) {
      const r = evaluateSweepCost('s1', ['s1'], bad, 120, 120, NOW, NOW);
      expect(r.cost).toBe(SWEEP_STAMINA_COST);
    }
  });
});
