import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL(
    '../../../supabase/migrations/20260801020000_guild_stronghold_economy.sql',
    import.meta.url,
  ),
  'utf8',
);
const edge = readFileSync(
  new URL('../../../supabase/functions/guild-expedition/index.ts', import.meta.url),
  'utf8',
);

describe('公会功勋与赛季据点服务端契约', () => {
  it('把功勋、消费、领取和据点来源全部锁在服务端表与 RLS 后面', () => {
    for (const table of [
      'guild_member_merits',
      'guild_merit_awards',
      'guild_merit_spends',
      'guild_shop_claims',
      'guild_stronghold_seasons',
      'guild_stronghold_sources',
    ]) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
    expect(migration).toContain('revoke all on public.guild_member_merits');
    expect(migration).toContain('primary key (guild_id, season_id, source_key)');
    expect(migration).toContain('request_id uuid primary key');
  });

  it('服务端从已落库的团本增量计算功勋，不接收客户端余额、价格或奖励数量', () => {
    const awardFn = migration.slice(
      migration.indexOf('function public.guild_award_merit'),
      migration.indexOf('function public.guild_apply_commission_stronghold'),
    );
    expect(awardFn).toContain("(result ->> 'improvedBy')::integer");
    expect(awardFn).toContain('least(5, greatest(0, (v_improved + 199) / 200))');
    expect(awardFn).not.toContain('p_merit');
    expect(awardFn).not.toContain('p_balance');
    expect(migration).toContain(
      'grant execute on function public.guild_award_merit(uuid, uuid) to service_role',
    );
    expect(edge).toContain("admin.rpc('guild_award_merit'");
    expect(edge).not.toContain('p_merit:');
  });

  it('捐献和商店均使用固定服务端档位、固定价格与请求幂等账', () => {
    expect(migration).toContain('p_amount not in (1, 5, 10)');
    expect(migration).toContain("when 'sakura-pennant' then v_cost := 8");
    expect(migration).toContain("when 'moon-lantern' then v_cost := 18");
    expect(migration).toContain("when 'legend-crest' then v_cost := 36");
    expect(migration).toContain(
      'if exists(select 1 from public.guild_merit_spends where request_id = p_request_id)',
    );
    expect(migration).not.toContain('p_price');
    expect(migration).not.toContain('p_reward');
    expect(migration).toContain('grant execute on function public.guild_donate_merit');
    expect(migration).toContain('grant execute on function public.guild_claim_shop_offer');
  });

  it('满额日建设和周团本首次完成才各自推进一次赛季据点', () => {
    expect(migration).toContain('after update of completed on public.guild_expeditions');
    expect(migration).toContain("'raid:' || new.week_key");
    expect(migration).toContain("'commission:' || p_day_key::text");
    expect(migration).toContain('guild_apply_commission_stronghold');
    expect(edge).toContain("admin.rpc('guild_apply_commission_stronghold'");
    expect(edge).toContain('p_season_id: TRIAL_SEASON_ID');
  });
});
