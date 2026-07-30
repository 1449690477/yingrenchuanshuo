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
import { REGION_CRIMSON_SET } from '@/data/regionEquipmentSets';
import type { Stats } from '../types';
import {
  EQUIPMENT_DUNGEON_CORE_PITY,
  EQUIPMENT_DUNGEON_CRYSTAL_MAX,
  EQUIPMENT_DUNGEON_CRYSTAL_MIN,
  IMPRINT_CORE_ID,
  IMPRINT_CRYSTAL_IDS,
} from '@/data/imprintRules';

const NOW = Date.parse('2026-07-28T04:30:00+08:00');
const FLAMEBURST = REGION_CRIMSON_SET.bonuses.flatMap((bonus) => bonus.onHitTriggers ?? [])[0]!;

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
    // 这一关此前已通关（records 里有 firstClearedAt），属于日常重复刷取，照常扣次数
    expect(result.state.clearsToday).toBe(1);
    expect(result.state.totalClears).toBe(10);
    expect(result.state.records.equipment_weapon_azure?.firstClearedAt).toBe(NOW - 86_400_000);
  });

  it('每天第 4 次成功领取会被拒绝', () => {
    const stage = requireEquipmentDungeonStage('equipment_weapon_azure');
    // 次数用尽即被日限挡住（首通不再豁免）
    const full: EquipmentDungeonState = {
      ...createEquipmentDungeonState(NOW),
      clearsToday: 3,
      records: {
        [stage.id]: { clears: 1, firstClearedAt: NOW - 1, bestDurationMs: 20_000 },
      },
    };
    expect(resolveEquipmentDungeonChallenge(input({ state: full }))).toMatchObject({
      ok: false,
      reason: 'daily-limit',
    });
  });

  it('首通同样计入每日次数，次数用尽连首通也进不去（2026-07-30 回滚 docs/47 §4.1）', () => {
    // 旧规则首通免次数：节奏重排后 8 部位 × 免费首通 × 双掉落 =
    // 解锁日白拿 16 件当期最强装备，瞬间毕业。现在一视同仁。
    const full: EquipmentDungeonState = {
      ...createEquipmentDungeonState(NOW),
      clearsToday: 3,
    };
    const blocked = resolveEquipmentDungeonChallenge(input({ state: full }));
    expect(blocked).toEqual({ ok: false, reason: 'daily-limit', state: full });

    // 有次数时首通正常计次，且双掉落保留
    const fresh = createEquipmentDungeonState(NOW);
    const result = resolveEquipmentDungeonChallenge(input({ state: fresh }));
    expect(result.ok && result.win).toBe(true);
    if (!result.ok || !result.win) return;
    expect(result.firstClear).toBe(true);
    expect(result.state.clearsToday).toBe(1);
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
    // 等级从档位定义里取，不写死 —— 档位等级会随平衡调整（见 docs/47），
    // 写死数字的话每次重排都要跟着改一遍测试。
    expect(isEquipmentDungeonStageUnlocked(violet, state, violet.unlockLevel - 1)).toBe(false);
    expect(isEquipmentDungeonStageUnlocked(violet, state, violet.unlockLevel)).toBe(true);
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

  it('胜利产出该档烙印晶（不再是装备），并原子推进次数、记录、RNG 与保底', () => {
    // 烙印重构（docs/58 §3.3）：副本只掉材料。原断言「产出当前职业的定向装备」
    // 描述的正是被取代的设计 —— 副本曾经是第二条装备生产线，
    // 导致主线掉落再极品也进不了套装。
    const result = resolveEquipmentDungeonChallenge(input());
    expect(result.ok).toBe(true);
    if (!result.ok || !result.win) return;

    expect(result.waves).toHaveLength(2);
    expect(result.waves.every((wave) => wave.result.win)).toBe(true);
    expect(result.drops).toHaveLength(1);
    expect(result.drops[0]?.itemId).toBe(IMPRINT_CRYSTAL_IDS.azure);
    // 首通额外一次 bonus roll，所以是两次掷骰的合并（各 2~3 颗）
    expect(result.drops[0]?.count).toBeGreaterThanOrEqual(EQUIPMENT_DUNGEON_CRYSTAL_MIN * 2);
    expect(result.drops[0]?.count).toBeLessThanOrEqual(EQUIPMENT_DUNGEON_CRYSTAL_MAX * 2);
    // 首通同样计次（2026-07-30 回滚 docs/47 §4.1）
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

  it('副本逐击真实结算炎爆并向表现层返回同源事件', () => {
    const result = resolveEquipmentDungeonChallenge(
      input({
        player: makePlayer('绯焰测试少女', 90, stats({ atk: 100, critRate: 100 }), 'fire', {
          damageReduction: 0,
          lifesteal: 0,
          elementDamage: { fire: 12, ice: 0, thunder: 0 },
        }),
        playerOnHitTriggers: [{ ...FLAMEBURST, chance: 1 }],
      }),
    );

    expect(result.ok && result.win).toBe(true);
    if (!result.ok || !result.win) return;
    const timeline = result.waves.flatMap((wave) => wave.result.events);
    const bursts = timeline.filter((event) => event.event.kind === 'on-hit-elemental-damage');
    expect(bursts.length).toBeGreaterThan(0);
    expect(bursts.every((event) => event.source === 'player')).toBe(true);
    expect(bursts.every((event) => event.event.damage > 0)).toBe(true);
    for (const wave of result.waves) {
      expect(wave.result.damageDealt).toBeCloseTo(
        wave.result.events
          .filter((event) => event.source === 'player')
          .reduce((sum, event) => sum + event.event.damage, 0),
        8,
      );
    }
  });

  it('星纹核保底达成时强制掉出，并把计数清回阈值以下', () => {
    // 旧断言是「通用双款连续缺失触发补偿双掉」—— 那是副本掉整装时代的保底，
    // 用来缓解「同一部位反复掉重复件」。副本改掉材料后重复件问题消失，
    // 保底的职责变成给坏运气兜底：连续掉最少数量的玩家不会卡在「差一颗」。
    const stage = requireEquipmentDungeonStage('equipment_ring_azure');
    const pityKey = `${stage.lootTable.id}:${IMPRINT_CORE_ID}`;
    const pity = { [pityKey]: EQUIPMENT_DUNGEON_CORE_PITY } as Record<string, number>;
    const result = resolveEquipmentDungeonChallenge(input({ stage, pity }));

    expect(result.ok).toBe(true);
    if (!result.ok || !result.win) return;
    expect(result.drops.some((drop) => drop.itemId === IMPRINT_CORE_ID)).toBe(true);
    // 断言「已清零」而不是某个具体数字：首通会额外跑一次 bonus roll，
    // 那一次核没再掉、计数会自然 +1。写死具体值会让测试依赖掷骰次数。
    expect(result.pity[pityKey]).toBeLessThan(EQUIPMENT_DUNGEON_CORE_PITY);
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
    // 非首通只掷一次骰：该档烙印晶 2~3 颗（首通那次是两轮所以更多）
    const secondTotal = second.drops.reduce((sum, drop) => sum + drop.count, 0);
    expect(secondTotal).toBeGreaterThanOrEqual(EQUIPMENT_DUNGEON_CRYSTAL_MIN);
    expect(secondTotal).toBeLessThanOrEqual(EQUIPMENT_DUNGEON_CRYSTAL_MAX + 1);
    expect(second.state.records.equipment_weapon_azure?.clears).toBe(2);
    expect(second.state.records.equipment_weapon_azure?.firstClearedAt).toBe(previousFirstAt);
    expect(second.state.records.equipment_weapon_azure?.bestDurationMs).toBeLessThanOrEqual(
      first.durationMs,
    );
  });
});
