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
