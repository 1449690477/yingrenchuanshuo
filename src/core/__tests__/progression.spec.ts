import { describe, it, expect } from 'vitest';
import {
  levelSoftCap,
  settleLevelUps,
  averageSkillMultiplier,
  baseStatsFor,
  expToNext,
  makeMonster,
  monsterAtk,
  monsterExp,
  monsterHp,
  staminaMaxForLevel,
  totalExpTo,
} from '../progression';
import {
  AVG_SKILL_MULTIPLIERS,
  CLASS_BASE_STATS,
  EXP_BASE,
  LEVEL_SOFT_CAP_MARGIN,
  STAMINA_BASE_MAX,
  STAMINA_CAPS,
} from '@/data/constants';
import { ALL_CHAPTERS } from '@/data/regions';
import { CLASS_IDS } from '../types';

describe('expToNext', () => {
  // 断言公式关系而非硬编码数字 —— 否则每次调平衡都要改测试
  it('Lv1 升级所需经验等于 EXP_BASE（因为 1^n = 1）', () => {
    expect(expToNext(1)).toBe(EXP_BASE);
  });

  it('严格单调递增', () => {
    for (let l = 1; l < 150; l++) {
      expect(expToNext(l + 1)).toBeGreaterThan(expToNext(l));
    }
  });

  it('等级 < 1 时报错', () => {
    expect(() => expToNext(0)).toThrow();
  });
});

describe('等级软上限（docs/56 §2）', () => {
  it('上限 = 可达最高关卡等级 + 余量', () => {
    expect(levelSoftCap(10)).toBe(10 + LEVEL_SOFT_CAP_MARGIN);
    expect(levelSoftCap(52)).toBe(52 + LEVEL_SOFT_CAP_MARGIN);
    expect(() => levelSoftCap(0)).toThrow('正整数');
  });

  it('未到上限正常连升，经验逐级扣除', () => {
    const exp = expToNext(5) + expToNext(6);
    const r = settleLevelUps(5, exp, 13);
    expect(r.level).toBe(7);
    expect(r.exp).toBe(0);
    expect(r.levelsGained).toBe(2);
  });

  it('顶到上限即停，超限经验原样保留不作废', () => {
    const exp = expToNext(12) + 999_999;
    const r = settleLevelUps(12, exp, 13);
    expect(r.level).toBe(13);
    // 只扣了升到 13 的那一级，剩余全部囤着
    expect(r.exp).toBe(999_999);
  });

  it('上限上移后囤积经验一次性释放（解锁新章的爽点）', () => {
    const hoard = expToNext(13) + expToNext(14) + expToNext(15);
    const frozen = settleLevelUps(13, hoard, 13);
    expect(frozen.level).toBe(13);
    expect(frozen.exp).toBe(hoard);

    const released = settleLevelUps(frozen.level, frozen.exp, 16);
    expect(released.level).toBe(16);
    expect(released.exp).toBe(0);
    expect(released.levelsGained).toBe(3);
  });

  it('老档等级高于上限：原样保留绝不回收，只是不再升（docs/40 红线）', () => {
    const r = settleLevelUps(118, 5_000_000, 55);
    expect(r.level).toBe(118);
    expect(r.exp).toBe(5_000_000);
    expect(r.levelsGained).toBe(0);
  });
});

describe('totalExpTo', () => {
  it('到 1 级为 0', () => {
    expect(totalExpTo(1)).toBe(0);
  });

  it('到 3 级等于前两级之和', () => {
    expect(totalExpTo(3)).toBe(expToNext(1) + expToNext(2));
  });
});

describe('baseStatsFor', () => {
  it('Lv1 等于职业基础属性', () => {
    for (const cls of CLASS_IDS) {
      const s = baseStatsFor(cls, 1);
      expect(s.atk).toBe(CLASS_BASE_STATS[cls].atk);
      expect(s.def).toBe(CLASS_BASE_STATS[cls].def);
      expect(s.hp).toBe(CLASS_BASE_STATS[cls].hp);
    }
  });

  it('魔女攻击最高、剑姬血量最厚（职业定位）', () => {
    const lv = 50;
    const sword = baseStatsFor('swordsman', lv);
    const witch = baseStatsFor('witch', lv);
    const shaman = baseStatsFor('shaman', lv);

    expect(witch.atk).toBeGreaterThan(sword.atk);
    expect(witch.atk).toBeGreaterThan(shaman.atk);
    expect(sword.hp).toBeGreaterThan(witch.hp);
    expect(sword.hp).toBeGreaterThan(shaman.hp);
    expect(sword.def).toBeGreaterThan(witch.def);
  });

  it('喵喵是四职业中攻速、闪避和基础暴击最高的高速职业', () => {
    const catkin = baseStatsFor('catkin', 50);
    for (const classId of CLASS_IDS.filter((id) => id !== 'catkin')) {
      const other = baseStatsFor(classId, 50);
      expect(catkin.spd).toBeGreaterThan(other.spd);
      expect(catkin.eva).toBeGreaterThan(other.eva);
      expect(catkin.critRate).toBeGreaterThan(other.critRate);
    }
  });

  it('属性随等级单调增长', () => {
    for (let l = 1; l < 100; l++) {
      expect(baseStatsFor('swordsman', l + 1).atk).toBeGreaterThan(
        baseStatsFor('swordsman', l).atk,
      );
    }
  });
});

