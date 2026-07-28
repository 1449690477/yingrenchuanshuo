import { CLASS_IDS, type ClassId, type Stats } from './types';
import { Rng } from './rng';

/** 好感互动后的即时心情；表现层据此选择颜色、粒子和短震模式。 */
export type AffectionMood = 'calm' | 'bright' | 'shy' | 'moved' | 'playful';

export interface AffectionTierDefinition {
  id: string;
  label: string;
  minPoints: number;
  combatBonusRatio: number;
}

export interface AffectionRules {
  /** 每个角色每天可获得数值奖励的互动次数。 */
  dailyInteractionLimit: number;
  /** 北京时间日切小时。 */
  resetHourCst: number;
  maxPoints: number;
  gearBaseChance: number;
  /** 从第几次连续未掉落开始进入软保底。 */
  gearSoftPityStart: number;
  /** 软保底阶段每次额外增加的概率。 */
  gearSoftPityStep: number;
  /** 第几次连续尝试必定掉落。 */
  gearHardPity: number;
  tiers: readonly AffectionTierDefinition[];
}

export interface AffectionCharacterProgress {
  points: number;
  mood: AffectionMood;
  /** 北京时间 04:00 日切后的业务日期。 */
  dayKey: string;
  interactionsToday: number;
  totalInteractions: number;
  /** 自上次心虹掉落后连续未掉落次数。 */
  gearPity: number;
  /** 永久图鉴记录；分解装备不会抹掉曾经获得过的事实。 */
  discoveredGearIds: string[];
  completedStoryIds: string[];
  choiceHistory: Record<string, string>;
}

export interface AffectionState {
  characters: Record<ClassId, AffectionCharacterProgress>;
}

export interface AffectionInteractionSpec {
  id: string;
  points: number;
  mood: AffectionMood;
}

export interface AffectionStoryChoiceSpec {
  id: string;
  mood: AffectionMood;
}

export interface AffectionStorySpec {
  id: string;
  unlockPoints: number;
  requiredStoryIds: readonly string[];
  completionPoints: number;
  choices: readonly AffectionStoryChoiceSpec[];
}

export interface AffectionGearReward {
  defId: string;
  newlyDiscovered: boolean;
  /** 装备实例掷骰使用的独立种子，不污染挂机掉落 RNG。 */
  rewardSeed: number;
  chance: number;
  pityBefore: number;
}

export type AffectionInteractionResult =
  | {
      ok: false;
      reason: 'daily-limit';
      /** 即使到达上限，也要把跨日刷新后的状态交还给 store。 */
      state: AffectionState;
    }
  | {
      ok: true;
      state: AffectionState;
      gainedPoints: number;
      totalInteractions: number;
      gearReward: AffectionGearReward | null;
    };

export type AffectionStoryResult =
  | {
      ok: false;
      reason: 'locked' | 'already-completed' | 'invalid-choice';
    }
  | {
      ok: true;
      state: AffectionState;
      gainedPoints: number;
      mood: AffectionMood;
    };

/** 与装备副本一致：北京时间 04:00 日切，且不依赖宿主系统时区。 */
export function affectionDayKey(now: number, resetHourCst: number): string {
  if (!Number.isFinite(now) || now < 0) {
    throw new Error(`[好感度] now 必须是非负有限时间戳，收到 ${now}`);
  }
  if (!Number.isInteger(resetHourCst) || resetHourCst < 0 || resetHourCst > 23) {
    throw new Error(`[好感度] resetHourCst 必须是 0~23 的整数，收到 ${resetHourCst}`);
  }
  const shifted = new Date(now + (8 - resetHourCst) * 3_600_000);
  return shifted.toISOString().slice(0, 10);
}

export function createAffectionState(now: number, rules: AffectionRules): AffectionState {
  const dayKey = affectionDayKey(now, rules.resetHourCst);
  return {
    characters: Object.fromEntries(
      CLASS_IDS.map((classId) => [classId, createCharacterProgress(dayKey)]),
    ) as Record<ClassId, AffectionCharacterProgress>,
  };
}

export function refreshAffectionDay(
  state: AffectionState,
  now: number,
  rules: AffectionRules,
): AffectionState {
  const dayKey = affectionDayKey(now, rules.resetHourCst);
  const characters = {} as Record<ClassId, AffectionCharacterProgress>;
  for (const classId of CLASS_IDS) {
    const progress = requireProgress(state, classId);
    characters[classId] = {
      ...cloneProgress(progress),
      dayKey,
      interactionsToday: progress.dayKey === dayKey ? progress.interactionsToday : 0,
    };
  }
  return { characters };
}

