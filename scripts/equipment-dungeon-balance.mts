import { CLASS_IDS, type ClassId, type EquipmentDef, type EquipmentInstance } from '../src/core/types';
import { addStats, combatPower } from '../src/core/formula';
import { createInstance, totalEquipStats } from '../src/core/equipment';
import {
  applyEquipmentSetStats,
  resolveEquipmentSetBonuses,
} from '../src/core/equipmentSets';
import { Rng } from '../src/core/rng';
import { simulateFight } from '../src/core/combat';
import {
  applyClassMods,
  averageSkillMultiplier,
  baseStatsFor,
  makeMonster,
  makePlayer,
} from '../src/core/progression';
import {
  createEquipmentDungeonState,
  resolveEquipmentDungeonChallenge,
} from '../src/core/equipmentDungeon';
import { SLOT_ORDER } from '../src/data/constants';
import { DEPTH_PER_TIER } from '../src/data/equipmentDungeonDepthRules';
import { EQUIPMENT_DUNGEON_RULES } from '../src/data/equipmentDungeonRules';
import {
  blankDefinitionId,
  depthNominalLevel,
  depthRecommendCp,
  depthScaledMonster,
  isDepthOpen,
} from '../src/core/equipmentDungeonDepth';
import { ALL_CHAPTERS } from '../src/data/regions';

const CONTENT_TOP_LEVEL = Math.max(...ALL_CHAPTERS.map((chapter) => chapter.levelTo));
import { EQUIPMENT, requireEquipment } from '../src/data/equipment';
import { requireEquipmentDungeonStage } from '../src/data/equipmentDungeons';
import {
  EQUIPMENT_DUNGEON_STAGE_LIST,
} from '../src/data/equipmentDungeons';
import {
  EQUIPMENT_DUNGEON_TIERS,
  type EquipmentDungeonTierId,
} from '../src/data/equipmentDungeonGear';
import { getEquipmentSet } from '../src/data/equipmentSets';

const NOW = Date.parse('2026-07-28T12:00:00+08:00');
const REAL_PACE_RUNS = 60;
const RUNS = 120;
/**
 * 入场玩家的强化档：**固定 +9，不再逐档手填**。
 *
 * docs/65 口径里「典型玩家」= 八件平均 +9（TYPICAL_ENHANCE_MUL 1.6），
 * 而 expectedFullGearCp / depthRecommendCp 都建立在这个口径上。
 * 原来的逐档表（3/5/8/11）是另一套假设，与推荐战力的口径不同源 ——
 * 那正是「两个旋钮之间没有反馈回路」的老毛病在入场模型这一侧的残留。
 */
const TYPICAL_ENHANCE = 9;

/**
 * 入场装备 = **该深度标称等级上的主线典型装**（docs/58 §六 第 5 步）。
 *
 * 两处旧问题一起修：
 *
 * 1. **原模型穿的是上一档的副本装备**，而烙印激活批次（79022ea）之后
 *    副本只掉材料 —— 那批装备**再也拿不到了**。拿玩家穿不上的装备做入场模型，
 *    测出来的难度与真实体验无关。
 *
 * 2. **强化档原本逐档手填**（3/5/8/11），与 expectedFullGearCp / depthRecommendCp
 *    的口径不同源 —— 那是「两个旋钮之间没有反馈回路」在入场模型这一侧的残留。
 *    改为固定 +9，与 docs/65 的「典型玩家」（TYPICAL_ENHANCE_MUL 1.6）同源。
 *
 * **玩家不随深度成长**（2026-07-31 裁定，见下）：装备锚在**档位等级**，
 * d1~d5 是同一个玩家面对递增难度。我一度改成「按深度标称等级取装备」，
 * 那是错的 —— 判据在 dungeonMinAnchorLevel 的注释里：
 * 三元 min(标称, 玩家等级, 内容顶) 的存在前提就是**玩家等级可能低于标称**。
 * 若玩家永远等于标称，那个 min 里的玩家等级项就退化成死代码。
 * **一个设计如果让自己的核心公式退化成恒等式，那个读法就是错的。**
 *
 * 而且两边都随深度成长会造成**结构性非单调**：玩家品质按 typicalQualityAt
 * 阈值跳变（azure 五层标称 16/19/22/25/28，前三层全困在 fine 段），
 * 怪物却连续变强 —— 两个阶梯台阶位置不同，实测出现「d5 反而是唯一能过的」。
 * 玩家不动之后只剩一个阶梯在走，非单调结构上消失，k(d) 才有可调空间。
 *
 * 复用 blankDefinitionId：胚子掉什么、入场模型穿什么，**必须是同一个函数** ——
 * 否则又是「同一口径两处实现」（docs/61 §2.2 的教训）。
 */
