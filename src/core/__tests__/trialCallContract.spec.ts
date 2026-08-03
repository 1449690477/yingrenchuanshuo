/**
 * `runTrial → simulateFight` 的运行时调用契约。
 *
 * 试炼反作弊上界等于 Boss 初始血量，前提是玩家只攻击 Boss，且 Boss 没有
 * 技能、召唤或其他额外血池。这里直接检查 runTrial 使用的统一参数构造点，
 * 不解析源码文本，正常重构不会让测试误报。
 *
 * 白名单变化时不要直接迎合测试：应先确认新参数会不会让计入成绩的伤害绕过
 * Boss 血量扣减；若会，必须连 `trialBracketDamageCeiling` 一起重审。
 *
 * 2026-08-03 批 3b 新增 `playerDamageMultiplier`：它是玩家侧直接伤害乘区，
 * 仍然全部经由 Boss 血量扣减路径（`Math.min(剩余血量, 伤害)`）计入成绩，
 * 不新增计分通道 —— 结构上界不变量保持成立，故纳入白名单。
 */

import { describe, expect, it } from 'vitest';
import { buildTrialCombatant, trialFightOptions } from '../trial';
import { SLOT_ORDER } from '@/data/constants';

const ALLOWED_KEYS = [
  'maxSeconds',
  'playerSkillKit',
  'playerTargetType',
  'playerOnHitTriggers',
  'playerOnLethalTriggers',
  'playerOnCritTriggers',
  'playerDamageMultiplier',
] as const;

function optionsForTest(): Record<string, unknown> {
  const build = buildTrialCombatant({
    name: '试炼调用契约',
    classId: 'kenshi',
    level: 65,
    equipped: SLOT_ORDER.map(() => null),
  });
  return trialFightOptions(build, {
    name: '契约靶',
    level: 65,
    element: 'fire',
    stats: { atk: 1, def: 0, hp: 10_000, acc: 0, eva: 0, critRate: 0, critDmg: 0, spd: 1 },
    currentHp: 10_000,
  }) as Record<string, unknown>;
}

function unexpectedKeys(options: Record<string, unknown>): string[] {
  const allowed = new Set<string>(ALLOWED_KEYS);
  return Object.keys(options).filter((key) => !allowed.has(key));
}

describe('runTrial → simulateFight 调用契约 · 结构上界的地基', () => {
  it('★ 运行时传参集合必须恰好等于白名单，多一个或少一个都要重审上界', () => {
    const keys = Object.keys(optionsForTest()).sort();
    expect(
      keys,
      '试炼战斗参数变了：先确认新参数是否引入 Boss 回血、多命、召唤或额外计分路径。',
    ).toEqual([...ALLOWED_KEYS].sort());
  });

  it('玩家目标固定为 Boss，且任何 monster* 参数都不允许出现', () => {
    const options = optionsForTest();
    expect(options.playerTargetType).toBe('boss');
    expect(Object.keys(options).filter((key) => key.startsWith('monster'))).toEqual([]);
  });

  it('白名单与运行时参数都不能悄悄变空', () => {
    expect(ALLOWED_KEYS.length).toBeGreaterThan(0);
    expect(Object.keys(optionsForTest()).length).toBeGreaterThan(0);
  });

  it('★ 自检：同一个检查器能识别未来误加的怪物侧参数', () => {
    const broken = { ...optionsForTest(), monsterOnLethalTriggers: [] };
    expect(unexpectedKeys(broken)).toEqual(['monsterOnLethalTriggers']);
  });
});
