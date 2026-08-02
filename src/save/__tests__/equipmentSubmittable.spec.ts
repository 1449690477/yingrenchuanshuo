import { describe, expect, it } from 'vitest';
import { createInstance } from '@/core/equipment';
import { Rng } from '@/core/rng';
import { trialEquipmentSnapshotIssue } from '@/core/trial';
import { CLASS_IDS } from '@/core/types';
import { EQUIPMENT } from '@/data/equipment';

/**
 * 联机提交硬门禁：把每件装备定义交给真实生成器，再送进五条 Edge Function 共用的
 * trialEquipmentSnapshotIssue 判据。绿只证明“客户端合法生成值不会被服务器拒绝”，
 * 不证明反作弊余量足够紧；战力上界另有独立守卫。
 */
describe('全部装备定义的联机可提交性', () => {
  it('真实生成的每一件装备都必须通过服务端硬校验', () => {
    const invalid: string[] = [];
    let checked = 0;
    let iceSnowChecked = 0;

    for (const definition of Object.values(EQUIPMENT)) {
      for (const classId of CLASS_IDS) {
        if (definition.classId && definition.classId !== classId) continue;
        for (let seed = 1; seed <= 8; seed += 1) {
          const instance = createInstance(
            definition,
            new Rng(seed * 7919),
            `submit-${definition.id}-${classId}-${seed}`,
            classId,
          );
          const issue = trialEquipmentSnapshotIssue(instance, classId, definition.level);
          checked += 1;
          if (definition.boutiqueTheme === 'ice-snow') iceSnowChecked += 1;
          if (!issue) continue;
          const affixes = instance.affixes
            .map((affix) => `${affix.key}=${affix.value}(T${affix.tier})`)
            .join(' ');
          invalid.push(
            `${definition.id} Lv${definition.level} ${classId} seed${seed} → ${issue} | ${affixes}`,
          );
          break;
        }
      }
    }

    expect(invalid).toEqual([]);
    // main@1f3ff0e 的旧表为 11,056 件次；冰雪 7 通用件×5职业 + 5职业武器 =
    // 40 个合法定义/职业组合，再乘 8 seed，必须精确新增 320 件次。
    expect(iceSnowChecked).toBe(320);
    expect(checked).toBeGreaterThan(11_056);
  });
});
