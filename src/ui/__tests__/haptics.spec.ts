import { afterEach, describe, expect, it, vi } from 'vitest';
import { hapticPattern, triggerHaptic } from '../haptics';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('affection haptics', () => {
  it('按心情发送短促模式，不共享可变数组', () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });

    expect(triggerHaptic('shy', true, false)).toBe(true);
    expect(vibrate).toHaveBeenCalledWith([10, 48, 10]);
    expect(hapticPattern('prismatic-drop')).toEqual([18, 30, 18, 38, 46]);
  });

  it('关闭触觉或减弱动效时绝不调用设备振动', () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });

    expect(triggerHaptic('bright', false, false)).toBe(false);
    expect(triggerHaptic('bright', true, true)).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('设备不支持振动时保持无副作用', () => {
    vi.stubGlobal('navigator', {});
    expect(triggerHaptic('calm', true, false)).toBe(false);
  });
});
