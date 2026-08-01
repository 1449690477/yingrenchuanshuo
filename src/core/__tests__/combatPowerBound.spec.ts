/**
 * 战力上界的测试（docs/65 §六之二 方向 B）。
 *
 * 这条上界的口径被测试改过两次，过程本身值得留在这里：
 *   ①原案「典型战力 × 3.0」——真实满配实测 3.50 倍，会误伤肝帝；
 *   ②改成 × 5.0——又发现倍率随职业在 1.3~3.5 之间变化，平坦系数形状就是错的；
 *   ③最终改成「从该等级该职业真正能穿到的最强一套推上界」。
 *
 * 两次否定都来自**拿真实装备数据算一遍**，而不是拿常量比常量。
 * 这正是今天频道里反复认的那一类错（自证断言）的反面做法。
 */

import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '../types';
import { expectedBuildCp } from '@/data/expectedPower';
import {
  COMBAT_POWER_HEADROOM,
  combatPowerCeiling,
  combatPowerCeilingRatio,
  isPlausibleCombatPower,
  structuralMaxCombatPower,
} from '../combatPowerBound';

const LEVEL = 78; // 当前内容顶

describe('上界从真实最强装备推出来', () => {
  it('物理上最强的一套一定通过，且余量装得下词条', () => {
    for (const classId of CLASS_IDS) {
      const maxed = structuralMaxCombatPower(LEVEL, classId);
      expect(maxed).toBeGreaterThan(0);
      expect(isPlausibleCombatPower(maxed, LEVEL, classId)).toBe(true);
      // 2026-08-01 A 版起词条在探针**里面**（每槽满 T5 纯键取最大），
      // 不再靠余量兜 —— 旧断言「ceiling ≥ maxed × 1.25」编码的是无词条探针
      // 时代的设计，新设计下 HEADROOM 只兜套装静态与版本漂移。
      expect(combatPowerCeiling(LEVEL, classId)).toBeCloseTo(maxed * COMBAT_POWER_HEADROOM, 6);
    }
  });

  it('典型养成的玩家离上界还有很大距离（上界不是拿来卡普通人的）', () => {
    for (const classId of CLASS_IDS) {
      const typical = expectedBuildCp(LEVEL, classId);
      expect(isPlausibleCombatPower(typical, LEVEL, classId)).toBe(true);
      expect(combatPowerCeiling(LEVEL, classId)).toBeGreaterThan(typical * 1.5);
    }
  });

  it('结构上界与典型养成的比值随等级塌陷 —— 平坦系数正是被它否掉的', () => {
    // 实测（docs/73 批 3 乘法投影 + 批 3-1 锚 Lv1 + 2026-08-01 A 版词条入探针）：
    // 全矩阵（Lv1~78 × 4 职业）峰值 = 120.92 @ Lv20 swordsman。
    // 相对上一版（无词条探针峰值 49.04）上浮的来源就是词条：低等级段 T5 满值
    // 相对裸属性占比极大，正是旧口径「探针×1.5」在新尺下拦掉 12 格真人的原因。
    // Lv16/20 峰值来自珍品商店超前品质阶梯 —— docs/73 A4 已拍板保留（a+c），属预期结构。
    // 只要塌陷还在，就不能退回「典型 × 单一系数」的写法：
    // 那个系数在低等级会松到形同虚设，在满级会紧到误伤肝帝。
    const low = combatPowerCeilingRatio(16, 'swordsman');
    const top = combatPowerCeilingRatio(LEVEL, 'swordsman');
    expect(low / top).toBeGreaterThan(2);

    // 同一等级跨职业只差一成左右 —— 说明它是等级的函数，不是职业的函数
    const sameLevel = CLASS_IDS.map((classId) => combatPowerCeilingRatio(LEVEL, classId));
    expect(Math.max(...sameLevel) / Math.min(...sameLevel)).toBeLessThan(1.5);

    // 守住合理范围：A 版（词条入探针）全矩阵实测峰值 = 120.92（Lv20 swordsman），
    // 门槛 125 = 峰值取整上浮（沿用小衡 2026-08-01「49.04 → 50」的同一裁定法）。
    // 它是绊线不是标定：若哪天某个比值跑到 125 以上，说明装备表出了新的超模件、
    // 又加了一档超前品质、或词条值域被抬 —— 该去查数据而不是调这条断言。
    // ⚠ 本次 50 → 125 恰恰**不是**「查数据」而是「改绊线」，因为触发它的是
    // 探针方法论变更（词条从 HEADROOM 挪进探针），不是数据超模 —— 两种情况的
    // 区分判据：方法变更会整条曲线等比上移，数据超模只会在单点冒尖。
    for (const level of [1, 16, 20, 40, LEVEL]) {
      for (const classId of CLASS_IDS) {
        expect(combatPowerCeilingRatio(level, classId)).toBeLessThan(125);
        expect(combatPowerCeilingRatio(level, classId)).toBeGreaterThan(1);
      }
    }
  });

  it('低等级同样成立：新号的上界也从真实可穿装备推出', () => {
    for (const level of [1, 16, 40]) {
      for (const classId of CLASS_IDS) {
        const maxed = structuralMaxCombatPower(level, classId);
        expect(isPlausibleCombatPower(maxed, level, classId)).toBe(true);
        expect(isPlausibleCombatPower(maxed * 2, level, classId)).toBe(false);
      }
    }
  });
});

describe('离谱值与非法等级', () => {
  it('自填的天文数字进不了榜', () => {
    expect(isPlausibleCombatPower(999_999_999, LEVEL, 'swordsman')).toBe(false);
  });

  it('负数与非有限值不可信', () => {
    expect(isPlausibleCombatPower(-1, LEVEL, 'swordsman')).toBe(false);
    expect(isPlausibleCombatPower(Number.NaN, LEVEL, 'swordsman')).toBe(false);
    expect(isPlausibleCombatPower(Number.POSITIVE_INFINITY, LEVEL, 'swordsman')).toBe(false);
  });

  it('等级本身不可信时，上界无从谈起，一律拒', () => {
    // 「先把等级伪造上去、再报一个对得上的战力」是最自然的绕过路径
    expect(isPlausibleCombatPower(100, 0, 'swordsman')).toBe(false);
    expect(isPlausibleCombatPower(100, 121, 'swordsman')).toBe(false);
    expect(isPlausibleCombatPower(100, 40.5, 'swordsman')).toBe(false);
  });

  it('新号的小数字照常通过', () => {
    // 新尺下 Lv1 结构上界 ≈ 86、上界余量 ≈ 129；100 在余量内应放行
    //（旧尺线性加权 ~583，200 曾是安全的；乘法投影后量级整体下移，docs/73 批 3）。
    expect(isPlausibleCombatPower(100, 1, 'swordsman')).toBe(true);
    expect(isPlausibleCombatPower(0, 1, 'witch')).toBe(true);
  });
});
