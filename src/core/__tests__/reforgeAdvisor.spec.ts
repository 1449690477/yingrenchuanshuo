import { describe, expect, it } from 'vitest';
import type { Affix, EquipmentDef, EquipmentInstance, EquipSlot, Quality } from '@/core/types';
import { ENHANCE_MAX } from '@/data/constants';
import {
  adviseReforge,
  assessAffix,
  topRecommendation,
  worthScoreOf,
} from '../reforgeAdvisor';

function def(
  id: string,
  slot: EquipSlot,
  quality: Quality,
  level: number,
  extra?: Partial<EquipmentDef>,
): EquipmentDef {
  return {
    id,
    name: id,
    slot,
    quality,
    level,
    icon: 'assets/equipment/r1/weapon.png',
    appearanceId: 'r1-weapon',
    ...extra,
  };
}

function instance(defId: string, affixes: Affix[], enhance = 0): EquipmentInstance {
  return {
    uid: `u-${defId}-${affixes.length}`,
    defId,
    enhance,
    baseRollPermille: 1000,
    enhanceGainPermille: Array.from({ length: ENHANCE_MAX }, () => 0),
    enhanceLuck: {},
    affixes,
    reforgeResonance: 0,
    locked: false,
  };
}

const atk = (tier: Affix['tier']): Affix => ({ key: 'atk', tier, value: 1 });
const dead = (): Affix => ({ key: 'skillMul', tier: 2, value: 2 });
const swd = (tier: Affix['tier']): Affix => ({ key: 'swd_guard', tier, value: 0.6 });
const wit = (tier: Affix['tier']): Affix => ({ key: 'wit_power', tier, value: 0.8 });

describe('词条单条评估', () => {
  it('待开放词条折算为死词条，他职专属低分，本职专属标注', () => {
    expect(assessAffix(dead(), 0, 'witch').status).toBe('dead');
    expect(assessAffix(dead(), 0, 'witch').score).toBeLessThan(10);
    expect(assessAffix(swd(3), 0, 'witch').status).toBe('foreign');
    const own = assessAffix(wit(5), 0, 'witch');
    expect(own.status).toBe('profession');
    expect(own.score).toBe(100);
  });
});

describe('装备底子价值', () => {
  it('穿戴中的高品质装备高于背包普通装', () => {
    const equipped = worthScoreOf(
      instance('a', [atk(3)], 10),
      def('a', 'weapon', 'mythic', 40),
      'equipped',
    );
    const bag = worthScoreOf(instance('b', [atk(3)]), def('b', 'body', 'common', 10), 'bag');
    expect(equipped).toBeGreaterThan(bag);
  });
});

describe('洗练建议规则', () => {
  it('有待开放死词条时优先推荐重铸', () => {
    const [first] = adviseReforge({
      classId: 'witch',
      entries: [
        {
          instance: instance('w1', [dead(), atk(3)]),
          definition: def('w1', 'weapon', 'rare', 20),
          source: 'equipped',
        },
      ],
    });
    expect(first?.recommendation?.operation).toBe('reforge');
    expect(first?.recommendation?.headline).toContain('死词条');
  });

  it('职业槽内的死词条且缺本职专属时推荐铭刻', () => {
    // 史诗 1 个职业槽 = 最后一条；把死词条放在最后
    const [first] = adviseReforge({
      classId: 'witch',
      entries: [
        {
          instance: instance('w2', [atk(3), atk(2), dead()]),
          definition: def('w2', 'weapon', 'epic', 30),
          source: 'equipped',
        },
      ],
    });
    expect(first?.recommendation?.operation).toBe('inscribe');
  });

  it('他职业专属词条推荐重铸洗掉', () => {
    const [first] = adviseReforge({
      classId: 'witch',
      entries: [
        {
          instance: instance('w3', [swd(4), atk(3)]),
          definition: def('w3', 'weapon', 'epic', 30),
          source: 'equipped',
        },
      ],
    });
    expect(first?.recommendation?.operation).toBe('reforge');
    expect(first?.recommendation?.headline).toContain('他职业');
  });

  it('T4 有用词条在好装备上推荐同调直升 T5，并给出目标下标', () => {
    const [first] = adviseReforge({
      classId: 'witch',
      entries: [
        {
          instance: instance('w4', [atk(4), wit(3), atk(3)]),
          definition: def('w4', 'weapon', 'epic', 30),
          source: 'equipped',
        },
      ],
    });
    expect(first?.recommendation?.operation).toBe('resonate');
    expect(first?.recommendation?.targetIndex).toBe(0);
    expect(first?.recommendation?.headline).toContain('T5');
  });

  it('史诗装备缺本职专属且有低阶可牺牲词条时推荐铭刻必出', () => {
    // 全低阶词条：同调无目标，铭刻随机替换的代价低，必出本职专属最划算
    const [first] = adviseReforge({
      classId: 'witch',
      entries: [
        {
          instance: instance('w5', [atk(1), atk(2), atk(1)]),
          definition: def('w5', 'weapon', 'epic', 30),
          source: 'equipped',
        },
      ],
    });
    expect(first?.recommendation?.operation).toBe('inscribe');
  });

  it('史诗装备缺本职专属但全是高阶好词条时不推荐铭刻（避免赌坏成品）', () => {
    // T5+T4+T4：铭刻随机一条可能毁掉 T5，应推荐同调而非铭刻
    const [first] = adviseReforge({
      classId: 'witch',
      entries: [
        {
          instance: instance('w5b', [atk(5), atk(4), atk(4)]),
          definition: def('w5b', 'weapon', 'epic', 30),
          source: 'equipped',
        },
      ],
    });
    expect(first?.recommendation?.operation).toBe('resonate');
  });

  it('全部词条有用但品阶低时推荐淬炼保类型', () => {
    const [first] = adviseReforge({
      classId: 'witch',
      entries: [
        {
          instance: instance('w6', [atk(1), atk(2)]),
          definition: def('w6', 'weapon', 'rare', 15),
          source: 'bag',
        },
      ],
    });
    expect(first?.recommendation?.operation).toBe('temper');
  });

  it('词条组已经很好时不给建议', () => {
    const [first] = adviseReforge({
      classId: 'witch',
      entries: [
        {
          instance: instance('w7', [atk(5), wit(5), atk(5)]),
          definition: def('w7', 'weapon', 'epic', 30),
          source: 'equipped',
        },
      ],
    });
    expect(first?.recommendation).toBeNull();
  });
});

