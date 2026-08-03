import { describe, it, expect } from 'vitest';
import {
  accumulateIdle,
  dailyStaminaClaim,
  idleCombatEfficiency,
  idleCombatRates,
  killsPerSecond,
  recoverStamina,
  spendStamina,
  settleIdle,
  settleOffline,
  settleSweep,
} from '../idle';
import type { IdleContext } from '../idle';
import { makeMonster, makePlayer } from '../progression';
import { estimateDps } from '../combat';
import { expectedReactionDpsShare } from '../elementGauge';
import { Rng } from '../rng';
import type { LootTable } from '../types';
import { OFFLINE_CAP_SECONDS, STAMINA_RECOVER_SECONDS } from '@/data/constants';
import { REGION_CRIMSON_SET } from '@/data/regionEquipmentSets';

const FLAMEBURST = REGION_CRIMSON_SET.bonuses.flatMap((bonus) => bonus.onHitTriggers ?? [])[0]!;

const lootTable: LootTable = {
  id: 'loot_idle',
  rolls: 1,
  entries: [{ itemId: 'stone', weight: 1, minCount: 1, maxCount: 1 }],
};

function monForIdle(level: number) {
  return makeMonster({
    id: `m-${level}`,
    name: '测试怪',
    level,
    type: 'normal',
    element: 'none',
    lootTableId: 'loot_idle',
    sprite: '',
  });
}

function ctx(overrides: Partial<IdleContext> = {}): IdleContext {
  const player = makePlayer('剑姬', 30, {
    atk: 2000,
    def: 300,
    hp: 5000,
    acc: 200,
    eva: 30,
    critRate: 10,
    critDmg: 50,
    spd: 1.0,
  });
  const monster = monForIdle(30);
  return { player, monster, expPerKill: 100, goldPerKill: 50, lootTable, ...overrides };
}

describe('killsPerSecond', () => {
  it('受关卡上限约束（防止高战刷低级图）', () => {
    const c = ctx({ maxKillsPerSec: 2.0 });
    c.player.stats.atk = 1e9;
    expect(killsPerSecond(c)).toBe(2.0);
  });

  it('打不动时为 0', () => {
    const c = ctx();
    c.player.stats.atk = 0;
    expect(killsPerSecond(c)).toBe(0);
  });

  it('攻击力越高击杀越快', () => {
    const weak = ctx();
    const strong = ctx();
    strong.player.stats.atk = weak.player.stats.atk * 3;
    expect(killsPerSecond(strong)).toBeGreaterThan(killsPerSecond(weak));
  });

  it('逐击炎爆用同一期望伤害进入挂机与离线，不另写平均技能倍率', () => {
    const plain = ctx({ maxKillsPerSec: 999 });
    const withBurst = ctx({ maxKillsPerSec: 999, onHitTriggers: [FLAMEBURST] });
    for (const context of [plain, withBurst]) {
      context.player.element = 'fire';
      context.player.combatBonuses = {
        damageReduction: 0,
        lifesteal: 0,
        elementDamage: { fire: 12, ice: 0, thunder: 0 },
      };
      context.monster.element = 'ice';
    }

    // docs/83 批3：火克冰（counter）时共鸣期望占比 6% 进入挂机 DPS。
    // 期望值必须与 idleCombatRates 同口径（estimateDps × (1+share)）。
    const burstShare = expectedReactionDpsShare(withBurst.player.stats.spd, true);
    const expectedKps =
      ((estimateDps(withBurst.player, withBurst.monster, 1, [FLAMEBURST]) * (1 + burstShare)) /
        withBurst.monster.stats.hp) *
      idleCombatEfficiency(withBurst);
    expect(killsPerSecond(withBurst)).toBeCloseTo(expectedKps, 10);
    expect(killsPerSecond(withBurst)).toBeGreaterThan(killsPerSecond(plain));
    expect(settleOffline(withBurst, 0, 3_600_000).yield.kills).toBeGreaterThan(
      settleOffline(plain, 0, 3_600_000).yield.kills,
    );
  });

  it('同等输出下防御和生命通过承伤效率提高真实击杀产出', () => {
    const fragile = ctx();
    fragile.player.stats.hp = 200;
    fragile.player.stats.def = 0;
    const sturdy = ctx();
    sturdy.player.stats.hp = 2_000;
    sturdy.player.stats.def = 1_000;

    expect(idleCombatEfficiency(sturdy)).toBeGreaterThan(idleCombatEfficiency(fragile));
    expect(killsPerSecond(sturdy)).toBeGreaterThan(killsPerSecond(fragile));
  });

  it('越级承伤只软性降速，效率与击杀速度都保持正数', () => {
    const pressured = ctx({ monster: monForIdle(120) });
    pressured.player.stats.hp = 20;
    pressured.player.stats.def = 0;

    expect(idleCombatEfficiency(pressured)).toBeGreaterThan(0);
    expect(idleCombatEfficiency(pressured)).toBeLessThan(0.3);
    expect(killsPerSecond(pressured)).toBeGreaterThan(0);
  });
});

