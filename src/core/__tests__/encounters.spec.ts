import { describe, expect, it } from 'vitest';
import {
  advanceEncounterState,
  availableEncounterIds,
  encounterRewardSeed,
  memoryDialogueForEncounter,
  relationshipStage,
  rememberEncounterStoryChoice,
  resolveEncounterChoice,
  resolveStoryEncounter,
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
  characters: {},
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

  it('只返回当前地区且开放章节已解锁的奇遇', () => {
    const definitions = Object.values(ENCOUNTERS);
    expect(availableEncounterIds(definitions, 'r1', new Set(['1-1']))).toEqual([
      'enc_r1_petalsmith',
    ]);
    expect(availableEncounterIds(definitions, 'r1', new Set(['1-1', '1-3']))).toEqual([
      'enc_r1_petalsmith',
      'enc_r1_bell',
    ]);
    expect(availableEncounterIds(definitions, 'r1', new Set(['1-1', '1-3', '1-5']))).toEqual([
      'enc_r1_petalsmith',
      'enc_r1_bell',
      'enc_r1_barrier',
    ]);
  });

  it('回到旧关时仍按历史已解锁章节保留后续奇遇', () => {
    const unlockedByHistory = new Set(['1-1', '1-2', '1-3', '1-4', '1-5']);
    expect(availableEncounterIds(Object.values(ENCOUNTERS), 'r1', unlockedByHistory)).toEqual([
      'enc_r1_petalsmith',
      'enc_r1_bell',
      'enc_r1_barrier',
    ]);
  });

  it('角色篇章只开放下一幕，完成第三幕后才开放可重复日常', () => {
    const definitions = Object.values(ENCOUNTERS);
    const chapters = new Set(['1-1', '1-2', '1-3', '1-4', '1-5']);
    const first = availableEncounterIds(definitions, 'r1', chapters, {});
    expect(first).toContain('enc_r1_petalsmith');
    expect(first).not.toContain('enc_r1_petalsmith_doubt');

    const afterFirst = {
      char_akane: {
        bond: 1,
        completedEncounterIds: ['enc_r1_petalsmith'],
        choiceHistory: { enc_r1_petalsmith: 'lasting_grip' },
      },
    };
    const second = availableEncounterIds(definitions, 'r1', chapters, afterFirst);
    expect(second).not.toContain('enc_r1_petalsmith');
    expect(second).toContain('enc_r1_petalsmith_doubt');
    expect(second).not.toContain('enc_r1_petalsmith_first_blade');

    const afterArc = {
      char_akane: {
        bond: 3,
        completedEncounterIds: [
          'enc_r1_petalsmith',
          'enc_r1_petalsmith_doubt',
          'enc_r1_petalsmith_first_blade',
        ],
        choiceHistory: {},
      },
    };
    const daily = availableEncounterIds(definitions, 'r1', chapters, afterArc);
    expect(daily).toContain('enc_r1_petalsmith_daily');
    expect(daily).not.toContain('enc_r1_petalsmith_first_blade');
  });

  it('待处理队列不生成相同奇遇，离线填队列时也保持 ID 唯一', () => {
    const generated = advanceEncounterState(emptyState(), 99_999, 'r1', r1Ids, 88, {
      ...ENCOUNTER_TIMING,
      queueMax: 8,
    });
    expect(new Set(generated.pending.map((entry) => entry.encounterId)).size).toBe(
      generated.pending.length,
    );
    expect(
      availableEncounterIds(
        Object.values(ENCOUNTERS),
        'r1',
        new Set(['1-1', '1-3', '1-5']),
        {},
        new Set(['enc_r1_bell']),
      ),
    ).not.toContain('enc_r1_bell');
  });

  it('剧情回答会写入待处理事件，关闭重开后可恢复且不能反复改答案', () => {
    const definition = ENCOUNTERS.enc_r1_petalsmith!;
    const state = emptyState();
    state.pending.push({ uid: 'enc_story_1', encounterId: definition.id, regionId: 'r1' });

    const remembered = rememberEncounterStoryChoice(
      state,
      'enc_story_1',
      definition,
      'lasting_grip',
    );
    expect(remembered.ok).toBe(true);
    if (!remembered.ok) return;
    expect(remembered.state.pending[0]?.storyChoiceId).toBe('lasting_grip');
    expect(state.pending[0]?.storyChoiceId).toBeUndefined();
    expect(
      rememberEncounterStoryChoice(remembered.state, 'enc_story_1', definition, 'prove_it'),
    ).toEqual({ ok: false, reason: 'already-chosen' });
  });

  it('不同剧情回答完成同一幕获得相同关系进度，且无材料告别也能推进', () => {
    const definition = ENCOUNTERS.enc_r1_petalsmith!;
    const completeWith = (storyChoiceId: string) => {
      const state = emptyState();
      state.pending.push({ uid: 'enc_story_2', encounterId: definition.id, regionId: 'r1' });
      const remembered = rememberEncounterStoryChoice(
        state,
        'enc_story_2',
        definition,
        storyChoiceId,
      );
      expect(remembered.ok).toBe(true);
      if (!remembered.ok) throw new Error('测试夹具未能记录剧情回答');
      return resolveStoryEncounter(
        remembered.state,
        'enc_story_2',
        definition,
        definition.choices[1],
        { gold: 0, items: {} },
        new Rng(7),
      );
    };

    const gentle = completeWith('lasting_grip');
    const bold = completeWith('prove_it');
    expect(gentle.ok).toBe(true);
    expect(bold.ok).toBe(true);
    if (!gentle.ok || !bold.ok) return;
    expect(gentle.relationship).toBe('熟悉');
    expect(bold.relationship).toBe('熟悉');
    expect(gentle.state.characters.char_akane?.bond).toBe(1);
    expect(bold.state.characters.char_akane?.bond).toBe(1);
    expect(gentle.state.characters.char_akane?.choiceHistory[definition.id]).toBe('lasting_grip');
    expect(bold.state.characters.char_akane?.choiceHistory[definition.id]).toBe('prove_it');
  });

  it('材料援助不足不完成篇章，并保留已经记录的回答', () => {
    const definition = ENCOUNTERS.enc_r1_petalsmith!;
    const state = emptyState();
    state.pending.push({
      uid: 'enc_story_3',
      encounterId: definition.id,
      regionId: 'r1',
      storyChoiceId: 'lasting_grip',
    });
    expect(
      resolveStoryEncounter(
        state,
        'enc_story_3',
        definition,
        definition.choices[0],
        { gold: 0, items: {} },
        new Rng(8),
      ),
    ).toEqual({ ok: false, reason: 'insufficient-resource' });
    expect(state.pending[0]?.storyChoiceId).toBe('lasting_grip');
    expect(state.characters).toEqual({});
  });

  it('拒绝结算存档中不属于当前奇遇的剧情回答，且不推进资源与随机序列', () => {
    const definition = ENCOUNTERS.enc_r1_petalsmith!;
    const state = emptyState();
    state.pending.push({
      uid: 'enc_story_invalid',
      encounterId: definition.id,
      regionId: 'r1',
      storyChoiceId: 'deleted_choice',
    });
    const wallet = { gold: 0, items: {} };
    const rewardRng = new Rng(9);
    const rngState = rewardRng.getState();

    expect(
      resolveStoryEncounter(
        state,
        'enc_story_invalid',
        definition,
        definition.choices[1],
        wallet,
        rewardRng,
      ),
    ).toEqual({ ok: false, reason: 'invalid-story-choice' });
    expect(state.pending[0]?.storyChoiceId).toBe('deleted_choice');
    expect(state.characters).toEqual({});
    expect(wallet).toEqual({ gold: 0, items: {} });
    expect(rewardRng.getState()).toBe(rngState);
  });

  it('后续篇章按旧回答追加记忆对白，关系值仅映射为定性阶段', () => {
    const state = emptyState();
    state.characters.char_akane = {
      bond: 1,
      completedEncounterIds: ['enc_r1_petalsmith'],
      choiceHistory: { enc_r1_petalsmith: 'lasting_grip' },
    };
    expect(
      memoryDialogueForEncounter(ENCOUNTERS.enc_r1_petalsmith_doubt!, state)[0]?.text,
    ).toContain('握得久');
    expect([0, 1, 2, 3, 99].map(relationshipStage)).toEqual([
      '初遇',
      '熟悉',
      '亲近',
      '信赖',
      '信赖',
    ]);
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
