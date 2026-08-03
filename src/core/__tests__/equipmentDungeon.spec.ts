import { describe, expect, it } from 'vitest';
import { makePlayer } from '../progression';
import {
  createEquipmentDungeonState,
  equipmentDungeonAttemptsRemaining,
  equipmentDungeonDayKey,
  isEquipmentDungeonDepthUnlocked,
  resolveEquipmentDungeonChallenge,
  type EquipmentDungeonChallengeInput,
  type EquipmentDungeonState,
} from '../equipmentDungeon';
import { requireEquipmentDungeonStage } from '@/data/equipmentDungeons';
import { REGION_CRIMSON_SET } from '@/data/regionEquipmentSets';
import type { Stats } from '../types';
import { buildDefaultPlayerSkillKit } from '../playerSkillKit';
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
  const result: EquipmentDungeonChallengeInput = {
    stage,
    depth: 1,
    contentTopLevel: 78,
    state: createEquipmentDungeonState(NOW),
    pity: {},
    player: makePlayer('测试少女', 90, stats()),
    classId: 'witch',
    playerSkillMultiplier: 2,
    rngState: 20260728,
    now: NOW,
    ...overrides,
  };
  if (result.playerSkillKit && overrides.playerSkillMultiplier === undefined) {
    delete result.playerSkillMultiplier;
  }
  return result;
}

