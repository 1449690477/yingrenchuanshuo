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
} from '@/data/constants';
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
