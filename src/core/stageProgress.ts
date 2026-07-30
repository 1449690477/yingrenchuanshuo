import {
  CHAPTER_GATE_CP_RATIO,
  GATE_LEGACY_LEVEL_MARGIN,
  REGION_GATE_CP_RATIO,
  STAGE_CHALLENGE_STAMINA_COST,
  STAMINA_RECOVER_SECONDS,
} from '@/data/constants';
import { ALL_CHAPTERS } from '@/data/regions';
import { stagesOfChapter } from '@/data/stages';

// ─────────────────────── 章节/区域进入门槛（docs/56 §3.3） ───────────────────────

export interface ChapterGate {
  ok: boolean;
  /** 进入该章所需战力（expectedBuildCp 口径的推荐值 × 门槛比例） */
  requiredCp: number;
  currentCp: number;
  /** max(0, required - current)；ok 时为 0 */
  gapCp: number;
  reason: 'ok' | 'cp' | 'legacy-bypass';
}

/** 章节 id 形如 '2-4'；'x-1' 是区域首章，门槛比例更高。 */
function isRegionFirstChapter(chapterId: string): boolean {
  return chapterId.endsWith('-1');
}

/**
 * 章节进入门槛（docs/57 §1.1 对 kimi 的契约）。
 *
 * 前置的「上一章最终关已通关」由既有的顺序解锁链保证，这里只判战力。
 * 同章节内的关卡不设门槛 —— 处处设卡会把游戏变成审批流程。
 */
export function evaluateChapterGate(
  currentCp: number,
  playerLevel: number,
  chapterId: string,
): ChapterGate {
  const chapter = ALL_CHAPTERS.find((c) => c.id === chapterId);
  if (!chapter) throw new Error(`[配置错误] 章节不存在：${chapterId}`);
  const firstStage = stagesOfChapter(chapterId)[0];
  if (!firstStage) throw new Error(`[配置错误] 章节没有关卡：${chapterId}`);

  // 游戏第一章永远敞开
  if (chapterId === ALL_CHAPTERS[0]!.id) {
    return { ok: true, requiredCp: 0, currentCp, gapCp: 0, reason: 'ok' };
  }

  const ratio = isRegionFirstChapter(chapterId) ? REGION_GATE_CP_RATIO : CHAPTER_GATE_CP_RATIO;
  const requiredCp = Math.round(firstStage.recommendCP * ratio);

  // 老档后门：历史无上限时期升上去的等级，早已到过这些内容，直接放行
  if (playerLevel >= chapter.levelFrom + GATE_LEGACY_LEVEL_MARGIN) {
    return { ok: true, requiredCp, currentCp, gapCp: 0, reason: 'legacy-bypass' };
  }

  if (currentCp >= requiredCp) {
    return { ok: true, requiredCp, currentCp, gapCp: 0, reason: 'ok' };
  }
  return {
    ok: false,
    requiredCp,
    currentCp,
    gapCp: Math.max(0, requiredCp - currentCp),
    reason: 'cp',
  };
}

// ─────────────────────── 挑战体力（docs/56 §5） ───────────────────────

export interface ChallengeCost {
  ok: boolean;
  /** 本次挑战消耗；已通关关卡恒为 0 */
  cost: number;
  stamina: number;
  staminaMax: number;
  /** 不足时距下一点恢复的秒数；充足时为 0 */
  nextPointInSeconds: number;
  reason: 'ok' | 'stamina';
}

/**
 * 挑战某关的体力核算（docs/57 §1.2 对 kimi 的契约）。
 *
 * 只有「进入未通关关卡」收费；挂机已通关关卡、离线收益不碰体力。
 * 这里只算不扣 —— 扣减由 store 在 selectStage 的原子提交里做。
 */