describe('docs/83 批3 元素共鸣期望加成（挂机本地模式）', () => {
  function elementCtx(
    playerElement: 'fire' | 'ice' | 'thunder' | 'none',
    monsterElement: 'fire' | 'ice' | 'thunder' | 'none',
  ) {
    const c = ctx({ maxKillsPerSec: 999 });
    c.player.element = playerElement;
    c.monster.element = monsterElement;
    return c;
  }

  it('无元素一侧不触发共鸣（零加成，默认行为不变）', () => {
    const nonePlayer = elementCtx('none', 'ice');
    const noneMonster = elementCtx('fire', 'none');
    expect(idleCombatRates(nonePlayer).playerDps).toBeCloseTo(
      idleCombatRates(elementCtx('none', 'none')).playerDps,
      6,
    );
    expect(idleCombatRates(noneMonster).playerDps).toBeCloseTo(
      idleCombatRates(elementCtx('fire', 'none')).playerDps,
      6,
    );
  });

  it('同系（元素倍率 1.0）DPS 提升恰为期望共鸣占比（中性 5%）', () => {
    const baseline = idleCombatRates(elementCtx('none', 'fire')).playerDps;
    const sameElement = idleCombatRates(elementCtx('fire', 'fire')).playerDps;
    expect(sameElement / baseline).toBeCloseTo(1 + expectedReactionDpsShare(1.0, false), 4);
  });

  it('克制（炎→冰）DPS = 元素倍率 1.25 × 共鸣加成（克制 6%）', () => {
    const baseline = idleCombatRates(elementCtx('none', 'ice')).playerDps;
    const counter = idleCombatRates(elementCtx('fire', 'ice')).playerDps;
    expect(counter / baseline).toBeCloseTo(1.25 * (1 + expectedReactionDpsShare(1.0, true)), 4);
  });

  it('共鸣加成有上界：任意攻速下同系加成 ≤6%（ICD 兜底，不会爆 DPS）', () => {
    for (const spd of [0.8, 1.0, 1.25, 2.0]) {
      const base = elementCtx('none', 'fire');
      base.player.stats.spd = spd;
      const boostedCtx = elementCtx('fire', 'fire');
      boostedCtx.player.stats.spd = spd;
      const share = idleCombatRates(boostedCtx).playerDps / idleCombatRates(base).playerDps - 1;
      expect(share).toBeLessThanOrEqual(0.061);
      expect(share).toBeGreaterThan(0);
    }
  });
});

describe('settleIdle', () => {
  it('0 秒无产出', () => {
    expect(settleIdle(ctx(), 0)).toEqual({ exp: 0, gold: 0, kills: 0, loot: [] });
  });

  it('负数秒数无产出（防御性）', () => {
    expect(settleIdle(ctx(), -100).kills).toBe(0);
  });

  it('产出与时长成正比', () => {
    const a = settleIdle(ctx(), 600);
    const b = settleIdle(ctx(), 1200);
    expect(b.kills).toBeGreaterThanOrEqual(a.kills * 2 - 1);
  });

  it('经验金币等于击杀数乘单只收益', () => {
    const c = ctx();
    const y = settleIdle(c, 3600);
    expect(y.exp).toBe(y.kills * c.expPerKill);
    expect(y.gold).toBe(y.kills * c.goldPerKill);
  });
});

