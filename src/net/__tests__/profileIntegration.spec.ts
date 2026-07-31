import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
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
    // 5d6a358 反作弊改造后 profileProgress 变为 verified ? {...} : null 三元，
    // 更新同步断言以匹配新源码形态（display_name 仍只出现在首次建档的 upsert 里）。
    expect(submitTrialSource).toContain('const profileProgress = verified');
    expect(submitTrialSource).toContain("{ onConflict: 'id', ignoreDuplicates: true }");
    expect(submitTrialSource).toContain('.update(profileProgress)');
    const progressBlock = submitTrialSource.match(
      /const profileProgress = verified\n[ \t]*\? \{([\s\S]*?)\n[ \t]*\}\s*: null;/,
    );
    expect(progressBlock?.[1]).not.toContain('display_name');
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