describe('列表排序与过滤', () => {
  it('按建议优先级排序并跳过固定模板', () => {
    const result = adviseReforge({
      classId: 'witch',
      entries: [
        {
          instance: instance('ok', [atk(5), wit(5), atk(5)]),
          definition: def('ok', 'weapon', 'epic', 30),
          source: 'equipped',
        },
        {
          // 同级、且该部位没穿东西 —— 是真正的候选装备，紧急度才有意义
          instance: instance('urgent', [dead(), atk(1)]),
          definition: def('urgent', 'body', 'epic', 30),
          source: 'bag',
        },
        {
          instance: instance('fixed', [atk(3)]),
          definition: def('fixed', 'ring', 'mythic', 40, { fixedTemplate: true }),
          source: 'bag',
        },
      ],
    });
    expect(result.map((entry) => entry.defId)).toEqual(['urgent', 'ok']);
    const top = topRecommendation(result);
    expect(top?.assessment.defId).toBe('urgent');
    expect(top?.recommendation.operation).toBe('reforge');
  });

  it('没有可洗练装备时首推为空', () => {
    expect(topRecommendation([])).toBeNull();
  });

  it('随机操作会标出该定契保护的高阶词条', () => {
    const result = adviseReforge({
      classId: 'witch',
      entries: [
        {
          // 一条 T5 好词条 + 两条低阶：重铸有三分之一概率把 T5 洗掉
          instance: instance('risky', [atk(5), atk(1), atk(1)]),
          definition: def('risky', 'weapon', 'epic', 40),
          source: 'equipped',
        },
      ],
    });
    const advice = result[0]!.recommendation!;
    // 具体推哪个随机操作由规则链决定，这里只关心「是随机操作」这件事
    expect(['reforge', 'temper', 'inscribe']).toContain(advice.operation);
    expect(advice.protectIndices).toEqual([0]);
  });

  it('同调不误伤其他词条，不给定契建议', () => {
    const result = adviseReforge({
      classId: 'witch',
      entries: [
        {
          instance: instance('safe', [atk(4), atk(4)]),
          definition: def('safe', 'weapon', 'epic', 40),
          source: 'equipped',
        },
      ],
    });
    const advice = result[0]!.recommendation!;
    expect(advice.operation).toBe('resonate');
    expect(advice.protectIndices).toBeUndefined();
  });

  it('背包里等级远低于在用装备的，判为已淘汰且不给建议', () => {
    const result = adviseReforge({
      classId: 'witch',
      entries: [
        {
          instance: instance('worn', [atk(2), wit(2)]),
          definition: def('worn', 'weapon', 'epic', 60),
          source: 'equipped',
        },
        {
          // Lv20 只有在用等级的三分之一，词条再烂也不值得投材料
          instance: instance('junk', [dead(), dead()]),
          definition: def('junk', 'body', 'epic', 20),
          source: 'bag',
        },
      ],
    });
    const junk = result.find((entry) => entry.defId === 'junk')!;
    expect(junk.relevance).toBe(0);
    expect(junk.recommendation).toBeNull();
    // 死词条最紧急，但淘汰装备不该因此登上首推
    expect(topRecommendation(result)?.assessment.defId).not.toBe('junk');
  });

  it('同部位已穿着不更差的装备时，背包那件判为已淘汰', () => {
    const result = adviseReforge({
      classId: 'witch',
      entries: [
        {
          instance: instance('worn', [atk(2), wit(2)]),
          definition: def('worn', 'weapon', 'legendary', 40),
          source: 'equipped',
        },
        {
          // 同级但品质更低，永远不会换上去
          instance: instance('spare', [dead(), atk(1)]),
          definition: def('spare', 'weapon', 'epic', 40),
          source: 'bag',
        },
      ],
    });
    expect(result.find((entry) => entry.defId === 'spare')!.relevance).toBe(0);
    expect(result[0]!.defId).toBe('worn');
  });

  it('穿戴中的装备排在背包候选之前', () => {
    const result = adviseReforge({
      classId: 'witch',
      entries: [
        {
          // 身上这件只需同调，紧急度低于死词条
          instance: instance('worn', [atk(4), wit(4)]),
          definition: def('worn', 'weapon', 'epic', 40),
          source: 'equipped',
        },
        {
          // 背包这件有死词条，规则上更「紧急」，但毕竟还没上身
          instance: instance('candidate', [dead(), atk(1)]),
          definition: def('candidate', 'body', 'epic', 40),
          source: 'bag',
        },
      ],
    });
    expect(result[0]!.defId).toBe('worn');
    expect(topRecommendation(result)?.assessment.defId).toBe('worn');
  });
});
