/**
 * 档案进度行的构造契约。
 *
 * 这组测试守的**不是**字段值本身，而是「**战力与版本戳不可分开写**」这条结构性质 ——
 * 2026-08-01 的缺口就是：四个函数各自手写 progress 对象，只有一个记得带戳，
 * 而漏戳的那条路径会产出「合法的戳 + 错尺的数」，筛得过、显示正常、没人看得出错。
 */

import { describe, expect, it } from 'vitest';
import { CP_FORMULA_VERSION } from '../cpFormulaVersion';
import { buildProfileProgress } from '../profileProgress';

const NOW = new Date('2026-08-01T12:00:00.000Z');

describe('档案进度行', () => {
  it('★ 战力与版本戳同批产出 —— 拿到战力就一定拿到戳', () => {
    const row = buildProfileProgress({
      classId: 'swordsman',
      level: 81,
      combatPower: 2_710_894,
      now: NOW,
    });
    expect(row.combat_power).toBe(2_710_894);
    expect(row.cp_formula_version).toBe(CP_FORMULA_VERSION);
  });

  it('★ 戳取自 core 常量，不是写死的字面量 —— 改公式时它自动跟上', () => {
    // 这条断言的重点是「等于那个常量」，不是「等于某个数字」。
    // 写成 toBe(2) 的话，公式升到 3 时这里会绿着放过一个过期的戳。
    const row = buildProfileProgress({ classId: 'witch', level: 1, combatPower: 1, now: NOW });
    expect(row.cp_formula_version).toBe(CP_FORMULA_VERSION);
  });

  it('战力取整 —— 列是整数，小数会被数据库截断成看不出来的偏差', () => {
    const row = buildProfileProgress({
      classId: 'catkin',
      level: 40,
      combatPower: 1234.6,
      now: NOW,
    });
    expect(row.combat_power).toBe(1235);
  });

  it('字段名与 profiles 的列名一致，调用方可以直接展开', () => {
    const row = buildProfileProgress({ classId: 'shaman', level: 5, combatPower: 10, now: NOW });
    expect(Object.keys(row).sort()).toEqual([
      'class_id',
      'combat_power',
      'cp_formula_version',
      'level',
      'updated_at',
    ]);
  });

  it('时刻可注入，缺省取当前 —— 测试不依赖真实时钟', () => {
    const row = buildProfileProgress({ classId: 'witch', level: 2, combatPower: 3, now: NOW });
    expect(row.updated_at).toBe('2026-08-01T12:00:00.000Z');
    const auto = buildProfileProgress({ classId: 'witch', level: 2, combatPower: 3 });
    expect(Number.isFinite(Date.parse(auto.updated_at))).toBe(true);
  });
});
