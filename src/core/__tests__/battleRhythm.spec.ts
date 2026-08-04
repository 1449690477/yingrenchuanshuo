import { describe, it, expect } from 'vitest';
import {
  advanceBattleBeatGate,
  advanceRhythm,
  createBattleRhythmSnapshot,
  createBattleBeatGateState,
  createRhythmState,
  syncRhythmSkills,
  type BattleBeat,
  type RhythmParams,
  type RhythmSkillSpec,
} from '../battleRhythm';
import { Rng } from '../rng';

const rhythmSkills: readonly RhythmSkillSpec[] = [
  { skillId: 'skill-a', cooldownSec: 4, priority: 10 },
  { skillId: 'skill-b', cooldownSec: 8, priority: 20 },
  { skillId: 'skill-c', cooldownSec: 12, priority: 30 },
  { skillId: 'skill-d', cooldownSec: 16, priority: 40 },
];

const params: RhythmParams = {
  playerInterval: 1,
  monsterInterval: 1.5,
  skills: rhythmSkills.slice(0, 2),
  critRate: 0.25,
  playerHit: 100,
  monsterHit: 40,
};

const beat = (seq: number, kind: BattleBeat['kind'] = 'player-attack'): BattleBeat => ({
  seq,
  kind,
  crit: false,
  damage: 10,
  skillId: null,
});

describe('BattleScene 拍子门控', () => {
  it('怪物先入场、随后收到空数组时也会无条件开启新序号纪元', () => {
    const oldStage = { cursor: 42, pending: [] };

    const reset = advanceBattleBeatGate(oldStage, [], 'spawn');

    expect(reset.reset).toBe(true);
    expect(reset.state).toEqual(createBattleBeatGateState());
    expect(reset.consume).toEqual([]);
  });

  it('入场期间缓存新关真实拍，入场结束后各消费一次', () => {
    const reset = advanceBattleBeatGate({ cursor: 42, pending: [] }, [], 'spawn');
    const spawning = advanceBattleBeatGate(reset.state, [beat(1), beat(2)], 'spawn');

    expect(spawning.state.cursor).toBe(2);
    expect(spawning.state.pending.map((entry) => entry.seq)).toEqual([1, 2]);
    expect(spawning.consume).toEqual([]);

    const active = advanceBattleBeatGate(spawning.state, [beat(1), beat(2)], 'active');
    expect(active.consume.map((entry) => entry.seq)).toEqual([1, 2]);
    expect(active.state).toEqual({ cursor: 2, pending: [] });

    const unchanged = advanceBattleBeatGate(active.state, [beat(1), beat(2)], 'active');
    expect(unchanged.consume).toEqual([]);
  });

  it('击杀定格期间推进游标但不把旧目标拍子重放到新目标', () => {
    const pulse = advanceBattleBeatGate(
      { cursor: 10, pending: [beat(10)] },
      [beat(10), beat(11), beat(12, 'monster-attack')],
      'pulse',
    );
    expect(pulse.consume).toEqual([]);
    expect(pulse.state).toEqual({ cursor: 12, pending: [] });

    const active = advanceBattleBeatGate(
      pulse.state,
      [beat(11), beat(12, 'monster-attack'), beat(13)],
      'active',
    );
    expect(active.consume.map((entry) => entry.seq)).toEqual([13]);
  });

  it('非法游标直接报错，不用静默归零掩盖状态错误', () => {
    expect(() => advanceBattleBeatGate({ cursor: -1, pending: [] }, [beat(1)], 'active')).toThrow(
      /游标/,
    );
  });
});

describe('createRhythmState', () => {
  it('技能冷却错峰，避免同一拍全部炸开', () => {
    const s = createRhythmState(rhythmSkills.slice(0, 3));
    expect(s.skillCds).toEqual({
      'skill-a': 0,
      'skill-b': 0.7,
      'skill-c': 1.4,
    });
  });

  it('技能 ID 重复或冷却非法时报错', () => {
    expect(() => createRhythmState([rhythmSkills[0]!, rhythmSkills[0]!])).toThrow(/重复/);
    expect(() => createRhythmState([{ skillId: 'broken', cooldownSec: 0, priority: 1 }])).toThrow(
      /技能冷却/,
    );
  });
});

