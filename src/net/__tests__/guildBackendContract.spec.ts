import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../../../supabase/migrations/20260730143000_guilds.sql', import.meta.url),
  'utf8',
);
const idempotency = readFileSync(
  new URL('../../../supabase/migrations/20260730143100_guild_idempotency.sql', import.meta.url),
  'utf8',
);
const inviteDetail = readFileSync(
  new URL('../../../supabase/migrations/20260730180000_guild_invite_and_detail.sql', import.meta.url),
  'utf8',
);
const edge = readFileSync(
  new URL('../../../supabase/functions/guild-expedition/index.ts', import.meta.url),
  'utf8',
);

describe('公会 Supabase 契约', () => {
  it('锁定一人一会、20 人上限和客户端禁写', () => {
    expect(migration).toContain('unique (user_id)');
    expect(migration).toContain('if v_count >= 20');
    expect(migration).toContain('revoke insert, update, delete on public.guilds');
    expect(migration).toContain('revoke all on public.guild_contributions');
  });

  it('成员管理使用原子函数并处理会长转移', () => {
    for (const name of [
      'guild_create',
      'guild_join',
      'guild_leave',
      'guild_update_notice',
      'guild_remove_member',
    ]) {
      expect(migration).toContain(`function public.${name}`);
    }
    expect(migration).toContain("update public.guild_members set role = 'leader'");
  });

  it('远征以请求账本全局幂等且只把最好成绩差额累加', () => {
    expect(idempotency).toContain('request_id uuid primary key');
    expect(idempotency).toContain('build_hash text not null');
    expect(idempotency).toContain('submission_index int not null');
    expect(idempotency).toContain('v_request_build_hash <> p_build_hash');
    expect(idempotency).toContain('v_delta := greatest(0, p_points - v_row.best_points)');
    expect(idempotency).toContain('progress = progress + v_delta');
    expect(idempotency).toContain('grant execute on function public.guild_apply_contribution');
  });

  it('Edge Function 严格拒绝客户端伤害并复用共享 core', () => {
    expect(edge).toContain("z.discriminatedUnion('action'");
    expect(edge).not.toMatch(/damage:\s*z\./);
    expect(edge).toContain('body.seasonId !== TRIAL_SEASON_ID');
    expect(edge).toContain('guildExpeditionBoss(TRIAL_SEASON_ID');
    expect(edge).toContain("select('build_hash, submission_index')");
    expect(edge).toContain('`${body.classId}:${body.level}:${build.buildHash}`');
    expect(edge).toContain('runTrial(build, boss.combatant, seed)');
    expect(edge).toContain('guildContributionPoints(battle.damage, battle.bossHpMax)');
  });

  it('邀请码唯一且可自动生成，详情与凭码加入走原子函数', () => {
    expect(inviteDetail).toContain('add column if not exists invite_code text');
    expect(inviteDetail).toContain('create unique index if not exists guilds_invite_code_idx');
    expect(inviteDetail).toContain('function public.guild_generate_invite_code()');
    expect(inviteDetail).toContain('set default public.guild_generate_invite_code()');
    for (const name of ['guild_get_detail', 'guild_join_by_code']) {
      expect(inviteDetail).toContain(`function public.${name}`);
      expect(inviteDetail).toContain(`grant execute on function public.${name}`);
    }
    expect(inviteDetail).toContain('你已经加入公会');
    expect(inviteDetail).toContain('公会已经满员');
  });

  it('我的公会状态只向成员暴露邀请码，广场列表不再过滤满员公会', () => {
    expect(inviteDetail).toContain('create or replace function public.guild_get_my_state()');
    expect(inviteDetail).toContain("'inviteCode', g.invite_code");
    expect(inviteDetail).toContain('create or replace function public.guild_list(p_limit int default 30)');
    expect(inviteDetail).not.toContain('having count(m.user_id) < 20');
    // 公开详情不返回邀请码
    const detailFn = inviteDetail.slice(inviteDetail.indexOf('function public.guild_get_detail'));
    expect(detailFn.slice(0, detailFn.indexOf('$$;'))).not.toContain('invite_code');
  });
});
