import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '../types';
import { createInstance } from '../equipment';
import { trialEquipmentSnapshotIssue } from '../trial';
import { Rng } from '../rng';
import { EQUIPMENT, getEquipment } from '@/data/equipment';

/**
 * 「下架不等于删除」——已下架商品的持有者必须仍然能提交到服务端。
 *
 * ## 背景
 *
 * 冰雪套（12 件）因外观整套复用问题于 2026-08-03 下架（main dc30f59）。
 * 下架只把货架从 BOUTIQUE_SHELF_LIST 摘掉、并从 BOUTIQUE_BOSS_DROP_THEME
 * 注释掉掉落来源，**装备定义一件没删**。
 *
 * ## 为什么必须有这条守卫
 *
 * 服务端五个端点（arena-snapshot / arena-challenge / submit-trial /
 * guild-expedition / sync-profile）的第一道闸就是 getEquipment(inst.defId)，
 * 取不到就直接 400『装备定义不存在』。而服务器**不存玩家背包**——
 * 已经买过冰雪套的真实玩家，装备只在他自己的 IndexedDB 里。
 *
 * ⇒ **谁哪天觉得「都下架了，定义留着是垃圾」而把这 12 条删掉，
 * 持有者当场无法进竞技场/试炼/公会远征，而且删的人不会看到任何红。**
 * 玩家侧表现为一个纯粹的 400，没有任何线索指向删定义这个动作。
 *
 * 这正是老板那条硬约束的反面：不能让正常玩家被判异常。
 *
 * ## 这条守卫钉的是什么
 *
 * 不是「货架下架了」（那归 views/__tests__/shopIceSnowDelisted.spec.ts），
 * 而是**下架之后，服务端那条真实校验路径依然放行**。
 * 用的是端点同款函数 getEquipment + trialEquipmentSnapshotIssue，
 * 不是自己另写一套等价判断。
 */

const ICE_SNOW_PREFIX = 'eq_shop_ice-snow_';

/** 下架时冰雪套的件数。件数对不上就说明有人动过定义，必须有人看一眼。 */
const ICE_SNOW_EQUIPMENT_COUNT = 12;

function iceSnowDefIds(): string[] {
  return Object.keys(EQUIPMENT)
    .filter((id) => id.startsWith(ICE_SNOW_PREFIX))
    .sort();
}

describe('下架商品的持有者仍能提交（冰雪套 · main dc30f59 下架）', () => {
  it('反空转：12 件定义仍在总表里 —— 件数为 0 时下面每条都会假绿', () => {
    const ids = iceSnowDefIds();
    expect(
      ids.length,
      `冰雪套定义件数变成了 ${ids.length}（期望 ${ICE_SNOW_EQUIPMENT_COUNT}）。\n` +
        '  ★如果是被删掉了：已购买的真实玩家会在竞技场/试炼/远征被判 400' +
        '『装备定义不存在』，而服务器不存背包，救不回来。\n' +
        '  下架的正确做法是摘货架 + 断掉落，定义与外观必须留着。',
    ).toBe(ICE_SNOW_EQUIPMENT_COUNT);
  });

  it('★ 每一件都能过服务端第一道闸 getEquipment', () => {
    for (const id of iceSnowDefIds()) {
      expect(getEquipment(id), `${id} 取不到定义，持有者会被判 400`).toBeDefined();
    }
  });

  it('★ 每一件都能过服务端完整校验 trialEquipmentSnapshotIssue', () => {
    for (const id of iceSnowDefIds()) {
      const def = getEquipment(id);
      expect(def, `${id} 定义缺失`).toBeDefined();
      if (!def) continue;

      // 该装备允许哪些职业穿，由定义自己决定；这里不猜字段名，
      // 直接找「存在某个职业 + 某个掷点能让服务端放行」。
      const issues = new Set<string>();
      const passed = CLASS_IDS.some((classId) =>
        [20260803, 7, 42].some((seed) => {
          const inst = createInstance(def, new Rng(seed), `probe-${id}-${seed}`, classId);
          // 等级闸不是本条要测的东西，用满级排除它的干扰。
          const issue = trialEquipmentSnapshotIssue(inst, classId, 120);
          if (issue) issues.add(`${classId}:${issue}`);
          return issue === null;
        }),
      );
      expect(
        passed,
        `${id} 在所有职业与掷点下都被服务端拒绝：${[...issues].join('、')}`,
      ).toBe(true);
    }
  });

  it('反空转：校验函数确实会拒绝伪造值，不是恒返回 null', () => {
    const def = getEquipment(iceSnowDefIds()[0]);
    expect(def).toBeDefined();
    if (!def) return;
    const inst = createInstance(def, new Rng(20260803), 'probe-tamper', CLASS_IDS[0]);
    const tampered = {
      ...inst,
      affixes: inst.affixes.map((affix) => ({ ...affix, value: affix.value * 10 + 999 })),
    };
    // 若这里也返回 null，说明量具坏了，上面那条「全部放行」就毫无意义。
    expect(
      inst.affixes.length,
      '这件装备没有任何词条，伪造探针测不到东西',
    ).toBeGreaterThan(0);
    expect(trialEquipmentSnapshotIssue(tampered, CLASS_IDS[0], 120)).not.toBeNull();
  });
});
