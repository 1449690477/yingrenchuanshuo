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
