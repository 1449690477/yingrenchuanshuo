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
    expect(idempotency).toContain('v_delta := greatest(0, p_points - v_row.best_points)');
    expect(idempotency).toContain('progress = progress + v_delta');
    expect(idempotency).toContain('grant execute on function public.guild_apply_contribution');
  });

  it('Edge Function 严格拒绝客户端伤害并复用共享 core', () => {
    expect(edge).toContain("z.discriminatedUnion('action'");
    expect(edge).not.toMatch(/damage:\s*z\./);
    expect(edge).toContain('runTrial(build, boss.combatant, seed)');
    expect(edge).toContain('guildContributionPoints(battle.damage, battle.bossHpMax)');
  });
});
