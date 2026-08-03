/**
 * 成就定义（M4-7，docs/14 成就系统）。
 *
 * 内容与代码分离（铁律 2）：本文件只描述成就是什么（名称/类别/统计口径/目标），
 * 不包含判定逻辑。全部 80 条成就统一用「统计值达到目标」模型，
 * 判定在 core/achievements.ts（纯函数）。
 *
 * 统计口径（数值线 2026-08-03 裁定）：
 * - 派生类：totalKills / bossKillKinds / bossKills / level / cp / gold /
 *   equipmentCodexCount / monsterCodexCount / epicCount / legendaryCount /
 *   totalCodexCount / clearedChapterCount / clearedStageCount（零新存档字段）。
 * - 计数类：enhanceCount / reforgeCount / sweepCount / affectionCount /
 *   arenaCount（stats 扩展，v27 迁移，只增不减）。
 * - 奖励：每解锁 20 条 +0.5% 战斗乘区，80 条封顶 +2.0%（仅本地 PvE，不进 CP）。
 */
import type { AchievementCategory, AchievementStat } from '@/core/achievements';

export interface AchievementDef {
  id: string;
  category: AchievementCategory;
  label: string;
  description: string;
  stat: AchievementStat;
  target: number;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // ── 击杀（16）──────────────────────────────────────────────
  { id: 'kill_1k', category: 'battle', label: '初出茅庐', description: '累计击杀 1,000 只怪物', stat: 'totalKills', target: 1000 },
  { id: 'kill_5k', category: 'battle', label: '百战之躯', description: '累计击杀 5,000 只怪物', stat: 'totalKills', target: 5000 },
  { id: 'kill_10k', category: 'battle', label: '万敌斩', description: '累计击杀 10,000 只怪物', stat: 'totalKills', target: 10000 },
  { id: 'kill_50k', category: 'battle', label: '修罗之路', description: '累计击杀 50,000 只怪物', stat: 'totalKills', target: 50000 },
  { id: 'kill_100k', category: 'battle', label: '十万屠', description: '累计击杀 100,000 只怪物', stat: 'totalKills', target: 100000 },
  { id: 'kill_500k', category: 'battle', label: '杀神', description: '累计击杀 500,000 只怪物', stat: 'totalKills', target: 500000 },
  { id: 'boss_kind_1', category: 'battle', label: '初遇强敌', description: '击败过 1 种 BOSS', stat: 'bossKillKinds', target: 1 },
  { id: 'boss_kind_3', category: 'battle', label: '弑君者', description: '击败过 3 种 BOSS', stat: 'bossKillKinds', target: 3 },
  { id: 'boss_kind_5', category: 'battle', label: '王座之敌', description: '击败过 5 种 BOSS', stat: 'bossKillKinds', target: 5 },
  { id: 'boss_kind_7', category: 'battle', label: '灭世者', description: '击败过 7 种 BOSS', stat: 'bossKillKinds', target: 7 },
  { id: 'boss_kind_10', category: 'battle', label: '诸神黄昏', description: '击败过 10 种 BOSS', stat: 'bossKillKinds', target: 10 },
  { id: 'boss_kind_15', category: 'battle', label: '万王之王', description: '击败过 15 种 BOSS', stat: 'bossKillKinds', target: 15 },
  { id: 'boss_total_10', category: 'battle', label: '初试锋芒', description: '累计击败 BOSS 10 次', stat: 'bossKills', target: 10 },
  { id: 'boss_total_50', category: 'battle', label: '屠龙者', description: '累计击败 BOSS 50 次', stat: 'bossKills', target: 50 },
  { id: 'boss_total_200', category: 'battle', label: '深渊猎手', description: '累计击败 BOSS 200 次', stat: 'bossKills', target: 200 },
  { id: 'boss_total_1000', category: 'battle', label: '神之敌', description: '累计击败 BOSS 1,000 次', stat: 'bossKills', target: 1000 },

