/**
 * 进度榜纯函数的契约测试（docs/63 §五 · P4）。
 *
 * 覆盖三防线的本地半边：
 *   - L1 结构白名单：关卡必须在推进链上；时刻窗口 [赛季起点, now+5min]
 *   - L3 同源门槛：与 evaluateChapterGate 同一份实现（首章恒过 /
 *     末关 0 战力拒 / 顶格战力过 / 老档等级后门）
 *   - 排序口径：更深者胜、同深更早者胜、无时刻排最后（不是惩罚，
 *     是「没有证据就不能主张更早」，docs/62 §4.1）
 *
 * 关卡 id 一律从 ORDERED_STAGE_IDS 现取，不硬编码 —— 加新区域自动跟随。
 */

import { describe, expect, it } from 'vitest';
import { GATE_LEGACY_LEVEL_MARGIN } from '@/data/constants';
import { ALL_CHAPTERS } from '@/data/regions';
import { ORDERED_STAGE_IDS, getStage } from '@/data/stages';
import {
  PROGRESS_CLAIM_CLOCK_SKEW_MS,
  PROGRESS_CLAIM_MIN_AT,
  deepestProgressClaim,
  evaluateProgressClaim,
  isProgressClaimWellFormed,
  progressRowBeatsRow,
  progressStageIndex,
  progressStageLabel,
} from '../progressBoard';

const FIRST = ORDERED_STAGE_IDS[0]!;
const LAST = ORDERED_STAGE_IDS.at(-1)!;
const NOW = Date.parse('2026-07-01T12:00:00.000Z');

describe('progressStageIndex', () => {
  it('序号就是推进链上的位置；未登记 id 为 -1', () => {
    expect(progressStageIndex(FIRST)).toBe(0);
    expect(progressStageIndex(LAST)).toBe(ORDERED_STAGE_IDS.length - 1);
    expect(progressStageIndex('stage_99-9_6')).toBe(-1);
  });
});

describe('deepestProgressClaim', () => {
  it('一关未通 → null（榜上还没有这个人）', () => {
    expect(deepestProgressClaim([], {})).toBeNull();
  });

  it('取已通关集合里推进序号最大的一关，与输入顺序无关', () => {
    const cleared = [ORDERED_STAGE_IDS[5]!, ORDERED_STAGE_IDS[2]!, ORDERED_STAGE_IDS[9]!];
    const claim = deepestProgressClaim(cleared, {});
    expect(claim?.stageId).toBe(ORDERED_STAGE_IDS[9]);
  });

  it('未登记的白名单外 id 一律忽略（旧档可能留着已下线的关卡）', () => {
    const claim = deepestProgressClaim(['stage_99-9_6', ORDERED_STAGE_IDS[3]!], {});
    expect(claim?.stageId).toBe(ORDERED_STAGE_IDS[3]);
    expect(deepestProgressClaim(['stage_99-9_6'], {})).toBeNull();
  });

  it('有时刻带时刻；最深关缺时刻 → null（老档不补记）', () => {
    const cleared = ORDERED_STAGE_IDS.slice(0, 4);
    const at = { [ORDERED_STAGE_IDS[3]!]: NOW - 5000 };
    expect(deepestProgressClaim(cleared, at)?.firstClearedAt).toBe(NOW - 5000);
    expect(deepestProgressClaim(cleared, {})?.firstClearedAt).toBeNull();
  });
});

describe('isProgressClaimWellFormed（L1 结构白名单）', () => {
  it('合法：链上关卡 + 窗口内整数时刻；无时刻也合法', () => {
    expect(isProgressClaimWellFormed({ stageId: FIRST, firstClearedAt: NOW - 1000 }, NOW)).toBe(true);
    expect(isProgressClaimWellFormed({ stageId: LAST, firstClearedAt: null }, NOW)).toBe(true);
  });

  it('未登记的关卡 id 一律不合法', () => {
    expect(isProgressClaimWellFormed({ stageId: 'stage_99-9_6', firstClearedAt: NOW }, NOW)).toBe(false);
  });

  it('时刻窗口：[赛季起点, now+5min]，边界两侧各取一点', () => {
    expect(
      isProgressClaimWellFormed({ stageId: FIRST, firstClearedAt: PROGRESS_CLAIM_MIN_AT }, NOW),
    ).toBe(true);
    expect(
      isProgressClaimWellFormed({ stageId: FIRST, firstClearedAt: PROGRESS_CLAIM_MIN_AT - 1 }, NOW),
    ).toBe(false);
    // 时钟漂移容差内放行，超出即拒
    expect(
      isProgressClaimWellFormed(
        { stageId: FIRST, firstClearedAt: NOW + PROGRESS_CLAIM_CLOCK_SKEW_MS },
        NOW,
      ),
    ).toBe(true);
    expect(
      isProgressClaimWellFormed(
        { stageId: FIRST, firstClearedAt: NOW + PROGRESS_CLAIM_CLOCK_SKEW_MS + 1 },
        NOW,
      ),
    ).toBe(false);
  });

  it('非整数时刻不合法（客户端载荷必须是 epoch ms 整数）', () => {
    expect(isProgressClaimWellFormed({ stageId: FIRST, firstClearedAt: NOW + 0.5 }, NOW)).toBe(false);
  });
});