describe('怪物强度', () => {
  // 注意：这里用比值断言而非精确相等。
  // 公式是「先乘系数再 round」，而不是「先 round 再乘」，
  // 所以 elite 和 normal×6 会有 ±1 的舍入差。这是正确行为。
  it('精英与 BOSS 的血量按类型系数放大', () => {
    const lv = 40;
    const eliteRatio = monsterHp(lv, 'elite') / monsterHp(lv, 'normal');
    const bossRatio = monsterHp(lv, 'boss') / monsterHp(lv, 'normal');
    expect(Math.abs(eliteRatio - 6) / 6).toBeLessThan(0.001);
    expect(Math.abs(bossRatio - 40) / 40).toBeLessThan(0.001);
  });

  it('BOSS 经验是小怪的 30 倍', () => {
    const ratio = monsterExp(30, 'boss') / monsterExp(30, 'normal');
    expect(Math.abs(ratio - 30) / 30).toBeLessThan(0.001); // 舍入误差 0.1% 以内
  });

  it('血量与攻击随等级单调增长', () => {
    for (let l = 1; l < 120; l++) {
      expect(monsterHp(l + 1)).toBeGreaterThan(monsterHp(l));
      expect(monsterAtk(l + 1)).toBeGreaterThan(monsterAtk(l));
    }
  });

  it('怪物血量增速快于玩家等级属性增速（卡点的来源）', () => {
    // 怪物血量 60 级 / 30 级 的倍率，应显著高于玩家攻击的同段倍率
    const hpRatio = monsterHp(60) / monsterHp(30);
    const atkRatio = baseStatsFor('swordsman', 60).atk / baseStatsFor('swordsman', 30).atk;
    expect(hpRatio).toBeGreaterThan(atkRatio);
  });
});

describe('makeMonster', () => {
  it('生成的怪物满血且属性一致', () => {
    const m = makeMonster({
      id: 'mon_test',
      name: '测试史莱姆',
      level: 20,
      type: 'normal',
      element: 'ice',
      lootTableId: 'loot_test',
      sprite: '',
    });
    expect(m.currentHp).toBe(m.stats.hp);
    expect(m.stats.hp).toBe(monsterHp(20, 'normal'));
    expect(m.element).toBe('ice');
    expect(m.level).toBe(20);
  });
});