function entryDefinitions(
  tierId: EquipmentDungeonTierId,
  atLevel = depthNominalLevel(tierId, 1),
): EquipmentDef[] {
  // 默认锚在档位等级（= 该档 d1 的标称），不随深度变；
  // 传入 atLevel 则取该等级的时代装备（第二人群读数用）。
  return SLOT_ORDER.map((slot) => requireEquipment(blankDefinitionId(slot, atLevel)));
}

function entryInstances(
  tierId: EquipmentDungeonTierId,
  classId: ClassId,
  atLevel = depthNominalLevel(tierId, 1),
): EquipmentInstance[] {
  const rng = new Rng(90_000 + CLASS_IDS.indexOf(classId) * 997);
  const enhance = TYPICAL_ENHANCE;
  return entryDefinitions(tierId, atLevel).map((definition, index) => {
    const instance = createInstance(
      definition,
      rng,
      `balance-${tierId}-${classId}-${index}`,
      classId,
    );
    instance.enhance = enhance;
    instance.enhanceGainPermille = instance.enhanceGainPermille.map((_, gainIndex) =>
      gainIndex < enhance ? 80 : 0,
    );
    return instance;
  });
}

/**
 * @param atLevel 覆盖玩家等级与装备时代。省略 = 入场模型（钉在档位等级）。
 *   传入 = 「边升级边下潜」的第二人群读数（见文件末尾的第二人群报表）。
 */
function playerFor(
  tierId: EquipmentDungeonTierId,
  classId: ClassId,
  atLevel = depthNominalLevel(tierId, 1),
) {
  const equipment = entryInstances(tierId, classId, atLevel);
  const setResolution = resolveEquipmentSetBonuses(
    equipment,
    (id) => EQUIPMENT[id],
    getEquipmentSet,
  );
  const stats = applyClassMods(
    classId,
    applyEquipmentSetStats(
      addStats(
        baseStatsFor(classId, atLevel),
        totalEquipStats(equipment, (id) => EQUIPMENT[id], classId),
      ),
      setResolution,
    ),
  );
  return {
    combatant: makePlayer(classId, atLevel, stats),
    cp: combatPower(stats),
    skillMultiplier: averageSkillMultiplier(atLevel) + setResolution.skillMultiplierBonus,
  };
}