describe('掉落结算模式（roll vs expected）', () => {
  // 回归测试：曾经实时挂机也走期望值，1~2 只怪的期望值被 floor 成 0，
  // 玩家挂机很久背包一个东西都没有。
  it('roll 模式下少量击杀也能掉出东西', () => {
    const c = ctx();
    const rng = new Rng(2026);
    const durationForTwoKills = 2 / killsPerSecond(c);
    let got = 0;
    for (let i = 0; i < 40; i++) {
      const y = settleIdle(c, durationForTwoKills, { mode: 'roll', rng });
      got += y.loot.reduce((s, d) => s + d.count, 0);
    }
    expect(got).toBeGreaterThan(0);
  });

  it('expected 模式在少量击杀时会因取整而漏掉（这就是不能用它跑实时的原因）', () => {
    // 低概率掉落表：每只怪只有 10% 概率掉，期望值 0.1，floor 后为 0
    const rareTable: LootTable = {
      id: 'loot_rare',
      rolls: 1,
      entries: [
        { itemId: 'junk', weight: 90, minCount: 1, maxCount: 1 },
        { itemId: 'rare', weight: 10, minCount: 1, maxCount: 1 },
      ],
    };
    const c = ctx({ lootTable: rareTable });
    const kps = killsPerSecond(c);
    const y = settleIdle(c, 2 / kps, { mode: 'expected' });

    expect(y.kills).toBeGreaterThanOrEqual(1);
    // rare 的期望数量不足 1，被取整抹掉了
    expect(y.loot.find((d) => d.itemId === 'rare')).toBeUndefined();

    // 同样条件下 roll 模式跑多次一定能掉出来
    let rareHits = 0;
    const rng = new Rng(7);
    for (let i = 0; i < 200; i++) {
      const r = settleIdle(c, 2 / kps, { mode: 'roll', rng });
      if (r.loot.some((d) => d.itemId === 'rare')) rareHits++;
    }
    expect(rareHits).toBeGreaterThan(0);
  });

  it('roll 模式可复现（同种子同结果）', () => {
    const run = () => settleIdle(ctx(), 60, { mode: 'roll', rng: new Rng(99) }).loot;
    expect(run()).toEqual(run());
  });

  it('roll 模式不会静默切换成期望值', () => {
    const c = ctx();
    const run = () => settleIdle(c, 1000, { mode: 'roll', rng: new Rng(1) });
    expect(run()).toEqual(run());
  });

  it('roll 模式缺少 seeded RNG 时直接报错', () => {
    expect(() => settleIdle(ctx(), 60, { mode: 'roll' })).toThrow('seeded RNG');
  });
});