  // ── 成长（16）──────────────────────────────────────────────
  { id: 'level_10', category: 'growth', label: '十级新人', description: '角色达到 10 级', stat: 'level', target: 10 },
  { id: 'level_20', category: 'growth', label: '小有所成', description: '角色达到 20 级', stat: 'level', target: 20 },
  { id: 'level_30', category: 'growth', label: '渐入佳境', description: '角色达到 30 级', stat: 'level', target: 30 },
  { id: 'level_40', category: 'growth', label: '一方高手', description: '角色达到 40 级', stat: 'level', target: 40 },
  { id: 'level_50', category: 'growth', label: '名动一方', description: '角色达到 50 级', stat: 'level', target: 50 },
  { id: 'level_60', category: 'growth', label: '绝世强者', description: '角色达到 60 级', stat: 'level', target: 60 },
  { id: 'level_70', category: 'growth', label: '问鼎巅峰', description: '角色达到 70 级', stat: 'level', target: 70 },
  { id: 'level_80', category: 'growth', label: '传说降临', description: '角色达到 80 级', stat: 'level', target: 80 },
  { id: 'cp_5k', category: 'growth', label: '战力萌芽', description: '战力达到 5,000', stat: 'cp', target: 5000 },
  { id: 'cp_10k', category: 'growth', label: '战力小成', description: '战力达到 10,000', stat: 'cp', target: 10000 },
  { id: 'cp_50k', category: 'growth', label: '战力精进', description: '战力达到 50,000', stat: 'cp', target: 50000 },
  { id: 'cp_100k', category: 'growth', label: '十方无敌', description: '战力达到 100,000', stat: 'cp', target: 100000 },
  { id: 'cp_200k', category: 'growth', label: '裂地之威', description: '战力达到 200,000', stat: 'cp', target: 200000 },
  { id: 'cp_500k', category: 'growth', label: '撼天之力', description: '战力达到 500,000', stat: 'cp', target: 500000 },
  { id: 'cp_1m', category: 'growth', label: '百万战力', description: '战力达到 1,000,000', stat: 'cp', target: 1000000 },
  { id: 'gold_1m', category: 'growth', label: '家财万贯', description: '持有金币达到 1,000,000', stat: 'gold', target: 1000000 },

  // ── 收集（20）──────────────────────────────────────────────
  { id: 'codex_eq_10', category: 'collect', label: '收藏起步', description: '装备图鉴收录 10 件', stat: 'equipmentCodexCount', target: 10 },
  { id: 'codex_eq_25', category: 'collect', label: '收藏爱好者', description: '装备图鉴收录 25 件', stat: 'equipmentCodexCount', target: 25 },
  { id: 'codex_eq_50', category: 'collect', label: '装备鉴赏家', description: '装备图鉴收录 50 件', stat: 'equipmentCodexCount', target: 50 },
  { id: 'codex_eq_100', category: 'collect', label: '百件收藏', description: '装备图鉴收录 100 件', stat: 'equipmentCodexCount', target: 100 },
  { id: 'codex_eq_200', category: 'collect', label: '典藏大师', description: '装备图鉴收录 200 件', stat: 'equipmentCodexCount', target: 200 },
  { id: 'codex_eq_300', category: 'collect', label: '全装备图鉴', description: '装备图鉴收录 300 件', stat: 'equipmentCodexCount', target: 300 },
  { id: 'codex_mon_10', category: 'collect', label: '怪物图鉴起步', description: '怪物图鉴收录 10 种', stat: 'monsterCodexCount', target: 10 },
  { id: 'codex_mon_20', category: 'collect', label: '怪物图鉴入门', description: '怪物图鉴收录 20 种', stat: 'monsterCodexCount', target: 20 },
  { id: 'codex_mon_40', category: 'collect', label: '图鉴猎人', description: '怪物图鉴收录 40 种', stat: 'monsterCodexCount', target: 40 },
  { id: 'codex_mon_60', category: 'collect', label: '图鉴专家', description: '怪物图鉴收录 60 种', stat: 'monsterCodexCount', target: 60 },
  { id: 'codex_mon_80', category: 'collect', label: '图鉴大师', description: '怪物图鉴收录 80 种', stat: 'monsterCodexCount', target: 80 },
  { id: 'codex_mon_100', category: 'collect', label: '全怪物图鉴', description: '怪物图鉴收录 100 种', stat: 'monsterCodexCount', target: 100 },
  { id: 'epic_10', category: 'collect', label: '史诗收藏家', description: '装备图鉴收录 10 件史诗装备', stat: 'epicCount', target: 10 },
  { id: 'epic_30', category: 'collect', label: '史诗大师', description: '装备图鉴收录 30 件史诗装备', stat: 'epicCount', target: 30 },
  { id: 'legendary_5', category: 'collect', label: '传说初拥', description: '装备图鉴收录 5 件传说装备', stat: 'legendaryCount', target: 5 },
  { id: 'legendary_15', category: 'collect', label: '传说收集者', description: '装备图鉴收录 15 件传说装备', stat: 'legendaryCount', target: 15 },
  { id: 'legendary_30', category: 'collect', label: '传说宝库', description: '装备图鉴收录 30 件传说装备', stat: 'legendaryCount', target: 30 },
  { id: 'codex_total_50', category: 'collect', label: '图鉴初成', description: '装备与怪物图鉴合计收录 50 项', stat: 'totalCodexCount', target: 50 },
  { id: 'codex_total_200', category: 'collect', label: '图鉴大成', description: '装备与怪物图鉴合计收录 200 项', stat: 'totalCodexCount', target: 200 },
  { id: 'codex_total_500', category: 'collect', label: '图鉴之神', description: '装备与怪物图鉴合计收录 500 项', stat: 'totalCodexCount', target: 500 },

