/**
 * `runTrial → simulateFight` 的**调用契约**。
 *
 * ## 这条测试补的是行为不变量看不见的那一半
 *
 * `trialBound.spec.ts` 里那条「damage 恒 ≤ Boss 初始血量」是**行为**不变量：
 * 它跑真实构筑、真实 Boss，对所有伤害向量同时成立。但它只能看见
 * **样本里存在的配置**。
 *
 * 于是有一个它必然漏掉的场景（@小桥 2026-08-02 01:36 指出）：
 * 将来 `runTrial` 开始给 Boss 传技能组，而当时在编的 Boss 恰好还没配召唤 ——
 * **行为样本仍然全绿，保护却已经没了**。等到某周的 Boss 配上召唤，
 * 判据就开始误伤把 Boss 打死的真实玩家，而且没有任何测试提前变红。
 *
 * ## 为什么钉「白名单」而不是「黑名单」
 *
 * 直觉写法是断言「不许出现 monsterSkillKit」。但那是**枚举**，
 * 挡不住还没被想到的那个参数 —— 今晚已经现场演示过一次枚举失效：
 * 有人断言「召唤不存在」并用它支撑拿掉安全余量，一分钟后就发现召唤
 * 作为 SkillEffect 是声明了的，而且正有人在实现。
 *
 * 所以这里钉的是**完整参数集合**：`runTrial` 传给 `simulateFight` 的
 * 键必须**恰好**是下面这几个。多一个、少一个都红 —— 包括将来那个
 * 谁也没想到的参数。
 *
 * ## 红了该怎么办
 *
 * **不要直接改这个白名单让它变绿。** 先回答一个问题：
 * 新参数会不会让「计入成绩的伤害」绕过 Boss 的血量扣减路径
 * （`combat.ts` 的 `Math.min(剩余血量, 伤害)` 截断）？
 * - 不会 → 把新键加进白名单，并在此注明理由；
 * - 会 → **上界不能再等于 Boss 血量**，必须连同 `trialBracketDamageCeiling`
 *   一起重审，否则第一批受害者是把 Boss 打死的顶尖玩家。
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function trialSource(): string {
  return readFileSync(new URL('../trial.ts', import.meta.url), 'utf8');
}

/** 抠出 `runTrial` 函数体内传给 `simulateFight` 的那个 opts 字面量。 */
function simulateFightOptsInRunTrial(source: string): string {
  const fnStart = source.indexOf('export function runTrial(');
  expect(fnStart, 'trial.ts 里找不到 runTrial —— 契约测试失去了锚点').toBeGreaterThan(-1);

  // 函数体到下一个顶格 `}` 为止
  const fnEnd = source.indexOf('\n}', fnStart);
  const body = source.slice(fnStart, fnEnd);

  const callStart = body.indexOf('simulateFight(');
  expect(callStart, 'runTrial 不再调用 simulateFight —— 这条契约的前提变了').toBeGreaterThan(-1);

  const braceStart = body.indexOf('{', callStart);
  const braceEnd = body.indexOf('});', braceStart);
  expect(braceEnd, 'simulateFight 的 opts 不再是内联字面量，契约需要重写').toBeGreaterThan(-1);
  return body.slice(braceStart, braceEnd);
}

/** 取字面量里的顶层键名。 */
function topLevelKeys(objectLiteral: string): string[] {
  return [...objectLiteral.matchAll(/^\s{4}([A-Za-z][A-Za-z0-9]*):/gm)].map((m) => m[1]!);
}

/**
 * 白名单：`runTrial` 允许传给 `simulateFight` 的全部键。
 *
 * 共同点是**它们都只作用于玩家一侧或整场时长**，没有一个能让 Boss
 * 回血、多命、或另开一条不经过血量扣减的计分路径。
 */
const ALLOWED_KEYS = [
  'maxSeconds',
  'playerSkillMultiplier',
  'playerOnHitTriggers',
  'playerOnLethalTriggers',
  'playerOnCritTriggers',
] as const;

describe('runTrial → simulateFight 调用契约 · 结构上界的地基', () => {
  it('★ 传参集合必须恰好等于白名单 —— 多一个键就必须重审上界', () => {
    const keys = topLevelKeys(simulateFightOptsInRunTrial(trialSource()));
    expect(
      [...keys].sort(),
      'runTrial 传给 simulateFight 的参数变了。先别改白名单：\n' +
        '新参数会不会让计入成绩的伤害绕过 Boss 血量扣减路径？\n' +
        '会的话，「上界 = Boss 初始血量」不再成立，必须连 trialBracketDamageCeiling 一起重审。',
    ).toEqual([...ALLOWED_KEYS].sort());
  });

  /**
   * 白名单是「恰好相等」，本来已经蕴含了这条。但怪物侧参数是
   * `FightOptions` 里**真实存在**的能力（`monsterSkillMultiplier`、
   * `monsterOnLethalTriggers` 都在 combat.ts 里），补一条点名断言，
   * 是为了红的时候第一眼就知道踩的是哪根线。
   */
  it('一个 monster* 参数都不许传 —— Boss 拿到任何能力，血量就不再是天花板', () => {
    const opts = simulateFightOptsInRunTrial(trialSource());
    const monsterKeys = topLevelKeys(opts).filter((key) => key.startsWith('monster'));
    expect(
      monsterKeys,
      `runTrial 给 Boss 传了 ${monsterKeys.join('、')}。` +
        'Boss 一旦能回血/多命/召唤，累计伤害就能超过初始血量，' +
        '而判据仍按血量卡人时，被误伤的是把 Boss 打死的真实玩家。',
    ).toEqual([]);
  });

  it('白名单本身不能悄悄变空 —— 空集合会让上面两条恒绿', () => {
    expect(ALLOWED_KEYS.length).toBeGreaterThan(0);
    expect(topLevelKeys(simulateFightOptsInRunTrial(trialSource())).length).toBeGreaterThan(0);
  });

  /**
   * ★ 自检：证明上面那两条**真的会红**。
   *
   * 一条不会失败的测试没有价值，而「源码里没搜到坏东西」恰恰是最容易
   * 假绿的形状 —— 正则写错、锚点找不到、函数体截断，全都表现为「干净通过」。
   *
   * 这里不去改真的 trial.ts（工作树是多实例共用的，临时改产品代码再还原
   * 有被别人的提交捎上的风险），改喂一段**合成源码**给同一个检测器：
   * 它必须能从里面认出那个多出来的怪物侧参数。检测器坏了，这条会红。
   */
  it('★ 自检：检测器能认出被破坏的调用（否则上面两条是假绿）', () => {
    const broken = [
      'export function runTrial(build: TrialBuild, boss: Combatant, seed: number): TrialRunResult {',
      '  const result = simulateFight(player, target, new Rng(seed), {',
      '    maxSeconds: TRIAL_DURATION_SEC,',
      '    playerSkillMultiplier: build.skillMultiplier,',
      '    monsterOnLethalTriggers: boss.onLethalTriggers,',
      '  });',
      '  return result;',
      '}',
    ].join('\n');

    const keys = topLevelKeys(simulateFightOptsInRunTrial(broken));
    expect(keys, '检测器没能从被破坏的调用里读出参数 —— 主断言的绿色不可信').toContain(
      'monsterOnLethalTriggers',
    );
    expect(keys.filter((key) => key.startsWith('monster'))).toEqual(['monsterOnLethalTriggers']);
    // 同一段合成源码放进主断言的口径里，必须判为「不等于白名单」
    expect([...keys].sort()).not.toEqual([...ALLOWED_KEYS].sort());
  });
});
