-- ═══════════════════════════════════════════════════════════════════
-- 联机排行榜 · 建表与策略（docs/51-联机排行榜设计方案.md §6）
--
-- 在 Supabase SQL Editor 整段执行，或 `supabase db push`。
-- 设计红线：
--   - 成绩表【不给客户端 insert 权限】：客户端只能调用 Edge Function
--     submit-trial，伤害由服务端复算产生（§6.3）
--   - 榜单对所有人可读（排行榜是公开信息）
--   - L3/L4 合理性检查不通过的行 verified = false，只移出展示，不封号
-- ═══════════════════════════════════════════════════════════════════

-- ─── 玩家公开档案（一人一行） ───
create table if not exists public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  display_name  text not null check (char_length(display_name) between 1 and 20),
  class_id      text not null check (class_id in ('swordsman','witch','shaman','catkin')),
  level         int  not null check (level between 1 and 120),
  combat_power  bigint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists profiles_power_idx on public.profiles (combat_power desc);

-- ─── 赛季 ───
create table if not exists public.seasons (
  id          text primary key,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null
);

insert into public.seasons (id, starts_at, ends_at)
values ('s1', '2026-01-05T04:00:00+08:00', '2099-01-01T04:00:00+08:00')
on conflict (id) do nothing;

-- ─── 周常试炼成绩（每人每周每分段一行，保留最好） ───
create table if not exists public.trial_scores (
  id           bigserial primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  season_id    text not null references public.seasons(id),
  week_index   int  not null,
  bracket_id   text not null,             -- 'chuying' | 'feiyue' | 'hupo' | 'feiying'
  class_id     text not null check (class_id in ('swordsman','witch','shaman','catkin')),
  damage       bigint not null check (damage >= 0),
  build_hash   text not null,             -- 提交搭配的哈希，便于查重与复现
  verified     boolean not null default false,
  created_at   timestamptz not null default now(),
  -- 玩家跨周升级会换分段；每周每分段各自保留最好成绩
  unique (user_id, season_id, week_index, bracket_id)
);

create index if not exists trial_scores_board_idx
  on public.trial_scores (season_id, week_index, bracket_id, class_id, damage desc);

-- ─── 里程碑用时（登顶速度榜，P2 预留） ───
create table if not exists public.milestones (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  milestone    int  not null,             -- 50 / 80 / 110
  elapsed_ms   bigint not null check (elapsed_ms > 0),
  verified     boolean not null default false,
  primary key (user_id, milestone)
);

-- ─── RLS：必须开，且必须这样开（§6.2） ───
alter table public.profiles     enable row level security;
alter table public.trial_scores enable row level security;
alter table public.milestones   enable row level security;
-- ⚠ seasons 也必须开。Supabase 默认把 public schema 的表授权给 anon，
-- 没开 RLS 的表等于完全敞开：任何人都能改甚至删掉赛季行，直接搞坏榜单。
alter table public.seasons      enable row level security;

-- 所有人可读（排行榜是公开的）
drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select using (true);

drop policy if exists "trial readable" on public.trial_scores;
create policy "trial readable" on public.trial_scores for select using (true);

drop policy if exists "milestones readable" on public.milestones;
create policy "milestones readable" on public.milestones for select using (true);

-- 赛季只读：客户端要读它算当前周次，但不该能写
drop policy if exists "seasons readable" on public.seasons;
create policy "seasons readable" on public.seasons for select using (true);

-- 只能写自己的档案（成绩表不给任何客户端写策略 → 只能走 Edge Function）
drop policy if exists "own profile upsert" on public.profiles;
create policy "own profile upsert" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- ─── 邻域榜 RPC（§5.1：「你 ±5 名」是默认视图） ───
-- 用 row_number 而不是 rank：并列也要占满连续名次，±5 窗口才干净。
-- verified = false 的成绩对所有人不可见（移出展示，但数据保留待审）。
create or replace function public.trial_neighborhood(
  p_season_id text,
  p_week_index int,
  p_bracket_id text,
  p_class_id text,
  p_user_id uuid,
  p_radius int default 5
)
returns table (
  rank bigint,
  user_id uuid,
  display_name text,
  class_id text,
  damage bigint,
  total bigint,
  is_me boolean
)
language sql stable security invoker set search_path = public as $$
  with board as (
    select
      t.user_id,
      p.display_name,
      t.class_id,
      t.damage,
      row_number() over (order by t.damage desc, t.created_at asc) as r,
      count(*) over () as n
    from trial_scores t
    join profiles p on p.id = t.user_id
    where t.season_id = p_season_id
      and t.week_index = p_week_index
      and t.bracket_id = p_bracket_id
      and t.class_id = p_class_id
      and t.verified
  ), me as (
    select r from board where board.user_id = p_user_id
  )
  select
    b.r as rank,
    b.user_id,
    b.display_name,
    b.class_id,
    b.damage,
    b.n as total,
    (b.user_id = p_user_id) as is_me
  from board b, me
  where b.r between greatest(1, me.r - p_radius) and me.r + p_radius
  order by b.r;
$$;

grant execute on function public.trial_neighborhood(text, int, text, text, uuid, int)
  to anon, authenticated;
