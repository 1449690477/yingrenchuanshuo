import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { CP_FORMULA_VERSION } from '@/core/cpFormulaVersion';
import { buildProfileProgress } from '@/core/profileProgress';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchPublicProfileIdentities } from '../leaderboard';
import { reportProfile } from '../profile';

const submitTrialSource = readFileSync(
  new URL('../../../supabase/functions/submit-trial/index.ts', import.meta.url),
  'utf8',
);
const arenaSnapshotSource = readFileSync(
  new URL('../../../supabase/functions/arena-snapshot/index.ts', import.meta.url),
  'utf8',
);
const arenaChallengeSource = readFileSync(
  new URL('../../../supabase/functions/arena-challenge/index.ts', import.meta.url),
  'utf8',
);

describe('公开档案补读', () => {
  it('一次请求合并邻域榜所需的头像、简介和昵称', async () => {
    const inFilter = vi.fn(async () => ({
      data: [
        {
          id: 'user-1',
          display_name: '樱落',
          bio: '本周专注破防搭配',
          avatar_url: 'https://example.test/avatar.webp',
        },
      ],
      error: null,
    }));
    const select = vi.fn(() => ({ in: inFilter }));
    const client = {
      from: vi.fn(() => ({ select })),
    } as unknown as SupabaseClient;

    const result = await fetchPublicProfileIdentities(client, ['user-1', 'user-1']);

    expect(inFilter).toHaveBeenCalledWith('id', ['user-1']);
    expect(result.get('user-1')).toEqual({
      displayName: '樱落',
      bio: '本周专注破防搭配',
      avatarUrl: 'https://example.test/avatar.webp',
    });
  });
});

describe('服务端档案同步', () => {
  it('上传试炼成绩不会覆盖已有玩家昵称', () => {
    // ── 2026-08-01：从「扫源码形状」改成「断行为」 ──
    // 原本这条扫的是字面量写法（`const profileProgress = {` 加正则挖块内文本）。
    // 那等于把**实现长什么样**当成契约 —— 而正是「四个函数各写各的」这个形状，
    // 让公式版本戳只加在了 sync-profile 一处。漏戳会留下「合法的戳 + 错尺的数」：
    // 筛得过、显示正常、没有任何人看得出它是错的。
    //
    // 现在四个写入点统一走 core 的 buildProfileProgress，
    // **「不含 display_name」由返回类型保证，不必再用正则去源码里挖。**
    const progress = buildProfileProgress({ classId: 'swordsman', level: 45, combatPower: 1234 });
    expect(progress).not.toHaveProperty('display_name');
    expect(progress.cp_formula_version).toBe(CP_FORMULA_VERSION);

    // 这两条仍然只能从调用形状上看出来：昵称只在首次建档的 upsert 里写一次。
    expect(submitTrialSource).toContain("{ onConflict: 'id', ignoreDuplicates: true }");
    expect(submitTrialSource).toContain('.update(profileProgress)');
  });

  it('★ 写 profiles.combat_power 的函数都走同一个构造点，不许再各写各的', () => {
    // 版本戳漏在任何一个写入点都会产出「合法的戳 + 错尺的数」。
    // 2026-08-01 就是这么漏的：加戳时以为 sync-profile 是唯一写入点，没 grep 全部函数。
    for (const [name, source] of Object.entries({
      submitTrial: submitTrialSource,
      arenaSnapshot: arenaSnapshotSource,
      arenaChallenge: arenaChallengeSource,
    })) {
      expect(source, `${name} 没有走 buildProfileProgress`).toContain('buildProfileProgress(');
    }
  });

  it('服务端不再用平均战力或匿名账号年龄拒绝已复算的真实成绩', () => {
    for (const source of [submitTrialSource, arenaSnapshotSource, arenaChallengeSource]) {
      expect(source).not.toContain('trialPlausibilityCap');
      expect(source).not.toContain('accountAgeMs');
      expect(source).toContain('trialEquipmentSnapshotIssue');
    }
  });

  it('同分重提可以修复旧版误审，但低分不能洗白更高旧分', () => {
    expect(submitTrialSource).toContain("select('id, damage, verified')");
    expect(submitTrialSource).toContain("decision.action === 'reverify'");
    expect(submitTrialSource).toContain('verified: decision.bestVerified');
  });
});

describe('档案举报', () => {
  it('重复举报命中唯一约束时仍视为成功', async () => {
    const insert = vi.fn(async () => ({
      error: { code: '23505', message: 'duplicate key' },
    }));
    const client = {
      from: vi.fn(() => ({ insert })),
    } as unknown as SupabaseClient;

    await expect(
      reportProfile(client, {
        reporterId: 'reporter',
        targetId: 'target',
        reason: '头像内容不当',
      }),
    ).resolves.toBeUndefined();
  });

  it('拒绝举报自己，也不向服务端写入', async () => {
    const insert = vi.fn();
    const client = {
      from: vi.fn(() => ({ insert })),
    } as unknown as SupabaseClient;

    await expect(
      reportProfile(client, {
        reporterId: 'same-user',
        targetId: 'same-user',
        reason: '测试',
      }),
    ).rejects.toThrow('不能举报自己');
    expect(insert).not.toHaveBeenCalled();
  });
});
