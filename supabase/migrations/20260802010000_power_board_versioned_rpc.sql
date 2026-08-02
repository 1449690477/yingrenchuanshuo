-- ═══════════════════════════════════════════════════════════════════
-- 战力榜的版本过滤挪到服务端（docs/73 批3-3 收尾）
--
-- ── 要修的是什么 ──
-- 战力榜的过滤曾经是「版本号完全相等」，而**相等的两侧来自两个独立部署的
-- 产物**：客户端 bundle 里的 CP_FORMULA_VERSION（src/core/cpFormulaVersion.ts
-- 编译进 Pages 构建），与 Edge Function bundle 里的同名常量（经
-- src/core/profileProgress.ts 盖进 profiles.cp_formula_version）。
-- 半截发版时这两个数**必然**对不上。
--
-- 2026-08-02 03:38 实测到这个窗口：12 个 Edge 部署完（常量 = 3），
-- Pages CI 连红三次没上线（线上 bundle 仍是常量 = 2），线上 profiles
-- 分布 v1=53 / v2=6 / v3=2。后果方向与直觉相反 —— 玩家进游戏触发一次
-- 档案同步会被盖成 3，于是从旧客户端的榜上**消失**。而那一刻
-- **没有任何戳值能同时满足客户端要 2、服务端写 3**，
-- 界面上那句「下次同步后自动回到榜上」在这个窗口里是假承诺。
--
-- ── 为什么是「服务端决定版本」而不是「客户端放宽到 .lte」──
-- 放宽只是把混排问题搬了个地方：客户端仍然持有常量、仍然要靠它决定
-- 哪些行标「旧标尺」，两产物握手依旧存在。**只要客户端还持有这个常量，
-- 就还有一个能与服务端错开的数。** 所以这里把常量从客户端彻底拿掉：
-- 版本由服务端在**一个**产物里决定，握手在结构上不可能错开。
--
-- ── 「当前版本」取自哪里：调用者自己那一行 ──
-- 关键判断：**榜的版本 = 看榜这个人自己的戳**，不是某个全局「当前版本」。
--   · 玩家永远在自己那把尺的榜上，**不可能从榜上消失** —— 这是上面那个
--     事故的根因，从形状上取消掉，而不是靠两边对齐来避免。
--   · 排序永远只在同一把尺量出来的数之间发生，混排依然不可能。
--   · 谁被重算成新版本，谁就自动并入新榜；不需要任何人对齐部署顺序。
-- 全局「当前」只用来回答一个展示问题：我这张榜是不是最新那把尺
-- （is_current / pending_recalc），好让界面说一句**在版本不匹配时也成立**的话。
--
-- 未登录（p_user_id 为空）时没有「我的尺」，退回 max(cp_formula_version)，
-- 也就是最新那把尺的榜。
--
-- ── 读取面没有变宽 ──
-- security definer 只是让版本判定不受将来 RLS 收紧的影响、并让计数能数到
-- 完整的表；本函数返回的列与客户端今天直读 profiles 拿到的**完全一致**
-- （display_name / bio / avatar_url / class_id / level / combat_power），
-- 没有新增任何字段的暴露面。search_path 钉 public，与 070000 的两个
-- versioned 函数同约定。
-- ═══════════════════════════════════════════════════════════════════

-- ─── 战力榜主查询 ───
-- 元信息（formula_version / board_total / pending_recalc / is_current）按行重复
-- 携带：客户端只发一次请求就能既拿到榜、又拿到「这张榜是哪把尺、是不是最新的、
-- 还有多少人不在这张榜上」。榜非空时必然带回元信息 —— 而只要调用者有档案，
-- 他自己那行就在榜里，榜就非空。
create or replace function public.power_board(
  p_user_id uuid default null,
  p_limit int default 50
)
returns table (
  id uuid,
  display_name text,
  bio text,
  avatar_url text,
  class_id text,
  level int,
  combat_power bigint,
  formula_version smallint,
  board_total bigint,
  pending_recalc bigint,
  is_current boolean
)
language sql stable security definer set search_path = public as $$
  with ruler as (
    -- 我自己那行的戳；没登录 / 没档案时退回最新那把尺
    select coalesce(
      (select p.cp_formula_version from profiles p where p.id = p_user_id),
      (select max(p.cp_formula_version) from profiles p)
    ) as v
  ), newest as (
    select max(p.cp_formula_version) as v from profiles p
  ), board as (
    select
      p.id,
      p.display_name,
      p.bio,
      p.avatar_url,
      p.class_id,
      p.level,
      p.combat_power,
      p.updated_at,
      count(*) over () as n
    from profiles p, ruler r
    where p.cp_formula_version = r.v
  )
  select
    b.id,
    b.display_name,
    b.bio,
    b.avatar_url,
    b.class_id,
    b.level,
    b.combat_power,
    (select r.v from ruler r) as formula_version,
    b.n as board_total,
    (select count(*) from profiles p, ruler r where p.cp_formula_version <> r.v) as pending_recalc,
    ((select r.v from ruler r) = (select nw.v from newest nw)) as is_current
  from board b
  order by b.combat_power desc, b.updated_at asc
  -- 夹取写全 coalesce：p_limit 显式传 null 时 greatest/least 会整体求值成 null，
  -- limit null 等于**不限制**，一次把整张表发给客户端。070000:233 踩过这个坑。
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

