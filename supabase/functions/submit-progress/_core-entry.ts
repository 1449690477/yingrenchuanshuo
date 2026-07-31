/**
 * submit-progress Edge Function 的共享 core 打包入口。
 *
 * 见 submit-milestone/_core-entry.ts 的说明：防线判定必须与客户端
 * 跑同一份 src/core 实现（docs/61 §2.2：同一份口径不许两处实现），
 * `npm run edge:build` 把入口打成自包含的 _core.ts 供 Deno import，
 * 并带确定性自检（打包产物与源实现的判定逐点一致）。
 */

export {
  PROGRESS_CLAIM_CLOCK_SKEW_MS,
  PROGRESS_CLAIM_MIN_AT,
  deepestProgressClaim,
  evaluateProgressClaim,
  isProgressClaimWellFormed,
  progressRowBeatsRow,
  progressStageIndex,
  progressStageLabel,
  type ProgressClaim,
  type ProgressGateProfile,
  type ProgressSortKey,
} from '../../../src/core/progressBoard';
