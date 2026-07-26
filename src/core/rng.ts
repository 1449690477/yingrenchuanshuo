/**
 * 可复现的伪随机数生成器。
 *
 * 见 AGENTS.md 铁律 4：全项目禁用 Math.random()。
 * 理由：
 *   1. 可测试 —— 同种子必然产出同结果，掉落和强化测试才写得出来
 *   2. 可复盘 —— 玩家说「强化 10 次全失败」，用他的种子能重现
 *   3. 可防作弊 —— 将来接服务端校验时，服务端用同种子重算即可
 *
 * 算法：mulberry32。32 位状态，速度快，分布质量足够游戏使用。
 */

export class Rng {
  private state: number;

  constructor(seed: number) {
    // 保证状态落在 uint32 范围内，且不为 0
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  /** [0, 1) 均匀分布 */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max) 浮点 */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** [min, max] 整数，闭区间 */
  int(min: number, max: number): number {
    return Math.floor(this.float(min, max + 1));
  }

  /** 以 p 的概率返回 true。p 为 0~1 */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** 从数组等概率取一个 */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Rng.pick: 数组为空');
    return arr[this.int(0, arr.length - 1)]!;
  }

  /**
   * 按权重取一个。权重不必归一化。
   * 见 docs/02-数据表规范.md —— 掉落表用权重制而非概率制，
   * 这样加新掉落物时不用重算所有概率。
   */
  weighted<T>(items: readonly T[], weightOf: (item: T) => number): T {
    if (items.length === 0) throw new Error('Rng.weighted: 数组为空');

    let total = 0;
    for (const it of items) {
      const w = weightOf(it);
      if (w < 0) throw new Error('Rng.weighted: 权重不能为负');
      total += w;
    }
    if (total <= 0) throw new Error('Rng.weighted: 总权重必须大于 0');

    let r = this.next() * total;
    for (const it of items) {
      r -= weightOf(it);
      if (r < 0) return it;
    }
    // 浮点误差兜底
    return items[items.length - 1]!;
  }

  /**
   * 派生一个子生成器。
   * 用途：每场战斗 / 每次强化 / 每次掉落各自持有独立的 Rng，
   * 互不干扰，且整体仍由一个主种子决定。
   */
  derive(salt: number): Rng {
    const s = Math.imul(this.state ^ (salt >>> 0), 0x85ebca6b) >>> 0;
    return new Rng(s);
  }

  /** 导出当前状态，用于存档 */
  getState(): number {
    return this.state;
  }

  /** 从存档恢复状态 */
  setState(state: number): void {
    this.state = state >>> 0;
  }
}

/** 用当前时间创建一个种子。仅用于新建存档时生成主种子。 */
export function createSeed(): number {
  return (Date.now() ^ (performance?.now?.() ?? 0)) >>> 0;
}
