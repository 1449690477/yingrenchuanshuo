/**
 * 图鉴集齐加成（M4-8 P3，数值线裁定：小衡 2026-08-03）。
 *
 * ── 裁定口径 ──
 * 1. 形态：战斗乘区（伤害百分点），不是面板 stats——面板 stats 会经
 *    combatPower 自动进 CP，且试炼/竞技服务端复算拿不到可信图鉴状态，
 *    纳入即复算失真（同 buildTrialCombatant 注释原则）。
 * 2. 不进 CP：收藏奖励是养成面，不是静态强度口径（docs/83 Q5 同原则）；
 *    战力面板需加文案「不含图鉴集齐加成」并登记 KNOWN_RESIDUALS。
 * 3. 生效范围：挂机 + 副本（本地 PvE）；试炼/竞技场不读本模块。
 * 4. 幅值：每区域集齐 +0.5% 伤害乘区；r1~r7 共 7 区 = 3.5% 封顶，
 *    r8 上线后自动 4%（数据驱动，不写死区数）；总上限 5% 保险。
 * 5. 集齐 = 该区域全部章节的全部怪物 id 都已在账本中。
 *
 * 本模块只计算「加成百分点」，不触碰伤害公式；上层（挂机/副本）把结果
 * 乘到本地 PvE 路径的伤害乘区上，试炼/竞技路径天然不读它。
 */

import { monstersOfChapter } from '@/data/monsters';
import { REGIONS } from '@/data/regions';

/** 每集齐一个区域的伤害加成（百分点）。 */
export const GALLERY_REGION_BONUS_PERCENT = 0.5;

/** 图鉴集齐加成总上限（百分点）。 */
export const GALLERY_BONUS_CAP_PERCENT = 5;

/** 某个区域是否集齐：该区全部章节的全部怪物都在账本里。 */
export function isRegionGalleryComplete(
  discoveredMonsterIds: ReadonlySet<string>,
  regionId: string,
): boolean {
  const region = REGIONS.find((r) => r.id === regionId);
  if (!region) return false;
  const ids = region.chapters.flatMap((chapter) =>
    monstersOfChapter(chapter.id).map((m) => m.id),
  );
  return ids.length > 0 && ids.every((id) => discoveredMonsterIds.has(id));
}

/**
 * 当前图鉴集齐加成（百分点）。数据驱动：区域越多，自然越高，只受总上限约束。
 */
export function galleryDamageBonusPercent(
  discoveredMonsterIds: readonly string[],
): number {
  const discovered = new Set(discoveredMonsterIds);
  let completedRegions = 0;
  for (const region of REGIONS) {
    if (isRegionGalleryComplete(discovered, region.id)) completedRegions += 1;
  }
  const raw = completedRegions * GALLERY_REGION_BONUS_PERCENT;
  return Math.min(raw, GALLERY_BONUS_CAP_PERCENT);
}
