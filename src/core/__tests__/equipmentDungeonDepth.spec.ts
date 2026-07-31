import { describe, expect, it } from 'vitest';
import {
  advanceDepth,
  blankDefinitionId,
  blankQualityInRegion,
  clearedDepthOf,
  depthAnchorLevel,
  depthBlankQuality,
  depthNominalLevel,
  depthRecommendCp,
  dungeonMinAnchorLevel,
  evaluateDungeonDepth,
  isDepthOpen,
  isDepthUnlocked,
  requireDepthAnchor,
  type EquipmentDungeonDepthProgress,
} from '../equipmentDungeonDepth';
import {
  EQUIPMENT_DUNGEON_DEPTH_ANCHORS,
  DEPTH_PER_TIER,
  REGION_BLANK_QUALITY_RANGE,
} from '@/data/equipmentDungeonDepthRules';
import { EQUIPMENT_DUNGEON_TIERS } from '@/data/equipmentDungeonGear';
import { typicalQualityAt, expectedFullGearCp } from '@/data/expectedPower';
import { ALL_CHAPTERS, REGIONS } from '@/data/regions';
import { EQUIPMENT, equipIdsOfRegion } from '@/data/equipment';
import { ITEM_BASE, ITEM_POW, ITEM_SCALE, QUALITY_MUL, QUALITY_ORDER } from '@/data/constants';
import type { Quality, Stats } from '../types';
import { combatPower } from '../formula';
import { monsterAtk } from '../progression';

const ZERO_STATS: Stats = {
  atk: 0, def: 0, hp: 0, acc: 0, eva: 0, critRate: 0, critDmg: 0, spd: 0,
};

/** 当前内容顶，与 arenaEquipment.ts 同源口径 */
const CONTENT_TOP = Math.max(...ALL_CHAPTERS.map((chapter) => chapter.levelTo));

/** 装备基准值，与 core/equipment.ts 的 itemBaseValue 同式 */
function baseValue(level: number, quality: Quality): number {
  return ITEM_BASE * Math.pow(level, ITEM_POW) * QUALITY_MUL[quality] * ITEM_SCALE;
}

/**
 * 断言范围的下界 = 副本入口等级。
 *
 * 低于它的玩家**进不了副本**，`min` 却仍会算出一个比任何主线装备都低的
 * 锚点（Lv1 的主线典型基准值 0.6 < 现存最弱装备 1.53）。
 * 拿不可达状态去断言只会得到一条永远红的门禁 —— 而一条永远红的门禁
 * 比没有门禁更糟，它会训练所有人忽略红灯。
 */
const ENTRY = dungeonMinAnchorLevel();

/** 玩家在该等级**实际能拿到**的主线最强 —— 注意封顶在内容顶 */
function mainlineBest(playerLevel: number): number {
  const level = Math.min(playerLevel, CONTENT_TOP);
  return baseValue(level, typicalQualityAt(level));
}

describe('深度锚点表', () => {
  it('每个档位都必须显式登记，缺配直接抛错而不是回退默认值', () => {
    for (const tier of EQUIPMENT_DUNGEON_TIERS) {
      expect(() => requireDepthAnchor(tier.id)).not.toThrow();
    }
    // @ts-expect-error 故意传入未登记的档位
    expect(() => requireDepthAnchor('unregistered-tier')).toThrow(/未登记深度锚点/);
  });

  it('步长按「填满到下一档」推导，不是手填的口味值', () => {
    const tiers = EQUIPMENT_DUNGEON_TIERS;
    for (let i = 0; i < tiers.length - 1; i++) {
      const current = EQUIPMENT_DUNGEON_DEPTH_ANCHORS[tiers[i]!.id];
      const next = EQUIPMENT_DUNGEON_DEPTH_ANCHORS[tiers[i + 1]!.id];
      expect(current.baseLevel + current.step * DEPTH_PER_TIER).toBe(next.baseLevel);
    }
  });

  it('深度越深标称等级越高', () => {
    for (let d = 2; d <= DEPTH_PER_TIER; d++) {
      expect(depthNominalLevel('violet', d)).toBeGreaterThan(depthNominalLevel('violet', d - 1));
    }
  });

  it('深度越界抛错', () => {
    expect(() => depthNominalLevel('azure', 0)).toThrow(/深度必须是/);
    expect(() => depthNominalLevel('azure', DEPTH_PER_TIER + 1)).toThrow(/深度必须是/);
    expect(() => depthNominalLevel('azure', 1.5)).toThrow(/深度必须是/);
  });
});

