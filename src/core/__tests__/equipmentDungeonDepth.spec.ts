import { describe, expect, it } from 'vitest';
import {
  advanceDepth,
  clearedDepthOf,
  depthAnchorLevel,
  depthBlankQuality,
  depthNominalLevel,
  depthRecommendCp,
  evaluateDungeonDepth,
  isDepthOpen,
  isDepthUnlocked,
  requireDepthAnchor,
  type EquipmentDungeonDepthProgress,
} from '../equipmentDungeonDepth';
import { EQUIPMENT_DUNGEON_DEPTH_ANCHORS, DEPTH_PER_TIER } from '@/data/equipmentDungeonDepthRules';
import { EQUIPMENT_DUNGEON_TIERS } from '@/data/equipmentDungeonGear';
import { typicalQualityAt } from '@/data/expectedPower';
import { ALL_CHAPTERS } from '@/data/regions';
import { ITEM_BASE, ITEM_POW, ITEM_SCALE, QUALITY_MUL } from '@/data/constants';
import type { Quality } from '../types';

/** 当前内容顶，与 arenaEquipment.ts 同源口径 */
const CONTENT_TOP = Math.max(...ALL_CHAPTERS.map((chapter) => chapter.levelTo));

/** 装备基准值，与 core/equipment.ts 的 itemBaseValue 同式 */
function baseValue(level: number, quality: Quality): number {
  return ITEM_BASE * Math.pow(level, ITEM_POW) * QUALITY_MUL[quality] * ITEM_SCALE;
}

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
        for (let level = 1; level <= CONTENT_TOP + 3; level++) {
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

describe('胚子品质取「典型」而不是「最好的可能」', () => {
  it('品质由锚点等级推导，不由档位的 quality 字段决定', () => {
    // crimson 档标着 mythic，但当前内容顶只到 78 → typicalQualityAt(78) = legendary
    expect(depthBlankQuality('crimson', 1, CONTENT_TOP + 3, CONTENT_TOP)).toBe(
      typicalQualityAt(CONTENT_TOP),
    );
    expect(depthBlankQuality('crimson', 1, CONTENT_TOP + 3, CONTENT_TOP)).not.toBe('mythic');
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
  it('深度越深推荐战力越高', () => {
    for (let d = 2; d <= DEPTH_PER_TIER; d++) {
      expect(depthRecommendCp('auric', d)).toBeGreaterThan(depthRecommendCp('auric', d - 1));
    }
  });

  it('高档同深度的推荐战力高于低档', () => {
    expect(depthRecommendCp('auric', 1)).toBeGreaterThan(depthRecommendCp('violet', 1));
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
