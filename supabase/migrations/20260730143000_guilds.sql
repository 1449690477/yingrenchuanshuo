-- 异步公会与每周远征（OpenSpec: add-async-guild-expedition）
-- 客户端不能直接写核心表；成员变更走原子 RPC，战斗贡献只走 Edge Function。

create table if not exists public.guilds (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 12),
  notice text not null default '' check (char_length(notice) <= 80),
  leader_id uuid not null references public.profiles(id) on delete cascade,
  reputation bigint not null default 0 check (reputation >= 0),
  expedition_clears int not null default 0 check (expedition_clears >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guild_members (
  guild_id uuid not null references public.guilds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('leader', 'member')),
  joined_at timestamptz not null default now(),
  primary key (guild_id, user_id),
  unique (user_id)
);

create index if not exists guild_members_joined_idx
  on public.guild_members (guild_id, joined_at, user_id);

create table if not exists public.guild_expeditions (
  guild_id uuid not null references public.guilds(id) on delete cascade,
  season_id text not null references public.seasons(id),
  week_index int not null check (week_index >= 0),
  week_key text not null,
  member_snapshot int not null check (member_snapshot between 1 and 20),
  target bigint not null check (target > 0),
  progress bigint not null default 0 check (progress >= 0),
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (guild_id, week_key),
  unique (guild_id, season_id, week_index)
);

create table if not exists public.guild_contributions (
  guild_id uuid not null,
  week_key text not null,
  day_key text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  attempts int not null default 0 check (attempts between 0 and 3),
  best_points int not null default 0 check (best_points between 0 and 1000),
  build_hash text not null default '',
  last_request_id uuid,
  last_result jsonb,
  updated_at timestamptz not null default now(),
  primary key (guild_id, week_key, day_key, user_id),
  foreign key (guild_id, week_key)
    references public.guild_expeditions(guild_id, week_key) on delete cascade
);

create index if not exists guild_contributions_week_idx
  on public.guild_contributions (guild_id, week_key, best_points desc);

alter table public.guilds enable row level security;
alter table public.guild_members enable row level security;
alter table public.guild_expeditions enable row level security;
alter table public.guild_contributions enable row level security;

drop policy if exists "guild summaries readable" on public.guilds;
create policy "guild summaries readable" on public.guilds for select to authenticated using (true);

-- 成员名册本身只含公开档案身份；贡献明细仍只通过安全函数返回。
drop policy if exists "guild members readable" on public.guild_members;
create policy "guild members readable" on public.guild_members for select to authenticated using (true);

revoke insert, update, delete on public.guilds from anon, authenticated;
revoke insert, update, delete on public.guild_members from anon, authenticated;
revoke all on public.guild_expeditions from anon, authenticated;
revoke all on public.guild_contributions from anon, authenticated;

create or replace function public.guild_list(p_limit int default 30)
returns table (
  id uuid,
  name text,
  notice text,
  reputation bigint,
  expedition_clears int,
  member_count bigint,
  member_limit int
)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.notice, g.reputation, g.expedition_clears,
         count(m.user_id) as member_count, 20 as member_limit
  from public.guilds g
  left join public.guild_members m on m.guild_id = g.id
  group by g.id
  having count(m.user_id) < 20
  order by g.reputation desc, g.created_at asc
  limit greatest(1, least(coalesce(p_limit, 30), 50));
$$;

create or replace function public.guild_get_my_state()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_guild_id uuid;
  v_result jsonb;
begin
  if v_uid is null then raise exception '需要登录后查看公会'; end if;
  select guild_id into v_guild_id from public.guild_members where user_id = v_uid;
  if v_guild_id is null then return null; end if;

  select jsonb_build_object(
    'guild', jsonb_build_object(
      'id', g.id, 'name', g.name, 'notice', g.notice, 'leaderId', g.leader_id,
      'reputation', g.reputation, 'expeditionClears', g.expedition_clears,
      'memberCount', (select count(*) from public.guild_members x where x.guild_id = g.id),
      'memberLimit', 20
    ),
    'myRole', (select role from public.guild_members x where x.guild_id = g.id and x.user_id = v_uid),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', m.user_id, 'displayName', p.display_name, 'classId', p.class_id,
        'level', p.level, 'combatPower', p.combat_power, 'role', m.role, 'joinedAt', m.joined_at
      ) order by case when m.role = 'leader' then 0 else 1 end, m.joined_at, m.user_id)
      from public.guild_members m join public.profiles p on p.id = m.user_id
      where m.guild_id = g.id
    ), '[]'::jsonb)
  ) into v_result
  from public.guilds g where g.id = v_guild_id;
  return v_result;