export function affectionInteractionsRemaining(
  state: AffectionState,
  classId: ClassId,
  now: number,
  rules: AffectionRules,
): number {
  const refreshed = refreshAffectionDay(state, now, rules);
  return Math.max(
    0,
    rules.dailyInteractionLimit - refreshed.characters[classId].interactionsToday,
  );
}

export function affectionTierAt(
  points: number,
  rules: Pick<AffectionRules, 'tiers'>,
): AffectionTierDefinition {
  assertNonNegativeFinite(points, 'points');
  const ordered = [...rules.tiers].sort((left, right) => left.minPoints - right.minPoints);
  const tier = ordered.filter((entry) => points >= entry.minPoints).at(-1);
  if (!tier || ordered[0]?.minPoints !== 0) {
    throw new Error('[好感度] 阶段配置必须从 0 点开始');
  }
  return tier;
}

/** 好感加护只放大常规数值，不直接抬高暴击率、暴伤或攻速。 */
export function applyAffectionCombatBonus(
  stats: Stats,
  points: number,
  rules: Pick<AffectionRules, 'tiers'>,
): Stats {
  const ratio = affectionTierAt(points, rules).combatBonusRatio;
  return {
    atk: stats.atk * (1 + ratio),
    def: stats.def * (1 + ratio),
    hp: stats.hp * (1 + ratio),
    acc: stats.acc * (1 + ratio),
    eva: stats.eva * (1 + ratio),
    critRate: stats.critRate,
    critDmg: stats.critDmg,
    spd: stats.spd,
  };
}

export function affectionGearChance(
  missesBeforeRoll: number,
  rules: Pick<
    AffectionRules,
    'gearBaseChance' | 'gearSoftPityStart' | 'gearSoftPityStep' | 'gearHardPity'
  >,
): number {
  if (!Number.isInteger(missesBeforeRoll) || missesBeforeRoll < 0) {
    throw new Error(`[好感度] 保底计数必须是非负整数，收到 ${missesBeforeRoll}`);
  }
  const attempt = missesBeforeRoll + 1;
  if (attempt >= rules.gearHardPity) return 1;
  const softSteps = Math.max(0, attempt - rules.gearSoftPityStart);
  return Math.min(1, rules.gearBaseChance + softSteps * rules.gearSoftPityStep);
}

/**
 * 结算一次有效互动。
 *
 * 互动序号与存档种子共同决定掉落，刷新页面或反复打开 UI 都不能重掷。
 * 未集齐前优先掉尚未发现的装备；集齐后才允许重复掉落不同胚子。
 */
export function performAffectionInteraction(
  state: AffectionState,
  classId: ClassId,
  interaction: AffectionInteractionSpec,
  gearPoolIds: readonly string[],
  saveSeed: number,
  now: number,
  rules: AffectionRules,
): AffectionInteractionResult {
  assertInteraction(interaction);
  assertGearPool(gearPoolIds);

  const next = refreshAffectionDay(state, now, rules);
  const progress = next.characters[classId];
  if (progress.interactionsToday >= rules.dailyInteractionLimit) {
    return { ok: false, reason: 'daily-limit', state: next };
  }

  progress.interactionsToday += 1;
  progress.totalInteractions += 1;
  progress.points = Math.min(rules.maxPoints, progress.points + interaction.points);
  progress.mood = interaction.mood;

  const pityBefore = progress.gearPity;
  const chance = affectionGearChance(pityBefore, rules);
  const rewardSeed = affectionRewardSeed(saveSeed, classId, progress.totalInteractions);
  const rewardRng = new Rng(rewardSeed);
  const dropped = rewardRng.chance(chance);
  let gearReward: AffectionGearReward | null = null;

  if (dropped) {
    const discovered = new Set(progress.discoveredGearIds);
    const unseen = gearPoolIds.filter((id) => !discovered.has(id));
    const candidates = unseen.length > 0 ? unseen : gearPoolIds;
    const defId = rewardRng.pick(candidates);
    const newlyDiscovered = !discovered.has(defId);
    if (newlyDiscovered) progress.discoveredGearIds.push(defId);
    progress.gearPity = 0;
    gearReward = { defId, newlyDiscovered, rewardSeed, chance, pityBefore };
  } else {
    progress.gearPity += 1;
  }

  return {
    ok: true,
    state: next,
    gainedPoints: interaction.points,
    totalInteractions: progress.totalInteractions,
    gearReward,
  };
}

