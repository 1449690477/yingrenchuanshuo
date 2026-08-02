import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIRST_STAGE_ID, ORDERED_STAGE_IDS, getStage } from '../stages';
import { getChapter } from '../regions';
import { CHEAT_BOARD_VISUAL, progressBoardSceneAsset } from '../boardVisuals';

describe('榜单场景映射', () => {
  it('封神榜使用真实存在的镜界裁决场景', () => {
    expect(CHEAT_BOARD_VISUAL.arenaName).toBe('镜界裁决庭');
    expect(existsSync(resolve('public', CHEAT_BOARD_VISUAL.sceneAsset))).toBe(true);
  });

  it('新号与最深进度都精确映射到所属章节战场', () => {
    expect(progressBoardSceneAsset(null)).toBe(progressBoardSceneAsset(FIRST_STAGE_ID));

    for (const stageId of [FIRST_STAGE_ID, ORDERED_STAGE_IDS.at(-1)!]) {
      const stage = getStage(stageId)!;
      const chapter = getChapter(stage.chapterId)!;
      expect(progressBoardSceneAsset(stageId)).toBe(chapter.battleAsset);
      expect(existsSync(resolve('public', chapter.battleAsset))).toBe(true);
    }
  });

  it('未知关卡不允许静默退回占位场景', () => {
    expect(() => progressBoardSceneAsset('stage_missing')).toThrow('进度关卡不存在');
  });
});
