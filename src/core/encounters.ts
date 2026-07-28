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

export interface EncounterStoryChoice {
  id: string;
  label: string;
  responseDialogue: EncounterLine[];
}

export interface EncounterMemoryCallback {
  fromEncounterId: string;
  choiceId: string;
  dialogue: EncounterLine[];
}
export interface EncounterDailyVariant {
  id: string;
  title: string;
  story: string;
  dialogue: EncounterLine[];
  relationshipDialogue: Partial<Record<EncounterRelationshipStage, EncounterLine[]>>;
}

export interface EncounterSupportTier {
  unlockChapterId: string;
  choice: EncounterChoice;
}

export interface EncounterStoryArc {
  characterId: string;
  characterName: string;
  episode: number;
  episodeLabel: string;
  requiredEncounterIds: string[];
  repeatable: boolean;
  storyChoices: [EncounterStoryChoice, EncounterStoryChoice];
  memoryCallbacks?: EncounterMemoryCallback[];
}

export interface EncounterDefinition {
  id: string;
  regionIds: string[];
  /** 玩家解锁这个章节后，奇遇才会进入新事件候选池。 */
  unlockChapterId: string;
  title: string;
  story: string;
  choices: [EncounterChoice, EncounterChoice];
  /** 连续角色剧情；缺失时沿用普通奇遇的一步结算流程。 */
  storyArc?: EncounterStoryArc;
  /** 可重复角色日常的稳定对白池；同一 pending UID 永远解析为同一项。 */
  dailyVariants?: EncounterDailyVariant[];
  /** 按历史最高章节递进的援助选项，顺序必须从早到晚。 */
  supportTiers?: EncounterSupportTier[];

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
  /** 角色剧情已选的回答；存在时重新打开直接进入回应阶段。 */
  storyChoiceId?: string;
}
export interface EncounterCharacterProgress {
  bond: number;
  completedEncounterIds: string[];
  choiceHistory: Record<string, string>;
}
export interface EncounterState {
  progressSec: number;
  generatedCount: number;
  resolvedCount: number;
  pending: PendingEncounter[];
  characters: Record<string, EncounterCharacterProgress>;
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

export type EncounterRelationshipStage = '初遇' | '熟悉' | '亲近' | '信赖';
export interface EncounterPresentation {
  title: string;
  story: string;
  dialogue: EncounterLine[];
  variantId?: string;
}

export interface EncounterJournalEpisode {
  encounterId: string;
  title: string;
  episodeLabel: string;
  answerLabel: string;
}

export interface EncounterJournalCharacter {
  characterId: string;
  characterName: string;
  glyph: string;
  relationship: EncounterRelationshipStage;
  completedEpisodes: EncounterJournalEpisode[];
  hasPendingStory: boolean;
}

export type RememberStoryChoiceResult =
  | { ok: true; state: EncounterState }
  | { ok: false; reason: 'not-found' | 'not-story' | 'invalid-choice' | 'already-chosen' };

export type StoryEncounterResolveResult =
  | {
      ok: true;
      state: EncounterState;
      wallet: ResourceWallet;
      rewards: ResourceBundle;
      relationship: EncounterRelationshipStage;
    }
  | { ok: false; reason: 'not-found' | 'story-choice-required' | 'insufficient-resource' };

export function createEncounterState(): EncounterState {
  return {
    progressSec: 0,
    generatedCount: 0,
    resolvedCount: 0,
    pending: [],
    characters: {},
  };
}

export function relationshipStage(bond: number): EncounterRelationshipStage {
  if (bond >= 3) return '信赖';
  if (bond >= 2) return '亲近';
  if (bond >= 1) return '熟悉';
  return '初遇';
}

export function characterProgress(
  state: EncounterState,
  characterId: string,
): EncounterCharacterProgress {
  const progress = state.characters[characterId];
  return progress
    ? {
        bond: progress.bond,
        completedEncounterIds: [...progress.completedEncounterIds],
        choiceHistory: { ...progress.choiceHistory },
      }
    : { bond: 0, completedEncounterIds: [], choiceHistory: {} };
}

/** 按地区与历史已解锁章节筛选可生成的奇遇。 */
export function availableEncounterIds(
  definitions: readonly EncounterDefinition[],
  regionId: string,
  unlockedChapterIds: ReadonlySet<string>,
  characters: Readonly<Record<string, EncounterCharacterProgress>> = {},
  pendingEncounterIds: ReadonlySet<string> = new Set(),
  pendingCharacterIds: ReadonlySet<string> = new Set(),
): string[] {
  return definitions
    .filter((encounter) => {
      if (pendingEncounterIds.has(encounter.id)) return false;
      if (
        !encounter.regionIds.includes(regionId) ||
        !unlockedChapterIds.has(encounter.unlockChapterId)
      ) {
        return false;
      }
      const arc = encounter.storyArc;
      if (!arc) return true;
      if (pendingCharacterIds.has(arc.characterId)) return false;
      const completed = new Set(characters[arc.characterId]?.completedEncounterIds ?? []);
      if (!arc.repeatable && completed.has(encounter.id)) return false;
      return arc.requiredEncounterIds.every((id) => completed.has(id));
    })
    .map((encounter) => encounter.id);
}

/** 同一待处理 UID 的日常展示可复现；关系阶段只追加文本，不参与抽取。 */
export function encounterPresentation(
  definition: EncounterDefinition,
  state: EncounterState,
  saveSeed: number,
  pendingUid: string,
): EncounterPresentation {
  const variants = definition.dailyVariants;
  if (!definition.storyArc?.repeatable || !variants || variants.length === 0) {
    return {
      title: definition.title,
      story: definition.story,
      dialogue: [...(definition.dialogue ?? [])],
    };
  }
  const variantSeed = encounterRewardSeed(saveSeed, pendingUid, `daily:${definition.id}`);
  const variant = variants[variantSeed % variants.length]!;
  const stage = relationshipStage(state.characters[definition.storyArc.characterId]?.bond ?? 0);
  return {
    title: variant.title,
    story: variant.story,
    dialogue: [...(variant.relationshipDialogue[stage] ?? []), ...variant.dialogue],
    variantId: variant.id,
  };
}

/** UI 与最终结算共用同一章节档位，避免显示和扣除分叉。 */
export function encounterChoicesForChapters(
  definition: EncounterDefinition,
  unlockedChapterIds: ReadonlySet<string>,
): [EncounterChoice, EncounterChoice] {
  let support = definition.choices[0];
  for (const tier of definition.supportTiers ?? []) {
    if (unlockedChapterIds.has(tier.unlockChapterId)) support = tier.choice;
  }
  return [cloneChoice(support), cloneChoice(definition.choices[1])];
}

/** 从既有完成记录和 pending 派生已遇见角色，不泄露未解锁篇章。 */
export function encounterJournalCharacters(
  definitions: readonly EncounterDefinition[],
  state: EncounterState,
): EncounterJournalCharacter[] {
  const storyDefinitions = definitions.filter(
    (definition) => definition.storyArc && !definition.storyArc.repeatable,
  );
  const pendingCharacterIds = new Set(
    state.pending.flatMap((entry) => {
      const arc = definitions.find((definition) => definition.id === entry.encounterId)?.storyArc;
      return arc ? [arc.characterId] : [];
    }),
  );
  const characterIds = new Set(
    storyDefinitions.map((definition) => definition.storyArc!.characterId),
  );
  return [...characterIds].flatMap((characterId) => {
    const definitionsForCharacter = storyDefinitions
      .filter((definition) => definition.storyArc!.characterId === characterId)
      .sort((left, right) => left.storyArc!.episode - right.storyArc!.episode);
    const progress = state.characters[characterId];
    const hasPendingStory = pendingCharacterIds.has(characterId);
    const completed = new Set(progress?.completedEncounterIds ?? []);
    if (completed.size === 0 && !hasPendingStory) return [];
    const first = definitionsForCharacter[0]!;
    return [
      {
        characterId,
        characterName: first.storyArc!.characterName,
        glyph: first.glyph ?? '✦',
        relationship: relationshipStage(progress?.bond ?? 0),
        completedEpisodes: definitionsForCharacter.flatMap((definition) => {
          if (!completed.has(definition.id)) return [];
          const choiceId = progress?.choiceHistory[definition.id];
          const answerLabel =
            definition.storyArc!.storyChoices.find((choice) => choice.id === choiceId)?.label ??
            '那时的回答已随风模糊';
          return [
            {
              encounterId: definition.id,
              title: definition.title,
              episodeLabel: definition.storyArc!.episodeLabel,
              answerLabel,
            },
          ];
        }),
        hasPendingStory,
      },
    ];
  });
}

/** 手札回顾只重建文本，不接触资源、队列或随机状态。 */
export function replayDialogueForEncounter(
  definition: EncounterDefinition,
  state: EncounterState,
): EncounterLine[] {
  const arc = definition.storyArc;
  if (!arc || arc.repeatable) return [];
  const progress = state.characters[arc.characterId];
  if (!progress?.completedEncounterIds.includes(definition.id)) return [];
  const storyChoice = arc.storyChoices.find(
    (choice) => choice.id === progress.choiceHistory[definition.id],
  );
  return [
    ...memoryDialogueForEncounter(definition, state),
    ...(definition.dialogue ?? []),
    ...(storyChoice?.responseDialogue ?? []),
  ];
}
export function memoryDialogueForEncounter(
  definition: EncounterDefinition,
  state: EncounterState,
): EncounterLine[] {
  const arc = definition.storyArc;
  if (!arc) return [];
  const history = state.characters[arc.characterId]?.choiceHistory ?? {};
  return (arc.memoryCallbacks ?? [])
    .filter((callback) => history[callback.fromEncounterId] === callback.choiceId)
    .flatMap((callback) => callback.dialogue);
}

export function rememberEncounterStoryChoice(
  state: EncounterState,
  uid: string,
  definition: EncounterDefinition,
  choiceId: string,
): RememberStoryChoiceResult {
  const index = state.pending.findIndex((entry) => entry.uid === uid);
  if (index < 0 || state.pending[index]?.encounterId !== definition.id) {
    return { ok: false, reason: 'not-found' };
  }
  const arc = definition.storyArc;
  if (!arc) return { ok: false, reason: 'not-story' };
  if (!arc.storyChoices.some((choice) => choice.id === choiceId)) {
    return { ok: false, reason: 'invalid-choice' };
  }
  if (state.pending[index]?.storyChoiceId) return { ok: false, reason: 'already-chosen' };
  const next = cloneState(state);
  next.pending[index] = { ...next.pending[index]!, storyChoiceId: choiceId };
  return { ok: true, state: next };
}

export function resolveStoryEncounter(
  state: EncounterState,
  uid: string,
  definition: EncounterDefinition,
  settlementChoice: EncounterChoice,
  wallet: ResourceWallet,
  rewardRng: Rng,
): StoryEncounterResolveResult {
  const index = state.pending.findIndex((entry) => entry.uid === uid);
  const entry = state.pending[index];
  if (index < 0 || !entry || entry.encounterId !== definition.id || !definition.storyArc) {
    return { ok: false, reason: 'not-found' };
  }
  if (!entry.storyChoiceId) return { ok: false, reason: 'story-choice-required' };
  const settlement = resolveEncounterChoice(settlementChoice, wallet, rewardRng);
  if (!settlement.ok) return settlement;

  const next = cloneState(state);
  next.pending.splice(index, 1);
  next.resolvedCount += 1;
  const arc = definition.storyArc;
  const progress = characterProgress(next, arc.characterId);
  if (!arc.repeatable && !progress.completedEncounterIds.includes(definition.id)) {
    progress.completedEncounterIds.push(definition.id);
    progress.choiceHistory[definition.id] = entry.storyChoiceId;
    progress.bond += 1;
  }
  next.characters[arc.characterId] = progress;
  return {
    ok: true,
    state: next,
    wallet: settlement.wallet,
    rewards: settlement.rewards,
    relationship: relationshipStage(progress.bond),
  };
}

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
    const pendingIds = new Set(pending.map((entry) => entry.encounterId));
    const candidates = availableEncounterIds.filter((id) => !pendingIds.has(id));
    if (candidates.length === 0) {
      progressSec = 0;
      break;
    }
    progressSec -= threshold;
    const sequence = generatedCount + 1;
    const eventRng = new Rng(saveSeed ^ Math.imul(sequence, 0x9e3779b1));
    pending.push({
      uid: `enc_${sequence}`,
      encounterId: eventRng.pick(candidates),
      regionId,
    });
    generatedCount = sequence;
  }
  if (pending.length >= timing.queueMax) progressSec = 0;
  return { ...cloneState(state), progressSec, generatedCount, pending };
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

function cloneChoice(choice: EncounterChoice): EncounterChoice {
  return {
    ...choice,
    costs: choice.costs ? { gold: choice.costs.gold, items: { ...choice.costs.items } } : undefined,
    rewardPool: choice.rewardPool?.map((variant) => ({
      weight: variant.weight,
      rewards: {
        gold: variant.rewards.gold ? { ...variant.rewards.gold } : undefined,
        items: variant.rewards.items
          ? Object.fromEntries(
              Object.entries(variant.rewards.items).map(([id, range]) => [id, { ...range }]),
            )
          : undefined,
      },
    })),
  };
}
function cloneState(state: EncounterState): EncounterState {
  return {
    ...state,
    pending: state.pending.map((entry) => ({ ...entry })),
    characters: Object.fromEntries(
      Object.entries(state.characters).map(([id, progress]) => [
        id,
        {
          bond: progress.bond,
          completedEncounterIds: [...progress.completedEncounterIds],
          choiceHistory: { ...progress.choiceHistory },
        },
      ]),
    ),
  };
}
