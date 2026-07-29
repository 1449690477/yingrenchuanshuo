import { ref } from 'vue';

/**
 * 折叠状态记忆（与 CollapsibleCard 共用同一套 sakura.fold.* 键）。
 *
 * CollapsibleCard 适用于「整卡外壳」场景；当折叠发生在已有自己视觉的
 * 块级容器内部（如副本页的套装块/掉落块）时，用这个 composable 拿
 * 同样的开合状态与记忆能力，不套卡片壳。
 */
export function useFold(key: string, defaultOpen: boolean) {
  function read(): boolean | null {
    try {
      const raw = localStorage.getItem(`sakura.fold.${key}`);
      if (raw === '1') return true;
      if (raw === '0') return false;
    } catch {
      /* 隐私模式等场景下不可写，静默回退默认 */
    }
    return null;
  }

  const open = ref(read() ?? defaultOpen);

  function toggle(): void {
    open.value = !open.value;
    try {
      localStorage.setItem(`sakura.fold.${key}`, open.value ? '1' : '0');
    } catch {
      /* 记忆失败不影响当次交互 */
    }
  }

  return { open, toggle };
}

/** 紧凑布局判定：矮屏（手机主流）与极窄屏的折叠默认值都按收起走。 */
export function prefersCompactLayout(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(max-height: 740px)').matches ||
      window.matchMedia?.('(max-width: 350px)').matches) === true
  );
}