end;
$$;

create or replace function public.guild_create(p_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if v_uid is null then raise exception '需要登录后创建公会'; end if;
  if char_length(v_name) not between 2 and 12 then raise exception '公会名称需要 2～12 个字'; end if;
  if not exists (select 1 from public.profiles where id = v_uid) then raise exception '请先完成玩家档案同步'; end if;
  if exists (select 1 from public.guild_members where user_id = v_uid) then raise exception '你已经加入公会'; end if;

  insert into public.guilds(name, leader_id) values (v_name, v_uid) returning id into v_id;
  insert into public.guild_members(guild_id, user_id, role) values (v_id, v_uid, 'leader');
  return v_id;
end;
$$;

create or replace function public.guild_join(p_guild_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then raise exception '需要登录后加入公会'; end if;
  if exists (select 1 from public.guild_members where user_id = v_uid) then raise exception '你已经加入公会'; end if;
  perform 1 from public.guilds where id = p_guild_id for update;
  if not found then raise exception '公会不存在或已经解散'; end if;
  select count(*) into v_count from public.guild_members where guild_id = p_guild_id;
  if v_count >= 20 then raise exception '公会已经满员'; end if;
  insert into public.guild_members(guild_id, user_id, role) values (p_guild_id, v_uid, 'member');
end;
$$;

create or replace function public.guild_leave()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_guild_id uuid;
  v_role text;
  v_next uuid;
begin
  select guild_id, role into v_guild_id, v_role
  from public.guild_members where user_id = v_uid for update;
  if v_guild_id is null then raise exception '你还没有加入公会'; end if;

  perform 1 from public.guilds where id = v_guild_id for update;
  if v_role = 'leader' then
    select user_id into v_next from public.guild_members
    where guild_id = v_guild_id and user_id <> v_uid
    order by joined_at, user_id limit 1;
    if v_next is null then
      delete from public.guilds where id = v_guild_id;
      return;
    end if;
    update public.guild_members set role = 'leader' where guild_id = v_guild_id and user_id = v_next;
    update public.guilds set leader_id = v_next, updated_at = now() where id = v_guild_id;
  end if;
  delete from public.guild_members where guild_id = v_guild_id and user_id = v_uid;
end;
$$;

create or replace function public.guild_update_notice(p_notice text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_notice text := btrim(coalesce(p_notice, ''));
begin
  if char_length(v_notice) > 80 then raise exception '公会公告最多 80 个字'; end if;
  update public.guilds g set notice = v_notice, updated_at = now()
  where g.leader_id = v_uid;
  if not found then raise exception '只有会长可以修改公告'; end if;
end;
$$;

create or replace function public.guild_remove_member(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_guild_id uuid;
begin
  select id into v_guild_id from public.guilds where leader_id = v_uid for update;
  if v_guild_id is null then raise exception '只有会长可以移除成员'; end if;
  if p_user_id = v_uid then raise exception '会长请使用退出公会'; end if;
  delete from public.guild_members where guild_id = v_guild_id and user_id = p_user_id and role = 'member';
  if not found then raise exception '成员不存在或已经离开'; end if;
end;
$$;

-- 仅 service_role 调用：锁定本周目标并返回远征、今日成绩与贡献榜。
create or replace function public.guild_init_expedition(
  p_user_id uuid,
  p_season_id text,
  p_week_index int,
  p_week_key text,
  p_target_per_member int
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_guild_id uuid; v_members int; v_day_key text;
begin
  select guild_id into v_guild_id from public.guild_members where user_id = p_user_id;
  if v_guild_id is null then raise exception '你还没有加入公会'; end if;
  select count(*) into v_members from public.guild_members where guild_id = v_guild_id;
  insert into public.guild_expeditions(
    guild_id, season_id, week_index, week_key, member_snapshot, target
  ) values (
    v_guild_id, p_season_id, p_week_index, p_week_key, greatest(1, v_members),
    greatest(1, v_members) * p_target_per_member
  ) on conflict (guild_id, week_key) do nothing;

  return jsonb_build_object(
    'guildId', v_guild_id,
    'expedition', (select jsonb_build_object(
      'seasonId', e.season_id, 'weekIndex', e.week_index, 'weekKey', e.week_key,
      'memberSnapshot', e.member_snapshot, 'target', e.target, 'progress', e.progress,
      'completed', e.completed, 'completedAt', e.completed_at
    ) from public.guild_expeditions e where e.guild_id = v_guild_id and e.week_key = p_week_key),
    'leaders', coalesce((select jsonb_agg(x) from (
      select jsonb_build_object('userId', c.user_id, 'displayName', p.display_name,
        'bestPoints', sum(c.best_points)) as x
      from public.guild_contributions c join public.profiles p on p.id = c.user_id
      where c.guild_id = v_guild_id and c.week_key = p_week_key
      group by c.user_id, p.display_name order by sum(c.best_points) desc limit 20
    ) ranked), '[]'::jsonb)
  );
end;
$$;

-- 仅 service_role 调用：幂等地应用今日最好成绩差额与首次周完成声望。
create or replace function public.guild_apply_contribution(
  p_user_id uuid,
  p_week_key text,
  p_day_key text,
  p_request_id uuid,
  p_points int,
  p_build_hash text,
  p_max_submissions int,
  p_clear_reputation int
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_guild_id uuid; v_row public.guild_contributions%rowtype; v_delta int;
  v_progress bigint; v_target bigint; v_completed boolean; v_just_completed boolean := false;
begin
  select guild_id into v_guild_id from public.guild_members where user_id = p_user_id;
  if v_guild_id is null then raise exception '你还没有加入公会'; end if;
  if p_points < 0 or p_points > 1000 then raise exception '贡献值越界'; end if;

  insert into public.guild_contributions(guild_id, week_key, day_key, user_id)
  values (v_guild_id, p_week_key, p_day_key, p_user_id)
  on conflict do nothing;
  select * into v_row from public.guild_contributions
  where guild_id = v_guild_id and week_key = p_week_key and day_key = p_day_key and user_id = p_user_id
  for update;

  if v_row.last_request_id = p_request_id and v_row.last_result is not null then
    return v_row.last_result;
  end if;
  if v_row.attempts >= p_max_submissions then raise exception '今日远征尝试已经用完'; end if;

  v_delta := greatest(0, p_points - v_row.best_points);
  update public.guild_contributions set
    attempts = attempts + 1,
    best_points = greatest(best_points, p_points),
    build_hash = case when p_points > best_points then p_build_hash else build_hash end,
    last_request_id = p_request_id,
    updated_at = now()
  where guild_id = v_guild_id and week_key = p_week_key and day_key = p_day_key and user_id = p_user_id;

  update public.guild_expeditions set progress = progress + v_delta, updated_at = now()
  where guild_id = v_guild_id and week_key = p_week_key
  returning progress, target, completed into v_progress, v_target, v_completed;
  if not found then raise exception '本周远征尚未初始化'; end if;

  if not v_completed and v_progress >= v_target then
    update public.guild_expeditions set completed = true, completed_at = now()
    where guild_id = v_guild_id and week_key = p_week_key and completed = false;
    if found then
      v_just_completed := true;
      update public.guilds set reputation = reputation + p_clear_reputation,
        expedition_clears = expedition_clears + 1, updated_at = now()
      where id = v_guild_id;
    end if;
  end if;

  v_row.last_result := jsonb_build_object(
    'points', p_points, 'improvedBy', v_delta, 'bestPoints', greatest(v_row.best_points, p_points),
    'attemptsUsed', v_row.attempts + 1, 'progress', v_progress, 'target', v_target,
    'completed', v_completed or v_just_completed, 'justCompleted', v_just_completed
  );
  update public.guild_contributions set last_result = v_row.last_result
  where guild_id = v_guild_id and week_key = p_week_key and day_key = p_day_key and user_id = p_user_id;
  return v_row.last_result;
end;
$$;

revoke all on function public.guild_list(int) from public;
revoke all on function public.guild_get_my_state() from public;
revoke all on function public.guild_create(text) from public;
revoke all on function public.guild_join(uuid) from public;
revoke all on function public.guild_leave() from public;
revoke all on function public.guild_update_notice(text) from public;
revoke all on function public.guild_remove_member(uuid) from public;
revoke all on function public.guild_init_expedition(uuid, text, int, text, int) from public;
revoke all on function public.guild_apply_contribution(uuid, text, text, uuid, int, text, int, int) from public;

grant execute on function public.guild_list(int) to authenticated;
grant execute on function public.guild_get_my_state() to authenticated;
grant execute on function public.guild_create(text) to authenticated;
grant execute on function public.guild_join(uuid) to authenticated;
grant execute on function public.guild_leave() to authenticated;
grant execute on function public.guild_update_notice(text) to authenticated;
grant execute on function public.guild_remove_member(uuid) to authenticated;
-- init/apply remain service_role-only (service_role bypasses grants/RLS).
