/**
 * 秘境榜合理性判定的测试（docs/64）。
 *
 * 这里最重要的不是覆盖率，是**把下界钉在真实战斗上**：
 * 下界若定成统计值，满级玩家打低档副本的合法成绩会被整批误判 ——
 * 所以 dungeonFloorIsReachable 那一条真的跑一场碾压战斗来验证，
 * 而不是拿另一个常量去对比常量。
 */

import { describe, expect, it } from 'vitest';
import { makePlayer } from '../progression';
import { createEquipmentDungeonState, resolveEquipmentDungeonChallenge } from '../equipmentDungeon';
import { requireEquipmentDungeonStage } from '@/data/equipmentDungeons';
import {
  DUNGEON_CLOCK_SKEW_TOLERANCE_MS,
  DUNGEON_FIRST_CLEAR_EPOCH_MS,
} from '@/data/dungeonBoardRules';
import {
  BOARDABLE_DUNGEON_IDS,
  DUNGEON_BOARD_ENTRIES,
  DUNGEON_DURATION_GRANULARITY_MS,
  DUNGEON_MAX_DURATION_MS,
  DUNGEON_MIN_DURATION_MS,
  formatDungeonDuration,
  isPlausibleDungeonClaim,
  isPlausibleDungeonDuration,
  isPlausibleFirstClearedAt,
  meetsDungeonDepthChain,
  mergeDungeonRecord,
  type DungeonClearClaim,
} from '../dungeonBoard';
import type { Stats } from '../types';

const NOW = Date.parse('2026-07-30T12:00:00+08:00');

function crushingStats(overrides: Partial<Stats> = {}): Stats {
  return {
    atk: 10_000_000,
    def: 100_000,
    hp: 10_000_000,
    acc: 100_000,
    eva: 500,
    critRate: 25,
    critDmg: 80,
    spd: 3,
    ...overrides,
  };
}

function clearDurationMs(stageId: string, stats: Stats, depth = 1): number {
  const stage = requireEquipmentDungeonStage(stageId);
  const base = createEquipmentDungeonState(NOW);
  // 深度模型下的门槛是深度链而不是等级：要打第 d 层，得先过第 d−1 层
  const state = depth > 1 ? { ...base, depth: { [stage.tierId]: depth - 1 } } : base;

  const result = resolveEquipmentDungeonChallenge({
    stage,
    state,
    depth,
    pity: {},
    player: makePlayer('测试少女', 90, stats),
    classId: 'witch',
    playerSkillMultiplier: 2,
    rngState: 20260730,
    now: NOW,
    contentTopLevel: 78,
  });
  if (!result.ok) throw new Error(`副本未开打：${result.reason}`);
  return result.durationMs;
}

function claim(overrides: Partial<DungeonClearClaim> = {}): DungeonClearClaim {
  return {
    dungeonId: 'equipment_weapon_auric_d1',
    bestDurationMs: 37_100,
    firstClearedAt: NOW - 86_400_000,
    ...overrides,
  };
}

describe('用时下界钉在真实战斗上', () => {
  it('满级玩家碾压低档副本时，用时正好落在下界上（合法，不是作弊）', () => {
    // 秘境没有等级上限：Lv90 打 16 级的晴蓝第一层，两波各一帧秒杀。
    // 若下界按 sim 均时（晴蓝 18.4s）× 余量来定，这条合法成绩会被判不可信。
    const durationMs = clearDurationMs('equipment_weapon_azure', crushingStats());

    expect(durationMs).toBe(DUNGEON_MIN_DURATION_MS);
    expect(isPlausibleDungeonDuration(durationMs)).toBe(true);
  });

  it('真实用时永远是 100ms 的整数倍（战斗按 0.1 秒一帧推进）', () => {
    const samples = [
      clearDurationMs('equipment_weapon_azure', crushingStats()),
      clearDurationMs('equipment_head_violet', crushingStats({ atk: 3_000, spd: 1.4 })),
      clearDurationMs('equipment_body_auric', crushingStats({ atk: 6_000, spd: 0.9 })),
      // 深层也要取一场：深度只改怪物强度，不改帧长，格律必须一样成立
      clearDurationMs('equipment_body_auric', crushingStats({ atk: 6_000, spd: 0.9 }), 3),
    ];

    expect(samples.every((ms) => ms % DUNGEON_DURATION_GRANULARITY_MS === 0)).toBe(true);
    // 取样里至少要有一场不是秒杀，否则这条断言等于只测了下界那一种情况
    expect(samples.some((ms) => ms > DUNGEON_MIN_DURATION_MS)).toBe(true);
  });
});