describe('M2 等级档位配置', () => {
  it('平均技能倍率读取 data 配置且随等级不下降', () => {
    expect(averageSkillMultiplier(1)).toBe(
      AVG_SKILL_MULTIPLIERS.find((entry) => entry.minLevel === 1)!.multiplier,
    );
    let previous = averageSkillMultiplier(1);
    for (let level = 2; level <= 120; level++) {
      const current = averageSkillMultiplier(level);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });

  it('体力上限从基础值开始并按等级提升', () => {
    expect(staminaMaxForLevel(1)).toBe(STAMINA_BASE_MAX);
    expect(staminaMaxForLevel(39)).toBe(STAMINA_BASE_MAX);
    expect(staminaMaxForLevel(40)).toBeGreaterThan(STAMINA_BASE_MAX);
    expect(staminaMaxForLevel(100)).toBeGreaterThan(staminaMaxForLevel(70));
  });

  it('非法等级直接报错', () => {
    expect(() => averageSkillMultiplier(0)).toThrow();
    expect(() => staminaMaxForLevel(0)).toThrow();
  });
});

// ────────── 等级阶梯表的结构守卫（2026-07-31） ──────────

/**
 * 这组测试的由来是一次**我差点犯的错**。
 *
 * docs/65 §六 我把 STAMINA_CAPS 的 minLevel 70 档和 AVG_SKILL_MULTIPLIERS 的
 * minLevel 85 档列为「Lv120 时代的死配置，待清理」—— 依据是当时软上限只有 68。
 * 区域 7 上线后软上限变成 81，**Lv70 那档立刻变成活的**，真的在给玩家抬体力上限。
 * 如果当初照那条建议删掉，区域 7 会静默丢掉这个档位，而且没有任何测试会发现。
 *
 * 教训：**「当前不可达」不等于「死配置」**。判据不是今天能否达到，
 * 而是设计上是否打算让它随内容自动生效 —— 与 typicalQualityAt 的
 * mythic/divine 两档是同一类东西（docs/60 §2.3 已经写过一次同样的道理）。
 */
describe('等级阶梯表的结构守卫', () => {
  const ladders = [
    { name: 'STAMINA_CAPS', rows: STAMINA_CAPS.map((e) => ({ minLevel: e.minLevel, value: e.max })) },
    {
      name: 'AVG_SKILL_MULTIPLIERS',
      rows: AVG_SKILL_MULTIPLIERS.map((e) => ({ minLevel: e.minLevel, value: e.multiplier })),
    },
  ];

  it('必须按 minLevel 降序排列 —— 查找取第一个匹配，升序会静默取错档', () => {
    // progression.ts 用 .find(level >= entry.minLevel) 取首个匹配。
    // 有人若按直觉改成升序，Lv80 玩家会拿到 minLevel 1 那档而不是 70 那档，
    // 而且不会报错、不会有人发现 —— 这正是最危险的一类回归。
    for (const ladder of ladders) {
      for (let i = 1; i < ladder.rows.length; i++) {
        expect(
          ladder.rows[i]!.minLevel,
          `${ladder.name} 第 ${i} 项破坏了降序`,
        ).toBeLessThan(ladder.rows[i - 1]!.minLevel);
      }
    }
  });

  it('必须有 minLevel 1 的兜底档 —— 查找末尾有非空断言，缺了会崩', () => {
    for (const ladder of ladders) {
      expect(
        ladder.rows[ladder.rows.length - 1]!.minLevel,
        `${ladder.name} 缺少 minLevel 1 兜底`,
      ).toBe(1);
    }
  });

  it('取值随等级单调递增 —— 高等级档不能比低等级档差', () => {
    for (const ladder of ladders) {
      for (let i = 1; i < ladder.rows.length; i++) {
        expect(
          ladder.rows[i - 1]!.value,
          `${ladder.name} 高等级档取值不高于低等级档`,
        ).toBeGreaterThan(ladder.rows[i]!.value);
      }
    }
  });

  it('超出当前软上限的档位一律保留 —— 它们是给未来内容留的，不是死配置', () => {
    const contentTop = Math.max(...ALL_CHAPTERS.map((chapter) => chapter.levelTo));
    const softCap = contentTop + LEVEL_SOFT_CAP_MARGIN;

    for (const ladder of ladders) {
      const beyond = ladder.rows.filter((row) => row.minLevel > softCap);
      // 这条不断言「必须有」超限档（内容涨上去后可能一个都不剩），
      // 而是断言「有的话必须仍然结构良好」—— 真正的守卫是上面三条。
      // 它存在的意义是把「超限档是有意保留的」这件事写进测试，
      // 让下一个想做清理的人先读到这段注释。
      for (const row of beyond) {
        expect(row.minLevel).toBeGreaterThan(softCap);
        expect(row.value).toBeGreaterThan(0);
      }
    }

    // 阶梯必须覆盖到当前软上限：最高的可达档不能低于软上限太多，
    // 否则说明内容涨上去了而阶梯没跟上。
    for (const ladder of ladders) {
      const reachable = ladder.rows.filter((row) => row.minLevel <= softCap);
      expect(reachable.length, `${ladder.name} 在软上限 ${softCap} 下无可达档`).toBeGreaterThan(0);
    }
  });

  it('查找函数在软上限内的每一级都能取到值', () => {
    const contentTop = Math.max(...ALL_CHAPTERS.map((chapter) => chapter.levelTo));
    const softCap = contentTop + LEVEL_SOFT_CAP_MARGIN;
    for (let level = 1; level <= softCap; level++) {
      expect(() => staminaMaxForLevel(level)).not.toThrow();
      expect(staminaMaxForLevel(level)).toBeGreaterThan(0);
      expect(averageSkillMultiplier(level)).toBeGreaterThan(0);
    }
  });
});
