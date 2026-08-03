/**
 * 称号定义（M4-9，docs/14 称号系统：Lv30 解锁，成就获得，提供属性）。
 *
 * 内容与代码分离（铁律 2）：本文件只描述称号是什么（名称/描述/获得条件），
 * 不包含判定逻辑。获得条件复用成就的统计口径（AchievementStat + 目标值），
 * 判定在 core/titles.ts（纯函数）。
 *
 * 属性奖励：与成就/图鉴同口径（战斗乘区、不进 CP、仅本地 PvE），
 * 幅值待数值线确认后由接线层生效。
 */
import type { AchievementStat } from '@/core/achievements';

export interface TitleDef {
  id: string;
  name: string;
  description: string;
  stat: AchievementStat;
  target: number;
}

export const TITLES: readonly TitleDef[] = [
  // ── 击杀 ────────────────────────────────────────────────
  { id: 'slayer_10k', name: '万敌斩', description: '累计击杀 10,000 只怪物', stat: 'totalKills', target: 10000 },
  { id: 'slayer_100k', name: '杀神', description: '累计击杀 100,000 只怪物', stat: 'totalKills', target: 100000 },
  { id: 'boss_killer_3', name: '弑君者', description: '击败过 3 种 BOSS', stat: 'bossKillKinds', target: 3 },
  { id: 'boss_killer_50', name: '屠龙者', description: '累计击败 BOSS 50 次', stat: 'bossKills', target: 50 },
  // ── 成长 ────────────────────────────────────────────────
  { id: 'pinnacle_70', name: '问鼎巅峰', description: '角色达到 70 级', stat: 'level', target: 70 },
  { id: 'legend_80', name: '传说降临', description: '角色达到 80 级', stat: 'level', target: 80 },
  { id: 'million_cp', name: '百万战力', description: '战力达到 1,000,000', stat: 'cp', target: 1000000 },
  { id: 'gold_hoarder', name: '富甲一方', description: '持有金币达到 1,000,000', stat: 'gold', target: 1000000 },
  // ── 收集 ────────────────────────────────────────────────
  { id: 'codex_master', name: '图鉴大师', description: '怪物图鉴收录 80 种', stat: 'monsterCodexCount', target: 80 },
  { id: 'codex_collector', name: '装备典藏家', description: '装备图鉴收录 100 件', stat: 'equipmentCodexCount', target: 100 },
  { id: 'epic_connoisseur', name: '史诗鉴赏家', description: '装备图鉴收录 30 件史诗装备', stat: 'epicCount', target: 30 },
  { id: 'legendary_keeper', name: '传说守护者', description: '装备图鉴收录 15 件传说装备', stat: 'legendaryCount', target: 15 },
  // ── 探索 ────────────────────────────────────────────────
  { id: 'wanderer', name: '走遍大陆', description: '通关 7 个章节', stat: 'clearedChapterCount', target: 7 },
  { id: 'conqueror_180', name: '百八征途', description: '通关 180 个关卡', stat: 'clearedStageCount', target: 180 },
  // ── 养成 ────────────────────────────────────────────────
  { id: 'grand_smith', name: '神匠', description: '累计强化装备 500 次', stat: 'enhanceCount', target: 500 },
  { id: 'reforge_sage', name: '词条之神', description: '累计洗练词条 200 次', stat: 'reforgeCount', target: 200 },
];
