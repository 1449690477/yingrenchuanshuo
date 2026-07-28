import { describe, expect, it } from 'vitest';
import { makePlayer } from '../progression';
import {
  createEquipmentDungeonState,
  equipmentDungeonAttemptsRemaining,
  equipmentDungeonDayKey,
  isEquipmentDungeonStageUnlocked,
  resolveEquipmentDungeonChallenge,
  type EquipmentDungeonChallengeInput,
  type EquipmentDungeonState,
} from '../equipmentDungeon';
import { requireEquipmentDungeonStage } from '@/data/equipmentDungeons';
import type { Stats } from '../types';

const NOW = Date.parse('2026-07-28T04:30:00+08:00');

function stats(overrides: Partial<Stats> = {}): Stats {
  return {
    atk: 10_000_000,
    def: 100_000,
    hp: 10_000_000,
    acc: 100_000,
    eva: 500,
    critRate: 25,
    critDmg: 80,
    spd: 3,
    ...overrides,
  };
}

function input(
  overrides: Partial<EquipmentDungeonChallengeInput> = {},
): EquipmentDungeonChallengeInput {
  const stage = requireEquipmentDungeonStage('equipment_weapon_azure');
  return {
    stage,
    state: createEquipmentDungeonState(NOW),
    pity: {},
    player: makePlayer('测试少女', 90, stats()),
    classId: 'witch',
    playerSkillMultiplier: 2,
    rngState: 20260728,
    now: NOW,
    ...overrides,
  };
}