/**
 * docs/66 G-1：三元 min 的**每一个约束都必须真的在起作用**。
 *
 * 初稿的 G-1 是「胚子基准值 ≡ 锚点等级的主线典型」，那条是自证的
 * （胚子就是用同一个式子算的），恒真、永远不会红，而且正因为自证，
 * 它抓不到满级段 1.052× 的真实反例。这里改成为每个约束各构造一个反例。
 */
describe('G-1 · 三元 min 的每个约束都有反例证明它在起作用', () => {
  it('标称等级取胜：满级玩家打低档，拿到的是低档的东西', () => {
    // 玩家 Lv78（已达内容顶），azure d1 标称 16 → 三者最小是标称
    expect(depthAnchorLevel('azure', 1, 78, CONTENT_TOP)).toBe(16);
  });

  it('玩家等级取胜：越级挑战不会拿到超模的胚子', () => {
    // Lv20 玩家打 auric d5（标称 76）→ 三者最小是玩家等级
    expect(depthAnchorLevel('auric', 5, 20, CONTENT_TOP)).toBe(20);
  });

  it('内容顶取胜：软上限那 3 级不许漏出超模', () => {
    // 软上限 = 内容顶 + LEVEL_SOFT_CAP_MARGIN(3)，玩家能到 81 而主线装备只到 78
    expect(depthAnchorLevel('crimson', 1, CONTENT_TOP + 3, CONTENT_TOP)).toBe(CONTENT_TOP);
  });

  it('删掉内容顶那一项就会重现 1.05× 超模（守卫有效性的反证）', () => {
    const player = CONTENT_TOP + 3;
    const twoWayMin = Math.min(depthNominalLevel('crimson', 1), player);
    const leaked = baseValue(twoWayMin, typicalQualityAt(twoWayMin)) / mainlineBest(player);
    expect(leaked).toBeGreaterThan(1.05);

    // 三元 min 之后回到 1.00
    const anchor = depthAnchorLevel('crimson', 1, player, CONTENT_TOP);
    expect(baseValue(anchor, typicalQualityAt(anchor)) / mainlineBest(player)).toBeCloseTo(1, 10);
  });
});

/** docs/66 G-2：真正的强度守卫 —— 对照玩家**实际能拿到**的主线最强 */
describe('G-2 · 副本胚子永远不超过同期主线最强', () => {
  it('任何档位 × 任何深度 × 任何等级，比值都不超过 1.00', () => {
    for (const tier of EQUIPMENT_DUNGEON_TIERS) {
      for (let depth = 1; depth <= DEPTH_PER_TIER; depth++) {
        for (let level = ENTRY; level <= CONTENT_TOP + 3; level++) {
          const anchor = depthAnchorLevel(tier.id, depth, level, CONTENT_TOP);
          const blank = baseValue(anchor, typicalQualityAt(anchor));
          const ratio = blank / mainlineBest(level);
          expect(
            ratio,
            `${tier.id} d${depth} @Lv${level} 超模 ${ratio.toFixed(3)}×`,
          ).toBeLessThanOrEqual(1 + 1e-9);
        }
      }
    }
  });

  it('低档给的确实更差 —— 否则档位进阶失去意义', () => {
    // Lv31 玩家：azure 最深层给的应当明显差于 violet 最深层
    const azure = depthAnchorLevel('azure', DEPTH_PER_TIER, 31, CONTENT_TOP);
    const violet = depthAnchorLevel('violet', DEPTH_PER_TIER, 31, CONTENT_TOP);
    expect(baseValue(azure, typicalQualityAt(azure))).toBeLessThan(
      baseValue(violet, typicalQualityAt(violet)),
    );
  });
});

