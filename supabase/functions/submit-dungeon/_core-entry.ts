/**
 * submit-dungeon Edge Function 的共享 core 打包入口。
 *
 * 见 submit-trial/_core-entry.ts 的说明：本文件是 esbuild 入口，
 * `npm run edge:build` 把它打成自包含的 _core.ts 供 Deno import。
 *
 * **为什么合理性判定必须走这条管线而不是在 index.ts 里重写一遍**：
 * 秘境榜的白名单是从 EQUIPMENT_DUNGEON_TIERS 的 comingSoon 推导出来的 ——
 * codex 在区域 7 解封绯樱档时，只会去改数据，不会来改 Edge Function。
 * 服务端若另抄一份白名单，解封当天玩家能打、服务端却拒收，
 * 而且没有任何人会想到去看这里。
 */

export {
  isPlausibleDungeonClaim,
  meetsDungeonDepthChain,
  mergeDungeonRecord,
  isBoardableDungeon,
  dungeonBoardEntry,
  BOARDABLE_DUNGEON_IDS,
  type DungeonClearClaim,
  type DungeonRecordRow,
} from '../../../src/core/dungeonBoard';
