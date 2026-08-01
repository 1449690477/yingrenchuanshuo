import { describe, expect, it } from 'vitest';
import { buildDefaultPlayerSkillKit } from '../playerSkillKit';
import { CLASS_IDS } from '../types';

describe('玩家默认技能栏生产入口', () => {
  it.each(CLASS_IDS)('%s 在各等级只装载已解锁的本职业技能', (classId) => {
    for (const level of [1, 30, 60, 90, 120]) {
      const kit = buildDefaultPlayerSkillKit(classId, level);
      expect(kit.active.length).toBeLessThanOrEqual(4);
      for (const entry of [...kit.active, ...kit.passives]) {
        expect(entry.skill.class).toBe(classId);
        expect(entry.skill.unlockLevel).toBeLessThanOrEqual(level);
      }
    }
  });

  it('召唤定义只进入所属灵巫技能栏，其他职业没有隐式召唤', () => {
    expect(buildDefaultPlayerSkillKit('shaman', 120).summons?.map((summon) => summon.id)).toEqual([
      'summon_shaman_skeleton',
      'summon_shaman_divine_beast',
    ]);
    for (const classId of CLASS_IDS.filter((candidate) => candidate !== 'shaman')) {
      expect(buildDefaultPlayerSkillKit(classId, 120).summons).toEqual([]);
    }
  });

  it('套装技能增伤以小数口径原样进入同一技能栏', () => {
    expect(buildDefaultPlayerSkillKit('kenshi', 120, 0.18).skillDamageBonusRatio).toBe(0.18);
  });

  it('拒绝非有限的技能伤害加成，不用静默默认值掩盖上游错误', () => {
    expect(() => buildDefaultPlayerSkillKit('kenshi', 120, Number.NaN)).toThrow('有限数');
  });
});