  // ── 探索（12）──────────────────────────────────────────────
  { id: 'chapter_2', category: 'explore', label: '翻越山丘', description: '通关 2 个章节', stat: 'clearedChapterCount', target: 2 },
  { id: 'chapter_3', category: 'explore', label: '深入幽谷', description: '通关 3 个章节', stat: 'clearedChapterCount', target: 3 },
  { id: 'chapter_4', category: 'explore', label: '穿越密林', description: '通关 4 个章节', stat: 'clearedChapterCount', target: 4 },
  { id: 'chapter_5', category: 'explore', label: '踏足秘境', description: '通关 5 个章节', stat: 'clearedChapterCount', target: 5 },
  { id: 'chapter_6', category: 'explore', label: '深入腹地', description: '通关 6 个章节', stat: 'clearedChapterCount', target: 6 },
  { id: 'chapter_7', category: 'explore', label: '走遍大陆', description: '通关 7 个章节', stat: 'clearedChapterCount', target: 7 },
  { id: 'stage_30', category: 'explore', label: '三十连捷', description: '通关 30 个关卡', stat: 'clearedStageCount', target: 30 },
  { id: 'stage_60', category: 'explore', label: '六十征程', description: '通关 60 个关卡', stat: 'clearedStageCount', target: 60 },
  { id: 'stage_90', category: 'explore', label: '九十难关', description: '通关 90 个关卡', stat: 'clearedStageCount', target: 90 },
  { id: 'stage_120', category: 'explore', label: '百二雄关', description: '通关 120 个关卡', stat: 'clearedStageCount', target: 120 },
  { id: 'stage_150', category: 'explore', label: '百五险途', description: '通关 150 个关卡', stat: 'clearedStageCount', target: 150 },
  { id: 'stage_180', category: 'explore', label: '百八征途', description: '通关 180 个关卡', stat: 'clearedStageCount', target: 180 },

  // ── 养成（16，计数类依赖 v27 stats 字段）──────────────────
  { id: 'enhance_10', category: 'cultivate', label: '锻造学徒', description: '累计强化装备 10 次', stat: 'enhanceCount', target: 10 },
  { id: 'enhance_50', category: 'cultivate', label: '锻造工匠', description: '累计强化装备 50 次', stat: 'enhanceCount', target: 50 },
  { id: 'enhance_200', category: 'cultivate', label: '锻造大师', description: '累计强化装备 200 次', stat: 'enhanceCount', target: 200 },
  { id: 'enhance_500', category: 'cultivate', label: '神匠', description: '累计强化装备 500 次', stat: 'enhanceCount', target: 500 },
  { id: 'enhance_1000', category: 'cultivate', label: '锻神', description: '累计强化装备 1,000 次', stat: 'enhanceCount', target: 1000 },
  { id: 'reforge_10', category: 'cultivate', label: '洗练学徒', description: '累计洗练词条 10 次', stat: 'reforgeCount', target: 10 },
  { id: 'reforge_50', category: 'cultivate', label: '洗练工匠', description: '累计洗练词条 50 次', stat: 'reforgeCount', target: 50 },
  { id: 'reforge_200', category: 'cultivate', label: '洗练大师', description: '累计洗练词条 200 次', stat: 'reforgeCount', target: 200 },
  { id: 'reforge_500', category: 'cultivate', label: '词条之神', description: '累计洗练词条 500 次', stat: 'reforgeCount', target: 500 },
  { id: 'sweep_50', category: 'cultivate', label: '扫荡达人', description: '累计扫荡 50 次', stat: 'sweepCount', target: 50 },
  { id: 'sweep_200', category: 'cultivate', label: '扫荡狂人', description: '累计扫荡 200 次', stat: 'sweepCount', target: 200 },
  { id: 'sweep_1000', category: 'cultivate', label: '扫荡之神', description: '累计扫荡 1,000 次', stat: 'sweepCount', target: 1000 },
  { id: 'affection_10', category: 'cultivate', label: '初见倾心', description: '累计好感互动 10 次', stat: 'affectionCount', target: 10 },
  { id: 'affection_50', category: 'cultivate', label: '日久生情', description: '累计好感互动 50 次', stat: 'affectionCount', target: 50 },
  { id: 'affection_200', category: 'cultivate', label: '心有灵犀', description: '累计好感互动 200 次', stat: 'affectionCount', target: 200 },
  { id: 'arena_10', category: 'cultivate', label: '竞技初战', description: '累计竞技场挑战 10 次', stat: 'arenaCount', target: 10 },
];