/**
 * docs/66 §3.5：胚子取自玩家当前区域的主线装备定义，
 * 所以品质必须夹进该区**实有**的集合。
 *
 * docs/73 A3 后 typicalQualityAt 由真实可得性推导（r2 Lv10-14 = rare），
 * 旧「r2 缺口」（Lv10~14 取到 common 而无定义）已被结构性关闭；
 * 本组测试仍逐区逐级扫覆盖面，防止将来新区域漏登记。
 */
describe('区域品质集合守卫', () => {
  const RE = /^eq_(r\d+)_ring_([a-z]+)$/;

  it('登记表与实际装备定义完全一致 —— 少一档品质就红', () => {
    const actual = new Map<string, Set<string>>();
    for (const definition of Object.values(EQUIPMENT)) {
      const matched = definition.id.match(RE);
      if (!matched) continue;
      const regionId = matched[1]!;
      if (!actual.has(regionId)) actual.set(regionId, new Set());
      actual.get(regionId)!.add(definition.quality);
    }

    for (const [regionId, qualities] of actual) {
      const range = REGION_BLANK_QUALITY_RANGE[regionId];
      expect(range, `区域 ${regionId} 未登记品质区间`).toBeDefined();
      const ordered = [...qualities].sort(
        (a, b) => QUALITY_ORDER.indexOf(a as Quality) - QUALITY_ORDER.indexOf(b as Quality),
      );
      expect(range!.lowest, `${regionId} 最低品质`).toBe(ordered[0]);
      expect(range!.highest, `${regionId} 最高品质`).toBe(ordered[ordered.length - 1]);
    }
  });

  it('每个区域的每一级都能取到真实存在的定义 —— 这条直接钉死 r2 缺口', () => {
    for (const region of REGIONS) {
      for (let level = region.levelFrom; level <= region.levelTo; level++) {
        const quality = blankQualityInRegion(region.id, level);
        expect(
          EQUIPMENT[`eq_${region.id}_ring_${quality}`],
          `${region.id} Lv${level} 夹取到 ${quality}，但该区没有这个品质的装备`,
        ).toBeDefined();
      }
    }
  });

  it('r2 的 Lv10~14 口径=rare（A3 派生），夹取后仍在实有集合内', () => {
    expect(typicalQualityAt(12)).toBe('rare');
    expect(blankQualityInRegion('r2', 12)).toBe('rare');
  });

  it('夹取不会超过该区最高品质', () => {
    expect(blankQualityInRegion('r7', 78)).toBe('legendary');
  });

  it('未登记的区域直接抛错，不回退默认值', () => {
    expect(() => blankQualityInRegion('r99', 30)).toThrow(/未登记可用装备品质区间/);
  });
});

describe('胚子品质取「典型」而不是「最好的可能」', () => {
  it('品质由锚点等级推导，不由档位的 quality 字段决定', () => {
    // crimson 档标着 mythic，但当前内容顶只到 78 → typicalQualityAt(78) = legendary
    expect(depthBlankQuality('crimson', 1, CONTENT_TOP + 3, CONTENT_TOP)).toBe(
      typicalQualityAt(CONTENT_TOP),
    );
    expect(depthBlankQuality('crimson', 1, CONTENT_TOP + 3, CONTENT_TOP)).not.toBe('mythic');
  });
});

/**
 * docs/66 G-2（收紧后的措辞）：
 * **胚子必须是玩家在当前区域刷主线就能掉到的定义。**
 *
 * 比「必须是当前区域的定义」更强 —— 后者只约束来源表，前者约束**可获得性**：
 * 将来若有人往区域表里塞一件「区域内但不掉落」的活动装或任务奖励，
 * 只约束来源表会放过它。门禁要能挡住我们还没想到的加法。
 */