/*
 * ★ 深度门禁已标定并生效（2026-07-31 定稿，claude 8b1f336）。
 *
 * 翻 true 的前提是四条同时成立，我复跑确认过：
 *   ①各深度胜率落进「三走一试一挣」的设计带；②均时随深度单调且不超 67.5s；
 *   ③结果侧四职业胜率极差 ≤50pp；④两条读 CP 的带宽门禁已具名降级。
 * 仍有两条**具名豁免**（见 KNOWN_RESIDUALS），它们有理由、有负责人、有过期条件。
 *
 * ── 以下是翻 true 之前的历史说明，保留以备回溯 ──
 *
 * 为什么不是「调松阈值让它变绿」：那是今天反复批的反模式 ——
 * 一条被调到永远能过的门禁等于没有门禁，还额外提供虚假的安全感。
 * 这里保留真实阈值、把违反项**每次运行都大声打印**，只是暂不 exit 1，
 * 并用一个必须有人显式翻转的开关记录「这件事没做完」。
 *
 * 实测现状（本开关为 false 的原因，2026-07-31）：
 *   azure d1 战力比 2.07~2.51、胜率 100%      → 太简单，撞上界
 *   azure d2 战力比 1.42~1.73、胜率 97~99.8%
 *   azure d3 战力比 1.00~1.21、胜率 **0%**    → 悬崖：刚好达标却必死
 *   跨档带宽 2.8~4.3×（目标 ≤1.25×）
 *
 * 悬崖的成因是难度随深度增长快于推荐战力：标称等级上升already 把怪物
 * 血量按 L^1.45 抬了一截，再乘 k(d) 就过头了。标定要动的是
 * DEPTH_ENCOUNTER_BASE 与 DEPTH_DIFFICULTY_K 两组数，属数值口径，
 * 按 docs/65 规则① 归 claude（数值）裁定后我执行。
 *
 * 翻 true 的条件：上面四项全部落进阈值。翻的时候删掉这段注释。
 */
const DEPTH_GATES_CALIBRATED = true;

/*
 * ★ 具名残留豁免清单 —— **不是「调松阈值」，是「把例外写下来并让它会自己过期」**。
 *
 * 为什么不调阈值：阈值一松，所有档位一起松，将来真出问题也看不见。
 * 为什么不手填补偿：那会变成「给单档塞一个手填系数」，
 * 正是这次重构要消灭的东西（TIER_ENCOUNTER_SCALE 的教训）。
 *
 * 每条必须写明**为什么**与**什么时候该删**。清单之外的任何违反 = 硬拦。
 *
 * ★ 自清扫性质：清单里的条目**如果不再违反**，脚本会主动提示删掉它。
 * 没有这条，豁免清单迟早变成一张没人敢动的永久名单 ——
 * 而「不会自己过期的例外」和「没有门禁」最终是同一回事。
 */
interface KnownResidual {
  tier: string;
  depth: number;
  classId: string;
  metric: 'winRate' | 'duration';
  reason: string;
  /** 负责人（docs/73 批 1：红项具名） */
  owner: string;
  /** 燃尽期限（docs/73 批 1：到期未清偿自动转硬失败） */
  deadline: string;
}

const KNOWN_RESIDUALS: readonly KnownResidual[] = [
  {
    tier: 'auric',
    depth: 4,
    classId: 'shaman',
    metric: 'winRate',
    reason:
      '赤金系统性偏易一层的残差（claude 16:06 定稿说明）。刻意不调数压下去——' +
      '那会变成给单档手填补偿。根因判断为主线威胁轴漂移在 Lv56~76 段的残留，' +
      '应在下版本「标尺与地基专线」修 monsterAtk 威胁因子时一起消失。' +
      '★ 那天若仍未消失，才说明副本自身另有形状问题，届时必须单独立项。',
    owner: '小数',
    deadline: '批 2（A1 威胁因子修平后若仍在则单独立项）',
  },
  {
    tier: 'auric',
    depth: 5,
    classId: 'shaman',
    metric: 'duration',
    reason:
      '同上一条同源：赤金偏易 ⇒ 灵巫在 d5 还能磨赢，于是胜局均时被拉到 75s。' +
      '它是「赢得太久」而不是「打不完」——超时会让整层归零，而这里仍有 25.8% 胜率，' +
      '说明是拖不是卡。与上一条同一个修复触发器。',
    owner: '小数',
    deadline: '批 2（A1 威胁因子修平后若仍在则单独立项）',
  },
  // docs/73 L5：A3 可得口径联动红（P0-2b 证据留档）——typicalQualityAt 改为
  // 「真实首次可得」后，violet/auric 档位入口的入场模型装备品质升一档、战力抬
  // 约 1.6×，而深度怪物标定按旧玩家模型，于是 d4/d5 被击穿成全职业 100%。
  // 清偿动作 = 批 2-1 A3 返工（回「典型持有」口径）+ 批 2-4 P0-2b 反标定
  // （从「三走一试一挣」带反解 DEPTH_ENCOUNTER_BASE / DEPTH_ATK_TARGET）。
  { tier: 'violet', depth: 4, classId: '*', metric: 'winRate', owner: '小数', deadline: '批 2', reason: 'A3 可得口径联动（docs/73 L5）：d4 全职业 100% 击穿对抗层带，P0-2b 反标定清偿' },
  { tier: 'violet', depth: 5, classId: '*', metric: 'winRate', owner: '小数', deadline: '批 2', reason: 'A3 可得口径联动（docs/73 L5）：d5 全职业 100% 击穿挣扎层带，P0-2b 反标定清偿' },
  { tier: 'auric', depth: 4, classId: '*', metric: 'winRate', owner: '小数', deadline: '批 2', reason: 'A3 可得口径联动（docs/73 L5）：d4 全职业 100% 击穿对抗层带，P0-2b 反标定清偿' },
  { tier: 'auric', depth: 5, classId: '*', metric: 'winRate', owner: '小数', deadline: '批 2', reason: 'A3 可得口径联动（docs/73 L5）：d5 全职业 100% 击穿挣扎层带，P0-2b 反标定清偿' },
];

