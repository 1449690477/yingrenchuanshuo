import { describe, it, expect } from 'vitest';
import {
  advanceRhythm,
  createRhythmState,
  resizeSkillCds,
  type RhythmParams,
} from '../battleRhythm';
import { Rng } from '../rng';

const params: RhythmParams = {
  playerInterval: 1,
  monsterInterval: 1.5,
  skillCooldowns: [4, 8],
  critRate: 0.25,
  playerHit: 100,
  monsterHit: 40,
};

describe('createRhythmState', () => {
  it('技能冷却错峰，避免同一拍全部炸开', () => {
    const s = createRhythmState(3);
    expect(s.skillCds).toEqual([0, 0.7, 1.4]);
  });

  it('技能数非法时报错', () => {
    expect(() => createRhythmState(-1)).toThrow();
    expect(() => createRhythmState(1.5)).toThrow();
  });
});

describe('advanceRhythm', () => {
  it('dt 为 0 或负数时不产生拍子', () => {
    const s = createRhythmState(2);
    expect(advanceRhythm(s, 0, params, new Rng(1)).beats).toEqual([]);
    expect(advanceRhythm(s, -5, params, new Rng(1)).beats).toEqual([]);
  });

  it('按攻速持续产生普攻，不依赖击杀', () => {
    let s = createRhythmState(0);
    const rng = new Rng(7);
    let attacks = 0;
    // 模拟 10 秒，每帧 0.25 秒
    for (let i = 0; i < 40; i++) {
      const r = advanceRhythm(s, 0.25, { ...params, skillCooldowns: [] }, rng);
      s = r.state;
      attacks += r.beats.filter((b) => b.kind === 'player-attack').length;
    }
    // 攻速 1/秒 × 10 秒 ≈ 10 次，允许边界误差
    expect(attacks).toBeGreaterThanOrEqual(9);
    expect(attacks).toBeLessThanOrEqual(11);
  });

  it('攻速越快普攻越密集', () => {
    const run = (interval: number) => {
      let s = createRhythmState(0);
      const rng = new Rng(3);
      let n = 0;
      for (let i = 0; i < 40; i++) {
        const r = advanceRhythm(
          s,
          0.25,
          { ...params, playerInterval: interval, skillCooldowns: [] },
          rng,
        );
        s = r.state;
        n += r.beats.filter((b) => b.kind === 'player-attack').length;
      }
      return n;
    };
    expect(run(0.5)).toBeGreaterThan(run(2));
  });

  it('技能按各自冷却轮转释放', () => {
    let s = createRhythmState(2);
    const rng = new Rng(11);
    const fired: number[] = [];
    for (let i = 0; i < 80; i++) {
      const r = advanceRhythm(s, 0.25, params, rng);
      s = r.state;
      for (const b of r.beats) {
        if (b.kind === 'player-skill') fired.push(b.skillIndex!);
      }
    }
    // 20 秒内：技能0（4s CD）约 5 次，技能1（8s CD）约 2-3 次
    expect(fired.filter((i) => i === 0).length).toBeGreaterThanOrEqual(4);
    expect(fired.filter((i) => i === 1).length).toBeGreaterThanOrEqual(2);
  });

  it('怪物也会持续反击', () => {
    let s = createRhythmState(0);
    const rng = new Rng(5);
    let n = 0;
    for (let i = 0; i < 40; i++) {
      const r = advanceRhythm(s, 0.25, { ...params, skillCooldowns: [] }, rng);
      s = r.state;
      n += r.beats.filter((b) => b.kind === 'monster-attack').length;
    }
    // 1.5 秒间隔 × 10 秒 ≈ 6-7 次
    expect(n).toBeGreaterThanOrEqual(5);
    expect(n).toBeLessThanOrEqual(8);
  });

  it('技能伤害显著高于普攻', () => {
    let s = createRhythmState(1);
    const rng = new Rng(20260727);
    const atk: number[] = [];
    const skill: number[] = [];
    for (let i = 0; i < 200; i++) {
      const r = advanceRhythm(
        s,
        0.25,
        { ...params, critRate: 0, skillCooldowns: [4] },
        rng,
      );
      s = r.state;
      for (const b of r.beats) {
        if (b.kind === 'player-attack') atk.push(b.damage);
        if (b.kind === 'player-skill') skill.push(b.damage);
      }
    }
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    expect(avg(skill)).toBeGreaterThan(avg(atk) * 2);
  });

  it('暴击率为 0 时永不暴击，为 1 时必定暴击', () => {
    const collect = (critRate: number) => {
      let s = createRhythmState(0);
      const rng = new Rng(9);
      const crits: boolean[] = [];
      for (let i = 0; i < 40; i++) {
        const r = advanceRhythm(s, 0.5, { ...params, critRate, skillCooldowns: [] }, rng);
        s = r.state;
        for (const b of r.beats) if (b.kind === 'player-attack') crits.push(b.crit);
      }
      return crits;
    };
    expect(collect(0).every((c) => c === false)).toBe(true);
    expect(collect(1).every((c) => c === true)).toBe(true);
  });

  it('怪物攻击永不标记暴击', () => {
    let s = createRhythmState(0);
    const rng = new Rng(1);
    for (let i = 0; i < 40; i++) {
      const r = advanceRhythm(s, 0.5, { ...params, critRate: 1, skillCooldowns: [] }, rng);
      s = r.state;
      for (const b of r.beats) {
        if (b.kind === 'monster-attack') expect(b.crit).toBe(false);
      }
    }
  });

  it('序号严格递增，UI 可以安全当动画 key', () => {
    let s = createRhythmState(2);
    const rng = new Rng(42);
    let last = 0;
    for (let i = 0; i < 60; i++) {
      const r = advanceRhythm(s, 0.3, params, rng);
      s = r.state;
      for (const b of r.beats) {
        expect(b.seq).toBeGreaterThan(last);
        last = b.seq;
      }
    }
  });

  it('切后台回来的超长 dt 会被截断，不会吐出上千拍', () => {
    const s = createRhythmState(2);
    // 模拟切后台 10 分钟
    const r = advanceRhythm(s, 600, params, new Rng(1));
    expect(r.beats.length).toBeLessThanOrEqual(12);
    expect(r.dropped).toBeGreaterThan(0);
  });

  it('同种子结果可复现', () => {
    const run = () => {
      let s = createRhythmState(2);
      const rng = new Rng(31337);
      const out: number[] = [];
      for (let i = 0; i < 30; i++) {
        const r = advanceRhythm(s, 0.3, params, rng);
        s = r.state;
        out.push(...r.beats.map((b) => b.damage));
      }
      return out;
    };
    expect(run()).toEqual(run());
  });

  it('不修改传入的 state', () => {
    const s = createRhythmState(2);
    const snapshot = JSON.parse(JSON.stringify(s));
    advanceRhythm(s, 5, params, new Rng(1));
    expect(s).toEqual(snapshot);
  });

  it('技能冷却数量不匹配时直接报错', () => {
    const state = createRhythmState(2);
    expect(() =>
      advanceRhythm(state, 0.25, { ...params, skillCooldowns: [4] }, new Rng(1)),
    ).toThrow(/数量/);
  });

  it.each([
    ['零冷却', [0]],
    ['NaN 冷却', [Number.NaN]],
  ])('%s 配置直接报错', (_label, skillCooldowns) => {
    const state = createRhythmState(1);
    expect(() =>
      advanceRhythm(state, 0.25, { ...params, skillCooldowns }, new Rng(1)),
    ).toThrow(/技能冷却/);
  });
});

describe('resizeSkillCds', () => {
  it('技能数不变时返回原对象', () => {
    const s = createRhythmState(2);
    expect(resizeSkillCds(s, 2)).toBe(s);
  });

  it('解锁新技能时保留已有冷却进度', () => {
    let s = createRhythmState(2);
    s = { ...s, skillCds: [1.2, 3.4] };
    const next = resizeSkillCds(s, 3);
    expect(next.skillCds[0]).toBe(1.2);
    expect(next.skillCds[1]).toBe(3.4);
    expect(next.skillCds).toHaveLength(3);
  });

  it('技能变少时截断', () => {
    const s = createRhythmState(4);
    expect(resizeSkillCds(s, 2).skillCds).toHaveLength(2);
  });
});
