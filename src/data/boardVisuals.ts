/**
 * 排行页场景映射。
 *
 * 榜单只负责展示已经存在的世界内容，不复制一套“榜单专用假场景”：
 * 开荒榜跟随玩家最深关卡，封神榜复用服务端试炼判定所在的镜界场。
 */
import { getChapter } from './regions';
import { FIRST_STAGE_ID, getStage } from './stages';

export const CHEAT_BOARD_VISUAL = Object.freeze({
  sceneAsset: 'assets/trial/trial-arena.webp',
  arenaName: '镜界裁决庭',
  ruleLabel: '四重物理上限复核',
});

/** 没有首通记录时展示第一关；有记录时必须精确解析该关，配置错就直接报错。 */
export function progressBoardSceneAsset(stageId: string | null): string {
  const resolvedStageId = stageId ?? FIRST_STAGE_ID;
  const stage = getStage(resolvedStageId);
  if (!stage) throw new Error(`[榜单表现] 进度关卡不存在：${resolvedStageId}`);
  const chapter = getChapter(stage.chapterId);
  if (!chapter) throw new Error(`[榜单表现] 进度章节不存在：${stage.chapterId}`);
  return chapter.battleAsset;
}
