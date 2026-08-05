import { describe, expect, it } from 'vitest';
import { buildTrialCombatant } from '../trial';
import {
  buildTrialFormulaStamp,
  LEGACY_TRIAL_FORMULA_VERSION,
  TRIAL_FORMULA_VERSION,
} from '../trialFormulaVersion';

describe('试炼公式版本戳', () => {
  it('当前五职业真实技能引擎使用 v2', () => {
    expect(LEGACY_TRIAL_FORMULA_VERSION).toBe(1);
    expect(TRIAL_FORMULA_VERSION).toBe(4);
    expect(Number.isInteger(TRIAL_FORMULA_VERSION)).toBe(true);
    expect(TRIAL_FORMULA_VERSION).toBeGreaterThan(0);
  });

  it('由唯一构造点生成数据库字段', () => {
    expect(buildTrialFormulaStamp()).toEqual({ trial_formula_version: TRIAL_FORMULA_VERSION });
  });

  it('A 案：竞技场场景分叉不改变战力口径与 PvE 试炼公式（小榜判据）', () => {
    const equipped = Array.from({ length: 8 }, () => null);
    const pve = buildTrialCombatant({
      name: 'A案探针',
      classId: 'shaman',
      level: 120,
      equipped,
    });
    const arena = buildTrialCombatant({
      name: 'A案探针',
      classId: 'shaman',
      level: 120,
      equipped,
      arena: true,
    });
    // 同一构筑传/不传 arena，战力与搭配哈希必须逐点相同（技能倍率不进 CP）
    expect(arena.combatPower).toBe(pve.combatPower);
    expect(arena.buildHash).toBe(pve.buildHash);
    // 分叉确实生效：竞技场召唤倍率与 PvE 不同
    expect((arena.skillKit.summons ?? []).map((entry) => entry.attackMultiplier)).not.toEqual(
      (pve.skillKit.summons ?? []).map((entry) => entry.attackMultiplier),
    );
  });
});
