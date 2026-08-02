import { describe, expect, it } from 'vitest';
import { CLASS_IDS, type EquipmentDef, type EquipmentInstance, type Quality } from '../types';
import {
  addCombatBonuses,
  affixValueRange,
  applyAffix,
  applyCombatAffix,
  baseEquipStats,
  baseRollGrade,
  createFixedInstance,
  createInstance,
  enhanceGainGrade,
  enhanceMultiplier,
  forgeStageAt,
  hasFullyFixedAffixes,
  instanceCombatBonuses,
  instanceStats,
  itemBaseValue,
  isRolledAffixValue,
  isVerifiablePersistedAffixValue,
  pickProfessionAffixSpec,
  rollAffixForKey,
  rollAffixes,
  rollAffixTier,
  rollAffixValue,
  rollBasePermille,
  rollEnhanceGainPermille,
  totalEquipCombatBonuses,
  totalEquipStats,
  weaponElementOf,
  zeroCombatBonuses,
} from '../equipment';
import { zeroStats } from '../formula';
import { Rng } from '../rng';
import {
  AFFIX_POOL,
  AFFIX_ELEMENT_OPTIONS,
  AFFIX_LABELS,
  AFFIX_RUNTIME_RULES,
  AFFIX_TIERS,
  availableAffixElementsAtLevel,
  ENHANCE_MAX,
  ENHANCE_PER_LEVEL,
  ENHANCE_TOTAL_GAIN_CAP_PERMILLE,
  EQUIPMENT_BASE_ROLL_MAX,
  EQUIPMENT_BASE_ROLL_MIN,
  QUALITY_AFFIX_COUNT,
  QUALITY_MUL,
  QUALITY_ORDER,
  QUALITY_PROFESSION_AFFIX_COUNT,
  PROFESSION_AFFIX_POOLS,
} from '@/data/constants';

function def(overrides: Partial<EquipmentDef> = {}): EquipmentDef {
  const slot = overrides.slot ?? 'ring';
  const { slot: _slot, element, ...rest } = overrides;
  const common = {
    id: 'eq_test',
    name: '测试戒指',
    quality: 'rare' as Quality,
    level: 20,
    icon: '',
    appearanceId: 'test-ring',
    ...rest,
  };
  return slot === 'weapon'
    ? { ...common, slot, element: element ?? 'none' }
    : { ...common, slot, element: undefined };
}

function inst(overrides: Partial<EquipmentInstance> = {}): EquipmentInstance {
  return {
    uid: 'e1',
    defId: 'eq_test',
    enhance: 0,
    baseRollPermille: 1000,
    enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(0),
    enhanceLuck: {},
    affixes: [],
    reforgeResonance: 0,
    locked: false,
    ...overrides,
  };
}

describe('装备基础属性', () => {
  it('武器元素只读取静态定义，且拒绝把非武器当作攻击属性来源', () => {
    expect(weaponElementOf(def({ slot: 'weapon', element: 'fire' }))).toBe('fire');
    expect(() => weaponElementOf(def({ slot: 'ring' }))).toThrow('只有武器');
  });

  it('等级和品质越高，数值基准越高', () => {
    expect(itemBaseValue(20, 'common')).toBeGreaterThan(itemBaseValue(10, 'common'));
    expect(itemBaseValue(20, 'rare') / itemBaseValue(20, 'common')).toBeCloseTo(
      QUALITY_MUL.rare,
      8,
    );
  });

  it('百分比属性只随品质变化，不随等级膨胀', () => {
    const low = baseEquipStats(def({ level: 1 }));
    const high = baseEquipStats(def({ level: 120 }));

    expect(high.atk).toBeGreaterThan(low.atk);
    expect(high.critRate).toBe(low.critRate);
    expect(high.critDmg).toBe(low.critDmg);
  });

  it('非法装备等级直接报错', () => {
    expect(() => itemBaseValue(0, 'common')).toThrow();
    expect(() => itemBaseValue(1.5, 'common')).toThrow();
  });
});

