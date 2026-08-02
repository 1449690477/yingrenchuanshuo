/**
 * ROADMAP 计数一致性守卫。
 *
 * 为什么需要：完成度总览存在两个地方（docs/30 总览行 + docs/31 状态表），
 * 且 docs/30 总览行里的数字是手写的。已经两次发生「勾了任务但总览没改」的
 * 分叉（今晚 docs/30 总览 80/156 vs docs/31 90/158）。本守卫统一两处数字为
 * 「实际勾选计数」，改勾任务而忘记更新总览会当场红。
 *
 * 计数口径：
 * - 任务行 = docs/30 中以 `- [ ]` 或 `- [x]` 开头的行
 * - 每段（## M×）独立统计勾选数
 * - 总览行必须与实际统计一致（包含分段数字）
 * - docs/31 的完成度与 M3 段数字必须与 docs/30 实际一致
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function readDocs(name: string): string {
  return readFileSync(resolve(root, 'docs', name), 'utf8');
}

interface RoadmapStats {
  totalTasks: number;
  checked: number;
  bySection: Record<string, { checked: number; total: number }>;
}

function countRoadmap(content: string): RoadmapStats {
  const lines = content.split('\n');
  const stats: RoadmapStats = { totalTasks: 0, checked: 0, bySection: {} };
  let section = '';
  for (const line of lines) {
    const sectionMatch = /^## (M\d+)/.exec(line);
    if (sectionMatch) section = sectionMatch[1]!;
    const task = /^- \[([ x])\]/.exec(line);
    if (!task) continue;
    stats.totalTasks += 1;
    const isChecked = task[1] === 'x';
    if (isChecked) stats.checked += 1;
    const bucket = (stats.bySection[section] ??= { checked: 0, total: 0 });
    bucket.total += 1;
    if (isChecked) bucket.checked += 1;
  }
  return stats;
}

function overviewNumbers(
  content: string,
): { done: number; total: number; m3: number; m3Total: number } {
  const overview = /进度总览：`(\d+) \/ (\d+)`/.exec(content);
  if (!overview) throw new Error('docs/30 缺少总览行');
  const m3 = /M3 完成 (\d+) \/ (\d+)/.exec(content);
  if (!m3) throw new Error('docs/30 总览缺少 M3 分段数字');
  return {
    done: Number(overview[1]),
    total: Number(overview[2]),
    m3: Number(m3[1]),
    m3Total: Number(m3[2]),
  };
}

function progressNumbers(content: string): { done: number; total: number; m3: number } {
  const m3 = /M3：(\d+) \/ (\d+)/.exec(content);
  const total = /\*\*完成度\*\* \| (\d+) \/ (\d+)/.exec(content);
  if (!m3 || !total) throw new Error('docs/31 缺少计数行');
  return { done: Number(total[1]), total: Number(total[2]), m3: Number(m3[1]) };
}

describe('ROADMAP 计数一致性', () => {
  const roadmap = readDocs('30-ROADMAP.md');
  const progress = readDocs('31-PROGRESS.md');
  const stats = countRoadmap(roadmap);
  const overview = overviewNumbers(roadmap);
  const progressNums = progressNumbers(progress);

  it('总览行与实际勾选一致（总数）', () => {
    expect(overview.done, 'docs/30 总览完成数').toBe(stats.checked);
    expect(overview.total, 'docs/30 总览分母').toBe(stats.totalTasks);
  });

  it('总览行 M3 分段与实际勾选一致', () => {
    const m3 = stats.bySection.M3;
    expect(m3).toBeDefined();
    expect(overview.m3).toBe(m3!.checked);
    expect(overview.m3Total).toBe(m3!.total);
  });

  it('docs/31 与 docs/30 实际一致（完成度与 M3）', () => {
    expect(progressNums.done).toBe(stats.checked);
    expect(progressNums.total).toBe(stats.totalTasks);
    expect(progressNums.m3).toBe(stats.bySection.M3?.checked ?? 0);
  });
});