export function evaluateChallengeCost(
  stageId: string,
  clearedStageIds: readonly string[],
  stamina: number,
  staminaMax: number,
  staminaRecoverAt: number,
  now: number,
): ChallengeCost {
  const cleared = clearedStageIds.includes(stageId);
  const cost = cleared ? 0 : STAGE_CHALLENGE_STAMINA_COST;
  if (stamina >= cost) {
    return { ok: true, cost, stamina, staminaMax, nextPointInSeconds: 0, reason: 'ok' };
  }
  // 距下一点恢复：恢复计时基准 + 周期 − 现在
  const elapsedMs = Math.max(0, now - staminaRecoverAt);
  const remainMs = STAMINA_RECOVER_SECONDS * 1000 - (elapsedMs % (STAMINA_RECOVER_SECONDS * 1000));
  return {
    ok: false,
    cost,
    stamina,
    staminaMax,
    nextPointInSeconds: Math.ceil(remainMs / 1000),
    reason: 'stamina',
  };
}

export interface StageKillProgress {
  /** 未通关时是首通进度；已通关 BOSS 关时是下一轮 BOSS 的循环进度。 */
  progress: number;
  /** 本次推进是否刚好完成首通。 */
  clearedNow: boolean;
  /** 本次推进实际完成了多少轮 BOSS。 */
  bossKills: number;
}

/**
 * 推进关卡击杀数，并把 BOSS 关转换为可重复的完整波次循环。
 *
 * 波次循环长度（cycleLength）与首通目标解耦（docs/56 §8）：
 * 首通目标 = cycleLength × clearCycles。未通关阶段波次照常循环 ——
 * BOSS/精英按原节奏出场掉落，每小时经济与通关前后完全一致；
 * 变的只有「要打满多少轮才算通」。
 *
 * 普通关通关后保持一轮满进度；BOSS 关通关后保存 0..cycleLength-1 的
 * 循环余数，因此刷新页面或离线结算后仍能从正确位置继续。
 */
export function advanceStageKillProgress(
  currentKills: number,
  addedKills: number,
  cycleLength: number,
  clearCycles: number,
  alreadyCleared: boolean,
  hasBoss: boolean,
): StageKillProgress {
  if (!Number.isInteger(currentKills) || currentKills < 0) {
    throw new Error(`[关卡进度错误] 当前击杀数必须是非负整数：${currentKills}`);
  }
  if (!Number.isInteger(addedKills) || addedKills < 0) {
    throw new Error(`[关卡进度错误] 新增击杀数必须是非负整数：${addedKills}`);
  }
  if (!Number.isInteger(cycleLength) || cycleLength <= 0) {
    throw new Error(`[关卡进度错误] 波次循环长度必须是正整数：${cycleLength}`);
  }
  if (!Number.isInteger(clearCycles) || clearCycles <= 0) {
    throw new Error(`[关卡进度错误] 通关循环数必须是正整数：${clearCycles}`);
  }
  const clearTarget = cycleLength * clearCycles;
  if (!alreadyCleared && currentKills >= clearTarget) {
    throw new Error(`[关卡进度错误] 未通关关卡的击杀数越界：${currentKills}/${clearTarget}`);
  }

  if (alreadyCleared) {
    if (!hasBoss) return { progress: cycleLength, clearedNow: false, bossKills: 0 };

    // 旧版存档会把已通关关卡保存为满值；取模可无损转换为新循环起点。
    const total = (currentKills % cycleLength) + addedKills;
    return {
      progress: total % cycleLength,
      clearedNow: false,
      bossKills: Math.floor(total / cycleLength),
    };
  }

  const total = currentKills + addedKills;
  // 未通关阶段 BOSS 也随波次循环出场：跨过几个循环边界就打了几只
  const bossKills = hasBoss
    ? Math.floor(total / cycleLength) - Math.floor(currentKills / cycleLength)
    : 0;

  if (total < clearTarget) {
    return { progress: total, clearedNow: false, bossKills };
  }

  if (!hasBoss) {
    return { progress: cycleLength, clearedNow: true, bossKills: 0 };
  }

  return {
    progress: total % cycleLength,
    clearedNow: true,
    bossKills,
  };
}
