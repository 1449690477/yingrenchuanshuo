import { Rng } from './rng';

export interface ResourceBundle {
  gold?: number;
  items?: Record<string, number>;
}
export interface AmountRange {
  min: number;
  max: number;
}
export interface RandomResourceBundle {
  gold?: AmountRange;
  items?: Record<string, AmountRange>;
}
export interface EncounterRewardVariant {
  weight: number;
  rewards: RandomResourceBundle;
}
export interface EncounterChoice {
  id: string;
  label: string;
  outcome: string;
  costs?: ResourceBundle;
  rewardPool?: EncounterRewardVariant[];
}
/**
 * 奇遇中的一句对话。
 *
 * speaker 为空表示旁白（居中、斜体），否则是角色说的话（带名牌）。
 */
export interface EncounterLine {
  speaker?: string;
  text: string;
}

export interface EncounterDefinition {
  id: string;
  regionIds: string[];
  title: string;
  story: string;
  choices: [EncounterChoice, EncounterChoice];

  // ── 演出相关（全部可选，缺失时 UI 会优雅降级）──

  /** 对话对象的名字，显示在名牌上 */
  speaker?: string;
  /**
   * 立绘资源路径。
   * 还没出图时留空，UI 会用 glyph 渲染一个风格化的占位头像，
   * 看起来是刻意设计而不是坏掉的图。
   */
  portraitAsset?: string;
  /** 占位头像里的字形（emoji 或单字），portraitAsset 缺失时使用 */
  glyph?: string;
  /** 场景背景图；缺省时用该区域的地图美术 */
  sceneAsset?: string;
  /**
   * 逐句对话。为空时 UI 退化为直接展示 story 一段话。
   * 玩家点击推进，读完才出选项 —— 这样奇遇才像「一段小剧情」而不是一个弹窗。
   */
  dialogue?: EncounterLine[];
}
export interface PendingEncounter {
  uid: string;
  encounterId: string;
  regionId: string;
}
export interface EncounterState {
  progressSec: number;
  generatedCount: number;
  resolvedCount: number;
  pending: PendingEncounter[];
}
export interface EncounterTiming {
  firstSec: number;
  intervalSec: number;
  queueMax: number;
}
export interface ResourceWallet {
  gold: number;
  items: Record<string, number>;
}
export type EncounterChoiceResult =
  | { ok: true; wallet: ResourceWallet; rewards: ResourceBundle }
  | { ok: false; reason: 'insufficient-resource' };

/** 用有效挂机时间推进队列；独立派生 RNG，不改变掉落随机序列。 */
export function advanceEncounterState(
  state: EncounterState,
  elapsedSec: number,
  regionId: string,
  availableEncounterIds: readonly string[],
  saveSeed: number,
  timing: EncounterTiming,
): EncounterState {
  if (!Number.isFinite(elapsedSec) || elapsedSec <= 0) return cloneState(state);
  if (availableEncounterIds.length === 0 || state.pending.length >= timing.queueMax) {
    return cloneState(state);
  }
  let progressSec = state.progressSec + elapsedSec;
  let generatedCount = state.generatedCount;
  const pending = state.pending.map((entry) => ({ ...entry }));
  while (pending.length < timing.queueMax) {
    const threshold = generatedCount === 0 ? timing.firstSec : timing.intervalSec;
    if (progressSec < threshold) break;
    progressSec -= threshold;
    const sequence = generatedCount + 1;
    const eventRng = new Rng(saveSeed ^ Math.imul(sequence, 0x9e3779b1));
    pending.push({
      uid: `enc_${sequence}`,
      encounterId: eventRng.pick(availableEncounterIds),
      regionId,
    });
    generatedCount = sequence;
  }
  if (pending.length >= timing.queueMax) progressSec = 0;
  return { progressSec, generatedCount, resolvedCount: state.resolvedCount, pending };
}

/** 原子校验并结算奇遇选项；失败时不返回半扣资源的状态。 */
export function resolveEncounterChoice(
  choice: EncounterChoice,
  wallet: ResourceWallet,
  rewardRng: Rng,
): EncounterChoiceResult {
  if (!canAfford(choice.costs, wallet)) return { ok: false, reason: 'insufficient-resource' };
  const rewards = rollEncounterRewards(choice.rewardPool, rewardRng);
  const next: ResourceWallet = { gold: wallet.gold, items: { ...wallet.items } };
  applyBundle(next, choice.costs, -1);
  applyBundle(next, rewards, 1);
  return { ok: true, wallet: next, rewards };
}

/** 奖励只由存档种子、奇遇 UID 和选项决定，刷新或重试不能刷结果。 */
export function encounterRewardSeed(
  saveSeed: number,
  encounterUid: string,
  choiceId: string,
): number {
  let hash = saveSeed >>> 0;
  for (const char of `${encounterUid}:${choiceId}`) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  }
  return hash;
}

export function rollEncounterRewards(
  pool: readonly EncounterRewardVariant[] | undefined,
  rng: Rng,
): ResourceBundle {
  if (!pool || pool.length === 0) return {};
  const variant = rng.weighted(pool, (entry) => entry.weight);
  const rewards: ResourceBundle = {};
  if (variant.rewards.gold) rewards.gold = rollAmount(variant.rewards.gold, rng);
  for (const [id, range] of Object.entries(variant.rewards.items ?? {})) {
    const count = rollAmount(range, rng);
    if (count > 0) (rewards.items ??= {})[id] = count;
  }
  return rewards;
}

function rollAmount(range: AmountRange, rng: Rng): number {
  if (
    !Number.isInteger(range.min) ||
    !Number.isInteger(range.max) ||
    range.min < 0 ||
    range.max < range.min
  ) {
    throw new Error(`奇遇奖励范围不合法：${range.min}~${range.max}`);
  }
  return rng.int(range.min, range.max);
}

export function canAfford(bundle: ResourceBundle | undefined, wallet: ResourceWallet): boolean {
  if (!bundle) return true;
  if ((bundle.gold ?? 0) > wallet.gold) return false;
  return Object.entries(bundle.items ?? {}).every(
    ([id, count]) => (wallet.items[id] ?? 0) >= count,
  );
}

function applyBundle(wallet: ResourceWallet, bundle: ResourceBundle | undefined, sign: 1 | -1) {
  if (!bundle) return;
  wallet.gold += sign * (bundle.gold ?? 0);
  for (const [id, count] of Object.entries(bundle.items ?? {})) {
    wallet.items[id] = (wallet.items[id] ?? 0) + sign * count;
    if (wallet.items[id] === 0) delete wallet.items[id];
  }
}

function cloneState(state: EncounterState): EncounterState {
  return { ...state, pending: state.pending.map((entry) => ({ ...entry })) };
}
