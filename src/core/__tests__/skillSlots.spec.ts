/**
 * 技能栏判定契约。
 *
 * 这组测试守的是**客户端与服务端不会各判各的**：两边都从 resolveActiveSkillSlots 过，
 * 所以只要这里绿着，就不存在「客户端按玩家选的打、服务端按另一套复算」那种
 * 会被判成成绩不可信的静默分歧。
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_ACTIVE_SKILL_ORDER, skillsFor } from '@/data/skills';
import { CLASS_IDS } from '../types';
import {
  ACTIVE_SKILL_SLOTS,
  resolveActiveSkillSlots,
  selectableActiveSkillIds,
} from '../skillSlots';
import { buildDefaultPlayerSkillKit } from '../playerSkillKit';
import { buildTrialCombatant } from '../trial';
import { buildArenaDuelSide } from '../duel';

const MAX_LEVEL = 81;

describe('技能栏判定', () => {
  it('★ 没做过选择时逐字回落到默认顺序 —— 老存档迁移后行为零变化', () => {
    for (const classId of CLASS_IDS) {
      for (const level of [1, 10, 35, 50, MAX_LEVEL]) {
        const resolved = resolveActiveSkillSlots(classId, level, undefined);
        const expected = DEFAULT_ACTIVE_SKILL_ORDER[classId]
          .filter((id) => {
            const skill = skillsFor(classId).find((s) => s.id === id);
            return skill?.type === 'active' && skill.unlockLevel <= level;
          })
          .slice(0, ACTIVE_SKILL_SLOTS);
        expect(resolved.selected, `${classId} Lv${level}`).toEqual(expected);
        expect(resolved.usedDefault).toBe(true);
        expect(resolved.dropped).toEqual([]);
      }
    }
  });

  it('★ 「没选过」与「选了空」是两件事，不能合并', () => {
    // 合并的话，就没法在不改变老玩家行为的前提下让新玩家清空栏位。
    const notChosen = resolveActiveSkillSlots('swordsman', MAX_LEVEL, undefined);
    const chosenEmpty = resolveActiveSkillSlots('swordsman', MAX_LEVEL, []);
    expect(notChosen.selected.length).toBeGreaterThan(0);
    expect(chosenEmpty.selected).toEqual([]);
    expect(chosenEmpty.usedDefault).toBe(false);
  });

  it('★ 非法项被逐个丢弃，合法项照常生效 —— 不整单拒绝', () => {
    // 整单拒绝会把「存档里存着已改名技能」的玩家永久锁死，而他什么都没做错。
    const legal = selectableActiveSkillIds('swordsman', MAX_LEVEL)[0];
    const resolved = resolveActiveSkillSlots('swordsman', MAX_LEVEL, [
      legal,
      'skill_does_not_exist',
    ]);
    expect(resolved.selected).toEqual([legal]);
    expect(resolved.dropped).toEqual([
      { skillId: 'skill_does_not_exist', reason: 'unknown-skill' },
    ]);
  });

  it('未解锁的技能进不来 —— 伪造者拿不到任何收益', () => {
    const locked = skillsFor('swordsman').find(
      (skill) => skill.type === 'active' && skill.unlockLevel > 5,
    );
    expect(locked, '测试前提：剑姬应有 Lv5 之后才解锁的主动技').toBeDefined();
    const resolved = resolveActiveSkillSlots('swordsman', 5, [locked!.id]);
    expect(resolved.selected).toEqual([]);
    expect(resolved.dropped).toEqual([{ skillId: locked!.id, reason: 'locked' }]);
  });

  it('别的职业的技能进不来', () => {
    const foreign = skillsFor('witch').find((skill) => skill.type === 'active')!;
    const resolved = resolveActiveSkillSlots('swordsman', MAX_LEVEL, [foreign.id]);
    expect(resolved.selected).toEqual([]);
    expect(resolved.dropped[0]?.reason).toBe('unknown-skill');
  });

  it('被动技不占主动栏位', () => {
    const passive = skillsFor('swordsman').find((skill) => skill.type === 'passive');
    expect(passive, '测试前提：剑姬应有被动技').toBeDefined();
    const resolved = resolveActiveSkillSlots('swordsman', MAX_LEVEL, [passive!.id]);
    expect(resolved.dropped).toEqual([{ skillId: passive!.id, reason: 'not-active' }]);
  });

  it('同一技能重复占栏被折成一个', () => {
    const legal = selectableActiveSkillIds('swordsman', MAX_LEVEL)[0];
    const resolved = resolveActiveSkillSlots('swordsman', MAX_LEVEL, [legal, legal]);
    expect(resolved.selected).toEqual([legal]);
    expect(resolved.dropped).toEqual([{ skillId: legal, reason: 'duplicate' }]);
  });

  it(`最多 ${ACTIVE_SKILL_SLOTS} 个栏位，超出的按 overflow 丢弃`, () => {
    const pool = selectableActiveSkillIds('swordsman', MAX_LEVEL);
    expect(pool.length).toBeGreaterThan(ACTIVE_SKILL_SLOTS);
    const resolved = resolveActiveSkillSlots('swordsman', MAX_LEVEL, pool);
    expect(resolved.selected).toHaveLength(ACTIVE_SKILL_SLOTS);
    expect(resolved.dropped.every((d) => d.reason === 'overflow')).toBe(true);
  });

  it('★ 非法项不会把后面的合法项挤掉，丢弃原因也不会张冠李戴', () => {
    // 如果上限判定放在合法性之前，一个不存在的 id 会占掉一个名额，
    // 后面本来能进的技能就会被报成 overflow —— 排查时完全指错方向。
    const pool = selectableActiveSkillIds('swordsman', MAX_LEVEL);
    const resolved = resolveActiveSkillSlots('swordsman', MAX_LEVEL, [
      'ghost',
      ...pool.slice(0, ACTIVE_SKILL_SLOTS),
    ]);
    expect(resolved.selected).toEqual(pool.slice(0, ACTIVE_SKILL_SLOTS));
    expect(resolved.dropped).toEqual([{ skillId: 'ghost', reason: 'unknown-skill' }]);
  });

  it('丢弃后不自动补默认技能 —— 宁可空栏，也不给玩家一个他没选过的技能', () => {
    const legal = selectableActiveSkillIds('shaman', MAX_LEVEL)[0];
    const resolved = resolveActiveSkillSlots('shaman', MAX_LEVEL, [legal, 'gone_a', 'gone_b']);
    expect(resolved.selected).toEqual([legal]);
    expect(resolved.selected.length).toBeLessThan(ACTIVE_SKILL_SLOTS);
  });

  it('★ 玩家选择真的流进了战斗产物 —— 服务端复算用的就是玩家选的那几个', () => {
    // 这条钉的是「schema 上多了个字段，但没接到战斗里」这种半截接线：
    // 那种情况下客户端按玩家选的打、服务端按默认打，两边伤害对不上，
    // 表现是成绩被判不可信，不是报错。
    const level = MAX_LEVEL;
    const pool = selectableActiveSkillIds('swordsman', level);
    const picked = [pool[pool.length - 1], pool[pool.length - 2]];
    const build = buildTrialCombatant({
      name: '测试',
      classId: 'swordsman',
      level,
      equipped: Array<null>(8).fill(null),
      selectedActiveSkillIds: picked,
    });
    expect(build.skillKit.active.map((entry) => entry.skill.id)).toEqual(picked);
    expect(build.droppedSkillSlots).toEqual([]);
  });

  it('★ 不传选择时，战斗产物与技能栏上线前逐字一致', () => {
    const level = MAX_LEVEL;
    const withoutField = buildTrialCombatant({
      name: '测试',
      classId: 'catkin',
      level,
      equipped: Array<null>(8).fill(null),
    });
    expect(withoutField.skillKit.active.map((entry) => entry.skill.id)).toEqual(
      resolveActiveSkillSlots('catkin', level, undefined).selected,
    );
    expect(withoutField.droppedSkillSlots).toEqual([]);
  });

  it('★ 非法选择在服务端复算里被过滤而不是让整次提交失败', () => {
    const level = MAX_LEVEL;
    const legal = selectableActiveSkillIds('witch', level)[0];
    const build = buildTrialCombatant({
      name: '测试',
      classId: 'witch',
      level,
      equipped: Array<null>(8).fill(null),
      selectedActiveSkillIds: [legal, 'skill_renamed_last_week'],
    });
    expect(build.skillKit.active.map((entry) => entry.skill.id)).toEqual([legal]);
    expect(build.droppedSkillSlots).toEqual([
      { skillId: 'skill_renamed_last_week', reason: 'unknown-skill' },
    ]);
  });

  it('★ 竞技场防守方也吃技能栏 —— 否则玩家「进攻时生效、被打时不生效」且看不出来', () => {
    // 防守方是离线的，arena-challenge 只能从存储的快照重建他。
    // 这条钉的是「只给挑战方接上」这种半截接线：那种情况下配过技能栏的玩家
    // 防守强度会低于他自己的进攻强度，而战报里看不出任何异常。
    const level = MAX_LEVEL;
    const pool = selectableActiveSkillIds('kenshi', level);
    const picked = [pool[pool.length - 1]];
    const side = buildArenaDuelSide(
      {
        name: '防守方',
        classId: 'kenshi',
        level,
        equipped: Array<null>(8).fill(null),
        selectedActiveSkillIds: picked,
      },
      'defender',
    );
    // skillKit 在对决侧是可选的，所以先断它确实被带上了 ——
    // 少了这一句的话，「防守方根本没有技能包」会以 undefined 的形式静默通过。
    expect(side.skillKit, '防守方没有技能包').toBeDefined();
    expect(side.skillKit!.active.map((entry) => entry.skill.id)).toEqual(picked);
  });

  it('★ 与生产构建入口同源：默认解析结果就是当前实际上场的技能', () => {
    // 这条把契约钉到真正打仗的那个产物上，而不是只在本模块内部自洽。
    for (const classId of CLASS_IDS) {
      const level = MAX_LEVEL;
      const kit = buildDefaultPlayerSkillKit(classId, level);
      const resolved = resolveActiveSkillSlots(classId, level, undefined);
      expect(kit.active.map((entry) => entry.skill.id), classId).toEqual(resolved.selected);
    }
  });
});