describe('装备副本业务日期与次数', () => {
  it('北京时间 04:00 才切换业务日期', () => {
    const before = Date.parse('2026-07-28T03:59:59+08:00');
    const after = Date.parse('2026-07-28T04:00:00+08:00');
    expect(equipmentDungeonDayKey(before)).toBe('2026-07-27');
    expect(equipmentDungeonDayKey(after)).toBe('2026-07-28');
  });

  it('跨日只重置今日次数，永久通关记录不丢', () => {
    const old: EquipmentDungeonState = {
      dayKey: '2026-07-27',
      clearsToday: 3,
      totalClears: 9,
      records: {
        equipment_weapon_azure: {
          clears: 2,
          firstClearedAt: NOW - 86_400_000,
          bestDurationMs: 12_300,
        },
      },
    };
    expect(equipmentDungeonAttemptsRemaining(old, NOW)).toBe(3);
    const result = resolveEquipmentDungeonChallenge(input({ state: old }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.dayKey).toBe('2026-07-28');
    expect(result.state.clearsToday).toBe(1);
    expect(result.state.totalClears).toBe(10);
    expect(result.state.records.equipment_weapon_azure?.firstClearedAt).toBe(
      NOW - 86_400_000,
    );
  });

  it('每天第 4 次成功领取会被拒绝', () => {
    const full: EquipmentDungeonState = {
      ...createEquipmentDungeonState(NOW),
      clearsToday: 3,
    };
    expect(resolveEquipmentDungeonChallenge(input({ state: full }))).toMatchObject({
      ok: false,
      reason: 'daily-limit',
    });
  });
});

describe('装备副本解锁与战斗事务', () => {
  it('等级与同部位前一档必须同时满足', () => {
    const violet = requireEquipmentDungeonStage('equipment_body_violet');
    const state = createEquipmentDungeonState(NOW);

    expect(isEquipmentDungeonStageUnlocked(violet, state, 99)).toBe(false);
    expect(
      resolveEquipmentDungeonChallenge(
        input({
          stage: violet,
          state,
          player: makePlayer('测试少女', 99, stats()),
        }),
      ),
    ).toMatchObject({ ok: false, reason: 'previous-tier-locked' });

    state.records.equipment_body_azure = {
      clears: 1,
      firstClearedAt: NOW - 1,
      bestDurationMs: 20_000,
    };
    expect(isEquipmentDungeonStageUnlocked(violet, state, 34)).toBe(false);
    expect(isEquipmentDungeonStageUnlocked(violet, state, 35)).toBe(true);
  });

  it('失败不扣次数、不推进主 RNG、也不增长保底', () => {
    const pity = { keep: 7 };
    const result = resolveEquipmentDungeonChallenge(
      input({
        pity,
        player: makePlayer(
          '纸片少女',
          90,
          stats({ atk: 1, def: 0, hp: 1, acc: 1, eva: 0, critRate: 0, spd: 1 }),
        ),
      }),
    );

    expect(result).toMatchObject({
      ok: true,
      win: false,
      nextRngState: 20260728,
      pity,
      state: { clearsToday: 0, totalClears: 0, records: {} },
    });
  });

  it('胜利只产出当前职业的定向装备，并原子推进次数、记录、RNG 与保底', () => {
    const result = resolveEquipmentDungeonChallenge(input());
    expect(result.ok).toBe(true);
    if (!result.ok || !result.win) return;

    expect(result.waves).toHaveLength(2);
    expect(result.waves.every((wave) => wave.result.win)).toBe(true);
    expect(result.drops).toHaveLength(1);
    expect(result.drops[0]?.itemId).toBe('eq_dungeon_azure_weapon_witch');
    expect(result.drops[0]?.count).toBe(2);
    expect(result.state.clearsToday).toBe(1);
    expect(result.state.totalClears).toBe(1);
    expect(result.state.records.equipment_weapon_azure).toMatchObject({
      clears: 1,
      firstClearedAt: NOW,
      bestDurationMs: result.durationMs,
    });
    expect(result.nextRngState).not.toBe(20260728);
  });

  it('相同输入和种子产出、战斗与保底完全一致', () => {
    expect(resolveEquipmentDungeonChallenge(input())).toEqual(
      resolveEquipmentDungeonChallenge(input()),
    );
  });

  it('通用双款连续缺失触发补偿双掉', () => {
    const stage = requireEquipmentDungeonStage('equipment_ring_azure');
    const forcedEntry = stage.lootTable.entries[0]!;
    const pity = {
      [`${stage.lootTable.id}:${forcedEntry.itemId}`]: forcedEntry.pityCount,
    } as Record<string, number>;
    const result = resolveEquipmentDungeonChallenge(input({ stage, pity }));

    expect(result.ok).toBe(true);
    if (!result.ok || !result.win) return;
    expect(result.drops.reduce((sum, drop) => sum + drop.count, 0)).toBeGreaterThanOrEqual(2);
    expect(result.drops.some((drop) => drop.itemId === forcedEntry.itemId)).toBe(true);
    expect(result.pity[`${stage.lootTable.id}:${forcedEntry.itemId}`]).toBe(0);
  });

  it('重复通关保留首次时间并只更新更快纪录', () => {
    const first = resolveEquipmentDungeonChallenge(input());
    expect(first.ok && first.win).toBe(true);
    if (!first.ok || !first.win) return;

    const previousFirstAt = first.state.records.equipment_weapon_azure!.firstClearedAt;
    const second = resolveEquipmentDungeonChallenge(
      input({
        state: first.state,
        pity: first.pity,
        rngState: first.nextRngState,
        now: NOW + 1_000,
      }),
    );
    expect(second.ok && second.win).toBe(true);
    if (!second.ok || !second.win) return;
    expect(second.firstClear).toBe(false);
    expect(second.drops.reduce((sum, drop) => sum + drop.count, 0)).toBe(1);
    expect(second.state.records.equipment_weapon_azure?.clears).toBe(2);
    expect(second.state.records.equipment_weapon_azure?.firstClearedAt).toBe(previousFirstAt);
    expect(second.state.records.equipment_weapon_azure?.bestDurationMs).toBeLessThanOrEqual(
      first.durationMs,
    );
  });
});
