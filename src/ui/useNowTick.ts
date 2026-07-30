import { onUnmounted, ref, type Ref } from 'vue';

/**
 * 每 intervalMs 跳一次的当前时间戳。
 * 用于体力恢复倒计时这类「低频、允许分钟级粒度」的 UI 刷新，
 * 避免组件各自拉 setInterval 忘记清理。
 */
export function useNowTick(intervalMs = 30_000): Ref<number> {
  const now = ref(Date.now());
  const timer = window.setInterval(() => {
    now.value = Date.now();
  }, intervalMs);
  onUnmounted(() => window.clearInterval(timer));
  return now;
}
