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

export const TRIAL_BRACKETS: readonly TrialBracket[] = [
  { id: 'chuying', name: '初樱', minLevel: 1, maxLevel: 30, bossLevel: 15 },
  { id: 'feiyue', name: '绯月', minLevel: 31, maxLevel: 60, bossLevel: 45 },
  { id: 'hupo', name: '琥珀', minLevel: 61, maxLevel: 90, bossLevel: 75 },
  { id: 'feiying', name: '绯樱', minLevel: 91, maxLevel: 120, bossLevel: 105 },
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