describe('强化与实例属性', () => {
  it('旧版每级 8% 记录在 +15 时仍精确为 2.2 倍，且百分比属性不受放大', () => {
    const legacyGains = Array<number>(ENHANCE_MAX).fill(ENHANCE_PER_LEVEL * 1000);
    expect(enhanceMultiplier(ENHANCE_MAX, legacyGains)).toBeCloseTo(
      1 + ENHANCE_PER_LEVEL * ENHANCE_MAX,
      8,
    );

    const definition = def();
    const plain = instanceStats(definition, inst());
    const enhanced = instanceStats(
      definition,
      inst({ enhance: ENHANCE_MAX, enhanceGainPermille: legacyGains }),
    );
    expect(enhanced.atk).toBeCloseTo(plain.atk * enhanceMultiplier(ENHANCE_MAX, legacyGains), 8);
    expect(enhanced.critRate).toBe(plain.critRate);
  });

  it('胚子只放大绝对基础属性，不放大百分比属性与词条', () => {
    const definition = def({
      slot: 'weapon',
      fixedAffixes: [{ key: 'atk', value: 100 }],
    });
    const standard = instanceStats(
      definition,
      inst({ affixes: [{ key: 'atk', value: 50, tier: 3 }] }),
    );
    const miracle = instanceStats(
      definition,
      inst({
        baseRollPermille: 1200,
        affixes: [{ key: 'atk', value: 50, tier: 3 }],
      }),
    );
    const base = baseEquipStats(definition);

    expect(miracle.atk - standard.atk).toBeCloseTo(base.atk * 0.2, 8);
    expect(miracle.critRate).toBe(standard.critRate);
  });

  it('强化总增幅受 ×2.35 硬上限约束', () => {
    const allMiracle = Array<number>(ENHANCE_MAX).fill(125);
    expect(enhanceMultiplier(ENHANCE_MAX, allMiracle)).toBe(
      1 + ENHANCE_TOTAL_GAIN_CAP_PERMILLE / 1000,
    );
  });

  it('强化等级、胚子和逐级记录非法时直接报错', () => {
    const empty = Array<number>(ENHANCE_MAX).fill(0);
    expect(() => enhanceMultiplier(-1, empty)).toThrow();
    expect(() => enhanceMultiplier(ENHANCE_MAX + 1, empty)).toThrow();
    expect(() => enhanceMultiplier(1, empty)).toThrow('第 1 格增幅不能为 0');
    expect(() => enhanceMultiplier(0, [0])).toThrow('固定为');
    expect(() => instanceStats(def(), inst({ baseRollPermille: 999 }))).toThrow('胚子倍率');
  });

  it('固定词条与随机词条都会叠加', () => {
    const stats = instanceStats(
      def({ fixedAffixes: [{ key: 'atk', value: 10 }] }),
      inst({ affixes: [{ key: 'atk', value: 20, tier: 3 }] }),
    );
    expect(stats.atk).toBeCloseTo(baseEquipStats(def()).atk + 30, 8);
  });

  it('全身属性累加，缺失的配置定义必须暴露错误', () => {
    const definition = def();
    const one = instanceStats(definition, inst());
    const total = totalEquipStats([inst(), inst({ uid: 'e2' })], () => definition, 'swordsman');
    expect(total.atk).toBeCloseTo(one.atk * 2, 8);

    expect(() => totalEquipStats([inst()], () => undefined, 'swordsman')).toThrow('装备定义不存在');
  });

  it('三类独立战斗词条按固定与随机来源统一累计', () => {
    const definition = def({
      fixedAffixes: [
        { key: 'dmgReduce', value: 2 },
        { key: 'elemDmg', value: 6, element: 'fire' },
      ],
    });
    const instance = inst({
      affixes: [
        { key: 'lifesteal', value: 3, tier: 4 },
        { key: 'elemDmg', value: 5, element: 'ice', tier: 3 },
      ],
    });

    expect(instanceCombatBonuses(definition, instance)).toEqual({
      damageReduction: 2,
      lifesteal: 3,
      elementDamage: { fire: 6, ice: 5, thunder: 0 },
      skillDamage: 0,
      armorPenetration: 0,
    });
    expect(
      totalEquipCombatBonuses(
        [instance, inst({ uid: 'e2', affixes: [{ key: 'dmgReduce', value: 4, tier: 5 }] })],
        () => definition,
        'swordsman',
      ),
    ).toEqual({
      damageReduction: 8,
      lifesteal: 3,
      elementDamage: { fire: 12, ice: 5, thunder: 0 },
      skillDamage: 0,
      armorPenetration: 0,
    });
  });

  it('元素伤害没有绑定三系属性时直接暴露数据错误', () => {
    expect(() =>
      instanceCombatBonuses(def(), inst({ affixes: [{ key: 'elemDmg', value: 5, tier: 3 }] })),
    ).toThrow('必须绑定');
  });

  it('战斗修正累加函数保持纯函数语义', () => {
    const empty = zeroCombatBonuses();
    const added = addCombatBonuses(empty, {
      damageReduction: 2,
      elementDamage: { thunder: 7 },
    });
    expect(added).toEqual({
      damageReduction: 2,
      lifesteal: 0,
      elementDamage: { fire: 0, ice: 0, thunder: 7 },
      skillDamage: 0,
      armorPenetration: 0,
    });
    expect(empty).toEqual(zeroCombatBonuses());
  });

  it('十九条职业专属词条全部进入对应的基础属性或战斗修正管线', () => {
    let stats = zeroStats();
    for (const [key, value] of [
      ['swd_guard', 5.9],
      ['swd_heavy', 9.1],
      ['swd_dash', 0.025],
      ['wit_power', 7.8],
      ['wit_veil', 6.1],
      ['wit_aura', 82],
      ['sha_vitality', 78],
      ['sha_spirit', 7.3],
      ['cat_swift', 0.039],
      ['cat_nimble', 9.1],
      ['cat_pelt', 76],
      ['kenshi_blade', 8.1],
      ['kenshi_honor', 81],
    ] as const) {
      stats = applyAffix(stats, { key, value });
    }
    expect(stats).toEqual({
      atk: 15.1,
      def: 5.9,
      hp: 317,
      acc: 0,
      eva: 15.2,
      critRate: 0,
      critDmg: 17.2,
      spd: 0.064,
    });

    let bonuses = zeroCombatBonuses();
    bonuses = applyCombatAffix(bonuses, {
      key: 'wit_elem',
      value: 8.5,
      element: 'thunder',
    });
    bonuses = applyCombatAffix(bonuses, { key: 'sha_drain', value: 1.6 });
    bonuses = applyCombatAffix(bonuses, { key: 'sha_ward', value: 2 });
    bonuses = applyCombatAffix(bonuses, { key: 'kenshi_iai', value: 4.3 });
    bonuses = applyCombatAffix(bonuses, { key: 'kenshi_bushido', value: 2.4 });
    expect(bonuses).toEqual({
      damageReduction: 4.4,
      lifesteal: 1.6,
      elementDamage: { fire: 0, ice: 0, thunder: 8.5 },
      skillDamage: 0,
      armorPenetration: 4.3,
    });
  });

  it('职业专属词条只对所属职业结算，切换职业后保留但不偷算属性', () => {
    const definition = def();
    const mixed = inst({
      affixes: [
        { key: 'wit_power', value: 12, tier: 3 },
        { key: 'sha_ward', value: 4, tier: 3 },
        { key: 'atk', value: 5, tier: 3 },
      ],
    });

    const witchStats = totalEquipStats([mixed], () => definition, 'witch');
    const swordsmanStats = totalEquipStats([mixed], () => definition, 'swordsman');
    expect(witchStats.atk - swordsmanStats.atk).toBeCloseTo(12, 8);
    expect(swordsmanStats.atk).toBeCloseTo(baseEquipStats(definition).atk + 5, 8);

    expect(totalEquipCombatBonuses([mixed], () => definition, 'shaman').damageReduction).toBe(4);
    expect(totalEquipCombatBonuses([mixed], () => definition, 'witch').damageReduction).toBe(0);
    expect(mixed.affixes).toHaveLength(3);
  });
});

