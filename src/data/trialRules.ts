/**
 * 周常试炼（联机排行榜核心玩法）的内容配置。
 *
 * 机制与数值口径见 docs/51-联机排行榜设计方案.md：
 *   - 全服每周同一个 Boss、同一个随机种子，比 60 秒总伤害
 *   - 不设失败状态：所有人都能打出一个数字，任何搭配改善都立刻看得见
 *   - 4 等级分段 × 4 职业分榜，每周产生 16 个第一名
 *   - 周一 04:00（北京时间，沿用既有日切）重置
 *
 * 本文件只有数据没有逻辑（AGENTS.md 铁律 2）；生成与模拟逻辑在 src/core/trial.ts。
 */

import type { Element } from '@/core/types';

/** 当前赛季。新赛季开启时递增，历史成绩按赛季归档。 */
export const TRIAL_SEASON_ID = 's1';

/** 试炼时长（秒）。用伤害而非通关时间，保证没有失败状态。 */
export const TRIAL_DURATION_SEC = 60;

/**
 * 周切时刻：北京时间周一 04:00，与装备副本 / 好感的日切小时保持一致。
 * 计算方式见 src/core/trial.ts 的 trialWeekIndex。
 */
export const TRIAL_RESET_HOUR_CST = 4;

/**
 * Boss 血量的安全余量倍率。
 *
 * Boss 血量以「分段中位等级、主线典型品质满配玩家」的 60 秒期望输出为基准，
 * 再乘这个倍率，保证任何真实玩家在 60 秒内都打不完 ——
 * 这样榜单指标永远是「伤害」而不是「剩余时间」。
 */
export const TRIAL_BOSS_HP_HEADROOM = 6;

/** 等级分段。Boss 属性以分段中位等级（bossLevel）为基准生成。 */
export interface TrialBracket {
  id: string;
  /** 显示名，如「初樱」 */
  name: string;
  minLevel: number;
  maxLevel: number;
  /** 分段中位等级，Boss 属性基准 */
  bossLevel: number;
}

/**
 * 等级分段（2026-07-30 重划，docs/64 §一）。
 *
 * 旧分段（1-30 / 31-60 / 61-90 / 91-120）是「等级无上限、内容到 Lv120」
 * 时代的配置，在新曲线（内容顶 Lv65 / 软上限 68，docs/56）下已经失效：
 *
 * | 旧分段 | 段内战力跨度 | 实际玩家 |
 * |---|---|---|
 * | 初樱 1-30  | **27.3×** | 13 / 20 人 |
 * | 绯月 31-60 | 3.6× | 5 人 |
 * | 琥珀 61-90 | 4.3×（实际只能到 68） | 2 人 |
 * | 绯樱 91-120 | —— | **0 人，永久不可达** |
 *
 * 分段存在的唯一理由是「同水平比较」（docs/51 §3.4）。27.3× 跨度里
 * Lv30 玩家对 Lv2 玩家是碾压，而 65% 的玩家都挤在这一段 ——
 * 分段没有起到任何作用，还占着一段永远空着的配置。
 *
 * 重划原则（按玩家**实际停留时间**加权，不是按等级数平均）：
 *   - Lv1~23 玩家只待约 1.5 天（sim：D1 就到 Lv21），跨度大无所谓 ——
 *     明天就换段了，为它牺牲别处的公平不值得
 *   - **Lv40~68 要待 22 天**，竞争真正发生在这里，必须切细
 *   - 段数取 5 而不是更多：人少时段数过多会把榜切空
 *     （今天邻域榜的教训：8 条成绩被 12 个桶切碎，docs/61 §3.2）
 *
 * 重划后段内跨度：3.9× / 3.1× / 2.7× / **1.5×** / **2.1×**，
 * 最大跨度落在只待半天的最低段。
 *
 * **id 全部换新**：旧 id 的语义变了（例如 hupo 从 61-90 变成 24-39），
 * 继续复用会让上周 Lv65 玩家的成绩显示在低段榜上 —— 那比看不见更糟。
 * 换新 id 后旧成绩行不再匹配任何当前分段，自然不展示；
 * 旧 id 仍保留在 LEGACY_TRIAL_BRACKET_IDS 供存档校验，老档不会读不出来。
 */
