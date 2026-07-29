/**
 * Supabase 客户端单例（M7-1 / docs/51 §6.4）。
 *
 * 两条铁规矩：
 *   1. **没配置就等于没有这个功能**。VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 *      缺失时整个联机层静默关闭，单机游戏主流程不受任何影响（docs/51 §7
 *      「离线可玩：所有网络失败都必须静默降级」）。
 *   2. **匿名登录优先**。放置游戏不该在第一屏要求注册；玩家想上榜时再
 *      引导绑定邮箱，不绑定也能玩（自主性，docs/40）。
 *
 * supabase-js 体积不小，用动态 import 拆包：只有玩家真的打开排行榜
 * 且项目已配置时才会加载它，挂机主流程的首屏成本为零。
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** 联机功能是否已配置（构建期注入环境变量）。 */
export const isSupabaseConfigured: boolean = Boolean(url && anonKey);

let clientPromise: Promise<SupabaseClient> | null = null;

/** 取客户端单例；未配置时返回 null，调用方据此静默降级。 */
export function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return Promise.resolve(null);
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // 纯匿名登录，没有 OAuth 回跳，关掉 URL 探测避免误吞路由参数
        detectSessionInUrl: false,
      },
    }),
  );
  return clientPromise;
}

export interface AnonymousSession {
  client: SupabaseClient;
  userId: string;
}

/**
 * 确保有一个已登录会话（没有就匿名登录）。
 *
 * 会话由 supabase-js 持久化在 localStorage，刷新页面后自动续上；
 * 匿名账号将来绑定邮箱后 userId 不变，榜单成绩无缝继承。
 *
 * @throws NetRequestError 网络或鉴权失败 —— 调用方必须能容忍此异常
 */
export async function ensureAnonymousSession(): Promise<AnonymousSession | null> {
  const client = await getSupabaseClient();
  if (!client) return null;

  const { data } = await client.auth.getSession();
  const existing = data.session?.user;
  if (existing) return { client, userId: existing.id };

  const { data: signed, error } = await client.auth.signInAnonymously();
  if (error || !signed.user) {
    throw new NetRequestError(error?.message ?? '匿名登录失败，请稍后重试');
  }
  return { client, userId: signed.user.id };
}

/** 联机层统一错误类型；message 必须是可以给玩家看的人话。 */
export class NetRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetRequestError';
  }
}