describe('evaluateProgressClaim（L3 同源门槛）', () => {
  it('游戏第一章永远敞开：Lv1 / 0 战力报首关也 verified', () => {
    const v = evaluateProgressClaim(
      { stageId: FIRST, firstClearedAt: NOW },
      { level: 1, combatPower: 0 },
    );
    expect(v).toEqual({ verified: true, verdict: 'ok' });
  });

  it('末关 Lv1 / 0 战力 → cp-insufficient，收下但不入榜', () => {
    const v = evaluateProgressClaim(
      { stageId: LAST, firstClearedAt: NOW },
      { level: 1, combatPower: 0 },
    );
    expect(v).toEqual({ verified: false, verdict: 'cp-insufficient' });
  });

  it('末关顶格战力 → verified（伪造它要先把自己挂上战力榜）', () => {
    const v = evaluateProgressClaim(
      { stageId: LAST, firstClearedAt: NOW },
      { level: 1, combatPower: Number.MAX_SAFE_INTEGER },
    );
    expect(v).toEqual({ verified: true, verdict: 'ok' });
  });

  it('老档等级后门：等级够 chapter.levelFrom + margin，0 战力也 verified', () => {
    const chapter = ALL_CHAPTERS.find((c) => c.id === getStage(LAST)!.chapterId)!;
    const v = evaluateProgressClaim(
      { stageId: LAST, firstClearedAt: NOW },
      { level: chapter.levelFrom + GATE_LEGACY_LEVEL_MARGIN, combatPower: 0 },
    );
    expect(v).toEqual({ verified: true, verdict: 'legacy-bypass' });
  });

  it('未登记关卡 → 抛配置错误（响亮地失败，不静默放行）', () => {
    expect(() =>
      evaluateProgressClaim(
        { stageId: 'stage_99-9_6', firstClearedAt: NOW },
        { level: 120, combatPower: 1 },
      ),
    ).toThrow('进度榜关卡不存在');
  });
});

describe('progressStageLabel', () => {
  it('展示名与等级与关卡表一致', () => {
    const stage = getStage(LAST)!;
    expect(progressStageLabel(LAST)).toEqual({ stageName: stage.name, stageLevel: stage.level });
  });
});

describe('progressRowBeatsRow（排序口径）', () => {
  it('更深者在前，与时刻无关', () => {
    expect(
      progressRowBeatsRow(
        { deepestStageIndex: 10, firstClearedAt: 1000 },
        { deepestStageIndex: 9, firstClearedAt: 500 },
      ),
    ).toBe(true);
    // 无时刻但更深，仍然在前（深度优先，时刻只破同深的并列）
    expect(
      progressRowBeatsRow(
        { deepestStageIndex: 10, firstClearedAt: null },
        { deepestStageIndex: 9, firstClearedAt: 500 },
      ),
    ).toBe(true);
  });

  it('同深处更早达成者在前', () => {
    expect(
      progressRowBeatsRow(
        { deepestStageIndex: 10, firstClearedAt: 500 },
        { deepestStageIndex: 10, firstClearedAt: 1000 },
      ),
    ).toBe(true);
    expect(
      progressRowBeatsRow(
        { deepestStageIndex: 10, firstClearedAt: 1000 },
        { deepestStageIndex: 10, firstClearedAt: 500 },
      ),
    ).toBe(false);
  });

  it('同深处无时刻排在有时刻之后（没有证据就不能主张更早）', () => {
    expect(
      progressRowBeatsRow(
        { deepestStageIndex: 10, firstClearedAt: 500 },
        { deepestStageIndex: 10, firstClearedAt: null },
      ),
    ).toBe(true);
    expect(
      progressRowBeatsRow(
        { deepestStageIndex: 10, firstClearedAt: null },
        { deepestStageIndex: 10, firstClearedAt: 500 },
      ),
    ).toBe(false);
  });

  it('完全并列时互不相胜（稳定次序交给服务端）', () => {
    const a = { deepestStageIndex: 10, firstClearedAt: 500 };
    const b = { deepestStageIndex: 10, firstClearedAt: 500 };
    expect(progressRowBeatsRow(a, b)).toBe(false);
    expect(progressRowBeatsRow(b, a)).toBe(false);
  });
});