describe('用时格律与上下界', () => {
  it('非 100ms 整数倍的用时不可信 —— 手填的数字过不了格律', () => {
    expect(isPlausibleDungeonDuration(1337)).toBe(false);
    expect(isPlausibleDungeonDuration(37_150)).toBe(false);
    expect(isPlausibleDungeonDuration(37_100)).toBe(true);
  });

  it('低于下界或高于两波上限都不可信', () => {
    expect(isPlausibleDungeonDuration(DUNGEON_MIN_DURATION_MS - 100)).toBe(false);
    expect(isPlausibleDungeonDuration(DUNGEON_MIN_DURATION_MS)).toBe(true);
    expect(isPlausibleDungeonDuration(DUNGEON_MAX_DURATION_MS)).toBe(true);
    expect(isPlausibleDungeonDuration(DUNGEON_MAX_DURATION_MS + 100)).toBe(false);
    expect(isPlausibleDungeonDuration(0)).toBe(false);
    expect(isPlausibleDungeonDuration(-200)).toBe(false);
  });

  it('小数与 NaN 一律不可信', () => {
    expect(isPlausibleDungeonDuration(200.5)).toBe(false);
    expect(isPlausibleDungeonDuration(Number.NaN)).toBe(false);
  });
});

describe('白名单随数据自动开合', () => {
  it('白名单恰好等于「未封存的副本」，不是另抄的一份清单', () => {
    // 这条不写死座数：区域 7 上线当天绯樱档解封，白名单从 24 座自动变成 32 座，
    // 服务端与客户端都没有改一行代码 —— 白名单是从 comingSoon 推导的。
    // 断言的是这条推导关系本身，它不随内容更新失效。
    expect(BOARDABLE_DUNGEON_IDS).toEqual(
      DUNGEON_BOARD_ENTRIES.filter((entry) => !entry.sealed).map((entry) => entry.id),
    );
    // 8 门户 ×（azure 5 + violet 5 + auric 5 + crimson 1）层
    expect(DUNGEON_BOARD_ENTRIES).toHaveLength(8 * (5 + 5 + 5 + 5));
  });

  it('每一层未封存的副本都收成绩，每一层封存的都拒收', () => {
    for (const entry of DUNGEON_BOARD_ENTRIES) {
      const verdict = isPlausibleDungeonClaim(claim({ dungeonId: entry.id }), NOW);
      expect(verdict).toBe(!entry.sealed);
    }
  });

  it('当前没有任何封存档位（区域 7 已解封绯樱）', () => {
    // 这是一条哨兵：将来若有人加了新的 comingSoon 档位，它会红，
    // 提醒来更新 docs/64 §二「哪些副本在榜」那一节。红了不是坏事。
    expect(DUNGEON_BOARD_ENTRIES.filter((entry) => entry.sealed).map((entry) => entry.id)).toEqual(
      [],
    );
  });

  it('不存在的副本 id 不接受成绩', () => {
    expect(isPlausibleDungeonClaim(claim({ dungeonId: 'equipment_weapon_rainbow' }), NOW)).toBe(
      false,
    );
    expect(meetsDungeonDepthChain('equipment_weapon_rainbow', 999)).toBe(false);
  });

});

describe('深度链取代等级门槛（L3）', () => {
  // 旧判定是「玩家等级 ≥ 副本 unlockLevel」。深度模型删掉了 unlockLevel，
  // 那条判定会退化成恒真 —— 失效了还不会变红的安全判定最危险。
  it('只能往上爬一层：第 d 层要求服务端已有第 d−1 层记录', () => {
    expect(meetsDungeonDepthChain('equipment_weapon_auric_d1', 0)).toBe(true); // 起点永远放行
    expect(meetsDungeonDepthChain('equipment_weapon_auric_d2', 0)).toBe(false);
    expect(meetsDungeonDepthChain('equipment_weapon_auric_d2', 1)).toBe(true);
    expect(meetsDungeonDepthChain('equipment_weapon_auric_d5', 3)).toBe(false);
    expect(meetsDungeonDepthChain('equipment_weapon_auric_d5', 4)).toBe(true);
  });

  it('已经爬得更高时不倒退：链只要求「至少到过前一层」', () => {
    expect(meetsDungeonDepthChain('equipment_weapon_auric_d2', 5)).toBe(true);
  });

  it('链认的是层号而不是关卡：同档不同门户共用同一条深度进度', () => {
    // 深度进度按档位记（state.depth[tierId]），八个门户共用，
    // 所以在武器炉爬到 d3 之后，头冠坊的 d4 也应当放行。
    expect(meetsDungeonDepthChain('equipment_head_auric_d4', 3)).toBe(true);
    expect(meetsDungeonDepthChain('equipment_head_auric_d5', 3)).toBe(false);
  });
});

