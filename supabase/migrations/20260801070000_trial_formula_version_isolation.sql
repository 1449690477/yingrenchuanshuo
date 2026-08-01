-- 周常试炼榜单按公式版本物理隔离。
--
-- 060000 只给成绩打上版本戳；若唯一键、读取 RPC 和榜单索引仍不含版本，
-- v1 的历史最好成绩会阻止同一玩家写入 v2，且新旧伤害还会混在同一张榜里。
-- 本迁移必须在新版 submit-trial / 客户端部署前执行。

-- 每个公式版本各自保留一条最好成绩。存量行由 060000 标为 v1，故加列后
-- 不会产生冲突。
alter table public.trial_scores
  drop constraint if exists trial_scores_user_id_season_id_week_index_bracket_id_key;

alter table public.trial_scores
  add constraint trial_scores_user_season_week_bracket_formula_key
  unique (user_id, season_id, week_index, bracket_id, trial_formula_version);

drop index if exists public.trial_scores_board_idx;
create index trial_scores_board_idx
  on public.trial_scores (
    season_id,
    week_index,
    bracket_id,
    trial_formula_version,
    class_id,
    damage desc
  );

-- 旧 PWA 仍调用不带版本参数的 RPC。它只能看到旧公式 v1，不能在部署窗口
-- 混入 v2。保留原函数名与签名，避免旧客户端直接 PGRST202。
create or replace function public.trial_neighborhood(
  p_season_id text,
  p_week_index int,
  p_bracket_id text,
  p_class_id text default null,
  p_user_id uuid default null,
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
      and t.trial_formula_version = 1
      and (p_class_id is null or t.class_id = p_class_id)
      and t.verified
  ), anchor as (
    select coalesce(
      (select b.r from board b where b.user_id = p_user_id),
      (select max(b.r) from board b)
    ) as r
  )
  select
    b.r as rank,
    b.user_id,
    b.display_name,
    b.class_id,
    b.damage,
    b.n as total,
    (b.user_id = p_user_id) as is_me
  from board b, anchor a
  where a.r is not null
    and b.r between greatest(1, a.r - p_radius) and a.r + p_radius
  order by b.r;
$$;

grant execute on function public.trial_neighborhood(text, int, text, text, uuid, int)
  to anon, authenticated;

-- 新客户端必须显式选择自己的公式版本。这里不提供版本默认值，漏传时让
-- PostgREST 明确报错，不能静默回落到 v1 或把多个版本混在一起。
create or replace function public.trial_neighborhood_versioned(
  p_season_id text,
  p_week_index int,
  p_bracket_id text,
  p_formula_version smallint,
  p_class_id text default null,
  p_user_id uuid default null,
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
      and t.trial_formula_version = p_formula_version
      and (p_class_id is null or t.class_id = p_class_id)
      and t.verified
  ), anchor as (
    select coalesce(
      (select b.r from board b where b.user_id = p_user_id),
      (select max(b.r) from board b)
    ) as r
  )
  select
    b.r as rank,
    b.user_id,
    b.display_name,
    b.class_id,
    b.damage,
    b.n as total,
    (b.user_id = p_user_id) as is_me
  from board b, anchor a
  where a.r is not null
    and b.r between greatest(1, a.r - p_radius) and a.r + p_radius
  order by b.r;
$$;

grant execute on function public.trial_neighborhood_versioned(
  text,
  int,
  text,
  smallint,
  text,
  uuid,
  int
) to anon, authenticated;

comment on function public.trial_neighborhood_versioned(
  text,
  int,
  text,
  smallint,
  text,
  uuid,
  int
) is '按明确试炼公式版本返回邻域榜；版本参数不得省略。';