describe('accumulateIdle（逐帧累积）', () => {
  // 这一组是回归测试：曾经每帧 floor 掉不足一只的部分，
  // 导致玩家挂机 6 秒一个金币都拿不到。
  it('单帧不足一只怪时不产出，但把时间攒进 carry', () => {
    const c = ctx();
    const kps = killsPerSecond(c);
    const dt = 1 / kps / 3; // 只够三分之一只

    const r = accumulateIdle(c, dt, 0);
    expect(r.yield.kills).toBe(0);
    expect(r.carrySec).toBeCloseTo(dt, 6);
  });

  it('多帧累积后能正常产出，不会丢失零头', () => {
    const c = ctx();
    const kps = killsPerSecond(c);
    const dt = 1 / kps / 3;

    let carry = 0;
    let kills = 0;
    for (let i = 0; i < 30; i++) {
      const r = accumulateIdle(c, dt, carry);
      carry = r.carrySec;
      kills += r.yield.kills;
    }

    // 30 帧 × 1/3 只 = 10 只，允许 1 只的取整误差
    expect(kills).toBeGreaterThanOrEqual(9);
    expect(kills).toBeLessThanOrEqual(10);
  });

  it('长期累积的产出与一次性结算基本一致（不漏也不多给）', () => {
    const c = ctx();
    const totalSec = 600;
    const dt = 0.4;

    let carry = 0;
    let kills = 0;
    for (let i = 0; i < totalSec / dt; i++) {
      const r = accumulateIdle(c, dt, carry);
      carry = r.carrySec;
      kills += r.yield.kills;
    }

    const oneShot = settleIdle(c, totalSec).kills;
    expect(Math.abs(kills - oneShot) / oneShot).toBeLessThan(0.02);
  });

  it('打不动时不结算，时间全部留在 carry 里', () => {
    const c = ctx();
    c.player.stats.atk = 0;
    const r = accumulateIdle(c, 5, 2);
    expect(r.yield.kills).toBe(0);
    expect(r.carrySec).toBe(7);
  });
});

describe('settleOffline', () => {
  const now = 1_800_000_000_000;

  it('正常时长全额结算', () => {
    const r = settleOffline(ctx(), now - 3600_000, now);
    expect(r.seconds).toBe(3600);
    expect(r.cappedSeconds).toBe(0);
    expect(r.yield.kills).toBeGreaterThan(0);
  });

  it('超过 8 小时上限被截断，并报告溢出量', () => {
    const twelveHours = 12 * 3600 * 1000;
    const r = settleOffline(ctx(), now - twelveHours, now);
    expect(r.seconds).toBe(OFFLINE_CAP_SECONDS);
    expect(r.cappedSeconds).toBe(4 * 3600);
  });

  it('系统时间回拨时不产生负收益', () => {
    const r = settleOffline(ctx(), now + 999_999, now);
    expect(r.seconds).toBe(0);
    expect(r.yield.kills).toBe(0);
  });

  it('相同参数结果一致（期望值结算，无随机方差）', () => {
    const a = settleOffline(ctx(), now - 7200_000, now);
    const b = settleOffline(ctx(), now - 7200_000, now);
    expect(a).toEqual(b);
  });
});

describe('settleSweep', () => {
  it('一次扫荡等同 30 分钟挂机', () => {
    const sweep = settleSweep(ctx(), 1);
    const idle30 = settleIdle(ctx(), 30 * 60);
    expect(sweep.kills).toBe(idle30.kills);
  });

  it('10 次扫荡产出约为 1 次的 10 倍', () => {
    const one = settleSweep(ctx(), 1);
    const ten = settleSweep(ctx(), 10);
    expect(ten.kills).toBeGreaterThanOrEqual(one.kills * 10 - 1);
  });
});

describe('recoverStamina', () => {
  const now = 1_800_000_000_000;

  it('每 5 分钟回 1 点', () => {
    const r = recoverStamina(0, 120, now - STAMINA_RECOVER_SECONDS * 3 * 1000, now);
    expect(r.stamina).toBe(3);
  });

  it('不超过上限', () => {
    const r = recoverStamina(119, 120, now - 999_999_999, now);
    expect(r.stamina).toBe(120);
  });

  it('已满时不推进', () => {
    const r = recoverStamina(120, 120, now - 999_999, now);
    expect(r.stamina).toBe(120);
    expect(r.nextRecoverAt).toBe(now);
  });

  it('不足一个周期时不回复，且保留已等待时间', () => {
    const last = now - 60_000;
    const r = recoverStamina(10, 120, last, now);
    expect(r.stamina).toBe(10);
    expect(r.nextRecoverAt).toBe(last);
  });
});

