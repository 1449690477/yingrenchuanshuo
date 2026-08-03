/**
 * M4-2 · 签到系统核心判定。
 *
 * 设计口径（docs/40 / docs/41 红线）：
 * - 信息型福利，不做焦虑运营：断签不重置、不清零、不惩罚。
 *   `cycleClaimed` 是累计签到次数，奖励位置 = 累计次数 % 7，
 *   所以「隔了几天再来签」只是循环往后推，没有任何损失。
 * - 月度累计按自然月（'YYYY-MM'）计数；跨月第一次签到自动归零重计，
 *   不设「补签」「追签」等补救机制（补救机制本身就是焦虑源）。
 *
 * 铁律 1 / 3 / 4：纯函数、零 UI 依赖、零副作用、无随机，必须配单元测试。
 * 日切 key 由调用方用 core/dayKey.ts 的 businessDayKey 生成（北京 04:00 日切，
 * 与每日体力补给同口径），本模块不做时钟读取。
 */
import { SIGN_IN_CYCLE_REWARDS, SIGN_IN_MONTH_MILESTONES } from '@/data/checkin';
import type { SignInReward } from '@/data/checkin';

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 存档中的签到状态（对应 player 子对象的四个字段）。 */
export interface SignInState {
  /** 最近一次签到的日切 key（'YYYY-MM-DD'）；null = 从未签过。 */
  lastSignInDay: string | null;
  /** 累计签到次数（只增不减；奖励位置 = 本值 % 7）。 */
  cycleClaimed: number;
  /** monthCount 所属的自然月（'YYYY-MM'）；null = 从未签过。 */
  monthKey: string | null;
  /** 所属自然月内的累计签到天数。 */
  monthCount: number;
}

/** 展示用状态快照（签到页 / 红点共用）。 */
export interface SignInStatus {
  /** 今天是否可签。 */
  claimable: boolean;
  /** 今天（若可签）将领取的七日循环奖励位置。 */
  rewardIndex: number;
  /** 当前自然月累计签到天数（不含今天）。 */
  monthCount: number;
  /** 距离最近未达成的月度里程碑天数；全部达成则 null。 */
  nextMilestoneDays: number | null;
}

/** 一次成功签到的结算结果。 */
export interface SignInApplyResult {
  /** 签到后的新状态（调用方写回存档）。 */
  state: SignInState;
  /** 本次领取的七日循环奖励位置。 */
  rewardIndex: number;
  /** 本次领取的循环奖励。 */
  reward: SignInReward;
  /** 本次签到恰好达成的月度里程碑；null = 未达成。 */
  milestone: { days: number; reward: SignInReward } | null;
}

function assertDayKey(todayKey: string): void {
  if (!DAY_KEY_PATTERN.test(todayKey)) {
    throw new Error(`[签到] todayKey 必须是 'YYYY-MM-DD' 日切 key，收到 ${todayKey}`);
  }
}

function assertState(state: SignInState): void {
  if (!Number.isInteger(state.cycleClaimed) || state.cycleClaimed < 0) {
    throw new Error(`[签到] cycleClaimed 必须是非负整数，收到 ${state.cycleClaimed}`);
  }
  if (!Number.isInteger(state.monthCount) || state.monthCount < 0) {
    throw new Error(`[签到] monthCount 必须是非负整数，收到 ${state.monthCount}`);
  }
}

function monthKeyOf(dayKey: string): string {
  return dayKey.slice(0, 7);
}

/** 当前自然月的累计天数（跨月自动视为 0）。 */
function effectiveMonthCount(state: SignInState, todayKey: string): number {
  return state.monthKey === monthKeyOf(todayKey) ? state.monthCount : 0;
}

/** 今天是否可签 + 展示口径。同一天重复签不产生任何变化。 */
export function signInStatus(state: SignInState, todayKey: string): SignInStatus {
  assertDayKey(todayKey);
  assertState(state);
  const monthCount = effectiveMonthCount(state, todayKey);
  const next = SIGN_IN_MONTH_MILESTONES.find((milestone) => milestone.days > monthCount);
  return {
    claimable: state.lastSignInDay !== todayKey,
    rewardIndex: state.cycleClaimed % SIGN_IN_CYCLE_REWARDS.length,
    monthCount,
    nextMilestoneDays: next ? next.days : null,
  };
}

/**
 * 执行一次签到：今天已签返回 null（UI 展示「今日已签」而不是报错）。
 * 成功则返回新状态与奖励，奖励发放由 store 层落账（金币 / 体力 / 背包材料）。
 */
export function applySignIn(state: SignInState, todayKey: string): SignInApplyResult | null {
  assertDayKey(todayKey);
  assertState(state);
  if (state.lastSignInDay === todayKey) return null;

  const rewardIndex = state.cycleClaimed % SIGN_IN_CYCLE_REWARDS.length;
  const reward = SIGN_IN_CYCLE_REWARDS[rewardIndex];
  if (!reward) {
    throw new Error(`[签到] 七日循环奖励表缺少位置 ${rewardIndex}`);
  }

  const monthKey = monthKeyOf(todayKey);
  const monthCount = effectiveMonthCount(state, todayKey) + 1;
  const milestone = SIGN_IN_MONTH_MILESTONES.find((entry) => entry.days === monthCount) ?? null;

  return {
    state: {
      lastSignInDay: todayKey,
      cycleClaimed: state.cycleClaimed + 1,
      monthKey,
      monthCount,
    },
    rewardIndex,
    reward,
    milestone,
  };
}