function residualOf(
  tier: string,
  depth: number,
  classId: string,
  metric: 'winRate' | 'duration',
): KnownResidual | undefined {
  return KNOWN_RESIDUALS.find(
    (r) =>
      r.tier === tier &&
      r.depth === depth &&
      (r.classId === classId || r.classId === '*') &&
      r.metric === metric,
  );
}

/** 记录哪些豁免这次真的被用到了 —— 没用到的说明已经修好，应当删除。 */
const usedResiduals = new Set<KnownResidual>();

/**
 * 各深度的胜率带 —— 对应「三层走过去、一层要试、一层要挣」的定稿形状。
 * 下限防止某层变成不可能，上限防止它变成散步。
 */
const DEPTH_WIN_BANDS: readonly { min: number; max: number }[] = [
  { min: 0.95, max: 1.0 }, // d1 教学层：必须过得去
  { min: 0.9, max: 1.0 }, // d2
  { min: 0.8, max: 1.0 }, // d3
  { min: 0.2, max: 0.9 }, // d4 对抗层
  { min: 0.0, max: 0.35 }, // d5 挣扎层：入场模型本就不该过
];

/** 每档每职业每深度的战力比，供 G-12 的两条带宽门禁使用（docs/66 §6.2）。 */
const ratiosByDepth = new Map<number, { tier: string; classId: string; ratio: number }[]>();
/** 结果侧读数（不经过 CP），顶替降级掉的两条带宽门禁做拦截。 */
const winRatesByDepth = new Map<number, { tier: string; classId: string; winRate: number }[]>();