revoke all on function public.power_board(uuid, int) from public;
grant execute on function public.power_board(uuid, int) to anon, authenticated;

comment on function public.power_board(uuid, int) is
  '战力榜：版本由服务端按调用者自己那行的 cp_formula_version 决定，客户端不再持有版本常量。未登录时取最新版本的榜。';

-- ─── 我的名次扫描 ───
-- 为什么不在 SQL 里直接 count 出名次：名次必须与榜单**数同一批人**，而榜单
-- 还要在客户端过一道 isPlausibleCombatPower（上界是等级与职业的函数，用的是
-- 游戏数据表，SQL 里没有）。所以这里只负责「把同一把尺下比我高的行发回去」，
-- 由客户端套上同一道过滤再数 —— 两个数字的口径因此不可能不一致。
--
-- ⚠ 比较基准取**服务端存的** combat_power，不是客户端本地算的那个数。
-- 榜是按存的值排的，用本地值去比会得出一个与榜对不上的名次。
create or replace function public.power_rank_scan(
  p_user_id uuid default null,
  p_limit int default 500
)
returns table (
  level int,
  class_id text,
  combat_power bigint
)
language sql stable security definer set search_path = public as $$
  with me as (
    select p.cp_formula_version as v, p.combat_power as cp
    from profiles p
    where p.id = p_user_id
  ), above as (
    select p.level, p.class_id, p.combat_power
    from profiles p, me
    where p.cp_formula_version = me.v
      and p.combat_power > me.cp
    limit least(greatest(coalesce(p_limit, 500), 1), 1000)
  )
  select a.level, a.class_id, a.combat_power
  from above a
  union all
  -- 我有档案、但没有人比我高时也要发一行出来（各列为 null）：
  -- 否则「查无档案」与「我就是第一名」都是空表，客户端分不出来，
  -- 只能在没有档案的人身上编出一个「第 1 名」。
  select null::int, null::text, null::bigint
  from me
  where not exists (select 1 from above);
$$;

revoke all on function public.power_rank_scan(uuid, int) from public;
grant execute on function public.power_rank_scan(uuid, int) to anon, authenticated;

comment on function public.power_rank_scan(uuid, int) is
  '返回与我同一公式版本、且战力高于我的行（只含定名次所需的三列）。空表 = 查无档案；单行全 null = 有档案且无人在我之上。';

-- ─── 执行顺序：本迁移必须先于新客户端发布 ───
-- 新客户端调 power_board，函数不存在时 PostgREST 返回 PGRST202。
-- 客户端对此有降级（退回直读 profiles，即加版本戳之前的行为），所以顺序
-- 做错不会让榜打不开；但降级期间是新旧混排的，别停在那里。
--
-- ─── 执行后请实跑验证（别只看迁移绿）───
-- 1) 榜的版本跟着调用者走，而不是某个全局常量：
--    select distinct formula_version, is_current, board_total, pending_recalc
--      from public.power_board(
--        (select id from public.profiles where cp_formula_version = 1 limit 1), 50);
--    期望：formula_version = 1，is_current = false，pending_recalc = 非 1 版本的行数。
--    换一个 cp_formula_version = 3 的 id 再跑，formula_version 必须变成 3。
--    **两次跑出同一个 formula_version 就说明版本没跟着调用者走，本迁移白做了。**
--
-- 2) 没有任何一张榜混排（每次调用只有一个版本）：
--    select count(distinct formula_version) from public.power_board(null, 200);
--    期望：1。
--
-- 3) 玩家不会从自己的榜上消失 —— 逐个版本各抽一人，自己必须在自己的榜里：
--    select p.cp_formula_version,
--           exists (select 1 from public.power_board(p.id, 200) b where b.id = p.id) as on_board
--      from public.profiles p
--     where p.id in (select distinct on (cp_formula_version) id
--                      from public.profiles order by cp_formula_version, id);
--    期望：on_board 全为 true。
--
-- 4) limit 夹取（null 不能退化成「不限制」）：
--    select count(*) from public.power_board(null, null);   -- 期望 ≤ 50
--    select count(*) from public.power_board(null, 9999);   -- 期望 ≤ 200
