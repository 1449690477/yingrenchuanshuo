-- 公会邀请码与任意公会详情浏览（公会 UI 重设计配套后端）
-- 1) guilds.invite_code：8 位去歧义短码，唯一，列默认值自动生成，guild_create 无需改动
-- 2) guild_get_detail(p_guild_id)：任何已登录玩家可查看任意公会的公开名册与最近一周远征进度
-- 3) guild_join_by_code(p_code)：凭邀请码直接加入，复用一人一会与 20 人上限约束
-- 4) guild_list 不再过滤满员公会：前端以「已满」置灰展示，公会广场可浏览全部公会

alter table public.guilds add column if not exists invite_code text;

-- 逐行回填短码：字母表去掉 0/O/1/I/L 等易混字符
do $$
declare
  v_guild record;
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_i int;
begin
  for v_guild in select id from public.guilds where invite_code is null loop
    loop
      v_code := '';
      for v_i in 1..8 loop
        v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
      end loop;
      exit when not exists (select 1 from public.guilds where invite_code = v_code);
    end loop;
    update public.guilds set invite_code = v_code where id = v_guild.id;
  end loop;
end;
$$;

alter table public.guilds alter column invite_code set not null;
alter table public.guilds add constraint guilds_invite_code_format
  check (invite_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$');
create unique index if not exists guilds_invite_code_idx on public.guilds (invite_code);

-- 新公会插入时自动获得唯一邀请码
create or replace function public.guild_generate_invite_code()
returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_i int;
begin
  loop
    v_code := '';
    for v_i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.guilds where invite_code = v_code);
  end loop;
  return v_code;
end;
$$;

alter table public.guilds alter column invite_code set default public.guild_generate_invite_code();

-- 我的公会状态补充邀请码（仅成员可见自己公会的码）
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
      'inviteCode', g.invite_code,
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

-- 任意公会公开详情：名片、公开名册与最近一周远征进度；不含邀请码
create or replace function public.guild_get_detail(p_guild_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then raise exception '需要登录后查看公会'; end if;
  select jsonb_build_object(
    'guild', jsonb_build_object(
      'id', g.id, 'name', g.name, 'notice', g.notice,
      'reputation', g.reputation, 'expeditionClears', g.expedition_clears,
      'memberCount', (select count(*) from public.guild_members x where x.guild_id = g.id),
      'memberLimit', 20,
      'leaderName', (select display_name from public.profiles where id = g.leader_id),
      'createdAt', g.created_at
    ),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', m.user_id, 'displayName', p.display_name, 'classId', p.class_id,
        'level', p.level, 'combatPower', p.combat_power, 'role', m.role, 'joinedAt', m.joined_at
      ) order by case when m.role = 'leader' then 0 else 1 end, m.joined_at, m.user_id)
      from public.guild_members m join public.profiles p on p.id = m.user_id
      where m.guild_id = g.id
    ), '[]'::jsonb),
    'expedition', (
      select jsonb_build_object(
        'weekKey', e.week_key, 'progress', e.progress, 'target', e.target, 'completed', e.completed
      )
      from public.guild_expeditions e
      where e.guild_id = g.id
      order by e.week_index desc
      limit 1
    )
  ) into v_result
  from public.guilds g where g.id = p_guild_id;
  if v_result is null then raise exception '公会不存在或已经解散'; end if;
  return v_result;
end;
$$;

-- 凭邀请码加入：与 guild_join 同约束，返回公会名片便于欢迎提示
create or replace function public.guild_join_by_code(p_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_guild_id uuid;
  v_name text;
  v_count int;
begin
  if v_uid is null then raise exception '需要登录后加入公会'; end if;
  if exists (select 1 from public.guild_members where user_id = v_uid) then
    raise exception '你已经加入公会';
  end if;
  select id, name into v_guild_id, v_name from public.guilds
    where invite_code = upper(btrim(coalesce(p_code, ''))) for update;
  if v_guild_id is null then raise exception '邀请码无效，请核对后再试'; end if;
  select count(*) into v_count from public.guild_members where guild_id = v_guild_id;
  if v_count >= 20 then raise exception '公会已经满员'; end if;
  insert into public.guild_members(guild_id, user_id, role) values (v_guild_id, v_uid, 'member');
  return jsonb_build_object('id', v_guild_id, 'name', v_name);
end;
$$;

-- 广场浏览需要看到全部公会（含满员），加入按钮由前端按容量置灰
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
  order by g.reputation desc, g.created_at asc
  limit greatest(1, least(coalesce(p_limit, 30), 50));
$$;

revoke all on function public.guild_generate_invite_code() from public;
revoke all on function public.guild_get_detail(uuid) from public;
revoke all on function public.guild_join_by_code(text) from public;

grant execute on function public.guild_get_detail(uuid) to authenticated;
grant execute on function public.guild_join_by_code(text) to authenticated;
-- invite_code 默认值生成器只由 guild_create（security definer）间接触发，不直接授权
