/**
 * 业务日切（日界）工具。
 *
 * 全游戏共用一套日切口径：北京时间凌晨 resetHourCst 点（默认 04:00）。
 * 装备副本、好感、试炼、竞技场的「每天」都必须从这里取，
 * 任何系统不得另起一套时区逻辑（docs/52 §九）。
 *
 * 北京是 UTC+8；把时间先加 (8 − resetHourCst) 小时再取 UTC 日期，等价于
 * 「北京时间减去 resetHourCst 小时后的自然日」，同时避免依赖宿主机时区。
 */

export function businessDayKey(now: number, resetHourCst = 4): string {
  if (!Number.isFinite(now) || now < 0) {
    throw new Error(`[日切] now 必须是非负有限时间戳，收到 ${now}`);
  }
  if (!Number.isInteger(resetHourCst) || resetHourCst < 0 || resetHourCst > 23) {
    throw new Error(`[日切] resetHourCst 必须是 0~23 的整数，收到 ${resetHourCst}`);
  }
  const shifted = new Date(now + (8 - resetHourCst) * 3_600_000);
  return shifted.toISOString().slice(0, 10);
}
