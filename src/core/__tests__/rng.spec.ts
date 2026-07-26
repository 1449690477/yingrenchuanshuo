import { describe, it, expect } from 'vitest';
import { Rng } from '../rng';

describe('Rng', () => {
  it('同种子必然产出同序列（可复现性 —— 铁律 4 的核心）', () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('不同种子产出不同序列', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('next() 落在 [0, 1)', () => {
    const r = new Rng(999);
    for (let i = 0; i < 2000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int() 是闭区间且覆盖两端', () => {
    const r = new Rng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(r.int(1, 5));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('int(n, n) 恒返回 n', () => {
    const r = new Rng(3);
    for (let i = 0; i < 20; i++) expect(r.int(4, 4)).toBe(4);
  });

  it('chance(0) 恒 false，chance(1) 恒 true', () => {
    const r = new Rng(42);
    for (let i = 0; i < 100; i++) {
      expect(r.chance(0)).toBe(false);
      expect(r.chance(1)).toBe(true);
    }
  });

  it('chance(p) 的实际频率接近 p', () => {
    const r = new Rng(2024);
    const N = 20000;
    let hits = 0;
    for (let i = 0; i < N; i++) if (r.chance(0.3)) hits++;
    expect(hits / N).toBeCloseTo(0.3, 1);
  });

  it('weighted() 按权重分布', () => {
    const r = new Rng(555);
    const items = [
      { id: 'a', w: 1 },
      { id: 'b', w: 9 },
    ];
    const N = 20000;
    let bCount = 0;
    for (let i = 0; i < N; i++) {
      if (r.weighted(items, (x) => x.w).id === 'b') bCount++;
    }
    expect(bCount / N).toBeCloseTo(0.9, 1);
  });

  it('weighted() 忽略零权重条目', () => {
    const r = new Rng(11);
    const items = [
      { id: 'zero', w: 0 },
      { id: 'only', w: 5 },
    ];
    for (let i = 0; i < 200; i++) {
      expect(r.weighted(items, (x) => x.w).id).toBe('only');
    }
  });

  it('weighted() 对空数组和全零权重报错', () => {
    const r = new Rng(1);
    expect(() => r.weighted([], () => 1)).toThrow();
    expect(() => r.weighted([{ w: 0 }], (x) => x.w)).toThrow();
  });

  it('derive() 产出独立但可复现的子生成器', () => {
    const parentA = new Rng(100);
    const parentB = new Rng(100);
    const childA = parentA.derive(7);
    const childB = parentB.derive(7);
    expect(childA.next()).toBe(childB.next());

    const other = new Rng(100).derive(8);
    expect(new Rng(100).derive(7).next()).not.toBe(other.next());
  });

  it('getState / setState 可完整恢复（存档需要）', () => {
    const r = new Rng(31337);
    for (let i = 0; i < 10; i++) r.next();

    const saved = r.getState();
    const expected = [r.next(), r.next(), r.next()];

    const restored = new Rng(0);
    restored.setState(saved);
    expect([restored.next(), restored.next(), restored.next()]).toEqual(expected);
  });
});