describe('随机词条', () => {
  it.each(QUALITY_ORDER.map((quality) => [quality, QUALITY_AFFIX_COUNT[quality]] as const))(
    '%s 品质生成 %i 条且不重复 key',
    (quality, expectedCount) => {
      const affixes = rollAffixes(def({ quality }), new Rng(2026), 'swordsman');
      expect(affixes).toHaveLength(expectedCount);
      expect(new Set(affixes.map((affix) => affix.key)).size).toBe(affixes.length);
      expect(affixes.every((affix) => affix.tier >= 1 && affix.tier <= 5)).toBe(true);
    },
  );

  it('八档品质槽数严格为 1/1/2/3/4/5/6/6', () => {
    expect(QUALITY_ORDER.map((quality: Quality) => QUALITY_AFFIX_COUNT[quality])).toEqual([
      1, 1, 2, 3, 4, 5, 6, 6,
    ]);
  });

  it('职业槽数严格为 0/0/0/1/1/1/1/1', () => {
    // 神话以上曾经是 2 槽，实测会把八件装备的职业增益叠得过密，
    // 四职业极值偏离一度达到 39%。因此所有史诗以上品质统一保留一个职业槽。
    expect(QUALITY_ORDER.map((quality) => QUALITY_PROFESSION_AFFIX_COUNT[quality])).toEqual([
      0, 0, 0, 1, 1, 1, 1, 1,
    ]);
  });

  it('十九条职业池配置、权重、基准值与中文名严格对应策划表', () => {
    expect(
      Object.fromEntries(
        CLASS_IDS.map((classId) => [
          classId,
          PROFESSION_AFFIX_POOLS[classId].map(
            ({ key, min, max, weight, scalesWithLevel, decimals }) => ({
              key,
              min,
              max,
              weight,
              scalesWithLevel,
              decimals,
              label: AFFIX_LABELS[key],
            }),
          ),
        ]),
      ),
    ).toEqual({
      swordsman: [
        {
          key: 'swd_guard',
          min: 0.59,
          max: 0.59,
          weight: 30,
          scalesWithLevel: true,
          decimals: 1,
          label: '守势',
        },
        {
          key: 'swd_heavy',
          min: 27.5,
          max: 27.5,
          weight: 25,
          scalesWithLevel: false,
          decimals: 1,
          label: '重压',
        },
        {
          key: 'swd_dash',
          min: 0.0175,
          max: 0.0175,
          weight: 40,
          scalesWithLevel: false,
          decimals: 3,
          label: '疾行',
        },
      ],
      witch: [
        {
          key: 'wit_power',
          min: 0.53,
          max: 0.53,
          weight: 30,
          scalesWithLevel: true,
          decimals: 1,
          label: '灵能',
        },
        {
          key: 'wit_elem',
          min: 4,
          max: 4,
          weight: 25,
          scalesWithLevel: false,
          decimals: 1,
          label: '元素亲和',
        },
        {
          key: 'wit_veil',
          min: 0.91,
          max: 0.91,
          weight: 55,
          scalesWithLevel: true,
          decimals: 1,
          label: '星纱',
        },
        {
          key: 'wit_aura',
          min: 7.8,
          max: 7.8,
          weight: 40,
          scalesWithLevel: true,
          decimals: 1,
          label: '灵炁',
        },
      ],
      shaman: [
        {
          key: 'sha_vitality',
          min: 7.8,
          max: 7.8,
          weight: 30,
          scalesWithLevel: true,
          decimals: 1,
          label: '回响',
        },
        {
          key: 'sha_drain',
          min: 1.6,
          max: 1.6,
          weight: 25,
          scalesWithLevel: false,
          decimals: 1,
          label: '灵契',
        },
        {
          key: 'sha_ward',
          min: 2,
          max: 2,
          weight: 25,
          scalesWithLevel: false,
          decimals: 1,
          label: '庇佑',
        },
        {
          key: 'sha_spirit',
          min: 0.58,
          max: 0.58,
          weight: 80,
          scalesWithLevel: true,
          decimals: 1,
          label: '灵击',
        },
        {
          key: 'sha_hex',
          min: 0.042,
          max: 0.042,
          weight: 40,
          scalesWithLevel: false,
          decimals: 3,
          label: '灵速',
        },
      ],
      catkin: [
        {
          key: 'cat_swift',
          min: 0.032,
          max: 0.032,
          weight: 30,
          scalesWithLevel: false,
          decimals: 3,
          label: '疾风',
        },
        {
          key: 'cat_nimble',
          min: 0.91,
          max: 0.91,
          weight: 25,
          scalesWithLevel: true,
          decimals: 1,
          label: '灵巧',
        },
        {
          key: 'cat_pelt',
          min: 7.8,
          max: 7.8,
          weight: 40,
          scalesWithLevel: true,
          decimals: 1,
          label: '厚绒',
        },
      ],
      kenshi: [
        {
          key: 'kenshi_iai',
          min: 4.3,
          max: 4.3,
          weight: 30,
          scalesWithLevel: false,
          decimals: 1,
          label: '破甲',
        },
        {
          key: 'kenshi_blade',
          min: 21,
          max: 21,
          weight: 25,
          scalesWithLevel: false,
          decimals: 1,
          label: '刀势',
        },
        {
          key: 'kenshi_honor',
          min: 7.8,
          max: 7.8,
          weight: 30,
          scalesWithLevel: true,
          decimals: 1,
          label: '樱志',
        },
        {
          key: 'kenshi_bushido',
          min: 2,
          max: 2,
          weight: 25,
          scalesWithLevel: false,
          decimals: 1,
          label: '武道',
        },
      ],
    });
  });

  it('四职业池都同时具备输出与生存定位，定位抽取稳定为各半', () => {
    for (const [classIndex, classId] of CLASS_IDS.entries()) {
      const pool = PROFESSION_AFFIX_POOLS[classId];
      expect(new Set(pool.map((entry) => entry.balanceRole))).toEqual(
        new Set(['offense', 'sustain']),
      );

      const rng = new Rng(0x50_50_0000 + classIndex);
      const samples = 20_000;
      let offense = 0;
      for (let sample = 0; sample < samples; sample++) {
        if (pickProfessionAffixSpec(pool, rng).balanceRole === 'offense') offense++;
      }
      expect(offense / samples).toBeGreaterThan(0.485);
      expect(offense / samples).toBeLessThan(0.515);
    }
  });

  it('魔女星纱与灵巫灵击分别进入闪避、攻击真实结算', () => {
    const base = zeroStats();
    expect(applyAffix(base, { key: 'wit_veil', value: 42 })).toMatchObject({ eva: 42 });
    expect(applyAffix(base, { key: 'sha_spirit', value: 39 })).toMatchObject({ atk: 39 });
  });

  it('各职业史诗以上装备按“通用在前、专属在末”生成规定数量的职业槽', () => {
    for (const classId of CLASS_IDS) {
      const professionKeys = new Set(PROFESSION_AFFIX_POOLS[classId].map((entry) => entry.key));
      for (const quality of QUALITY_ORDER) {
        const affixes = rollAffixes(def({ quality }), new Rng(2026), classId);
        const professionCount = QUALITY_PROFESSION_AFFIX_COUNT[quality];
        const splitAt = affixes.length - professionCount;

        expect(
          affixes.slice(0, splitAt).every((affix) => !professionKeys.has(affix.key)),
          `${classId}/${quality} 通用槽`,
        ).toBe(true);
        expect(
          affixes.slice(splitAt).every((affix) => professionKeys.has(affix.key)),
          `${classId}/${quality} 专属槽`,
        ).toBe(true);
        expect(new Set(affixes.map((affix) => affix.key)).size).toBe(affixes.length);
      }
    }
  });

  it('固定词条占用品质词条名额且不会重复 key', () => {
    const definition = def({
      quality: 'epic',
      fixedAffixes: [
        { key: 'atk', value: 10 },
        { key: 'critRate', value: 2 },
      ],
    });
    const random = rollAffixes(definition, new Rng(2027), 'swordsman');
    expect(random).toHaveLength(1);
    expect(random.some((affix) => affix.key === 'atk' || affix.key === 'critRate')).toBe(false);
    expect(PROFESSION_AFFIX_POOLS.swordsman.some((entry) => entry.key === random[0]!.key)).toBe(
      true,
    );
  });

  it('部分固定词条扣除容量后仍保留随机职业槽，且与固定词条不重复 key', () => {
    const partial = rollAffixes(
      def({
        quality: 'mythic',
        fixedAffixes: [
          { key: 'atk', value: 10 },
          { key: 'def', value: 8 },
          { key: 'hp', value: 80 },
        ],
      }),
      new Rng(2028),
      'swordsman',
    );
    const swordKeys = new Set(PROFESSION_AFFIX_POOLS.swordsman.map((entry) => entry.key));
    expect(partial).toHaveLength(2);
    // 神话职业槽已从 2 降为 1，所以两条随机词条里恰好一条来自职业池、一条来自通用池
    expect(partial.filter((affix) => swordKeys.has(affix.key))).toHaveLength(1);

    const alreadyHasProfession = rollAffixes(
      def({
        quality: 'epic',
        fixedAffixes: [{ key: 'swd_guard', value: 5.9 }],
      }),
      new Rng(2029),
      'swordsman',
    );
    expect(alreadyHasProfession).toHaveLength(2);
    expect(swordKeys.has(alreadyHasProfession[0]!.key)).toBe(false);
    // 池扩到三条（新增 swd_dash）后，Rng(2029) 的确定性抽取结果随之变化
    expect(alreadyHasProfession[1]!.key).toBe('swd_dash');
  });

  it('确定模板只认 fixedTemplate 显式标记，不再从词条数量猜测', () => {
    const fullEpic = [
      { key: 'atk', value: 10 },
      { key: 'def', value: 8 },
      { key: 'hp', value: 80 },
    ] as const;
    expect(
      hasFullyFixedAffixes(
        def({
          quality: 'epic',
          fixedAffixes: [...fullEpic],
        }),
      ),
    ).toBe(false);
    expect(
      hasFullyFixedAffixes(
        def({
          quality: 'epic',
          fixedAffixes: [...fullEpic],
          fixedTemplate: true,
        }),
      ),
    ).toBe(true);
    expect(
      rollAffixes(
        def({
          quality: 'epic',
          fixedAffixes: [...fullEpic],
          fixedTemplate: true,
        }),
        new Rng(1),
        'witch',
      ),
    ).toEqual([]);
    expect(() =>
      hasFullyFixedAffixes(
        def({
          quality: 'epic',
          fixedAffixes: [{ key: 'atk', value: 10 }],
          fixedTemplate: true,
        }),
      ),
    ).toThrow(/必须写满/);
    expect(
      rollAffixes(def({ quality: 'epic', fixedAffixes: [...fullEpic] }), new Rng(1), 'swordsman'),
    ).toEqual([]);
    expect(() =>
      hasFullyFixedAffixes(
        def({
          quality: 'rare',
          fixedAffixes: [...fullEpic],
        }),
      ),
    ).toThrow(/超过/);
  });

  it('同种子生成完全相同的装备实例', () => {
    const definition = def({ quality: 'legendary' });
    const make = () => createInstance(definition, new Rng(88), 'e88', 'swordsman');
    expect(make()).toEqual(make());
  });

  it('生成随机词条和装备实例必须显式提供合法职业，不得使用默认职业兜底', () => {
    expect(() => rollAffixes(def(), new Rng(1), undefined as never)).toThrow('有效职业');
    expect(() => createInstance(def(), new Rng(1), 'missing-class', undefined as never)).toThrow(
      '有效职业',
    );
  });

  it('品阶权重接近 40/27/18/11/4，保底只会生成 T4/T5', () => {
    const rng = new Rng(20260728);
    const counts = new Map(AFFIX_TIERS.map(({ tier }) => [tier, 0]));
    const sampleCount = 50_000;
    for (let i = 0; i < sampleCount; i++) {
      const tier = rollAffixTier(rng);
      counts.set(tier, counts.get(tier)! + 1);
    }

    for (const config of AFFIX_TIERS) {
      const actual = counts.get(config.tier)! / sampleCount;
      expect(Math.abs(actual - config.weight / 100), `T${config.tier}`).toBeLessThan(0.01);
    }

    const guaranteed = Array.from({ length: 2_000 }, () => rollAffixTier(rng, true));
    expect(guaranteed.every((tier) => tier === 4 || tier === 5)).toBe(true);
    expect(guaranteed).toContain(4);
    expect(guaranteed).toContain(5);
  });

  it('延后到 M3-4 的技能倍率可被旧档识别，但不会出现在任何新掉落中', () => {
    expect(AFFIX_RUNTIME_RULES.skillMul).toMatchObject({
      generation: 'deferred',
      settlement: 'deferred',
      milestone: 'M3-4',
    });
    expect(() => rollAffixForKey('skillMul', 20, new Rng(42))).toThrow('词条未开放');

    const generated = Array.from({ length: 1_000 }, (_, seed) =>
      rollAffixes(
        def({ quality: 'divine', level: 60 }),
        new Rng(seed + 1),
        CLASS_IDS[seed % CLASS_IDS.length]!,
      ),
    ).flat();
    expect(generated.some((affix) => affix.key === 'skillMul')).toBe(false);
  });

  it('每档数值严格落在基准值 × 品阶系数的 ±3% 微浮动内', () => {
    const spec = AFFIX_POOL.find((entry) => entry.key === 'hp')!;
    const level = 50;
    const baseline = ((spec.min + spec.max) / 2) * Math.pow(level, 1.3);
    const rng = new Rng(20260729);
    for (const config of AFFIX_TIERS) {
      for (let i = 0; i < 200; i++) {
        const value = rollAffixValue(spec, level, config.tier, rng);
        expect(isRolledAffixValue(spec.key, level, config.tier, value)).toBe(true);
        const ratio = value / (baseline * config.multiplier);
        // hp 为大整数，额外 0.1% 只用于容纳最终整数四舍五入。
        expect(ratio).toBeGreaterThanOrEqual(0.969);
        expect(ratio).toBeLessThanOrEqual(1.031);
      }
    }

    const range = affixValueRange('hp', level, 3);
    expect(isRolledAffixValue('hp', level, 3, range.min)).toBe(true);
    expect(isRolledAffixValue('hp', level, 3, range.max)).toBe(true);
    expect(isRolledAffixValue('hp', level, 3, range.min - 0.1)).toBe(false);
    expect(isRolledAffixValue('hp', level, 3, range.min + 0.01)).toBe(false);
  });

  it('联机硬校验精确兼容 v9 正式生成并迁移的历史值，仍拒绝超模伪造值', () => {
    // eq_r1_weapon_rare 为 Lv6。v9 的 atk 上界是
    // round(0.8 × 6^1.3, 1) = 8.2，反推为旧 T5 后按 1.64/1.54
    // 正式迁移得到 8.7；它不在当前 T5 的 ±3% 新掉落区间内。
    expect(isRolledAffixValue('atk', 6, 5, 8.7)).toBe(false);
    expect(isVerifiablePersistedAffixValue('atk', 6, 5, 8.7)).toBe(true);

    // v9 低端值同样按冻结区间证明，不靠笼统放宽。
    expect(isRolledAffixValue('atk', 6, 1, 4.1)).toBe(false);
    expect(isVerifiablePersistedAffixValue('atk', 6, 1, 4.1)).toBe(true);

    expect(isVerifiablePersistedAffixValue('atk', 6, 5, 8_700)).toBe(false);
    expect(isVerifiablePersistedAffixValue('atk', 6, 5, 8.75)).toBe(false);
    // v9 没有职业词条；职业词条不能借历史兼容绕开当前公式。
    expect(isVerifiablePersistedAffixValue('swd_heavy', 6, 5, 8.7)).toBe(false);
  });

  it('元素词条按真实来源等级解锁，直接生成只会绑定当级可用元素', () => {
    expect(availableAffixElementsAtLevel(15)).toEqual([]);
    expect(availableAffixElementsAtLevel(16)).toEqual(['fire', 'ice']);
    expect(availableAffixElementsAtLevel(19)).toEqual(['fire', 'ice']);
    expect(availableAffixElementsAtLevel(20)).toEqual(AFFIX_ELEMENT_OPTIONS);

    for (const key of ['elemDmg', 'wit_elem'] as const) {
      const lockedRng = new Rng(2026);
      const stateBefore = lockedRng.getState();
      expect(() => rollAffixForKey(key, 15, lockedRng)).toThrow(
        `[配置错误] Lv15 尚无真实武器元素来源，不能生成 ${key}`,
      );
      expect(lockedRng.getState()).toBe(stateBefore);

      const level16Rng = new Rng(20260730);
      const level16Elements = new Set(
        Array.from({ length: 400 }, () => rollAffixForKey(key, 16, level16Rng).element),
      );
      expect(level16Elements).toEqual(new Set(['fire', 'ice']));

      const level20Rng = new Rng(20260730);
      const level20Elements = new Set(
        Array.from({ length: 600 }, () => rollAffixForKey(key, 20, level20Rng).element),
      );
      expect(level20Elements).toEqual(new Set(AFFIX_ELEMENT_OPTIONS));
    }
  });

  it('Lv16 前的新掉落排除元素词条，解锁后也只使用当级可用列表', () => {
    const make = () => {
      return Array.from({ length: 1_000 }, (_, seed) =>
        rollAffixes(
          def({ quality: 'divine', level: 15 }),
          new Rng(seed + 1),
          CLASS_IDS[seed % CLASS_IDS.length]!,
        ),
      ).flat();
    };
    expect(make()).toEqual(make());
    expect(make().some((affix) => affix.key === 'elemDmg' || affix.key === 'wit_elem')).toBe(false);

    const level16ElementAffixes = Array.from({ length: 1_000 }, (_, seed) =>
      rollAffixes(def({ quality: 'divine', level: 16 }), new Rng(seed + 1), 'witch'),
    )
      .flat()
      .filter((affix) => affix.key === 'elemDmg' || affix.key === 'wit_elem');
    expect(level16ElementAffixes.length).toBeGreaterThan(0);
    expect(new Set(level16ElementAffixes.map((affix) => affix.element))).toEqual(
      new Set(['fire', 'ice']),
    );
  });

  it('所有随等级成长的词条保留一位小数，Lv1 真实小数不会被抹成 0', () => {
    const levelScaledSpecs = [
      ...AFFIX_POOL,
      ...Object.values(PROFESSION_AFFIX_POOLS).flat(),
    ].filter((entry) => entry.scalesWithLevel);
    expect(levelScaledSpecs.map((entry) => entry.key)).toEqual([
      'atk',
      'def',
      'hp',
      'acc',
      'eva',
      'swd_guard',
      'wit_power',
      'wit_veil',
      'wit_aura',
      'sha_vitality',
      'sha_spirit',
      'cat_nimble',
      'cat_pelt',
      'kenshi_honor',
    ]);

    for (const spec of levelScaledSpecs.filter(
      (entry) => AFFIX_RUNTIME_RULES[entry.key].generation === 'active',
    )) {
      expect(spec.decimals, spec.key).toBe(1);
      const values = Array.from({ length: 100 }, (_, seed) =>
        rollAffixForKey(spec.key, 1, new Rng(seed + 1)),
      );
      expect(
        values.every((affix) => affix.value > 0),
        spec.key,
      ).toBe(true);
      expect(
        values.every((affix) => Number.isInteger(affix.value * 10)),
        spec.key,
      ).toBe(true);
    }

    const defSpec = AFFIX_POOL.find((entry) => entry.key === 'def')!;
    const lowDef = rollAffixValue(defSpec, 1, 1, new Rng(7));
    expect(lowDef).toBeGreaterThan(0);
    expect(lowDef).toBeLessThan(1);
  });

  it('rollAffixForKey 可解析全部十九条职业词条', () => {
    const professionKeys = Object.values(PROFESSION_AFFIX_POOLS)
      .flat()
      .map((entry) => entry.key);
    expect(professionKeys).toHaveLength(19);
    for (const key of professionKeys.filter(
      (candidate) => AFFIX_RUNTIME_RULES[candidate].generation === 'active',
    )) {
      const affix = rollAffixForKey(key, 20, new Rng(42));
      expect(affix.key).toBe(key);
      expect(affix.value).toBeGreaterThan(0);
    }
    const iai = rollAffixForKey('kenshi_iai', 20, new Rng(42));
    expect(iai.value).toBeGreaterThanOrEqual(2.5);
    expect(iai.value).toBeLessThanOrEqual(7.3);
  });

  it('掉落胚子始终位于 100%~120%，并能掷出精工与奇迹档', () => {
    const rolls = Array.from({ length: 1000 }, (_, seed) => rollBasePermille(new Rng(seed + 1)));

    expect(
      rolls.every(
        ({ permille }) =>
          permille >= EQUIPMENT_BASE_ROLL_MIN && permille <= EQUIPMENT_BASE_ROLL_MAX,
      ),
    ).toBe(true);
    expect(rolls.some(({ grade }) => grade === 'refined')).toBe(true);
    expect(rolls.some(({ grade }) => grade === 'miracle')).toBe(true);
    expect(baseRollGrade(1000)).toBe('steady');
    expect(baseRollGrade(1061)).toBe('refined');
    expect(baseRollGrade(1200)).toBe('miracle');
  });

  it('强化增幅最低不低于旧版，低概率出现奇迹档', () => {
    const rolls = Array.from({ length: 1000 }, (_, seed) =>
      rollEnhanceGainPermille(new Rng(seed + 1)),
    );

    expect(rolls.every(({ permille }) => permille >= 80 && permille <= 125)).toBe(true);
    expect(rolls.some(({ grade }) => grade === 'excellent')).toBe(true);
    expect(rolls.some(({ grade }) => grade === 'miracle')).toBe(true);
    expect(enhanceGainGrade(80)).toBe('stable');
    expect(enhanceGainGrade(83)).toBe('excellent');
    expect(enhanceGainGrade(110)).toBe('miracle');
    expect(() => enhanceGainGrade(100)).toThrow('未配置');
  });

  it('自动锁定按品质而非只按胚子，确定珍品则保持固定 100% 胚子', () => {
    let miracleSeed = 0;
    let plainSeed = 0;
    for (let seed = 1; seed < 10_000; seed++) {
      const grade = rollBasePermille(new Rng(seed)).grade;
      if (!miracleSeed && grade === 'miracle') miracleSeed = seed;
      if (!plainSeed && grade !== 'miracle') plainSeed = seed;
      if (miracleSeed && plainSeed) break;
    }
    expect(miracleSeed).toBeGreaterThan(0);
    expect(plainSeed).toBeGreaterThan(0);

    const lockedOf = (quality: Quality, seed: number) =>
      createInstance(def({ quality }), new Rng(seed), 'u', 'swordsman').locked;

    // 传说及以上一律上锁 —— 这是玩家最怕误删的东西，胚子普通也要保护
    expect(lockedOf('legendary', plainSeed)).toBe(true);
    expect(lockedOf('mythic', plainSeed)).toBe(true);
    // 奇迹胚子把门槛下调一档到史诗
    expect(lockedOf('epic', miracleSeed)).toBe(true);
    expect(lockedOf('epic', plainSeed)).toBe(false);
    // 蓝装及以下一律不上锁：原规则会把奇迹白装永久锁死，再也清不掉
    expect(lockedOf('common', miracleSeed)).toBe(false);
    expect(lockedOf('rare', miracleSeed)).toBe(false);

    const fixedDefinition = def({
      quality: 'common',
      fixedTemplate: true,
      fixedAffixes: [{ key: 'atk', value: 10 }],
    });
    expect(createFixedInstance(fixedDefinition, 'shop', true)).toMatchObject({
      baseRollPermille: 1000,
      enhance: 0,
      enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(0),
      enhanceLuck: {},
      affixes: [],
      locked: true,
    });
    expect(() => createFixedInstance(def(), 'invalid', true)).toThrow('fixedTemplate');
  });

  it('攻速词条按配置保留两位小数', () => {
    const rng = new Rng(20260731);
    const speedValues = Array.from({ length: 200 }, () => rollAffixForKey('spd', 1, rng).value);
    expect(speedValues.every((value) => value >= 0.01)).toBe(true);
    expect(speedValues.every((value) => Number.isInteger(value * 100))).toBe(true);
  });
});

describe('锻造外观阶段', () => {
  it.each([
    [0, 'original'],
    [4, 'original'],
    [5, 'gleam'],
    [8, 'gleam'],
    [9, 'radiant'],
    [11, 'radiant'],
    [12, 'starforged'],
    [14, 'starforged'],
    [15, 'sakura'],
  ] as const)('+%i 对应 %s', (level, stage) => {
    expect(forgeStageAt(level)).toBe(stage);
  });

  it('拒绝越界等级', () => {
    expect(() => forgeStageAt(-1)).toThrow();
    expect(() => forgeStageAt(16)).toThrow();
  });
});
