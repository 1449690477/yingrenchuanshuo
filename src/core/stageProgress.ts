import {
  CHAPTER_GATE_CP_RATIO,
  GATE_LEGACY_LEVEL_MARGIN,
  REGION_GATE_CP_RATIO,
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
 * 普通关通关后保持满进度；BOSS 关通关后保存 0..target-1 的循环余数，
 * 因此刷新页面或离线结算后仍能从正确位置继续，而不是把 BOSS 掉落表
 * 错误地应用到最终关卡的每一只普通怪。
 */
export function advanceStageKillProgress(
  currentKills: number,
  addedKills: number,
  target: number,
  alreadyCleared: boolean,
  hasBoss: boolean,
): StageKillProgress {
  if (!Number.isInteger(currentKills) || currentKills < 0) {
    throw new Error(`[关卡进度错误] 当前击杀数必须是非负整数：${currentKills}`);
  }
  if (!Number.isInteger(addedKills) || addedKills < 0) {
    throw new Error(`[关卡进度错误] 新增击杀数必须是非负整数：${addedKills}`);
  }
  if (!Number.isInteger(target) || target <= 0) {
    throw new Error(`[关卡进度错误] 击杀目标必须是正整数：${target}`);
  }
  if (!alreadyCleared && currentKills >= target) {
    throw new Error(`[关卡进度错误] 未通关关卡的击杀数越界：${currentKills}/${target}`);
  }

  if (alreadyCleared) {
    if (!hasBoss) return { progress: target, clearedNow: false, bossKills: 0 };

    // 旧版存档会把已通关关卡保存为 target；取模可无损转换为新循环起点。
    const total = (currentKills % target) + addedKills;
    return {
      progress: total % target,
      clearedNow: false,
      bossKills: Math.floor(total / target),
    };
  }

  const total = currentKills + addedKills;
  if (total < target) {
    return { progress: total, clearedNow: false, bossKills: 0 };
  }

  if (!hasBoss) {
    return { progress: target, clearedNow: true, bossKills: 0 };
  }

  const overflow = total - target;
  return {
    progress: overflow % target,
    clearedNow: true,
    bossKills: 1 + Math.floor(overflow / target),
  };
}
