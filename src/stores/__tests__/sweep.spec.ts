import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SWEEP_STAMINA_COST } from '@/data/constants';
import { FIRST_STAGE_ID } from '@/data/stages';
import { clearSave } from '@/save/storage';
import { useGameStore } from '@/stores/game';

/**
 * 扫荡的 store 级验证（M3-7）。
 *
 * 这里验的是**产出真的进了存档、体力真的扣了**，
 * 而不是「函数返回了一个对象」—— 后者在扣减写错位置时照样是绿的。
 */

beforeEach(async () => {
  setActivePinia(createPinia());
  await clearSave();
});

afterEach(async () => {
  await clearSave();
});

/** 造一个「首关已通关、体力满」的存档：扫荡只对已通关关卡开放。 */
async function clearedSave() {
  const game = useGameStore();
  await game.startNewGame('小督', 'swordsman');
  game.save!.progress.clearedStageIds = [FIRST_STAGE_ID];
  game.save!.player.stamina = game.staminaMax;
  return game;
}

describe('扫荡 · store', () => {
  it('未通关的关卡扫不动，且不动任何状态', async () => {
    const game = useGameStore();
    await game.startNewGame('小督', 'swordsman');
    game.save!.player.stamina = game.staminaMax;
    const before = game.save!.player.stamina;

    expect(game.sweepStage(1)).toBeNull();
    // 关键：失败路径**一点体力都不能扣**
    expect(game.save!.player.stamina).toBe(before);
  });

  it('已通关关卡：扣体力、产出入账、返回汇总', async () => {
    const game = await clearedSave();
    const before = {
      stamina: game.save!.player.stamina,
      gold: game.save!.player.gold,
      exp: game.save!.player.exp,
      kills: game.save!.stats.totalKills,
    };

    const r = game.sweepStage(1);
    expect(r).not.toBeNull();
    expect(r!.times).toBe(1);
    expect(r!.staminaSpent).toBe(SWEEP_STAMINA_COST);

    expect(game.save!.player.stamina).toBe(before.stamina - SWEEP_STAMINA_COST);
    // 产出必须真的落进存档，不是只出现在返回值里
    expect(game.save!.stats.totalKills).toBeGreaterThan(before.kills);
    expect(game.save!.player.gold + game.save!.player.exp).toBeGreaterThan(
      before.gold + before.exp,
    );
  });

  it('×10 的产出与体力都是 ×1 的十倍量级——不是只扣十倍体力', async () => {
    const one = await clearedSave();
    const r1 = one.sweepStage(1)!;

    setActivePinia(createPinia());
    await clearSave();
    const ten = await clearedSave();
    const r10 = ten.sweepStage(10)!;

    expect(r10.staminaSpent).toBe(SWEEP_STAMINA_COST * 10);

    /**
     * ★ 这里**不能**断言恰好十倍，原因是浮点而不是逻辑：
     * 击杀数 = floor(每秒击杀 × 秒数)，而一次算 18000 秒与十次各算 1800 秒
     * 的浮点误差方向不同。实测 kps=0.8583333333333333 时
     * ×1800 得 1545.0000000000002（floor 1545）、×18000 得 15449.999999999998
     * （floor 15449）—— 同一个数，只因量级不同，取整差 1。
     *
     * 所以判据是「量级一致、误差不超过一次取整」，不是「精确十倍」。
     * 写成精确相等会得到一个**随浮点抖动随机变红**的测试，那比没有更糟。
     */
    expect(r10.yield.kills).toBeGreaterThanOrEqual(r1.yield.kills * 10 - 10);
    expect(r10.yield.kills).toBeLessThanOrEqual(r1.yield.kills * 10 + 10);
    // 但方向性必须成立：十次远多于一次，不能因为取整就少给一个数量级
    expect(r10.yield.kills).toBeGreaterThan(r1.yield.kills * 9);
  });

  it('★ 体力不足时整体拒绝，不做「扣得起多少算多少」的半次扫荡', async () => {
    const game = await clearedSave();
    game.save!.player.stamina = SWEEP_STAMINA_COST * 2; // 只够 2 次
    const before = game.save!.player.stamina;

    expect(game.sweepStage(10)).toBeNull();
    expect(game.save!.player.stamina).toBe(before);
    // UI 该用 sweepCost(10).affordableTimes 把按钮降级成 ×2，而不是让 store 擅自减量
    expect(game.sweepCost(10).affordableTimes).toBe(2);
  });

  it('体力恰好够时可以扫到 0，不留下无法使用的余量', async () => {
    const game = await clearedSave();
    game.save!.player.stamina = SWEEP_STAMINA_COST * 3;

    expect(game.sweepStage(3)).not.toBeNull();
    expect(game.save!.player.stamina).toBe(0);
  });
});
