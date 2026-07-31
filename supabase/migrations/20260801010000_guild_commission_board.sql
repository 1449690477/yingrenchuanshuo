-- 公会每日建设委托：所有结算来自 guild-expedition 的服务端复算结果。
-- 客户端只读取快照；不提交贡献、声望、材料、装备、货币或战斗属性。

create table if not exists public.guild_commission_days (
  guild_id uuid not null references public.guilds(id) on delete cascade,
  day_key date not null,
  commissions jsonb not null check (jsonb_typeof(commissions) = 'array'),
  build_progress integer not null default 0 check (build_progress >= 0),
  build_target integer not null check (build_target > 0),
  rewarded boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (guild_id, day_key)
);

create table if not exists public.guild_commission_contributions (
  guild_id uuid not null,
  day_key date not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  commission_id text not null,
  request_id uuid not null,
  contribution integer not null check (contribution > 0),
  created_at timestamptz not null default now(),
  -- 同一成员每天每档只计算一次；一个远征 request 可完成多个不同档位。
  primary key (guild_id, day_key, user_id, commission_id),
  foreign key (guild_id, day_key)
    references public.guild_commission_days(guild_id, day_key) on delete cascade
);

alter table public.guild_commission_days enable row level security;
alter table public.guild_commission_contributions enable row level security;
revoke all on public.guild_commission_days, public.guild_commission_contributions
  from public, anon, authenticated;

-- 成员只读自己的公会当天快照。首次读取也会初始化卡片，首屏不会空白。
create or replace function public.guild_get_commission_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_guild_id uuid;
  v_day date := (now() + interval '4 hours')::date;
begin
  if v_user_id is null then
    raise exception '需要登录后查看公会委托';
  end if;

  select guild_id into v_guild_id
  from public.guild_members
  where user_id = v_user_id;
  if v_guild_id is null then
    return null;
  end if;

  insert into public.guild_commission_days (
    guild_id, day_key, commissions, build_progress, build_target, rewarded
  ) values (
    v_guild_id,
    v_day,
    jsonb_build_array(
      jsonb_build_object('id', 'expedition-entry', 'name', '远征集结', 'description', '完成一次公会远征', 'contribution', 80),
      jsonb_build_object('id', 'expedition-vanguard', 'name', '先锋试炼', 'description', '本次远征达到 400 评分', 'contribution', 160),
      jsonb_build_object('id', 'expedition-ace', 'name', '破阵之锋', 'description', '本次远征达到 800 评分', 'contribution', 280)
    ),
    0,
    1800,
    false
  ) on conflict (guild_id, day_key) do nothing;

  return (
    select jsonb_build_object(
      'dayKey', day.day_key,
      'commissions', day.commissions,
      'progress', day.build_progress,
      'target', day.build_target,
      'completed', day.rewarded,
      'participants', (
        select count(distinct contribution.user_id)
        from public.guild_commission_contributions contribution
        where contribution.guild_id = day.guild_id and contribution.day_key = day.day_key
      ),
      'completedCommissionIds', coalesce((
        select jsonb_agg(contribution.commission_id order by contribution.commission_id)
        from public.guild_commission_contributions contribution
        where contribution.guild_id = day.guild_id
          and contribution.day_key = day.day_key
          and contribution.user_id = v_user_id
      ), '[]'::jsonb)
    )
    from public.guild_commission_days day
    where day.guild_id = v_guild_id and day.day_key = v_day
  );
end;
$$;

-- 只有 Edge Function 的 service_role 可执行。值在数据库固定，不能由客户端参数影响。
create or replace function public.guild_apply_commission(
  p_user_id uuid,
  p_day_key date,
  p_commission_id text,
  p_request_id uuid,
  p_points integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guild_id uuid;
  v_threshold integer;
  v_contribution integer;
  v_inserted boolean := false;
  v_progress integer;
  v_target integer;
  v_completed boolean;
  v_just_completed boolean := false;
begin
  if p_points < 0 or p_points > 1000 then
    raise exception 'invalid expedition points';
  end if;
  if p_day_key <> (now() + interval '4 hours')::date then
    raise exception 'invalid commission business day';
  end if;

  case p_commission_id
    when 'expedition-entry' then v_threshold := 1; v_contribution := 80;
    when 'expedition-vanguard' then v_threshold := 400; v_contribution := 160;
    when 'expedition-ace' then v_threshold := 800; v_contribution := 280;
    else raise exception 'invalid guild commission';
  end case;
  if p_points < v_threshold then
    raise exception 'commission objective is not complete';
  end if;

  select guild_id into v_guild_id
  from public.guild_members
  where user_id = p_user_id;
  if v_guild_id is null then
    raise exception 'guild membership required';
  end if;

  -- Edge 不依赖玩家是否先打开过首页；直接挑战也能按同一张日卡结算。
  insert into public.guild_commission_days (
    guild_id, day_key, commissions, build_progress, build_target, rewarded
  ) values (
    v_guild_id,
    p_day_key,
    jsonb_build_array(
      jsonb_build_object('id', 'expedition-entry', 'name', '远征集结', 'description', '完成一次公会远征', 'contribution', 80),
      jsonb_build_object('id', 'expedition-vanguard', 'name', '先锋试炼', 'description', '本次远征达到 400 评分', 'contribution', 160),
      jsonb_build_object('id', 'expedition-ace', 'name', '破阵之锋', 'description', '本次远征达到 800 评分', 'contribution', 280)
    ),
    0,
    1800,
    false
  ) on conflict (guild_id, day_key) do nothing;

  insert into public.guild_commission_contributions (
    guild_id, day_key, user_id, commission_id, request_id, contribution
  ) values (
    v_guild_id, p_day_key, p_user_id, p_commission_id, p_request_id, v_contribution
  ) on conflict (guild_id, day_key, user_id, commission_id) do nothing
  returning true into v_inserted;
  v_inserted := found;

  select build_progress, build_target, rewarded
  into v_progress, v_target, v_completed
  from public.guild_commission_days
  where guild_id = v_guild_id and day_key = p_day_key
  for update;

  if v_inserted then
    update public.guild_commission_days
    set build_progress = least(build_target, build_progress + v_contribution)
    where guild_id = v_guild_id and day_key = p_day_key
    returning build_progress into v_progress;
  end if;

  if not v_completed and v_progress >= v_target then
    update public.guild_commission_days
    set rewarded = true
    where guild_id = v_guild_id and day_key = p_day_key and rewarded = false;
    v_just_completed := found;
    if v_just_completed then
      update public.guilds
      set reputation = reputation + 20, updated_at = now()
      where id = v_guild_id;
    end if;
  end if;

  return jsonb_build_object(
    'progress', v_progress,
    'target', v_target,
    'completed', v_completed or v_just_completed,
    'contributionAwarded', case when v_inserted then v_contribution else 0 end,
    'reputationAwarded', case when v_just_completed then 20 else 0 end,
    'duplicate', not v_inserted
  );
end;
$$;

revoke all on function public.guild_get_commission_state() from public;
grant execute on function public.guild_get_commission_state() to authenticated;

revoke all on function public.guild_apply_commission(uuid, date, text, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.guild_apply_commission(uuid, date, text, uuid, integer)
  to service_role;