export const TRIAL_BRACKETS: readonly TrialBracket[] = [
  { id: 'b_bud', name: '初樱', minLevel: 1, maxLevel: 10, bossLevel: 7 },
  { id: 'b_moon', name: '绯月', minLevel: 11, maxLevel: 23, bossLevel: 18 },
  { id: 'b_amber', name: '琥珀', minLevel: 24, maxLevel: 39, bossLevel: 33 },
  { id: 'b_crimson', name: '绯樱', minLevel: 40, maxLevel: 54, bossLevel: 48 },
  // 顶段名与 Lv50 的「传说樱冠」外观档呼应（characterAppearance.ts）
  { id: 'b_crown', name: '樱冠', minLevel: 55, maxLevel: 120, bossLevel: 63 },
] as const;

/**
 * 已废弃的分段 id，**只用于存档校验**。
 *
 * 玩家存档里的历史 TrialBest 记录带着旧 id，如果校验白名单只认当前分段，
 * 老档会直接读不出来 —— 那是「一次更新废掉存档」（AGENTS.md 铁律 5）。
 * 这些 id 不再出现在任何榜单查询里，只是让历史记录能通过校验。
 */
export const LEGACY_TRIAL_BRACKET_IDS: readonly string[] = [
  'chuying',
  'feiyue',
  'hupo',
  'feiying',
] as const;

/**
 * 每周词条倾向（Boss 变体）。
 *
 * 每周由种子从本表选一只，让「最优解」每周变化（docs/51 §3.5 多变的酬赏）：
 *   - 坚壳：防御与减伤极高 → 攻击、暴伤、攻速等纯输出词条升值
 *   - 幻影：闪避极高 → 命中词条升值（命中不足时命中率被压到下限）
 *   - 狂怒：攻击极高 → 生命 / 防御 / 减伤 / 吸血升值，活着才能打满全程
 *
 * 数值全部是「乘以怪物基准公式」的倍率，不写死数值（铁律 2 的延伸：
 * 调怪物曲线时，试炼 Boss 自动跟随，不会脱节）。
 */
export interface TrialTilt {
  id: string;
  /** 变体名，用于 Boss 名称前缀 */
  name: string;
  /** 给玩家看的解法提示；每周变化的「那把尺子」 */
  hint: string;
  defMul: number;
  evaMul: number;
  atkMul: number;
  /** 装备系减伤（百分点），与防御减伤相乘 */
  damageReductionPoints: number;
  /** 各元素下的 Boss 全名 */
  names: Record<Exclude<Element, 'none'>, string>;
}

export const TRIAL_TILTS: readonly TrialTilt[] = [
  {
    id: 'shell',
    name: '坚壳',
    hint: '甲壳厚重，攻击与暴伤词条本周更有价值',
    defMul: 1.8,
    evaMul: 1,
    atkMul: 1,
    damageReductionPoints: 25,
    names: { fire: '坚壳·烬甲龙', ice: '坚壳·霜噬之影', thunder: '坚壳·霆鳞镇岳' },
  },
  {
    id: 'mirage',
    name: '幻影',
    hint: '身法飘忽，命中词条本周更有价值',
    defMul: 1,
    evaMul: 2.6,
    atkMul: 1,
    damageReductionPoints: 0,
    names: { fire: '幻影·焰魅流萤', ice: '幻影·冰霰幻羽', thunder: '幻影·雷痕瞬影' },
  },
  {
    id: 'fury',
    name: '狂怒',
    hint: '攻势凶猛，活着才能打满全程',
    defMul: 1,
    evaMul: 1,
    atkMul: 2.1,
    damageReductionPoints: 0,
    names: { fire: '狂怒·绯焰怒獠', ice: '狂怒·凛牙碎寒', thunder: '狂怒·奔雷裂空' },
  },
] as const;

/** Boss 元素池；每周由种子轮换，属性克制随之成为每周变量。 */
export const TRIAL_BOSS_ELEMENTS: readonly Exclude<Element, 'none'>[] = [
  'fire',
  'ice',
  'thunder',
] as const;

/** 元素中文名（榜单与 Boss 卡展示用）。 */
export const ELEMENT_LABELS: Record<Element, string> = {
  fire: '炎',
  ice: '冰',
  thunder: '雷',
  none: '无',
};

/** 本地最多保留多少条每周最好成绩（约半年），超出后最旧的被淘汰。 */
export const TRIAL_BEST_KEEP = 26;
