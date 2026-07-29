import { describe, expect, it } from 'vitest';
import { AVATAR_ACCEPT, AVATAR_MAX_BYTES, AVATAR_MAX_EDGE, fitWithin } from '../imageResize';

describe('头像等比缩放', () => {
  it('长边超限时按比例缩到上限，短边跟着等比缩', () => {
    expect(fitWithin(2048, 1024, 512)).toEqual({ width: 512, height: 256 });
    expect(fitWithin(1024, 2048, 512)).toEqual({ width: 256, height: 512 });
  });

  it('正方形缩到正方形', () => {
    expect(fitWithin(4000, 4000, 512)).toEqual({ width: 512, height: 512 });
  });

  it('小图不放大——放大只会糊，还平白增加体积', () => {
    expect(fitWithin(120, 80, 512)).toEqual({ width: 120, height: 80 });
    expect(fitWithin(512, 512, 512)).toEqual({ width: 512, height: 512 });
  });

  it('极端长条图短边至少留 1px，不会算出 0', () => {
    const out = fitWithin(10000, 3, 512);
    expect(out.width).toBe(512);
    expect(out.height).toBeGreaterThanOrEqual(1);
  });

  it('非法尺寸直接报错，不静默返回垃圾值', () => {
    expect(() => fitWithin(0, 100, 512)).toThrow('尺寸必须是正数');
    expect(() => fitWithin(-1, 100, 512)).toThrow();
    expect(() => fitWithin(Number.NaN, 100, 512)).toThrow();
  });

  it('常量与存储桶限制保持一致', () => {
    // 桶上写死 204800 与三种 MIME（见 20260729210000_profile_identity.sql），
    // 两边分叉会导致客户端以为压好了、服务端却拒收
    expect(AVATAR_MAX_BYTES).toBe(204800);
    expect(AVATAR_MAX_EDGE).toBe(512);
    expect([...AVATAR_ACCEPT]).toEqual(['image/jpeg', 'image/png', 'image/webp']);
  });
});