describe('spendStamina', () => {
  it('从满体力消费时以消费时刻重启恢复计时，旧时间戳不能让刷新白嫖回满', () => {
    const now = 1_800_000_000_000;
    expect(spendStamina(150, 150, now - 24 * 60 * 60 * 1000, 6, now)).toEqual({
      stamina: 144,
      nextRecoverAt: now,
    });
    expect(recoverStamina(144, 150, now, now + 1_000)).toEqual({
      stamina: 144,
      nextRecoverAt: now,
    });
  });

  it('未满时继续消费保留已经等待的恢复余数', () => {
    const now = 1_800_000_000_000;
    const baseline = now - 90_000;
    expect(spendStamina(80, 150, baseline, 6, now)).toEqual({
      stamina: 74,
      nextRecoverAt: baseline,
    });
  });

  it('拒绝负数、非整数与超额消费', () => {
    expect(() => spendStamina(5, 120, 1, 6, 2)).toThrow('体力不足');
    expect(() => spendStamina(5, 120, 1, -1, 2)).toThrow('消耗');
    expect(() => spendStamina(5.5, 120, 1, 1, 2)).toThrow('当前体力');
  });
});

describe('dailyStaminaClaim', () => {
  const now = 1_800_000_000_000;
  const day = new Date(now + (8 - 4) * 3_600_000).toISOString().slice(0, 10);

  it('今天未领过：先结算自然恢复再叠加免费额度，不超上限', () => {
    const r = dailyStaminaClaim(100, 120, now - 600_000, null, 0, now);
    expect(r.claimed).toBe(true);
    expect(r.stamina).toBe(120);
    expect(r.claimedCount).toBe(1);
    expect(r.claimedDay).toBe(day);
  });

  it('今天已领 1 次：第二次可继续领，自然恢复正常结算', () => {
    const r = dailyStaminaClaim(60, 120, now - 600_000, day, 1, now);
    expect(r.claimed).toBe(true);
    expect(r.stamina).toBe(92);
    expect(r.claimedCount).toBe(2);
  });

  it('今天已领满 3 次：不重复发放，但自然恢复正常结算', () => {
    const r = dailyStaminaClaim(60, 120, now - 600_000, day, 3, now);
    expect(r.claimed).toBe(false);
    expect(r.stamina).toBe(62);
    expect(r.claimedCount).toBe(3);
  });

  it('体力不足时领取也不会超过上限', () => {
    const r = dailyStaminaClaim(80, 120, now, null, 0, now);
    expect(r.claimed).toBe(true);
    expect(r.stamina).toBe(110);
    expect(r.nextRecoverAt).toBe(now);
  });

  it('满体力领取不浪费（封顶为上限）', () => {
    const r = dailyStaminaClaim(120, 120, now, null, 0, now);
    expect(r.claimed).toBe(true);
    expect(r.stamina).toBe(120);
  });

  it('跨日：明天重置次数可再领', () => {
    const tomorrow = now + 24 * 3_600_000;
    const r = dailyStaminaClaim(10, 120, tomorrow, day, 3, tomorrow);
    expect(r.claimed).toBe(true);
    expect(r.stamina).toBe(40);
    expect(r.claimedCount).toBe(1);
  });
});

describe('图鉴集齐加成（M4-8 P3：本地 PvE 伤害乘区）', () => {
  it('默认缺省与显式 0 完全一致（零行为变化）', () => {
    const a = idleCombatRates(ctx());
    const b = idleCombatRates(ctx({ galleryBonusPercent: 0 }));
    expect(a.playerDps).toBe(b.playerDps);
    expect(a.efficiency).toBe(b.efficiency);
  });

  it('3.5%（r1~r7 全齐）→ playerDps ×1.035', () => {
    const base = idleCombatRates(ctx());
    const bonus = idleCombatRates(ctx({ galleryBonusPercent: 3.5 }));
    expect(bonus.playerDps / base.playerDps).toBeCloseTo(1.035, 9);
  });

  it('100%（测试极限）→ playerDps ×2', () => {
    const base = idleCombatRates(ctx());
    const bonus = idleCombatRates(ctx({ galleryBonusPercent: 100 }));
    expect(bonus.playerDps / base.playerDps).toBeCloseTo(2, 9);
  });
});
