-- ═══════════════════════════════════════════════════════════════════
-- 战力公式版本戳（docs/73 批3-3）
--
-- 背景：profiles 只存 combat_power 这个数字，**不存算出它的搭配**
-- （sync-profile 拿 equipped 算完 CP 就丢，没有落库）。所以战力公式一改，
-- 线上存量**没有任何重算路径** —— 服务端手里没有重算所需的输入。
-- 这一点由两条独立路径确认：小榜读 sync-profile 源码 195~199 行，
-- 我查表结构 + 线上数据（arena_ranks.build_snapshot 是唯一带搭配的表，0 行）。
--
-- 既然重算不了，就如实标注：每行战力记下它是用哪版公式算的。
-- 旧行等玩家下次同步时被新公式自然重写，玩家零操作，我们不改任何存量数据。
--
-- 被否决的替代方案见 src/core/cpFormulaVersion.ts 文件头
-- （整体缩放存量 = 产出一批「看起来合理、实际是错的」数字）。
--
-- ⚠⚠ **执行顺序与 20260731230000 正好相反，别照着那份的直觉做** ⚠⚠
--   那份（收权限）必须**最后**执行：早了会让旧客户端的直写静默失败。
--   这份（加列）必须**最先**执行：晚了会让新客户端的战力榜**直接报错**。
--   原因：新客户端的 fetchPowerTop 会 select 并 .eq 这一列，
--   列不存在时 PostgREST 返回 42703，玩家看到的是「战力榜读取失败」，
--   **整张榜打不开**，不是少几行的问题。
--   正确顺序：① 执行本迁移 → ② 部署 sync-profile → ③ 发布新客户端。
--   本迁移对旧客户端完全无感：它们既不读也不写这一列，
--   而已有行填 1 保证榜单内容在①之后一行都不变。
-- ═══════════════════════════════════════════════════════════════════

-- ─── 为什么已有行填 1 而不是 0 ───
-- 线上这 60 行**确实是**用当前这版公式（加权和 × spd）算出来的。
-- 填 0（未知）会让它们在版本戳启用当天全部被判成「旧口径」，
-- 榜单当场清空 —— 而实际上那一刻没有任何东西是旧的。
-- 本迁移单独执行时必须是**对榜单完全无感的**：填 1 才做得到。
alter table public.profiles
  add column if not exists cp_formula_version smallint not null default 1;

-- ─── 默认值就停在 1，不要再改成 0 ───
-- 我第一版写的是「再 alter set default 0，让将来的占位档标成 0（从未被算过）」。
-- **那一版是错的**，会误伤真人：本迁移应用之后、sync-profile 重新部署之前
-- 注册的新玩家，由**当时还在线上的旧函数**建档 —— 旧函数不写这一列，
-- 于是落到默认值 0，被判成旧口径、**上不了榜**。他的战力明明是当前公式算的。
-- 那个窗口有多长取决于部署间隔，而误伤真人这件事不该由部署间隔决定。
--
-- 停在 1 就没有这个窗口：1 = 「本迁移执行时的当前公式版本」。
-- 它是一个历史刻度，不是「未知」—— 而且**会自动过期**：等谁把
-- CP_FORMULA_VERSION 改成 2，这个默认值就自动变成「旧口径」，
-- 那时没被服务端重新算过的行（包括占位档）自然落在榜外，正是我们要的。
-- 代价只有一个：在版本仍是 1 的这段时间里，占位档（combat_power = 0）
-- 会被当成当前版本 —— 但它的战力是 0，排在最后，与今天的表现完全一致。
-- **拿一个今天就存在的观感问题，换掉一个会让真人消失的窗口，值。**

comment on column public.profiles.cp_formula_version is
  '算出 combat_power 的战力公式版本（见 src/core/cpFormulaVersion.ts）。改公式必须同批 +1，否则新旧两把尺会在同一张榜上按同一字段排序且事后无法区分。默认值 1 是本列建立时的当前版本，版本一 +1 它就自动表示「旧口径」。';

-- 榜单查询从「按 combat_power 排序」变成「先按版本筛、再按 combat_power 排序」，
-- 单列索引 profiles_power_idx 不再能覆盖。复合索引把筛与排一次做掉。
-- 现在只有 60 行，这条索引是为将来加的，不是为现在。
create index if not exists profiles_cp_version_power_idx
  on public.profiles (cp_formula_version, combat_power desc);

-- ─── 写权限：本列从出生起就是 service-role 专属（已实查确认前提）───
-- 前提是 20260731230000 已经落地 —— 2026-08-01 06:3x 实查确认：
--   select version from supabase_migrations.schema_migrations → 有 20260731230000
--   anon/authenticated 的 UPDATE 列 → 只剩 avatar_url, bio, display_name, updated_at
-- 那份迁移撤掉了表级 insert/update、改成按列授权。**新加的列不会自动获得任何授权**，
-- 所以本列一建出来客户端就写不了，不需要为它再补一份 revoke。
-- 反过来说：如果将来有人恢复了表级授权，本列会**跟着一起开放**，
-- 那时玩家就能把旧尺的战力自行标成新版本 —— 版本戳的可信度整个建立在
-- 「profiles 没有表级写授权」这一条上。ops-check 的第 4 项守的就是它。

-- ─── 验证方式（执行后请实跑，别只看迁移绿）───
-- select cp_formula_version, count(*) from public.profiles group by 1 order by 1;
-- 期望：只有一组 (1, 61)。2026-08-01 06:3x 实查线上共 61 行档案。
-- 出现任何其他版本号 = 有人跳过了版本戳纪律，或表级写授权被恢复了。
--
-- select column_default, is_nullable from information_schema.columns
--  where table_schema='public' and table_name='profiles' and column_name='cp_formula_version';
-- 期望：column_default = 1，is_nullable = NO。
--
-- ─── 本迁移必须是「应用前后榜单一模一样」───
-- 应用前后各跑一次，两次结果必须逐行相同：
-- select id, combat_power from public.profiles order by combat_power desc, updated_at limit 20;
