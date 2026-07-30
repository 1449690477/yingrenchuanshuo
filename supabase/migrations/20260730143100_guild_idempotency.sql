-- 公会远征全局幂等请求账本：即使较新的挑战已完成，旧请求重发也不会再次计数。

create table if not exists public.guild_submission_requests (
  request_id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  guild_id uuid not null references public.guilds(id) on delete cascade,
  week_key text not null,
  day_key text not null,
  build_hash text not null,
  submission_index int not null check (submission_index between 1 and 3),
  result jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.guild_submission_requests enable row level security;
revoke all on public.guild_submission_requests from anon, authenticated;

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
  v_guild_id uuid; v_row public.guild_contributions%rowtype; v_delta int; v_result jsonb;
  v_request_build_hash text;
  v_progress bigint; v_target bigint; v_completed boolean; v_just_completed boolean := false;
begin
  select result, build_hash into v_result, v_request_build_hash from public.guild_submission_requests
  where request_id = p_request_id and user_id = p_user_id;
  if v_result is not null then
    if v_request_build_hash <> p_build_hash then
      raise exception '同一远征请求不能更换角色搭配';
    end if;
    return v_result;
  end if;

  select guild_id into v_guild_id from public.guild_members where user_id = p_user_id;
  if v_guild_id is null then raise exception '你还没有加入公会'; end if;
  if p_points < 0 or p_points > 1000 then raise exception '贡献值越界'; end if;

  insert into public.guild_contributions(guild_id, week_key, day_key, user_id)
  values (v_guild_id, p_week_key, p_day_key, p_user_id)
  on conflict do nothing;
  select * into v_row from public.guild_contributions
  where guild_id = v_guild_id and week_key = p_week_key and day_key = p_day_key and user_id = p_user_id
  for update;

  -- 获得行锁后再查一次，封住同一 request_id 并发提交的竞态窗口。
  select result, build_hash into v_result, v_request_build_hash
  from public.guild_submission_requests
  where request_id = p_request_id and user_id = p_user_id;
  if v_result is not null then
    if v_request_build_hash <> p_build_hash then
      raise exception '同一远征请求不能更换角色搭配';
    end if;
    return v_result;
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

  v_result := jsonb_build_object(
    'points', p_points, 'improvedBy', v_delta, 'bestPoints', greatest(v_row.best_points, p_points),
    'attemptsUsed', v_row.attempts + 1, 'progress', v_progress, 'target', v_target,
    'completed', v_completed or v_just_completed, 'justCompleted', v_just_completed
  );
  update public.guild_contributions set last_result = v_result
  where guild_id = v_guild_id and week_key = p_week_key and day_key = p_day_key and user_id = p_user_id;
  insert into public.guild_submission_requests(
    request_id, user_id, guild_id, week_key, day_key, build_hash, submission_index, result
  ) values (
    p_request_id, p_user_id, v_guild_id, p_week_key, p_day_key,
    p_build_hash, v_row.attempts + 1, v_result
  );
  return v_result;
end;
$$;

revoke all on function public.guild_apply_contribution(uuid, text, text, uuid, int, text, int, int) from public;
grant execute on function public.guild_init_expedition(uuid, text, int, text, int) to service_role;
grant execute on function public.guild_apply_contribution(uuid, text, text, uuid, int, text, int, int) to service_role;