describe('首通时刻的合理区间（它是并列时的排序依据）', () => {
  it('早于项目诞生的时刻不可信 —— 否则改成 1970 年就能永远赢并列', () => {
    expect(isPlausibleFirstClearedAt(0, NOW)).toBe(false);
    expect(isPlausibleFirstClearedAt(DUNGEON_FIRST_CLEAR_EPOCH_MS - 1, NOW)).toBe(false);
    expect(isPlausibleFirstClearedAt(DUNGEON_FIRST_CLEAR_EPOCH_MS, NOW)).toBe(true);
  });

  it('设备时钟快几分钟照收，快过容差才判不可信', () => {
    expect(isPlausibleFirstClearedAt(NOW + DUNGEON_CLOCK_SKEW_TOLERANCE_MS, NOW)).toBe(true);
    expect(isPlausibleFirstClearedAt(NOW + DUNGEON_CLOCK_SKEW_TOLERANCE_MS + 1, NOW)).toBe(false);
  });
});

describe('记录合并：最快用时可刷新，首通时刻只会更早', () => {
  const existing = { bestDurationMs: 30_000, firstClearedAt: NOW - 5 * 86_400_000, verified: true };

  it('更快的成绩覆盖，更慢的不覆盖', () => {
    const faster = mergeDungeonRecord(existing, {
      bestDurationMs: 25_000,
      firstClearedAt: NOW,
      verified: true,
    });
    expect(faster.row.bestDurationMs).toBe(25_000);
    expect(faster.changed).toBe(true);

    const slower = mergeDungeonRecord(existing, {
      bestDurationMs: 40_000,
      firstClearedAt: NOW,
      verified: true,
    });
    expect(slower.row.bestDurationMs).toBe(30_000);
    expect(slower.changed).toBe(false);
  });

  it('首通时刻取更早的那个，晚报的不改写', () => {
    const earlier = mergeDungeonRecord(existing, {
      bestDurationMs: 30_000,
      firstClearedAt: NOW - 9 * 86_400_000,
      verified: true,
    });
    expect(earlier.row.firstClearedAt).toBe(NOW - 9 * 86_400_000);
  });

  it('不可信成绩永远改写不了已有记录 —— 堵死「先报真的再报假的」', () => {
    const merged = mergeDungeonRecord(existing, {
      bestDurationMs: 200,
      firstClearedAt: DUNGEON_FIRST_CLEAR_EPOCH_MS,
      verified: false,
    });
    expect(merged.row).toEqual(existing);
    expect(merged.changed).toBe(false);
  });

  it('可信成绩可以整行取代此前不可信的行，玩家自证后不被旧坏数据拖着', () => {
    const dirty = { bestDurationMs: 200, firstClearedAt: NOW - 99 * 86_400_000, verified: false };
    const merged = mergeDungeonRecord(dirty, {
      bestDurationMs: 41_300,
      firstClearedAt: NOW - 86_400_000,
      verified: true,
    });
    expect(merged.row).toEqual({
      bestDurationMs: 41_300,
      firstClearedAt: NOW - 86_400_000,
      verified: true,
    });
    expect(merged.changed).toBe(true);
  });
});

describe('用时展示', () => {
  it('一分钟以内给到 0.1 秒，超过一分钟分秒分开', () => {
    expect(formatDungeonDuration(200)).toBe('0.2 秒');
    expect(formatDungeonDuration(37_100)).toBe('37.1 秒');
    expect(formatDungeonDuration(95_400)).toBe('1 分 35.4 秒');
  });
});

