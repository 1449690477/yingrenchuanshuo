import type { AffixKey } from '@/core/types';

/**
 * v10 发布包中与 v11 当前基准不同的职业词条。
 *
 * 这是已经发到玩家设备上的历史协议，不是当前平衡参数：服务端复核旧装备时
 * 必须先按旧基准还原 v10 可生成值，再走与存档迁移相同的比例重标。删除或
 * “顺手改成当前值”都会让真实旧存档无法参加公会、试炼与竞技场。
 */
export const V10_PROFESSION_AFFIX_REBASE = {
  swd_heavy: { oldBaseline: 9.1, newBaseline: 27 },
  wit_power: { oldBaseline: 0.78, newBaseline: 0.53 },
  wit_elem: { oldBaseline: 8.5, newBaseline: 4.3 },
  cat_swift: { oldBaseline: 0.039, newBaseline: 0.027 },
} as const satisfies Partial<
  Record<AffixKey, { readonly oldBaseline: number; readonly newBaseline: number }>
>;

export type V10RebasedAffixKey = keyof typeof V10_PROFESSION_AFFIX_REBASE;

export function isV10RebasedAffixKey(key: AffixKey): key is V10RebasedAffixKey {
  return key in V10_PROFESSION_AFFIX_REBASE;
}

/**
 * v11 之后历次「已发布职业词条基准」变更的登记（2026-08-02 C2+C5 重标）。
 *
 * 与 V10_PROFESSION_AFFIX_REBASE 的区别：那张表登记 v10→v11 那一代；
 * 这张表登记 v11 之后的每一代重标，同一个键可以出现多次。
 *
 * 用途：isVerifiablePersistedAffixValue 在 v10 迁移路径之后，用登记过的
 * oldBaseline 复算「旧基准可生成的区间」（保值模式：旧装备保留旧值，
 * 不做存档迁移）。docs/73 P0 事故：2026-08-02 10:15 发现 sha_spirit
 * 0.84→0.68 后，老装备上的旧值被持久化校验判非法，玩家提交试炼直接 400。
 *
 * 这是已经发到玩家设备上的历史协议，不是当前平衡参数：删除或“顺手改成
 * 当前值”都会让真实旧存档无法参加公会、试炼与竞技场。任何已发布基准的
 * 改动必须先登记旧基准，再补「老值域边界值仍可验证」的测试，最后才改
 * 冻结表（affixBaselineFreeze 守卫会强制这个顺序）。
 */
export const AFFIX_BASELINE_HISTORY: Readonly<
  Partial<Record<AffixKey, readonly { readonly oldBaseline: number; readonly newBaseline: number }[]>>
> = {
  // 灵巫·灵击：C2+C5 重标 0.84→0.68
  sha_spirit: [{ oldBaseline: 0.84, newBaseline: 0.68 }],
  // 剑姬 职业词条：重标 27→22
  kenshi_blade: [{ oldBaseline: 27, newBaseline: 22 }],
  // 喵喵·疾风：v11 后二次重标 0.027→0.044（v10→v11 那次 0.039→0.027 登记在 V10 表里）
  cat_swift: [{ oldBaseline: 0.027, newBaseline: 0.044 }],
};

/** 取某词条 v11 之后的历次基准变更记录；未登记过返回空数组。 */
export function baselineHistoryFor(key: AffixKey): readonly {
  readonly oldBaseline: number;
  readonly newBaseline: number;
}[] {
  return AFFIX_BASELINE_HISTORY[key] ?? [];
}