describe('G-2 · 胚子必须是玩家刷主线就能掉到的定义', () => {
  it('任何档 × 任何深度 × 任何等级，胚子定义都真实存在且可烙印', () => {
    for (const tier of EQUIPMENT_DUNGEON_TIERS) {
      for (let depth = 1; depth <= DEPTH_PER_TIER; depth++) {
        for (let level = ENTRY; level <= CONTENT_TOP + 3; level++) {
          for (const slot of ['weapon', 'ring', 'shoes'] as const) {
            const anchor = depthAnchorLevel(tier.id, depth, level, CONTENT_TOP);
            const definition = EQUIPMENT[blankDefinitionId(slot, anchor)];
            expect(
              definition,
              `${tier.id} d${depth} @Lv${level} ${slot} 的胚子定义不存在`,
            ).toBeDefined();
            // 带定义级 setId 的装备不可烙印（planImprint 的 def-set-conflict 分支），
            // 发一批不能烙印的胚子会直接违反 docs/58 红线
            expect(definition!.setId, `${definition!.id} 带定义级 setId，不可烙印`).toBeUndefined();
          }
        }
      }
    }
  });

  it('胚子定义确实在某个区域的可掉落集合里 —— 不是「注册了但刷不到」的装备', () => {
    const droppable = new Set(REGIONS.flatMap((region) => equipIdsOfRegion(region.id)));
    for (let level = ENTRY; level <= CONTENT_TOP + 3; level++) {
      for (const slot of ['weapon', 'ring', 'shoes'] as const) {
        const id = blankDefinitionId(slot, level);
        expect(droppable.has(id), `${id} 不在任何区域的可掉落集合里`).toBe(true);
      }
    }
  });

  /**
   * ★ 这条是真正的强度守卫，**必须拿真实定义的等级与品质算**。
   *
   * 初版写成「bv(锚点, typicalQualityAt(锚点)) ÷ 同一个式子」，恒等于 1、
   * 永远不会红 —— 于是「取锚点所在区域」那版实现里 Lv10 拿到 r2 的 Lv16 装备
   * （**2.83×**）它一声不吭。和 G-1 自证断言是同一个错，在下一层又犯了一遍。
   */
  it('胚子的真实基准值永不超过玩家同期主线典型', () => {
    for (let level = ENTRY; level <= CONTENT_TOP + 3; level++) {
      for (const slot of ['weapon', 'ring', 'shoes'] as const) {
        const definition = EQUIPMENT[blankDefinitionId(slot, level)]!;
        const actual = baseValue(definition.level, definition.quality);
        const era = baseValue(
          Math.min(level, CONTENT_TOP),
          typicalQualityAt(Math.min(level, CONTENT_TOP)),
        );
        expect(
          actual / era,
          `Lv${level} ${slot} 拿到 ${definition.id}（Lv${definition.level} ${definition.quality}）= ${(actual / era).toFixed(2)}×`,
        ).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  /**
   * 只约束基准值是不够的：低品质高等级的装备可以在基准值上「换算」过关。
   *
   * claude 实测的反例：violet d4 标称 Lv46 曾选中 eq_r6_ring_rare(Lv58) ——
   * bv(58,rare)=331 ≤ bv(46,epic)=379 所以基准值那关过了，
   * 但那是 **r6 的装备出现在 violet（Lv31-51）副本里**，
   * 玩家会看到一件明显不属于这个副本、甚至还没解锁的区域的东西。
   */
  it('胚子等级永不超过锚点 —— 不许用「高等级低品质」在基准值上换算过关', () => {
    for (let level = ENTRY; level <= CONTENT_TOP + 3; level++) {
      for (const slot of ['weapon', 'ring', 'shoes'] as const) {
        const definition = EQUIPMENT[blankDefinitionId(slot, level)]!;
        expect(
          definition.level,
          `锚点 Lv${level} 选中了 ${definition.id}（Lv${definition.level}），高于锚点`,
        ).toBeLessThanOrEqual(level);
      }
    }
  });

  it('深度越深、品质在本区阶梯上越高（等级足够时）', () => {
    // Lv78 满级玩家：azure d1（标称 16）应当明显差于 auric d5（标称 76）
    const shallow = depthAnchorLevel('azure', 1, 78, CONTENT_TOP);
    const deep = depthAnchorLevel('auric', 5, 78, CONTENT_TOP);
    expect(QUALITY_ORDER.indexOf(EQUIPMENT[blankDefinitionId('ring', deep)]!.quality)).toBeGreaterThan(
      QUALITY_ORDER.indexOf(EQUIPMENT[blankDefinitionId('ring', shallow)]!.quality),
    );
  });
});

describe('深度链（替代 unlockLevel）', () => {
  const empty: EquipmentDungeonDepthProgress = {};

  it('没打过时只能挑战第 1 层', () => {
    expect(isDepthUnlocked(empty, 'azure', 1)).toBe(true);
    expect(isDepthUnlocked(empty, 'azure', 2)).toBe(false);
  });

  it('通过第 N 层后开放第 N+1 层，且不能跳级', () => {
    const progress = advanceDepth(empty, 'azure', 2);
    expect(isDepthUnlocked(progress, 'azure', 3)).toBe(true);
    expect(isDepthUnlocked(progress, 'azure', 4)).toBe(false);
  });

  it('各档进度互相独立', () => {
    const progress = advanceDepth(empty, 'azure', 4);
    expect(clearedDepthOf(progress, 'azure')).toBe(4);
    expect(clearedDepthOf(progress, 'violet')).toBe(0);
  });

  it('等级完全不参与解锁判定 —— 这正是本次重排的目的', () => {
    // 同一份进度，Lv1 与 Lv78 得到相同的解锁结论
    const progress = advanceDepth(empty, 'auric', 1);
    expect(isDepthUnlocked(progress, 'auric', 2)).toBe(true);
  });
});

describe('深度只升不降（docs/40 红线：进度条不许倒退）', () => {
  it('用更低的深度推进不会让进度退回去', () => {
    const progress = advanceDepth(advanceDepth({}, 'violet', 4), 'violet', 2);
    expect(clearedDepthOf(progress, 'violet')).toBe(4);
  });

  it('重复通关同一层不改变进度', () => {
    const once = advanceDepth({}, 'violet', 3);
    expect(clearedDepthOf(advanceDepth(once, 'violet', 3), 'violet')).toBe(3);
  });
});

describe('crimson 当前只开 d1（docs/66 §七）', () => {
  it('d2~d5 未开放，且不因玩家等级或进度而开放', () => {
    expect(isDepthOpen('crimson', 1)).toBe(true);
    for (let d = 2; d <= DEPTH_PER_TIER; d++) {
      expect(isDepthOpen('crimson', d)).toBe(false);
      expect(isDepthUnlocked(advanceDepth({}, 'crimson', 1), 'crimson', d)).toBe(false);
    }
  });

  it('配置刻意保留：区域 8 抬高内容顶那天它们自动生效，不需要改代码', () => {
    // 未开放不等于未登记 —— 标称等级仍然算得出来
    expect(depthNominalLevel('crimson', 5)).toBe(101);
  });

  it('全五层锚点都被内容顶压到同一个值，所以开了也是重复劳动', () => {
    const anchors = Array.from({ length: DEPTH_PER_TIER }, (_, i) =>
      depthAnchorLevel('crimson', i + 1, CONTENT_TOP + 3, CONTENT_TOP),
    );
    expect(new Set(anchors).size).toBe(1);
    expect(anchors[0]).toBe(CONTENT_TOP);
  });
});

describe('推荐战力与实际难度同源', () => {
  // docs/73 A3 后为**构造保证**：rec = EFG(档位入口) × TARGET[d]，TARGET 单调。
  // 四档全部断言，防止将来有人把等级项塞回公式重新引入非单调（auric 曾 d2>d3）。
  it('深度越深推荐战力越高（四档全部）', () => {
    const TIERS = ['azure', 'violet', 'auric', 'crimson'] as const;
    for (const tier of TIERS) {
      for (let d = 2; d <= DEPTH_PER_TIER; d++) {
        expect(
          depthRecommendCp(tier, d),
          `${tier} d${d} 的推荐战力必须高于 d${d - 1}`,
        ).toBeGreaterThan(depthRecommendCp(tier, d - 1));
      }
    }
  });

  it('高档同深度的推荐战力高于低档', () => {
    const TIERS = ['azure', 'violet', 'auric', 'crimson'] as const;
    for (let i = 1; i < TIERS.length; i++) {
      expect(depthRecommendCp(TIERS[i], 1)).toBeGreaterThan(depthRecommendCp(TIERS[i - 1], 1));
    }
  });
});

describe('evaluateDungeonDepth 的阻挡原因', () => {
  const base = { playerLevel: 40, contentTopLevel: CONTENT_TOP, attemptsRemaining: 3 };

  it('未开放优先于其它原因', () => {
    const result = evaluateDungeonDepth({ ...base, progress: {}, tierId: 'crimson', depth: 3 });
    expect(result.reason).toBe('not-opened');
    expect(result.unlocked).toBe(false);
  });

  it('前置深度未通', () => {
    expect(
      evaluateDungeonDepth({ ...base, progress: {}, tierId: 'azure', depth: 3 }).reason,
    ).toBe('previous-depth');
  });

  it('次数耗尽', () => {
    expect(
      evaluateDungeonDepth({
        ...base,
        attemptsRemaining: 0,
        progress: {},
        tierId: 'azure',
        depth: 1,
      }).reason,
    ).toBe('daily-limit');
  });

  it('可以挑战时给出首破标记', () => {
    const first = evaluateDungeonDepth({ ...base, progress: {}, tierId: 'azure', depth: 1 });
    expect(first.reason).toBe('ok');
    expect(first.isFirstBreak).toBe(true);

    const repeat = evaluateDungeonDepth({
      ...base,
      progress: advanceDepth({}, 'azure', 1),
      tierId: 'azure',
      depth: 1,
    });
    expect(repeat.isFirstBreak).toBe(false);
  });
});


/**
 * ★★ 哨兵测试 —— 它的作用不是证明代码对，而是**在别人修好某件事时把人拉回来**。
 *
 * 背景：`scripts/equipment-dungeon-balance.mts` 里两条读 CP 的带宽门禁
 * 本版已降级为「只报不拦」，因为 CP 有两个已知失真源，它们量的一部分
 * 是标尺的毛病而不是难度的毛病。
 *
 * 但「只报不拦」有个众所周知的下场：**从此没人管**。
 * 我们今天已经吃过两次亏 —— 平衡门禁的上界缺了几个月没被发现、
 * DEPTH_GATES_CALIBRATED 挂了大半天。所以重启条件不能写成注释里的一句话，
 * 必须是一条**会自己变红**的断言：下面这两条断言的是「失真**仍然存在**」，
 * 修好任何一条的人都会被它拦住，而他绕不过去 —— 因为他改的正是被断言的东西。
 */
describe('哨兵 · CP 已知失真源仍然存在（修好任一条就回去把带宽门禁改回硬拦）', () => {
  const CALL_TO_ACTION =
    ' ★ 这条红了说明 CP 的已知失真源被修好了。请立刻回到 ' +
    'scripts/equipment-dungeon-balance.mts，把 CROSS_TIER_BANDWIDTH / ' +
    'CROSS_CLASS_BANDWIDTH 两条从「只报不拦」改回 failed = true，复跑确认后再删本断言。' +
    ' 负责人：claude-drops　出处：docs/66 §6.2';

  it('失真源①：暴击率在 CP 里仍是固定加权（职业间失真）', () => {
    // 固定加权 ⇒ +10% 暴击的 CP 增量与等级无关；真实收益却随基础值放大。
    const low = combatPower({ ...ZERO_STATS, atk: 100, critRate: 10 });
    const lowBase = combatPower({ ...ZERO_STATS, atk: 100 });
    const high = combatPower({ ...ZERO_STATS, atk: 10_000, critRate: 10 });
    const highBase = combatPower({ ...ZERO_STATS, atk: 10_000 });
    expect(high - highBase, `暴击的 CP 定价已随基础值变化${CALL_TO_ACTION}`).toBeCloseTo(
      low - lowBase,
      6,
    );
  });

  it('失真源②：怪物攻击相对玩家时代强度仍在随等级漂移（等级段间失真）', () => {
    // 同一口径下取两个相距很远的等级，漂移比应当明显大于 1（= 尚未修复）
    const ratioAt = (level: number) =>
      expectedFullGearCp(level) / monsterAtk(level, 'normal', 1);
    const drift = ratioAt(75) / ratioAt(15);
    expect(drift, `威胁轴漂移已被修平${CALL_TO_ACTION}`).toBeGreaterThan(1.5);
  });
});