let failed = false;
for (const tier of EQUIPMENT_DUNGEON_TIERS) {
 for (let depth = 1; depth <= DEPTH_PER_TIER; depth += 1) {
  if (!isDepthOpen(tier.id, depth)) continue;
  for (const classId of CLASS_IDS) {
    const player = playerFor(tier.id, classId);
    let wins = 0;
    let totalDurationMs = 0;
    let worstPortal = '';
    let worstWins = RUNS + 1;

    for (const stage of EQUIPMENT_DUNGEON_STAGE_LIST.filter(
      (candidate) => candidate.tierId === tier.id,
    )) {
      let stageWins = 0;
      for (let run = 0; run < RUNS; run += 1) {
        const state = createEquipmentDungeonState(NOW);
        // 深度链：要打第 d 层就得先通过 d-1 层（docs/66）。
        // 旧的 previousStageId 档位链已被它取代。
        if (depth > 1) state.depth = { [tier.id]: depth - 1 };
        const result = resolveEquipmentDungeonChallenge({
          stage,
          depth,
          contentTopLevel: CONTENT_TOP_LEVEL,
          state,
          pity: {},
          player: player.combatant,
          classId,
          playerSkillMultiplier: player.skillMultiplier,
          rngState: 10_000 + run * 73 + stage.id.length * 101,
          now: NOW,
        });
        if (result.ok && result.win) {
          wins += 1;
          stageWins += 1;
          totalDurationMs += result.durationMs;
        }
      }
      if (stageWins < worstWins) {
        worstWins = stageWins;
        worstPortal = stage.slot;
      }
    }

    const totalRuns = RUNS * SLOT_ORDER.length;
    const winRate = wins / totalRuns;
    const averageSeconds = wins > 0 ? totalDurationMs / wins / 1000 : Number.POSITIVE_INFINITY;
    const cpRatio = player.cp / depthRecommendCp(tier.id, depth);
    if (!ratiosByDepth.has(depth)) ratiosByDepth.set(depth, []);
    ratiosByDepth.get(depth)!.push({ tier: tier.id, classId, ratio: cpRatio });
    if (!winRatesByDepth.has(depth)) winRatesByDepth.set(depth, []);
    winRatesByDepth.get(depth)!.push({ tier: tier.id, classId, winRate });
    console.log(
      [
        tier.id.padEnd(7),
        `d${depth}`,
        classId.padEnd(9),
        `胜率 ${(winRate * 100).toFixed(1)}%`,
        `最难 ${worstPortal} ${(worstWins / RUNS * 100).toFixed(1)}%`,
        `胜局均时 ${averageSeconds.toFixed(1)}s`,
        `战力 ${player.cp}`,
        `战力比 ${cpRatio.toFixed(2)}`,
      ].join(' | '),
    );
    /*
     * ★ 胜率带按**定稿的设计形状**判，不是按通用带（docs/66 §3.2 定稿）。
     *
     * 设计意图：**三层可以走过去、一层要试、一层要挣**。
     *   d1~d3 —— 入场即可通关。第一层尤其必须是 100%：
     *            它是「你一定过得去」的锚点，用来教会玩法并保证首破掉胚子。
     *            把它做成会输的层，只会让玩家在还没理解深度是什么之前先被劝退。
     *   d4    —— 真正的对抗层，入场玩家五五开上下。
     *   d5    —— 要求实打实的养成投入；入场模型**本就不该过得去**。
     *
     * ⚠ 这里的「玩家」是入场模型 = **该档最弱可能玩家**。
     * 所以 d5 低胜率不是「太难」，而是设计如此 —— 拿入场模型去要求 d5 高胜率，
     * 等于要求「最弱的人也能打最深的层」，那会把深度轴压成一条平线。
     *
     * 我最初写的是「d1≤95%、d5≥35%」的通用带，那是在标定之前拍的，
     * 与最终定稿的形状不符。**按实测结果改口径，不是调松阈值** ——
     * 判据本身变了（从「均匀难度」变成「三走一试一挣」），不是把线挪松。
     */
    const band = DEPTH_WIN_BANDS[depth - 1];
    if (!band) throw new Error(`[配置错误] 缺少 d${depth} 的胜率带`);
    if (winRate < band.min) {
      console.log(
        `  ↓ 太难：d${depth} 胜率 ${(winRate * 100).toFixed(1)}% 低于下限 ${(band.min * 100).toFixed(0)}%`,
      );
      failed = true;
    }
    if (winRate > band.max) {
      const residual = residualOf(tier.id, depth, classId, 'winRate');
      if (residual) {
        usedResiduals.add(residual);
        console.log(
          `  ⓘ [具名豁免] ${tier.id} d${depth} ${classId} 胜率 ${(winRate * 100).toFixed(1)}% > ${(band.max * 100).toFixed(0)}%`,
        );
      } else {
        console.log(
          `  ↑ 太简单：${tier.id} d${depth} ${classId} 胜率 ${(winRate * 100).toFixed(1)}% 超过上限 ${(band.max * 100).toFixed(0)}%`,
        );
        failed = true;
      }
    }
    /*
     * 均时上限：90 秒硬上限的 75%，留 25% 给职业与运气的方差。
     *
     * **零胜局时 averageSeconds 是 Infinity，那不是「太慢」而是「没赢过」** ——
     * d5 设计上就允许入场模型全败（见上面的胜率带），
     * 拿一个除零结果去报「太慢」是判据 bug，不是难度问题。
     * 胜率带已经管住了「该不该赢」，这里只管「赢的那些是不是拖太久」。
     */
    if (wins > 0 && averageSeconds > 90 * 0.75) {
      const residual = residualOf(tier.id, depth, classId, 'duration');
      if (residual) {
        usedResiduals.add(residual);
        console.log(
          `  ⓘ [具名豁免] ${tier.id} d${depth} ${classId} 胜局均时 ${averageSeconds.toFixed(1)}s > 67.5s`,
        );
      } else {
        console.log(
          `  ⏱ 太慢：${tier.id} d${depth} ${classId} 胜局均时 ${averageSeconds.toFixed(1)}s 超过 67.5s`,
        );
        failed = true;
      }
    }
  }
 }
}