/**
 * 榜单 id 的单向棘轮（2026-08-01，与小榜共同定的）。
 *
 * ── 这两条守的是什么 ──
 * 秘境榜的定位键 dungeon_id 由 `stageId + 深度` 拼成（dungeonBoard.ts:79），
 * 而读取侧是 `eq('dungeon_id', …)`（net/dungeonBoard.ts:125）。
 * **一个 id 只要从 DUNGEON_BOARD_ENTRIES 里消失，库里那些历史行就再也没人查它们**
 * —— 行还在，永远不显示；玩家想重打还会收到「这座秘境尚未开放，或者不存在」
 * （submit-dungeon/index.ts:85）。
 *
 * 试炼榜 2026-07-30 已经完整发生过一次同型事件（分段重划 → 10 行成为孤儿）。
 * 那次是**有人在做决定**：trialRules.ts:74~77 白纸黑字写了「宁可看不见也不能错位展示」。
 * **而这里不会是决定** —— 改的人在调「crimson 开几层」，想的是玩法节奏，
 * 不会意识到自己顺手让一批历史记录变成了「不存在」。
 * **有意识的取舍不需要门禁，无意识的副作用才需要。**
 *
 * ── 为什么是两条而不是一条 ──
 * id 消失有两条独立路径：**改 stageId** 与 **调小 openDepths**。
 * 合并成「id 集合是超集」一条也能挡住，但失败时只会说「少了 40 个 id」，
 * 不说是哪条路径破的。分成两条，红的那条自己就是诊断结论。
 *
 * ── 它不禁止缩层 ──
 * 要缩就改这里的数字。它的作用是让缩层从「顺手改个数」变成「必须先读这段注释」。
 */
describe('★ 榜单 id 单向棘轮：消失的 id 会让历史成绩变成「不存在」', () => {
  /** 2026-08-01 的全部关卡 id。**只增不减** —— 减了就是有历史行成为孤儿。 */
  const FROZEN_STAGE_IDS: readonly string[] = [
    'equipment_belt_auric', 'equipment_belt_azure', 'equipment_belt_crimson',
    'equipment_belt_violet', 'equipment_body_auric', 'equipment_body_azure',
    'equipment_body_crimson', 'equipment_body_violet', 'equipment_bracelet_auric',
    'equipment_bracelet_azure', 'equipment_bracelet_crimson', 'equipment_bracelet_violet',
    'equipment_head_auric', 'equipment_head_azure', 'equipment_head_crimson',
    'equipment_head_violet', 'equipment_necklace_auric', 'equipment_necklace_azure',
    'equipment_necklace_crimson', 'equipment_necklace_violet', 'equipment_ring_auric',
    'equipment_ring_azure', 'equipment_ring_crimson', 'equipment_ring_violet',
    'equipment_shoes_auric', 'equipment_shoes_azure', 'equipment_shoes_crimson',
    'equipment_shoes_violet', 'equipment_weapon_auric', 'equipment_weapon_azure',
    'equipment_weapon_crimson', 'equipment_weapon_violet',
  ];

  /** 2026-08-01 各档实际开放层数。**只增不减**。 */
  const FROZEN_OPEN_DEPTHS: Readonly<Record<string, number>> = {
    azure: 5, violet: 5, auric: 5, crimson: 1,
  };

  it('关卡 id 只增不减 —— 改名或删关卡都会让该关卡的历史成绩永久不可见', () => {
    const current = new Set(DUNGEON_BOARD_ENTRIES.map((entry) => entry.stageId));
    const missing = FROZEN_STAGE_IDS.filter((id) => !current.has(id));
    expect(
      missing,
      `这些关卡 id 从榜单里消失了：${missing.join(', ')}\n` +
        `dungeon_records 里带这些 id 的历史行会永久查不到（读取侧按 dungeon_id 精确匹配），\n` +
        `玩家重打时会收到「这座秘境尚未开放，或者不存在」。\n` +
        `如果这是有意的：先处理那些历史行（迁移或显式声明不可比），再改这里的清单。`,
    ).toEqual([]);
  });

  it('各档开放层数只增不减 —— 缩层等于让超出新层数的历史成绩变成「不存在」', () => {
    const shrunk = Object.entries(FROZEN_OPEN_DEPTHS)
      .map(([tierId, frozen]) => {
        const now = Math.max(
          0,
          ...DUNGEON_BOARD_ENTRIES.filter((e) => e.tierId === tierId).map((e) => e.depth),
        );
        return { tierId, frozen, now };
      })
      .filter((row) => row.now < row.frozen);
    expect(
      shrunk,
      `这些档的开放层数变小了：${shrunk.map((r) => `${r.tierId} ${r.frozen}→${r.now}`).join('、')}\n` +
        `要调低 openDepths，请先处理 dungeon_records 里该档超出新层数的历史行 ——\n` +
        `它们会变成玩家侧的「这座秘境不存在」，而不是「暂时关闭」。\n` +
        `确认处理过之后，把上面 FROZEN_OPEN_DEPTHS 的数字一起改小。`,
    ).toEqual([]);
  });
});
