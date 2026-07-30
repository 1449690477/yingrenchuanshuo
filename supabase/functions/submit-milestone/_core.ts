// ═══════════════════════════════════════════════════
// 生成文件，请勿手改。来源：src/core（见 _core-entry.ts）
// 重新生成：npm run edge:build
// ═══════════════════════════════════════════════════

// src/data/milestoneRules.ts
var MILESTONE_LEVELS = [20, 40, 60];
var HOUR_MS = 36e5;
var MILESTONE_MIN_ELAPSED_MS = {
  20: 4 * HOUR_MS,
  40: 36 * HOUR_MS,
  60: 100 * HOUR_MS
};
function isMilestoneLevel(level) {
  return MILESTONE_LEVELS.includes(level);
}

// src/core/milestones.ts
function milestoneElapsedMs(createdAt, reachedAt) {
  return Math.max(1, Math.round(reachedAt - createdAt));
}
function isPlausibleMilestone(claim) {
  if (!isMilestoneLevel(claim.level)) return false;
  if (!Number.isFinite(claim.elapsedMs) || claim.elapsedMs <= 0) return false;
  return claim.elapsedMs >= MILESTONE_MIN_ELAPSED_MS[claim.level];
}
export {
  MILESTONE_LEVELS,
  isMilestoneLevel,
  isPlausibleMilestone,
  milestoneElapsedMs
};