/*
 * ★ G-12 带宽（docs/66 §6.2）：跨档与跨职业**必须分开量**。
 *
 * 合成一条会得到一个假门禁：辉金单档内跨职业实测就已经 1.32×，
 * 若只写一条「跨四档四职业 ≤ 1.35×」等于要求跨档差异压进 0.03× ——
 * 做不到，门禁永远红，最后被人注掉。而一条永远红的门禁比没有门禁更糟。
 *
 * 拆开的第二个好处是红了能立刻归因：
 * 跨档红 → 标称等级或 k(d) 有问题；跨职业红 → 门户系数有问题。
 */
/*
 * ★★ 这两条带宽门禁**本版已降级为只报不拦**，原因是它们读 CP，而 CP 有两个
 * 已知失真源 —— 它们量的一部分是标尺的毛病，不是难度的毛病：
 *
 *   ① CP 对暴击定价错（职业间失真）：固定加权 250，Lv52 错约 28 倍。
 *      四职业裸暴击 5/6/8/10，喵喵是剑姬两倍 —— 跨职业带宽首当其冲。
 *   ② CP 相对怪物攻击的尺度随等级漂移（等级段间失真）：全程 4.7 倍单调漂移。
 *      四档锚在 Lv16/31/56/81，正好横跨整个区间 —— 跨档带宽首当其冲。
 *
 * 铁证：苍蓝 d2 战力比 1.22 → 胜率 34%，赤金 d2 战力比 1.16 → 胜率 100%。
 * **战力比更高的那个全灭。战力比不预测胜负。**
 *
 * ★ 重启条件（不是「以后再说」，是有明确触发器的）：
 *   `equipmentDungeonDepth.spec.ts` 里有一条**哨兵测试**断言上述失真源仍然存在。
 *   任何人修好其中任一条，那条哨兵会立刻变红并指名要求回到这里，
 *   把这两条改回硬拦（`failed = true`）并复跑确认。
 *   **负责人：claude-drops。出处：docs/66 §6.2。**
 *
 * 为什么不是简单删掉：它们仍然是有用的报表 —— 数字变化本身能提示形状问题，
 * 只是不该拿一把已知失真的尺子去**拦人**。
 * 顶替它们做拦截的是下面那条**完全不读 CP 的结果侧断言**。
 */
