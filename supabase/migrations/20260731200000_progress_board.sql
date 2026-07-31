-- 进度榜（docs/63 §五 · P4，docs/51 §4 榜 3「开荒者的荣誉」）：专用表 progress_records。
--
-- 为什么不走 profiles 加两列（docs/63 §五 的原始建议，已撤回）：
-- profiles 的 own-row 写策略是 for all，已登录客户端可以直接 PATCH
-- 自己那行的任何列 —— 竞速榜挂上去等于把名次开放给客户端自填。
-- 照 milestones / dungeon_records 同构：RLS 全员只读、客户端没有任何
-- 写策略、只有 service role 经 security definer RPC 写入。

create table if not exists public.progress_records (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  deepest_stage_id text not null,
  deepest_stage_index int not null check (deepest_stage_index >= 0),
  -- 首通时刻；老档无记录为 null（不补记：没有证据就不能主张更早，docs/62 §4.1）
  deepest_stage_at timestamptz,
  -- L3 软旗标：同源 evaluateChapterGate 判定；false = 收下但不入榜
  verified boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.progress_records enable row level security;

-- 榜单是公开的：全员可读
drop policy if exists "progress readable" on public.progress_records;
create policy "progress readable" on public.progress_records for select using (true);
-- 没有任何 insert/update/delete 策略 —— 客户端连自己的行都不能写

-- 榜单查询：只在 verified 行内排（部分索引省体积）
create index if not exists progress_records_board_idx
  on public.progress_records (deepest_stage_index desc, deepest_stage_at asc nulls last)
  where verified;

-- L2 原子单调 upsert（只升不降）：
--   · 新序号更大 → 整行覆盖（更深的首通取代旧的，verified 以新判定为准）
--   · 同序号 → 只允许两种动作：①null→有值 补时刻（同一关后来才报上时刻）
--               ②verified false→true 翻正 —— 给「清装备导致战力低于门槛
--               被误标」的合法玩家留恢复路；反向 true→false 永不允许（堵洗白）
--   · 序号更小 → 一字不改（另一台设备报过更深的进度，榜上以更深的为准）
-- 行锁（select ... for update）封住同一账号并发提交的竞态窗口。
create or replace function public.submit_progress_record(
  p_user_id uuid,
  p_stage_id text,
  p_stage_index int,
  p_stage_at timestamptz,
  p_verified boolean
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_row public.progress_records%rowtype;
begin
  select * into v_row from public.progress_records where user_id = p_user_id for update;

  if not found then
    insert into public.progress_records(
      user_id, deepest_stage_id, deepest_stage_index, deepest_stage_at, verified
    ) values (
      p_user_id, p_stage_id, p_stage_index, p_stage_at, p_verified
    ) returning * into v_row;
  else
    if p_stage_index > v_row.deepest_stage_index then
      update public.progress_records set
        deepest_stage_id = p_stage_id,
        deepest_stage_index = p_stage_index,
        deepest_stage_at = p_stage_at,
        verified = p_verified,
        updated_at = now()
      where user_id = p_user_id;
    elsif p_stage_index = v_row.deepest_stage_index
      and (
        (v_row.deepest_stage_at is null and p_stage_at is not null)
        or (not v_row.verified and p_verified)
      )
    then
      update public.progress_records set
        deepest_stage_at = coalesce(v_row.deepest_stage_at, p_stage_at),
        verified = v_row.verified or p_verified,
        updated_at = now()
      where user_id = p_user_id;
    end if;
    select * into v_row from public.progress_records where user_id = p_user_id;
  end if;

  return jsonb_build_object(
    'deepestStageId', v_row.deepest_stage_id,
    'deepestStageIndex', v_row.deepest_stage_index,
    'firstClearedAt',
      case when v_row.deepest_stage_at is null then null
           else floor(extract(epoch from v_row.deepest_stage_at) * 1000)::bigint end,
    'verified', v_row.verified
  );
end;
$$;

-- 只允许 service role 调用（Edge Function）；客户端直调会被拒
revoke all on function public.submit_progress_record(uuid, text, int, timestamptz, boolean) from public;
grant execute on function public.submit_progress_record(uuid, text, int, timestamptz, boolean) to service_role;
