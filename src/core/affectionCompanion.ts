/**
 * 好感陪伴内容的纯逻辑。
 *
 * R2 的幕间闲聊、来信与回忆画廊都不发数值奖励，也不消耗每日互动次数。
 * 这里仅负责「当前该显示哪一组内容」和「玩家真实选择对应哪封信」；
 * 文本、图片与角色配置仍全部留在 data 层。
 */

export interface AffectionCompanionProgress {
  points: number;
  totalInteractions: number;
  completedStoryIds: readonly string[];
  choiceHistory: Readonly<Record<string, string>>;
}

export interface AffectionInterludeSpec {
  id: string;
  minPoints: number;
}

export interface AffectionLetterVariantSpec {
  choiceId: string;
}

export interface AffectionLetterSpec<
  TVariant extends AffectionLetterVariantSpec = AffectionLetterVariantSpec,
> {
  id: string;
  requiredStoryId: string;
  variants: readonly TVariant[];
}

/**
 * 只取当前最高已解锁心意阶段的闲聊池。
 *
 * 这样初见台词不会在誓约后突然冒出来；配置缺少 0 点池时直接报错，
 * 不用低阶段内容静默兜底，避免数据错误被掩盖。
 */
export function currentAffectionInterludePool<T extends AffectionInterludeSpec>(
  entries: readonly T[],
  points: number,
): readonly T[] {
  if (!Number.isFinite(points) || points < 0) {
    throw new Error(`[好感陪伴] points 必须是非负有限数，收到 ${points}`);
  }
  const unlocked = entries.filter((entry) => entry.minPoints <= points);
  if (unlocked.length === 0) {
    throw new Error('[好感陪伴] 当前角色缺少可用的幕间闲聊配置');
  }
  const highestMinPoints = Math.max(...unlocked.map((entry) => entry.minPoints));
  return unlocked.filter((entry) => entry.minPoints === highestMinPoints);
}

/**
 * 可复现地轮换闲聊。
 *
 * baseIndex 由已有存档事实（总互动数 + 已完成剧情数）决定，cursor 仅存在
 * 于本次弹窗会话。重开同一存档会回到同一句，连续点击则完整轮播当前池，
 * 不引入 Math.random()，也不污染战斗/掉落 RNG。
 */
export function selectAffectionInterlude<T extends AffectionInterludeSpec>(
  entries: readonly T[],
  progress: AffectionCompanionProgress,
  cursor: number,
): T {
  if (!Number.isInteger(cursor) || cursor < 0) {
    throw new Error(`[好感陪伴] cursor 必须是非负整数，收到 ${cursor}`);
  }
  const pool = currentAffectionInterludePool(entries, progress.points);
  const baseIndex = (progress.totalInteractions + progress.completedStoryIds.length) % pool.length;
  return pool[(baseIndex + cursor) % pool.length]!;
}

export function unlockedAffectionLetters<T extends AffectionLetterSpec>(
  entries: readonly T[],
  completedStoryIds: readonly string[],
): readonly T[] {
  const completed = new Set(completedStoryIds);
  return entries.filter((entry) => completed.has(entry.requiredStoryId));
}

/**
 * 按玩家当时真正选择的选项解析来信。
 *
 * 已完成剧情却没有选择历史、或数据表漏掉对应分支都属于存档/配置损坏，
 * 必须显式报错；不能偷偷展示一封通用信冒充玩家选择得到了回应。
 */
export function resolveAffectionLetterVariant<T extends AffectionLetterVariantSpec>(
  letter: AffectionLetterSpec<T>,
  progress: AffectionCompanionProgress,
): T | null {
  if (!progress.completedStoryIds.includes(letter.requiredStoryId)) return null;
  const selectedChoiceId = progress.choiceHistory[letter.requiredStoryId];
  if (!selectedChoiceId) {
    throw new Error(`[好感陪伴] 已完成 ${letter.requiredStoryId}，但存档缺少对应选择历史`);
  }
  const variant = letter.variants.find((entry) => entry.choiceId === selectedChoiceId);
  if (!variant) {
    throw new Error(`[好感陪伴] 来信 ${letter.id} 缺少选项 ${selectedChoiceId} 的回应文本`);
  }
  return variant;
}

export function isAffectionMemoryUnlocked(
  storyId: string,
  completedStoryIds: readonly string[],
): boolean {
  return completedStoryIds.includes(storyId);
}
