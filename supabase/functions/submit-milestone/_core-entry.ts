/**
 * submit-milestone Edge Function 的共享 core 打包入口。
 *
 * 见 submit-trial/_core-entry.ts 的说明：本文件是 esbuild 入口，
 * `npm run edge:build` 把它打成自包含的 _core.ts 供 Deno import。
 *
 * **为什么合理性判定必须走这条管线而不是在 index.ts 里重写一遍**：
 * 今天刚在邻域榜查出「同一份口径两处实现，只有一处正确」的 bug
 * （客户端 if (filter.classId) 处理对了、SQL 裸等号处理错了，
 * 导致整个默认视图永久为空，详见 docs/61 §2.2）。
 * 里程碑的下界表若在服务端另抄一份，早晚会漂移成同一类事故。
 */

export {
  isPlausibleMilestone,
  milestoneElapsedMs,
  type MilestoneClaim,
} from '../../../src/core/milestones';

export { MILESTONE_LEVELS, isMilestoneLevel } from '../../../src/data/milestoneRules';