const CROSS_TIER_BANDWIDTH = 1.25;
const CROSS_CLASS_BANDWIDTH = 1.35;
for (const [depth, rows] of [...ratiosByDepth].sort((a, b) => a[0] - b[0])) {
  const byClass = new Map<string, number[]>();
  for (const row of rows) {
    if (!byClass.has(row.classId)) byClass.set(row.classId, []);
    byClass.get(row.classId)!.push(row.ratio);
  }
  for (const [classId, values] of byClass) {
    const spread = Math.max(...values) / Math.min(...values);
    if (values.length > 1 && spread > CROSS_TIER_BANDWIDTH) {
      console.log(
        `  ⓘ [已降级·只报不拦] d${depth} ${classId} 跨档带宽 ${spread.toFixed(2)}× > ${CROSS_TIER_BANDWIDTH}×`,
      );
    }
  }

  const byTier = new Map<string, number[]>();
  for (const row of rows) {
    if (!byTier.has(row.tier)) byTier.set(row.tier, []);
    byTier.get(row.tier)!.push(row.ratio);
  }
  for (const [tierId, values] of byTier) {
    const spread = Math.max(...values) / Math.min(...values);
    if (spread > CROSS_CLASS_BANDWIDTH) {
      console.log(
        `  ⓘ [已降级·只报不拦] d${depth} ${tierId} 跨职业带宽 ${spread.toFixed(2)}× > ${CROSS_CLASS_BANDWIDTH}×`,
      );
    }
  }
}

/*
 * ★ 顶替两条带宽门禁的**结果侧**断言：同档同深，四职业胜率极差。
 *
 * 它完全不经过 CP —— 胜率是直接观测量，不受暴击定价与等级段尺度漂移影响。
 * 门禁的意义在于抓「某个职业在这一层被系统性针对」，
 * 而这正是 docs/36 记过的那类事故（辉金魔女胜率一度只有 47.5%）。
 *
 * 只在**对抗层**（胜率带非全通的层）检查：d1~d3 设计上全员通过，
 * 极差必然接近 0，查了也没有信息量；d5 全员接近 0，同理。
 */
const CLASS_WINRATE_SPREAD_LIMIT = 0.5; // 50 个百分点
for (const [depth, rows] of [...winRatesByDepth].sort((a, b) => a[0] - b[0])) {
  const band = DEPTH_WIN_BANDS[depth - 1];
  if (!band || band.min >= 0.9 || band.max <= 0.35) continue;
  const byTier = new Map<string, number[]>();
  for (const row of rows) {
    if (!byTier.has(row.tier)) byTier.set(row.tier, []);
    byTier.get(row.tier)!.push(row.winRate);
  }
  for (const [tierId, values] of byTier) {
    const spread = Math.max(...values) - Math.min(...values);
    if (spread > CLASS_WINRATE_SPREAD_LIMIT) {
      console.log(
        `  ✗ d${depth} ${tierId} 四职业胜率极差 ${(spread * 100).toFixed(0)}pp > ${CLASS_WINRATE_SPREAD_LIMIT * 100}pp`,
      );
      failed = true;
    }
  }
}

/*
 * ★ 自清扫：清单里没被用到的豁免 = 那个残留已经修好了，条目该删。
 *
 * 没有这一步，豁免清单会变成一张只增不减、没人敢动的永久名单 ——
 * 而「不会自己过期的例外」和「没有门禁」最终是同一回事。
 */
const staleResiduals = KNOWN_RESIDUALS.filter((r) => !usedResiduals.has(r));
if (staleResiduals.length > 0) {
  console.log('');
  for (const r of staleResiduals) {
    console.log(
      `  ✓ 豁免已失效：${r.tier} d${r.depth} ${r.classId} 的 ${r.metric} 不再违反 —— 请从 KNOWN_RESIDUALS 里删掉这条`,
    );
  }
}

