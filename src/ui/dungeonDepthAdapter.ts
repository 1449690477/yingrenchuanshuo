/**
 * 深度 UI 的本地数据源 stub（docs/66 §八 第 6 步）。
 *
 * ⚠ **接线批次删我**：claude-drops 把存档切成深度进度、game store 接上
 *   `game.equipmentDungeonDepth` / `game.evaluateDungeonDepth` /
 *   `game.runEquipmentDungeonDepth` 之后，DungeonView 改为直连 game store，
 *   本文件整体删除。契约签名以 22:04 频道交付承诺为准，签名变更会在频道 @。
 *
 * stub 的三条假设与 docs/66 §五 迁移规则逐条对齐，保证接线前后玩家看到的
 * UI 不跳变（claude-drops 已在频道逐条核过）：
 *   1. progress 从现有 records 推导 —— 该档任一部位有首通记录 ⇒ 视为 d1 已过，
 *      否则 0；**绝不伪造更高深度**（§五 迁移规则的同一条）
 *   2. evaluate 直连 core/equipmentDungeonDepth.ts（cf828ab 已落地），
 *      contentTopLevel 用与 arenaEquipment 同一条 ALL_CHAPTERS levelTo 公式（同源）
 *   3. run 不开放 —— 挑战按钮文案「深度挑战随接线批次开放」
 */

import {
  evaluateDungeonDepth,
  type DepthEvaluation,
  type EquipmentDungeonDepthProgress,
} from '@/core/equipmentDungeonDepth';
import type { EquipmentDungeonState } from '@/core/equipmentDungeon';
import { SLOT_ORDER } from '@/data/constants';
import { equipmentDungeonStagesForSlot } from '@/data/equipmentDungeons';
import type { EquipmentDungeonTierId } from '@/data/equipmentDungeonGear';
import { ALL_CHAPTERS } from '@/data/regions';

/**
 * 内容顶等级：与 arenaEquipment.ts 的 MAX_CONTENT_LEVEL 同一条公式。
 * 同源，勿另造口径 —— 区域 8 抬高内容顶那天两边自动一起抬。
 */
export function dungeonDepthContentTopLevel(): number {
  return Math.max(...ALL_CHAPTERS.map((chapter) => chapter.levelTo));
}

/**
 * 从现有存档推导深度进度（stub）。
 *
 * docs/66 §五 迁移规则：该档有任意部位首通记录 ⇒ depth[tier] = 1，否则 0。
 * 绝不伪造更高深度 —— 哪怕玩家把 4 档 32 座全首通了，每档也只记 1。
 */
export function dungeonDepthProgressStub(
  state: EquipmentDungeonState | null,
): EquipmentDungeonDepthProgress {
  if (!state) return {};
  const progress: Partial<Record<EquipmentDungeonTierId, number>> = {};
  for (const slot of SLOT_ORDER) {
    for (const stage of equipmentDungeonStagesForSlot(slot)) {
      if (state.records[stage.id] !== undefined && (progress[stage.tierId] ?? 0) < 1) {
        progress[stage.tierId] = 1;
      }
    }
  }
  return progress;
}

/**
 * evaluate 直连已落地的 core 纯函数，仅注入 contentTopLevel。
 * 其余入参与将来的 `game.evaluateDungeonDepth(tierId, depth)` 口径一致。
 */
export function evaluateDungeonDepthStub(input: {
  progress: EquipmentDungeonDepthProgress;
  tierId: EquipmentDungeonTierId;
  depth: number;
  playerLevel: number;
  attemptsRemaining: number;
}): DepthEvaluation {
  return evaluateDungeonDepth({
    progress: input.progress,
    tierId: input.tierId,
    depth: input.depth,
    playerLevel: input.playerLevel,
    contentTopLevel: dungeonDepthContentTopLevel(),
    attemptsRemaining: input.attemptsRemaining,
  });
}

/**
 * stub 期不开放深度挑战。接线批次由 `game.runEquipmentDungeonDepth(slot, tierId, depth)`
 * 替代；在此之前挑战按钮显示「深度挑战随接线批次开放」并保持禁用。
 */
export function runEquipmentDungeonDepthStub(): { ok: false; reason: 'not-wired' } {
  return { ok: false, reason: 'not-wired' };
}
