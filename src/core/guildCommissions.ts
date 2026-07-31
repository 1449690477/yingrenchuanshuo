/** 公会委托的纯规则层：不依赖网络、Vue 或本地存档。 */
import { GUILD_COMMISSION_DEFS, type GuildCommissionDef } from '@/data/guildCommissions';
import { guildDayKey } from './guildExpedition';

/** 委托与远征共用北京时间 04:00 的业务日，避免两个系统在日切时分叉。 */
export function guildCommissionDayKey(now: number): string {
  return guildDayKey(now);
}

/**
 * 一场服务端复算过的远征可以满足哪些阶梯。
 * 只返回配置表中的项目；调用方仍必须由服务端按成员、业务日和委托 ID 去重。
 */
export function guildCompletedCommissions(points: number): readonly GuildCommissionDef[] {
  if (!Number.isInteger(points) || points < 0) {
    throw new Error(`[公会委托] 积分必须是非负整数，收到 ${points}`);
  }
  return GUILD_COMMISSION_DEFS.filter((commission) => points >= commission.minimumPoints);
}