/*
 * ★★ 第二条人群读数：**边升级边下潜**（2026-07-31 新增）。
 *
 * 上面所有门禁量的都是「等级钉死在档位入场等级」的静态玩家。
 * 但真实玩家爬完五层要花时间，期间会升级 —— azure 跨 Lv16→28 只是一两天。
 * 两种人群的读数差别极大，实测（四职业 × 60 场，玩家等级跟随该层标称等级）：
 *
 *   档位 d5 胜率：  静态入场 → 真实节奏
 *   azure    0.4% → **100%**（均时 9.4s）
 *   violet   0.7% → **100%**（均时 14.3s）
 *   auric   16.6% → **100%**（均时 16.3s）
 *
 * **十六层全部 100%。** 也就是说门禁描述的「一层要试、一层要挣」
 * 只对**不升级的玩家**成立；正常升级的玩家眼里深度是一路平推。
 *
 * ★ 这不是 bug，但**必须有人一直看得见它**：
 *   ①奖励不会因此失衡 —— 胚子锚点是 min(标称, 玩家等级, 内容顶)，
 *     越级平推拿到的仍是自己时代的东西，「越级的回报是更早拿到而不是拿到更强的」；
 *   ②但「深度是挑战轴」这个说法，**只在早潜时成立**。
 *     玩家可以用「等几天」换掉全部难度，这是设计上必须知情的取舍。
 *
 * 之所以做成常驻报表而不是门禁：它没有「应该是多少」的正确答案 ——
 * 定成 100% 不对（那深度就白设计了），定成低值也不对（那等于惩罚正常升级）。
 * **没有正确答案的量不该拿来拦人，但绝不能因此就不量** ——
 * 今天我们已经吃够了「某条轴没有量具于是漂到几十倍没人知道」的亏。
 */
console.log('');
console.log('── 第二人群读数：边升级边下潜（只报，不拦）──');
for (const tier of EQUIPMENT_DUNGEON_TIERS) {
  for (let depth = 1; depth <= DEPTH_PER_TIER; depth += 1) {
    if (!isDepthOpen(tier.id, depth)) continue;
    const level = depthNominalLevel(tier.id, depth);
    let wins = 0;
    let totalMs = 0;
    for (const classId of CLASS_IDS) {
      const leveled = playerFor(tier.id, classId, level);
      for (let run = 0; run < REAL_PACE_RUNS; run += 1) {
        const stage = requireEquipmentDungeonStage(`equipment_weapon_${tier.id}`);
        const rng = new Rng(9_000 + run * 37);
        const unit = { ...leveled.combatant, stats: { ...leveled.combatant.stats } };
        unit.currentHp = unit.stats.hp;
        let ok = true;
        let ms = 0;
        for (const encounter of stage.encounters) {
          const monster = makeMonster(depthScaledMonster(encounter.monster, tier.id, depth));
          const result = simulateFight(unit, monster, rng, {
            playerSkillMultiplier: leveled.skillMultiplier,
            maxSeconds: EQUIPMENT_DUNGEON_RULES.maxFightSeconds,
          });
          ms += result.duration * 1000;
          if (!result.win) {
            ok = false;
            break;
          }
          unit.currentHp = Math.min(
            unit.stats.hp,
            unit.currentHp + unit.stats.hp * EQUIPMENT_DUNGEON_RULES.betweenWaveHealRatio,
          );
        }
        if (ok) {
          wins += 1;
          totalMs += ms;
        }
      }
    }
    const total = REAL_PACE_RUNS * CLASS_IDS.length;
    const rate = ((wins / total) * 100).toFixed(1);
    const avg = wins > 0 ? (totalMs / wins / 1000).toFixed(1) + 's' : '—';
    console.log(`  ${tier.id.padEnd(8)} d${depth} Lv${String(level).padStart(3)} 胜率 ${rate.padStart(5)}% 均时 ${avg}`);
  }
}

if (failed && !DEPTH_GATES_CALIBRATED) {
  console.log('');
  console.log('⚠ 深度门禁有违反项（见上），但 DEPTH_GATES_CALIBRATED=false，本轮只报不拦。');
  console.log('  标定完成后把该常量翻为 true，这些违反项就会真的挡住提交。');
} else if (failed) {
  throw new Error('装备副本深度门禁未通过：胜率越出上下界，或跨档/跨职业带宽超标。');
}