describe('advanceRhythm', () => {
  it('dt 为 0 或负数时不产生拍子', () => {
    const s = createRhythmState(params.skills);
    expect(advanceRhythm(s, 0, params, new Rng(1)).beats).toEqual([]);
    expect(advanceRhythm(s, -5, params, new Rng(1)).beats).toEqual([]);
  });

  it('按攻速持续产生普攻，不依赖击杀', () => {
    let s = createRhythmState();
    const rng = new Rng(7);
    let attacks = 0;
    // 模拟 10 秒，每帧 0.25 秒
    for (let i = 0; i < 40; i++) {
      const r = advanceRhythm(s, 0.25, { ...params, skills: [] }, rng);
      s = r.state;
      attacks += r.beats.filter((b) => b.kind === 'player-attack').length;
    }
    // 攻速 1/秒 × 10 秒 ≈ 10 次，允许边界误差
    expect(attacks).toBeGreaterThanOrEqual(9);
    expect(attacks).toBeLessThanOrEqual(11);
  });

  it('攻速越快普攻越密集', () => {
    const run = (interval: number) => {
      let s = createRhythmState();
      const rng = new Rng(3);
      let n = 0;
      for (let i = 0; i < 40; i++) {
        const r = advanceRhythm(s, 0.25, { ...params, playerInterval: interval, skills: [] }, rng);
        s = r.state;
        n += r.beats.filter((b) => b.kind === 'player-attack').length;
      }
      return n;
    };
    expect(run(0.5)).toBeGreaterThan(run(2));
  });

  it('技能按各自冷却轮转释放', () => {
    let s = createRhythmState(params.skills);
    const rng = new Rng(11);
    const fired: string[] = [];
    for (let i = 0; i < 80; i++) {
      const r = advanceRhythm(s, 0.25, params, rng);
      s = r.state;
      for (const b of r.beats) {
        if (b.kind === 'player-skill') fired.push(b.skillId!);
      }
    }
    // 20 秒内：skill-a（4s CD）约 5 次，skill-b（8s CD）约 2-3 次
    expect(fired.filter((id) => id === 'skill-a').length).toBeGreaterThanOrEqual(4);
    expect(fired.filter((id) => id === 'skill-b').length).toBeGreaterThanOrEqual(2);
  });

  it('怪物也会持续反击', () => {
    let s = createRhythmState();
    const rng = new Rng(5);
    let n = 0;
    for (let i = 0; i < 40; i++) {
      const r = advanceRhythm(s, 0.25, { ...params, skills: [] }, rng);
      s = r.state;
      n += r.beats.filter((b) => b.kind === 'monster-attack').length;
    }
    // 1.5 秒间隔 × 10 秒 ≈ 6-7 次
    expect(n).toBeGreaterThanOrEqual(5);
    expect(n).toBeLessThanOrEqual(8);
  });

  it('技能伤害显著高于普攻', () => {
    const oneSkillParams = { ...params, skills: rhythmSkills.slice(0, 1) };
    let s = createRhythmState(oneSkillParams.skills);
    const rng = new Rng(20260727);
    const atk: number[] = [];
    const skill: number[] = [];
    for (let i = 0; i < 200; i++) {
      const r = advanceRhythm(s, 0.25, { ...oneSkillParams, critRate: 0 }, rng);
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
      let s = createRhythmState();
      const rng = new Rng(9);
      const crits: boolean[] = [];
      for (let i = 0; i < 40; i++) {
        const r = advanceRhythm(s, 0.5, { ...params, critRate, skills: [] }, rng);
        s = r.state;
        for (const b of r.beats) if (b.kind === 'player-attack') crits.push(b.crit);
      }
      return crits;
    };
    expect(collect(0).every((c) => c === false)).toBe(true);
    expect(collect(1).every((c) => c === true)).toBe(true);
  });

  it('怪物攻击永不标记暴击', () => {
    let s = createRhythmState();
    const rng = new Rng(1);
    for (let i = 0; i < 40; i++) {
      const r = advanceRhythm(s, 0.5, { ...params, critRate: 1, skills: [] }, rng);
      s = r.state;
      for (const b of r.beats) {
        if (b.kind === 'monster-attack') expect(b.crit).toBe(false);
      }
    }
  });

  it('序号严格递增，UI 可以安全当动画 key', () => {
    let s = createRhythmState(params.skills);
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
    const s = createRhythmState(params.skills);
    // 模拟切后台 10 分钟
    const r = advanceRhythm(s, 600, params, new Rng(1));
    expect(r.beats.length).toBeLessThanOrEqual(12);
    expect(r.dropped).toBeGreaterThan(0);
  });

  it('同种子结果可复现', () => {
    const run = () => {
      let s = createRhythmState(params.skills);
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
    const s = createRhythmState(params.skills);
    const snapshot = JSON.parse(JSON.stringify(s));
    advanceRhythm(s, 5, params, new Rng(1));
    expect(s).toEqual(snapshot);
  });

  it('技能 ID 与状态不匹配时直接报错', () => {
    const state = createRhythmState(params.skills);
    expect(() =>
      advanceRhythm(
        state,
        0.25,
        { ...params, skills: [{ skillId: 'other', cooldownSec: 4, priority: 1 }] },
        new Rng(1),
      ),
    ).toThrow(/ID 不一致/);
  });

  it.each([
    ['零冷却', 0],
    ['NaN 冷却', Number.NaN],
  ])('%s 配置直接报错', (_label, cooldownSec) => {
    const skills = [{ skillId: 'broken', cooldownSec, priority: 1 }];
    const state = { ...createRhythmState(), skillCds: { broken: 0 } };
    expect(() => advanceRhythm(state, 0.25, { ...params, skills }, new Rng(1))).toThrow(/技能冷却/);
  });

  it('同一帧多个技能就绪时只按视觉优先级决定拍子顺序', () => {
    const skills = [
      { skillId: 'low', cooldownSec: 4, priority: 10 },
      { skillId: 'high', cooldownSec: 4, priority: 90 },
    ];
    const state = {
      ...createRhythmState(skills),
      skillCds: { low: 0, high: 0 },
    };
    const result = advanceRhythm(state, 0.25, { ...params, skills }, new Rng(8));
    expect(
      result.beats.filter((entry) => entry.kind === 'player-skill').map((entry) => entry.skillId),
    ).toEqual(['high', 'low']);
  });
});

describe('syncRhythmSkills', () => {
  it('技能 ID 集合不变时返回原对象', () => {
    const skills = rhythmSkills.slice(0, 2);
    const s = createRhythmState(skills);
    expect(syncRhythmSkills(s, [...skills].reverse())).toBe(s);
  });

  it('解锁新技能时按 ID 保留已有冷却进度', () => {
    const firstTwo = rhythmSkills.slice(0, 2);
    let s = createRhythmState(firstTwo);
    s = { ...s, skillCds: { 'skill-a': 1.2, 'skill-b': 3.4 } };
    const next = syncRhythmSkills(s, rhythmSkills.slice(0, 3));
    expect(next.skillCds['skill-a']).toBe(1.2);
    expect(next.skillCds['skill-b']).toBe(3.4);
    expect(next.skillCds['skill-c']).toBe(1.4);
  });

  it('技能重新排序不会把冷却串给另一技能，离开列表的技能会移除', () => {
    const s = {
      ...createRhythmState(rhythmSkills.slice(0, 3)),
      skillCds: { 'skill-a': 1, 'skill-b': 2, 'skill-c': 3 },
    };
    const next = syncRhythmSkills(s, [rhythmSkills[2]!, rhythmSkills[0]!]);
    expect(next.skillCds).toEqual({ 'skill-c': 3, 'skill-a': 1 });
  });
});

describe('createBattleRhythmSnapshot', () => {
  it('发布与生产器同源的基础行动和技能冷却，不暴露可变状态', () => {
    const skills = rhythmSkills.slice(0, 2);
    const state = {
      ...createRhythmState(skills),
      seq: 9,
      playerCd: 0.4,
      skillCds: { 'skill-a': 1, 'skill-b': 20 },
    };
    const snapshot = createBattleRhythmSnapshot(state, {
      contextId: 'catkin',
      epoch: 3,
      running: true,
      playerCooldownSec: 1,
      skills,
      lastBasicCastSeq: 7,
      lastCastBySkillId: { 'skill-a': 8, 'skill-b': 9 },
    });

    expect(snapshot.source).toBe('visual-projection');
    expect(snapshot.contextId).toBe('catkin');
    expect(snapshot.basic).toEqual({
      cooldownSec: 1,
      remainingSec: 0.4,
      ratio: 0.4,
      lastCastSeq: 7,
    });
    expect(snapshot.skills).toEqual([
      {
        skillId: 'skill-a',
        cooldownSec: 4,
        remainingSec: 1,
        ratio: 0.25,
        lastCastSeq: 8,
      },
      {
        skillId: 'skill-b',
        cooldownSec: 8,
        remainingSec: 8,
        ratio: 1,
        lastCastSeq: 9,
      },
    ]);
  });

  it('技能快照缺少同 ID 冷却时直接报错，不用零值兜底', () => {
    const skills = rhythmSkills.slice(0, 1);
    expect(() =>
      createBattleRhythmSnapshot(createRhythmState(), {
        contextId: 'shaman',
        epoch: 1,
        running: true,
        playerCooldownSec: 1,
        skills,
        lastBasicCastSeq: null,
        lastCastBySkillId: {},
      }),
    ).toThrow(/缺少技能冷却/);
  });
});

describe('advanceRhythm 治疗与召唤拍（2026-08-04 起进入挂机演出）', () => {
  const kitSkills: readonly RhythmSkillSpec[] = [
    {
      skillId: 'heal',
      cooldownSec: 10,
      priority: 95,
      effect: 'heal',
      castWhenSelfHpAtMost: 0.75,
      healMaxHpRatio: 0.1,
    },
    { skillId: 'pet', cooldownSec: 12, priority: 30, effect: 'summon' },
  ];
  const kitParams: RhythmParams = {
    ...params,
    skills: kitSkills,
    playerMaxHp: 1000,
  };

  it('血量高于门槛时治疗保持就绪不释放、不烧冷却；低于门槛后 1 秒内补上', () => {
    let state = createRhythmState(kitSkills);
    const first = advanceRhythm(state, 0.1, { ...kitParams, selfHpRatio: 0.9 }, new Rng(1));
    expect(first.beats.filter((b) => b.skillId === 'heal')).toHaveLength(0);
    state = first.state;

    const second = advanceRhythm(state, 1.0, { ...kitParams, selfHpRatio: 0.5 }, new Rng(2));
    const heals = second.beats.filter((b) => b.skillId === 'heal');
    expect(heals).toHaveLength(1);
    expect(heals[0]).toMatchObject({ kind: 'player-skill', effect: 'heal', crit: false });
    // 回复量 = healMaxHpRatio × playerMaxHp
    expect(heals[0]!.damage).toBe(100);
  });

  it('缺省 selfHpRatio 视为满血：门槛技能不释放（不误演）', () => {
    const state = createRhythmState(kitSkills);
    const advance = advanceRhythm(state, 0.1, kitParams, new Rng(3));
    expect(advance.beats.filter((b) => b.skillId === 'heal')).toHaveLength(0);
  });

  it('召唤拍 effect=summon、damage=0、不吃暴击', () => {
    const state = createRhythmState(kitSkills);
    const advance = advanceRhythm(state, 1.0, { ...kitParams, selfHpRatio: 1 }, new Rng(4));
    const pets = advance.beats.filter((b) => b.skillId === 'pet');
    expect(pets).toHaveLength(1);
    expect(pets[0]).toMatchObject({ kind: 'player-skill', effect: 'summon', damage: 0, crit: false });
  });

  it('门槛重试不烧冷却：开门后仍能立刻释放，随后按满冷却轮转', () => {
    let state = createRhythmState([kitSkills[0]!]);
    const closed = { ...kitParams, skills: [kitSkills[0]!], selfHpRatio: 1 };
    for (let i = 0; i < 5; i += 1) {
      const advance = advanceRhythm(state, 1.0, closed, new Rng(10 + i));
      expect(advance.beats).toEqual(advance.beats.filter((b) => b.skillId !== 'heal'));
      state = advance.state;
    }
    const open = advanceRhythm(state, 1.0, { ...closed, selfHpRatio: 0.3 }, new Rng(20));
    expect(open.beats.filter((b) => b.skillId === 'heal')).toHaveLength(1);
    // 释放后进入满冷却，紧接着的一秒不会再放
    const after = advanceRhythm(open.state, 1.0, { ...closed, selfHpRatio: 0.3 }, new Rng(21));
    expect(after.beats.filter((b) => b.skillId === 'heal')).toHaveLength(0);
  });

  it('非法门槛与回复比例被拒绝', () => {
    expect(() =>
      createRhythmState([{ skillId: 'x', cooldownSec: 5, priority: 1, castWhenSelfHpAtMost: 0 }]),
    ).toThrow();
    expect(() =>
      createRhythmState([{ skillId: 'x', cooldownSec: 5, priority: 1, healMaxHpRatio: 1.5 }]),
    ).toThrow();
  });
});
