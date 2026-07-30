-- 试炼邻域榜修复：未上榜时锚定榜尾，职业为空时看全分段
--
-- 线上实测（2026-07-30，trial_scores 共 8 行且全部 verified）：
--   A 我有成绩 + 指定职业        → rows=1   机制本身没问题
--   B 我有成绩 + 职业 null        → rows=0   ← bug
--   C 榜上有 8 条 + 我没成绩      → rows=0   ← bug（玩家实际撞的就是这个）
--   D 省略职业参数                → PGRST202 ← bug
--
-- 三处根因，都在原函数的最后一段：
--
-- 1) `from board b, me` 是交叉连接。me = 「我在这个桶里的排名」，
--    玩家本周没交成绩时 me 是空集，交叉连接的结果就是零行 ——
--    榜上明明有数据，却整块看不见。这是「邻域榜是默认视图」（docs/51 §5.1）
--    最不能出的故障：新玩家第一次点开榜单，永远是空的。
--
-- 2) `t.class_id = p_class_id` 在 p_class_id 为 null 时恒为假（SQL 三值逻辑），
--    于是 docs/51 §3.4 写明的「缺省为该分段的全服总榜」结构性永远为空。
--    fetchTrialTop 用 `if (filter.classId)` 处理对了，这里没有。
--
-- 3) p_class_id 没有 SQL 默认值，客户端省略该参数时 PostgREST 直接按
--    「函数不存在」报错（PGRST202），而不是走总榜。
--
-- 锚点为什么落在榜尾而不是榜首：docs/51 §5.1 的原话是「第 3000 名看到
-- 第 2998 名只领先他 2%，是够得着的目标；看到第 1 名领先他 40 倍，只会关掉」。
-- 没上榜的玩家要看的是「打到多少能挤进去」，那个数字在榜尾，不在榜首。
--
-- 未上榜时返回的行里 is_me 全为 false，客户端据此区分「我的邻域」与
-- 「榜尾预览」，无需改返回列（改返回列要 drop function，会丢授权）。

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
      and (p_class_id is null or t.class_id = p_class_id)
      and t.verified
  ), anchor as (
    -- 无 from 的 select 恒返回一行，所以下面的交叉连接不会再被空集吃掉。
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
