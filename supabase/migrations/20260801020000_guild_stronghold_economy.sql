-- 公会大版本：服务端功勋、赛季据点、功勋捐献与收藏商店。
-- 任何可消耗/可领取的功勋都只存在于 Supabase；客户端无法写入余额、价格、阶段或奖励。

create table if not exists public.guild_member_merits (
  guild_id uuid not null references public.guilds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  earned_total integer not null default 0 check (earned_total >= 0),
  spent_total integer not null default 0 check (spent_total >= 0),
  updated_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);

create table if not exists public.guild_merit_awards (
  request_id uuid primary key,
  guild_id uuid not null references public.guilds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  merit integer not null check (merit > 0 and merit <= 5),
  created_at timestamptz not null default now()
);

create table if not exists public.guild_merit_spends (
  request_id uuid primary key,
  guild_id uuid not null references public.guilds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_id text not null check (season_id ~ '^[a-z][a-z0-9_-]{0,15}$'),
  spend_type text not null check (spend_type in ('donation', 'shop')),
  amount integer not null check (amount > 0),
  offer_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.guild_shop_claims (
  guild_id uuid not null references public.guilds(id) on delete cascade,
  season_id text not null check (season_id ~ '^[a-z][a-z0-9_-]{0,15}$'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  offer_id text not null check (offer_id in ('sakura-pennant', 'moon-lantern', 'legend-crest')),
  claimed_at timestamptz not null default now(),
  primary key (guild_id, season_id, user_id, offer_id)
);

create table if not exists public.guild_stronghold_seasons (
  guild_id uuid not null references public.guilds(id) on delete cascade,
  season_id text not null check (season_id ~ '^[a-z][a-z0-9_-]{0,15}$'),
  progress integer not null default 0 check (progress >= 0),
  commission_days integer not null default 0 check (commission_days >= 0),
  raid_clears integer not null default 0 check (raid_clears >= 0),
  donated_merits integer not null default 0 check (donated_merits >= 0),
  updated_at timestamptz not null default now(),
  primary key (guild_id, season_id)
);

create table if not exists public.guild_stronghold_sources (
  guild_id uuid not null references public.guilds(id) on delete cascade,
  season_id text not null check (season_id ~ '^[a-z][a-z0-9_-]{0,15}$'),
  source_key text not null,
  source_type text not null check (source_type in ('commission', 'raid', 'donation')),
  progress integer not null check (progress > 0),
  created_at timestamptz not null default now(),
  primary key (guild_id, season_id, source_key)
);

alter table public.guild_member_merits enable row level security;
alter table public.guild_merit_awards enable row level security;
alter table public.guild_merit_spends enable row level security;
alter table public.guild_shop_claims enable row level security;
alter table public.guild_stronghold_seasons enable row level security;
alter table public.guild_stronghold_sources enable row level security;

revoke all on public.guild_member_merits, public.guild_merit_awards, public.guild_merit_spends,
  public.guild_shop_claims, public.guild_stronghold_seasons, public.guild_stronghold_sources
  from public, anon, authenticated;

-- 所有来源都先写不可重复的来源账，再推进总进度；服务端重试不会叠加。
create or replace function public.guild_add_stronghold_source(
  p_guild_id uuid,
  p_season_id text,
  p_source_key text,
  p_source_type text,
  p_progress integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted boolean := false;
begin
  if p_season_id !~ '^[a-z][a-z0-9_-]{0,15}$'
    or p_source_key = '' or p_progress <= 0
    or p_source_type not in ('commission', 'raid', 'donation') then
    raise exception 'invalid guild stronghold source';
  end if;

  insert into public.guild_stronghold_sources (
    guild_id, season_id, source_key, source_type, progress
  ) values (
    p_guild_id, p_season_id, p_source_key, p_source_type, p_progress
  ) on conflict do nothing
  returning true into v_inserted;
  v_inserted := found;

  if v_inserted then
    insert into public.guild_stronghold_seasons (
      guild_id, season_id, progress, commission_days, raid_clears, donated_merits
    ) values (
      p_guild_id,
      p_season_id,
      p_progress,
      case when p_source_type = 'commission' then 1 else 0 end,
      case when p_source_type = 'raid' then 1 else 0 end,
      case when p_source_type = 'donation' then p_progress else 0 end
    ) on conflict (guild_id, season_id) do update
    set progress = public.guild_stronghold_seasons.progress + excluded.progress,
        commission_days = public.guild_stronghold_seasons.commission_days + excluded.commission_days,
        raid_clears = public.guild_stronghold_seasons.raid_clears + excluded.raid_clears,
        donated_merits = public.guild_stronghold_seasons.donated_merits + excluded.donated_merits,
        updated_at = now();
  end if;
  return coalesce(v_inserted, false);
end;
$$;

-- 周团本由既有 guild_apply_contribution 原子地改 completed；触发器只捕获第一次完成。
create or replace function public.guild_record_raid_stronghold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.completed = true and old.completed = false then
    perform public.guild_add_stronghold_source(
      new.guild_id,
      new.season_id,
      'raid:' || new.week_key,
      'raid',
      10
    );
  end if;
  return new;
end;
$$;

drop trigger if exists guild_expedition_stronghold_complete on public.guild_expeditions;
create trigger guild_expedition_stronghold_complete
after update of completed on public.guild_expeditions
for each row execute function public.guild_record_raid_stronghold();

-- Edge 传入的只有用户与已保存的 request id；功勋值从远征原子 RPC 的结果读取。
create or replace function public.guild_award_merit(
  p_user_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guild_id uuid;
  v_request_guild_id uuid;
  v_improved integer;
  v_merit integer;
  v_balance integer;
  v_inserted boolean := false;
begin
  select guild_id into v_guild_id
  from public.guild_members where user_id = p_user_id;
  if v_guild_id is null then raise exception 'guild membership required'; end if;

  select guild_id, coalesce((result ->> 'improvedBy')::integer, 0)
  into v_request_guild_id, v_improved
  from public.guild_submission_requests
  where request_id = p_request_id and user_id = p_user_id;
  if v_request_guild_id is null or v_request_guild_id <> v_guild_id then
    raise exception 'unverified guild expedition request';
  end if;

  v_merit := least(5, greatest(0, (v_improved + 199) / 200));
  insert into public.guild_member_merits(guild_id, user_id)
  values (v_guild_id, p_user_id) on conflict do nothing;

  if v_merit > 0 then
    insert into public.guild_merit_awards(request_id, guild_id, user_id, merit)
    values (p_request_id, v_guild_id, p_user_id, v_merit)
    on conflict do nothing
    returning true into v_inserted;
    v_inserted := found;

    if v_inserted then
      update public.guild_member_merits
      set balance = balance + v_merit,
          earned_total = earned_total + v_merit,
          updated_at = now()
      where guild_id = v_guild_id and user_id = p_user_id
      returning balance into v_balance;
    end if;
  end if;

  if v_balance is null then
    select balance into v_balance
    from public.guild_member_merits
    where guild_id = v_guild_id and user_id = p_user_id;
  end if;
  return jsonb_build_object(
    'awarded', case when v_inserted then v_merit else 0 end,
    'balance', coalesce(v_balance, 0),
    'duplicate', not coalesce(v_inserted, false)
  );
end;
$$;

-- 满额日常委托的据点进度只由已写入的 commission day 推进，和客户端卡片无关。
create or replace function public.guild_apply_commission_stronghold(
  p_user_id uuid,
  p_day_key date,
  p_season_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guild_id uuid;
  v_complete boolean;
begin
  if p_season_id !~ '^[a-z][a-z0-9_-]{0,15}$'
    or p_day_key <> (now() + interval '4 hours')::date then
    raise exception 'invalid commission stronghold request';
  end if;
  select guild_id into v_guild_id from public.guild_members where user_id = p_user_id;
  if v_guild_id is null then raise exception 'guild membership required'; end if;
  select rewarded into v_complete
  from public.guild_commission_days
  where guild_id = v_guild_id and day_key = p_day_key;
  if coalesce(v_complete, false) then
    return public.guild_add_stronghold_source(
      v_guild_id, p_season_id, 'commission:' || p_day_key::text, 'commission', 2
    );
  end if;
  return false;
end;
$$;

create or replace function public.guild_get_stronghold_state(p_season_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_guild_id uuid;
  v_balance integer := 0;
  v_progress integer := 0;
  v_commission_days integer := 0;
  v_raid_clears integer := 0;
  v_donated_merits integer := 0;
begin
  if v_user_id is null then raise exception '需要登录后查看赛季据点'; end if;
  if p_season_id !~ '^[a-z][a-z0-9_-]{0,15}$' then raise exception 'invalid season'; end if;
  select guild_id into v_guild_id from public.guild_members where user_id = v_user_id;
  if v_guild_id is null then return null; end if;

  select balance into v_balance from public.guild_member_merits
  where guild_id = v_guild_id and user_id = v_user_id;
  select progress, commission_days, raid_clears, donated_merits
  into v_progress, v_commission_days, v_raid_clears, v_donated_merits
  from public.guild_stronghold_seasons
  where guild_id = v_guild_id and season_id = p_season_id;

  return jsonb_build_object(
    'seasonId', p_season_id,
    'meritBalance', coalesce(v_balance, 0),
    'stronghold', jsonb_build_object(
      'progress', coalesce(v_progress, 0),
      'commissionDays', coalesce(v_commission_days, 0),
      'raidClears', coalesce(v_raid_clears, 0),
      'donatedMerits', coalesce(v_donated_merits, 0),
      'stageId', case
        when coalesce(v_progress, 0) >= 72 then 'citadel'
        when coalesce(v_progress, 0) >= 36 then 'garden'
        when coalesce(v_progress, 0) >= 12 then 'lantern'
        else 'camp'
      end
    ),
    'offers', jsonb_build_array(
      jsonb_build_object(
        'id', 'sakura-pennant', 'name', '樱庭旗印', 'description', '收进本季公会收藏册的旗印。',
        'meritCost', 8, 'locked', false,
        'claimed', exists(
          select 1 from public.guild_shop_claims
          where guild_id = v_guild_id and season_id = p_season_id
            and user_id = v_user_id and offer_id = 'sakura-pennant'
        )
      ),
      jsonb_build_object(
        'id', 'moon-lantern', 'name', '月樱引灯', 'description', '收进本季公会收藏册的月灯。',
        'meritCost', 18, 'locked', false,
        'claimed', exists(
          select 1 from public.guild_shop_claims
          where guild_id = v_guild_id and season_id = p_season_id
            and user_id = v_user_id and offer_id = 'moon-lantern'
        )
      ),
      jsonb_build_object(
        'id', 'legend-crest', 'name', '同行纹章', 'description', '据点抵达繁樱庭院后可领取的纪念纹章。',
        'meritCost', 36, 'locked', coalesce(v_progress, 0) < 36,
        'claimed', exists(
          select 1 from public.guild_shop_claims
          where guild_id = v_guild_id and season_id = p_season_id
            and user_id = v_user_id and offer_id = 'legend-crest'
        )
      )
    )
  );
end;
$$;

-- 捐献和收藏领取都由登录身份、服务端功勋余额、固定档位/价格及幂等 request id 共同约束。
create or replace function public.guild_donate_merit(
  p_season_id text,
  p_request_id uuid,
  p_amount integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_guild_id uuid;
  v_balance integer;
begin
  if v_user_id is null then raise exception '需要登录后捐献'; end if;
  if p_season_id !~ '^[a-z][a-z0-9_-]{0,15}$' or p_amount not in (1, 5, 10) then
    raise exception 'invalid merit donation';
  end if;
  if exists(select 1 from public.guild_merit_spends where request_id = p_request_id) then
    return jsonb_build_object('duplicate', true);
  end if;
  select guild_id into v_guild_id from public.guild_members where user_id = v_user_id;
  if v_guild_id is null then raise exception 'guild membership required'; end if;

  insert into public.guild_member_merits(guild_id, user_id) values (v_guild_id, v_user_id)
  on conflict do nothing;
  select balance into v_balance from public.guild_member_merits
  where guild_id = v_guild_id and user_id = v_user_id for update;
  if exists(select 1 from public.guild_merit_spends where request_id = p_request_id) then
    return jsonb_build_object('duplicate', true);
  end if;
  if v_balance < p_amount then raise exception '功勋不足，先完成公会团本获得功勋'; end if;

  insert into public.guild_merit_spends(
    request_id, guild_id, user_id, season_id, spend_type, amount
  ) values (
    p_request_id, v_guild_id, v_user_id, p_season_id, 'donation', p_amount
  );
  update public.guild_member_merits
  set balance = balance - p_amount, spent_total = spent_total + p_amount, updated_at = now()
  where guild_id = v_guild_id and user_id = v_user_id
  returning balance into v_balance;
  perform public.guild_add_stronghold_source(
    v_guild_id, p_season_id, 'donation:' || p_request_id::text, 'donation', p_amount
  );
  return jsonb_build_object('duplicate', false, 'balance', v_balance);
end;
$$;

create or replace function public.guild_claim_shop_offer(
  p_season_id text,
  p_request_id uuid,
  p_offer_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_guild_id uuid;
  v_balance integer;
  v_progress integer := 0;
  v_cost integer;
  v_required_progress integer;
begin
  if v_user_id is null then raise exception '需要登录后领取收藏'; end if;
  if p_season_id !~ '^[a-z][a-z0-9_-]{0,15}$' then raise exception 'invalid season'; end if;
  case p_offer_id
    when 'sakura-pennant' then v_cost := 8; v_required_progress := 0;
    when 'moon-lantern' then v_cost := 18; v_required_progress := 0;
    when 'legend-crest' then v_cost := 36; v_required_progress := 36;
    else raise exception 'invalid guild shop offer';
  end case;
  if exists(select 1 from public.guild_merit_spends where request_id = p_request_id) then
    return jsonb_build_object('duplicate', true);
  end if;
  select guild_id into v_guild_id from public.guild_members where user_id = v_user_id;
  if v_guild_id is null then raise exception 'guild membership required'; end if;

  insert into public.guild_member_merits(guild_id, user_id) values (v_guild_id, v_user_id)
  on conflict do nothing;
  select balance into v_balance from public.guild_member_merits
  where guild_id = v_guild_id and user_id = v_user_id for update;
  if exists(select 1 from public.guild_merit_spends where request_id = p_request_id) then
    return jsonb_build_object('duplicate', true);
  end if;
  if exists(
    select 1 from public.guild_shop_claims
    where guild_id = v_guild_id and season_id = p_season_id
      and user_id = v_user_id and offer_id = p_offer_id
  ) then
    return jsonb_build_object('alreadyClaimed', true, 'balance', v_balance);
  end if;
  select progress into v_progress from public.guild_stronghold_seasons
  where guild_id = v_guild_id and season_id = p_season_id;
  if coalesce(v_progress, 0) < v_required_progress then
    raise exception '据点阶段不足，先和旅伴推进赛季据点';
  end if;
  if v_balance < v_cost then raise exception '功勋不足，先完成公会团本获得功勋'; end if;

  insert into public.guild_merit_spends(
    request_id, guild_id, user_id, season_id, spend_type, amount, offer_id
  ) values (
    p_request_id, v_guild_id, v_user_id, p_season_id, 'shop', v_cost, p_offer_id
  );
  insert into public.guild_shop_claims(guild_id, season_id, user_id, offer_id)
  values (v_guild_id, p_season_id, v_user_id, p_offer_id);
  update public.guild_member_merits
  set balance = balance - v_cost, spent_total = spent_total + v_cost, updated_at = now()
  where guild_id = v_guild_id and user_id = v_user_id
  returning balance into v_balance;
  return jsonb_build_object('claimed', true, 'balance', v_balance);
end;
$$;

revoke all on function public.guild_add_stronghold_source(uuid, text, text, text, integer) from public;
revoke all on function public.guild_record_raid_stronghold() from public;
revoke all on function public.guild_award_merit(uuid, uuid) from public, anon, authenticated;
revoke all on function public.guild_apply_commission_stronghold(uuid, date, text) from public, anon, authenticated;
revoke all on function public.guild_get_stronghold_state(text) from public;
revoke all on function public.guild_donate_merit(text, uuid, integer) from public;
revoke all on function public.guild_claim_shop_offer(text, uuid, text) from public;

grant execute on function public.guild_award_merit(uuid, uuid) to service_role;
grant execute on function public.guild_apply_commission_stronghold(uuid, date, text) to service_role;
grant execute on function public.guild_get_stronghold_state(text) to authenticated;
grant execute on function public.guild_donate_merit(text, uuid, integer) to authenticated;
grant execute on function public.guild_claim_shop_offer(text, uuid, text) to authenticated;