export function isAffectionStoryUnlocked(
  progress: AffectionCharacterProgress,
  story: AffectionStorySpec,
): boolean {
  return (
    progress.points >= story.unlockPoints &&
    story.requiredStoryIds.every((id) => progress.completedStoryIds.includes(id))
  );
}

export function completeAffectionStory(
  state: AffectionState,
  classId: ClassId,
  story: AffectionStorySpec,
  choiceId: string,
  rules: Pick<AffectionRules, 'maxPoints'>,
): AffectionStoryResult {
  const progress = requireProgress(state, classId);
  if (progress.completedStoryIds.includes(story.id)) {
    return { ok: false, reason: 'already-completed' };
  }
  if (!isAffectionStoryUnlocked(progress, story)) {
    return { ok: false, reason: 'locked' };
  }
  const choice = story.choices.find((entry) => entry.id === choiceId);
  if (!choice) return { ok: false, reason: 'invalid-choice' };

  const next = cloneState(state);
  const nextProgress = next.characters[classId];
  nextProgress.points = Math.min(rules.maxPoints, nextProgress.points + story.completionPoints);
  nextProgress.mood = choice.mood;
  nextProgress.completedStoryIds.push(story.id);
  nextProgress.choiceHistory[story.id] = choice.id;
  return {
    ok: true,
    state: next,
    gainedPoints: story.completionPoints,
    mood: choice.mood,
  };
}

/** 同一存档、职业和有效互动序号永远得到相同种子。 */
export function affectionRewardSeed(
  saveSeed: number,
  classId: ClassId,
  totalInteractions: number,
): number {
  if (!Number.isInteger(totalInteractions) || totalInteractions < 1) {
    throw new Error(`[好感度] totalInteractions 必须是正整数，收到 ${totalInteractions}`);
  }
  let hash = saveSeed >>> 0;
  for (const char of `${classId}:${totalInteractions}`) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  }
  return hash || 0x9e3779b9;
}

function createCharacterProgress(dayKey: string): AffectionCharacterProgress {
  return {
    points: 0,
    mood: 'calm',
    dayKey,
    interactionsToday: 0,
    totalInteractions: 0,
    gearPity: 0,
    discoveredGearIds: [],
    completedStoryIds: [],
    choiceHistory: {},
  };
}

function requireProgress(state: AffectionState, classId: ClassId): AffectionCharacterProgress {
  const progress = state.characters[classId];
  if (!progress) throw new Error(`[好感度] 缺少 ${classId} 的角色进度`);
  return progress;
}

function cloneState(state: AffectionState): AffectionState {
  const characters = {} as Record<ClassId, AffectionCharacterProgress>;
  for (const classId of CLASS_IDS) {
    characters[classId] = cloneProgress(requireProgress(state, classId));
  }
  return { characters };
}

function cloneProgress(progress: AffectionCharacterProgress): AffectionCharacterProgress {
  return {
    ...progress,
    discoveredGearIds: [...progress.discoveredGearIds],
    completedStoryIds: [...progress.completedStoryIds],
    choiceHistory: { ...progress.choiceHistory },
  };
}

function assertInteraction(interaction: AffectionInteractionSpec): void {
  if (!interaction.id.trim()) throw new Error('[好感度] 互动 ID 不能为空');
  if (!Number.isInteger(interaction.points) || interaction.points <= 0) {
    throw new Error(`[好感度] 互动点数必须是正整数，收到 ${interaction.points}`);
  }
}

function assertGearPool(gearPoolIds: readonly string[]): void {
  if (gearPoolIds.length === 0) throw new Error('[好感度] 心虹装备池不能为空');
  if (gearPoolIds.some((id) => !id.trim())) throw new Error('[好感度] 心虹装备 ID 不能为空');
  if (new Set(gearPoolIds).size !== gearPoolIds.length) {
    throw new Error('[好感度] 心虹装备池不能包含重复 ID');
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`[好感度] ${label} 必须是非负有限数，收到 ${value}`);
  }
}