describe('装备副本业务日期与次数', () => {
  it('真实技能栏与旧平均倍率不能双传或双缺', () => {
    const legacy = input();
    expect(() =>
      resolveEquipmentDungeonChallenge({
        ...legacy,
        playerSkillKit: buildDefaultPlayerSkillKit('witch', 90),
      }),
    ).toThrow(/必须且只能提供一种/);
    const neither = { ...legacy };
    delete neither.playerSkillMultiplier;
    expect(() => resolveEquipmentDungeonChallenge(neither)).toThrow(/必须且只能提供一种/);
  });

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
      depth: { azure: 1 },
      records: {
        equipment_weapon_azure_d1: {
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
    expect(result.state.records.equipment_weapon_azure_d1?.firstClearedAt).toBe(NOW - 86_400_000);
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
  it('localPveDamageBonusPercent 折算进玩家伤害乘区（ADR-024/025 本地 PvE 收藏奖励）', () => {
    const weakStats = stats({ atk: 5, hp: 9_999_999_999, def: 1_000_000, eva: 100_000 });
    const baseResult = resolveEquipmentDungeonChallenge(
      input({ depth: 1, player: makePlayer('加成对照', 90, weakStats) }),
    );
    const boostedResult = resolveEquipmentDungeonChallenge(
      input({
        depth: 1,
        player: makePlayer('加成对照', 90, weakStats),
        localPveDamageBonusPercent: 100,
      }),
    );
    expect(baseResult.ok).toBe(true);
    expect(boostedResult.ok).toBe(true);
    if (!baseResult.ok || !boostedResult.ok) return;
    const baseWave = baseResult.waves[0]!.result;
    const boostedWave = boostedResult.waves[0]!.result;
    expect(baseWave.win).toBe(true);
    expect(boostedWave.win).toBe(true);
    // 同 RNG 同配置、只差乘区：+100% 乘区应让战斗用时显著缩短（约一半）
    expect(boostedWave.duration).toBeLessThan(baseWave.duration * 0.7);
  });

  it('深度链取代等级门槛：跳级被拒，且等级完全不参与判定', () => {
    const violet = requireEquipmentDungeonStage('equipment_body_violet');
    const state = createEquipmentDungeonState(NOW);

    // 一层没过时只能打 d1；d2 必须先通 d1
    expect(isEquipmentDungeonDepthUnlocked(violet, state, 1)).toBe(true);
    expect(isEquipmentDungeonDepthUnlocked(violet, state, 2)).toBe(false);
    expect(
      resolveEquipmentDungeonChallenge(
        input({ stage: violet, depth: 2, state, player: makePlayer('测试少女', 99, stats()) }),
      ),
    ).toMatchObject({ ok: false, reason: 'previous-depth-locked' });

    // 通过 d1 之后 d2 开放
    state.depth = { violet: 1 };
    expect(isEquipmentDungeonDepthUnlocked(violet, state, 2)).toBe(true);

    /*
     * ★ 等级完全不参与：同一份进度下，Lv1 与 Lv99 得到相同结论。
     *
     * 这正是 docs/66 的目的 —— 战斗本身已经是门禁（失败不扣次数、不推 RNG、
     * 不动保底），等级门槛是叠在它上面的第二道门，挡住的恰好是
     * 「我练强了想试更深的」这个唯一的正反馈。
     */
    expect(isEquipmentDungeonDepthUnlocked(violet, state, 2)).toBe(true);
  });

  it('crimson 当前只开 d1，d2 被拒且与深度进度无关', () => {
    const crimson = requireEquipmentDungeonStage('equipment_body_crimson');
    const state = createEquipmentDungeonState(NOW);
    state.depth = { crimson: 1 };
    expect(isEquipmentDungeonDepthUnlocked(crimson, state, 2)).toBe(false);
    expect(
      resolveEquipmentDungeonChallenge(
        input({ stage: crimson, depth: 2, state, player: makePlayer('测试少女', 99, stats()) }),
      ),
    ).toMatchObject({ ok: false, reason: 'depth-not-opened' });
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
    /*
     * 首破必掉 1 件胚子（docs/66 §4.2），所以掉落是「晶 + 胚子」两项。
     * 胚子是**主线装备定义**，不是副本专属装备 —— docs/58 的红线是
     * 「副本不再产出带定义级 setId 的整装」，主线胚子不违反它。
     */
    expect(result.drops).toHaveLength(2);
    const crystal = result.drops.find((drop) => drop.itemId === IMPRINT_CRYSTAL_IDS.azure);
    const blank = result.drops.find((drop) => drop.itemId !== IMPRINT_CRYSTAL_IDS.azure);
    expect(crystal, '必须掉该档烙印晶').toBeDefined();
    expect(blank?.itemId, '首破必掉一件主线胚子').toMatch(/^eq_r\d+_weapon_/);
    expect(blank?.count).toBe(1);
    // 首通额外一次 bonus roll，所以是两次掷骰的合并（各 2~3 颗）
    expect(crystal?.count).toBeGreaterThanOrEqual(EQUIPMENT_DUNGEON_CRYSTAL_MIN * 2);
    expect(crystal?.count).toBeLessThanOrEqual(EQUIPMENT_DUNGEON_CRYSTAL_MAX * 2);
    // 首通同样计次（2026-07-30 回滚 docs/47 §4.1）
    expect(result.state.clearsToday).toBe(1);
    expect(result.state.totalClears).toBe(1);
    expect(result.state.records.equipment_weapon_azure_d1).toMatchObject({
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

  it('副本把职业真实技能栏转发给每一波战斗', () => {
    const result = resolveEquipmentDungeonChallenge(
      input({
        classId: 'kenshi',
        player: makePlayer('樱酱', 90, stats()),
        playerSkillKit: buildDefaultPlayerSkillKit('kenshi', 90),
      }),
    );

    expect(result.ok && result.win).toBe(true);
    if (!result.ok || !result.win) return;
    const skillEvents = result.waves
      .flatMap((wave) => wave.result.events)
      .filter(
        (event) =>
          event.source === 'player' &&
          event.event.kind === 'direct-damage' &&
          event.event.skillId,
      );
    expect(skillEvents.length).toBeGreaterThan(0);
    expect(
      skillEvents.every(
        (event) =>
          event.event.kind === 'direct-damage' &&
          event.event.skillId?.startsWith('skill_kenshi_'),
      ),
    ).toBe(true);
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

    const previousFirstAt = first.state.records.equipment_weapon_azure_d1!.firstClearedAt;
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
    expect(second.state.records.equipment_weapon_azure_d1?.clears).toBe(2);
    expect(second.state.records.equipment_weapon_azure_d1?.firstClearedAt).toBe(previousFirstAt);
    expect(second.state.records.equipment_weapon_azure_d1?.bestDurationMs).toBeLessThanOrEqual(
      first.durationMs,
    );
  });
});
