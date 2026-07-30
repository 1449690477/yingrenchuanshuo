/**
 * submit-affection Edge Function 的共享 core 打包入口。
 *
 * 见 submit-milestone/_core-entry.ts 的说明：合理性判定必须与客户端
 * 跑同一份 src/core 实现（docs/63 §六.1：同一份口径不许两处实现），
 * `npm run edge:build` 把入口打成自包含的 _core.ts 供 Deno import，
 * 并带确定性自检（打包产物与源实现的判定逐点一致）。
 */

export {
  affectionTotalPoints,
  isAffectionClaimWellFormed,
  isPlausibleAffectionClaim,
  type AffectionBoardClaim,
} from '../../../src/core/affectionBoard';

export {
  AFFECTION_MAX_POINTS_PER_CHARACTER,
  AFFECTION_STORY_CAP_PER_CHARACTER,
} from '../../../src/data/affectionBoardRules';

export { CLASS_IDS, type ClassId } from '../../../src/core/types';
