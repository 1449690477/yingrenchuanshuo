import { registerSW, type RegisterSWOptions } from 'virtual:pwa-register';

export type PwaUpdateHandlers = Pick<RegisterSWOptions, 'onNeedRefresh' | 'onRegisterError'>;

/**
 * 使用 vite-plugin-pwa / Workbox 的正式更新通道。
 *
 * 返回函数会通知正在等待的 Service Worker 接管页面；插件随后在 controlling
 * 事件里整页刷新，保证入口 JS、懒加载模块与缓存清单来自同一个版本。
 */
export function registerPwaUpdates(
  handlers: PwaUpdateHandlers,
): (reloadPage?: boolean) => Promise<void> {
  return registerSW({
    immediate: true,
    ...handlers,
  });
}
