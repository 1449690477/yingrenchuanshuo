import { describe, expect, it } from 'vitest';
import {
  advanceEncounterState,
  encounterRewardSeed,
  resolveEncounterChoice,
  type EncounterState,
} from '../encounters';
import { Rng } from '../rng';
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
    const result = resolveEncounterChoice(
      choice,
      { gold: 10, items: { petal_sakura: 3, grass_soft: 2, stone_enhance: 1 } },
      new Rng(123),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.wallet.gold).toBe(10 + (result.rewards.gold ?? 0));
    expect(Object.keys(result.rewards.items ?? {})).not.toHaveLength(0);
  });

  it('资源不足时不返回任何部分结算状态', () => {
    const choice = ENCOUNTERS.enc_r1_petalsmith!.choices[0];
    expect(
      resolveEncounterChoice(
        choice,
        { gold: 10, items: { petal_sakura: 3, grass_soft: 1 } },
        new Rng(456),
      ),
    ).toEqual({ ok: false, reason: 'insufficient-resource' });
  });

  it('相同奇遇与选项的奖励可复现且不受调用顺序影响', () => {
    const choice = ENCOUNTERS.enc_r1_petalsmith!.choices[0];
    const seed = encounterRewardSeed(2026, 'enc_7', choice.id);
    const wallet = { gold: 0, items: { petal_sakura: 3, grass_soft: 2 } };
    expect(resolveEncounterChoice(choice, wallet, new Rng(seed))).toEqual(
      resolveEncounterChoice(choice, wallet, new Rng(seed)),
    );
  });

  it('不同种子能够产生不同的隐藏奖励结果', () => {
    const choice = ENCOUNTERS.enc_r1_petalsmith!.choices[0];
    const wallet = { gold: 0, items: { petal_sakura: 3, grass_soft: 2 } };
    const results = new Set(
      Array.from({ length: 20 }, (_, seed) =>
        JSON.stringify(resolveEncounterChoice(choice, wallet, new Rng(seed + 1))),
      ),
    );
    expect(results.size).toBeGreaterThan(1);
  });

  it('所有配置都有两个选项、免费退路且付费选项不会空手而归', () => {
    for (const encounter of Object.values(ENCOUNTERS)) {
      expect(encounter.choices).toHaveLength(2);
      expect(encounter.choices.some((choice) => !choice.costs)).toBe(true);
      for (const choice of encounter.choices) {
        for (const id of Object.keys(choice.costs?.items ?? {})) expect(getItem(id)).toBeDefined();
        for (const variant of choice.rewardPool ?? []) {
          const resources = variant.rewards;
          expect(variant.weight).toBeGreaterThan(0);
          expect(Boolean(resources.gold) || Object.keys(resources.items ?? {}).length > 0).toBe(
            true,
          );
          if (resources.gold) {
            expect(resources.gold.min).toBeGreaterThan(0);
            expect(resources.gold.max).toBeGreaterThanOrEqual(resources.gold.min);
          }
          for (const [id, range] of Object.entries(resources.items ?? {})) {
            expect(getItem(id)).toBeDefined();
            expect(range.min).toBeGreaterThan(0);
            expect(range.max).toBeGreaterThanOrEqual(range.min);
          }
        }
        if (choice.costs) expect(choice.rewardPool?.length).toBeGreaterThan(0);
      }
    }
  });

  it('每个付费奖励档的最低折算价值不低于提交材料', () => {
    for (const encounter of Object.values(ENCOUNTERS)) {
      for (const choice of encounter.choices.filter((entry) => entry.costs)) {
        const costValue =
          (choice.costs?.gold ?? 0) +
          Object.entries(choice.costs?.items ?? {}).reduce(
            (sum, [id, count]) => sum + getItem(id)!.sellPrice * count,
            0,
          );
        for (const variant of choice.rewardPool ?? []) {
          const rewardValue =
            (variant.rewards.gold?.min ?? 0) +
            Object.entries(variant.rewards.items ?? {}).reduce(
              (sum, [id, range]) => sum + getItem(id)!.sellPrice * range.min,
              0,
            );
          expect(rewardValue, `${encounter.id}/${choice.id}`).toBeGreaterThanOrEqual(costValue);
        }
      }
    }
  });
});
