import { describe, expect, it } from 'vitest';
import { advanceEncounterState, resolveEncounterChoice, type EncounterState } from '../encounters';
import { ENCOUNTERS, ENCOUNTER_TIMING, encounterIdsForRegion } from '@/data/encounters';
import { getItem } from '@/data/items';

const emptyState = (): EncounterState => ({
  progressSec: 0,
  generatedCount: 0,
  resolvedCount: 0,
  pending: [],
});

describe('idle encounters', () => {
  const r1Ids = encounterIdsForRegion('r1');

  it('首次有效挂机达到 60 秒后生成当前地区奇遇', () => {
    const before = advanceEncounterState(emptyState(), 59, 'r1', r1Ids, 42, ENCOUNTER_TIMING);
    expect(before.pending).toHaveLength(0);
    const after = advanceEncounterState(before, 1, 'r1', r1Ids, 42, ENCOUNTER_TIMING);
    expect(after.pending).toHaveLength(1);
    expect(after.pending[0]?.regionId).toBe('r1');
    expect(r1Ids).toContain(after.pending[0]?.encounterId);
  });

  it('相同种子、序号和地区产生相同序列', () => {
    const a = advanceEncounterState(emptyState(), 1_260, 'r1', r1Ids, 77, ENCOUNTER_TIMING);
    const b = advanceEncounterState(emptyState(), 1_260, 'r1', r1Ids, 77, ENCOUNTER_TIMING);
    expect(a).toEqual(b);
  });

  it('队列最多三个且满后不累计额外时间欠账', () => {
    const full = advanceEncounterState(emptyState(), 99_999, 'r1', r1Ids, 88, ENCOUNTER_TIMING);
    expect(full.pending).toHaveLength(3);
    expect(full.progressSec).toBe(0);
    expect(advanceEncounterState(full, 999, 'r1', r1Ids, 88, ENCOUNTER_TIMING)).toEqual(full);
  });

  it('资源充足时原子扣除成本并增加奖励', () => {
    const choice = ENCOUNTERS.enc_r1_petalsmith!.choices[0];
    expect(
      resolveEncounterChoice(choice, {
        gold: 10,
        items: { petal_sakura: 3, grass_soft: 2, stone_enhance: 1 },
      }),
    ).toEqual({ ok: true, wallet: { gold: 40, items: { stone_enhance: 3 } } });
  });

  it('资源不足时不返回任何部分结算状态', () => {
    const choice = ENCOUNTERS.enc_r1_petalsmith!.choices[0];
    expect(
      resolveEncounterChoice(choice, { gold: 10, items: { petal_sakura: 3, grass_soft: 1 } }),
    ).toEqual({ ok: false, reason: 'insufficient-resource' });
  });

  it('所有配置都有两个选项、免费退路且只引用存在的物品', () => {
    for (const encounter of Object.values(ENCOUNTERS)) {
      expect(encounter.choices).toHaveLength(2);
      expect(encounter.choices.some((choice) => !choice.costs)).toBe(true);
      for (const choice of encounter.choices) {
        for (const id of Object.keys(choice.costs?.items ?? {})) expect(getItem(id)).toBeDefined();
        for (const id of Object.keys(choice.rewards?.items ?? {}))
          expect(getItem(id)).toBeDefined();
      }
    }
  });
});
