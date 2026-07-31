-- ═══════════════════════════════════════════════════════════════════
-- 收紧 profiles 的写权限：排名字段只能由 Edge Function 写
-- （docs/65 §六之二 方向 A）
--
-- ⚠ **这份迁移必须最后执行，而且要单独发。**
--   执行顺序：① 部署 sync-profile 函数 → ② 发布调用它的客户端
--             → ③ 等旧客户端基本更新完 → ④ 才执行本迁移
--   顺序错了会发生什么：旧客户端的 upsertProfile 是直写 profiles 的，
--   本迁移一旦先落地，它们的档案同步会**静默失败**（调用点是
--   .catch(() => undefined)），表现为「战力榜上的数字停在旧值」——
--   不报错、不崩溃，只是悄悄不更新，是最难被发现的那种坏法。
-- ═══════════════════════════════════════════════════════════════════

-- ─── 为什么不能只写列级 revoke ───
-- PostgreSQL 的列级 revoke **削不掉表级授权**，而 Supabase 默认把
-- public schema 的表授权给了 anon / authenticated。这种情况下
-- `revoke update (combat_power) ...` 是空操作，只发一句 warning，
-- 迁移照样绿 —— 我在公会邀请码那条上踩过一次，线上查
-- information_schema.column_privileges 才发现完全没生效。
-- 正确做法：**先撤表级，再按列重新授。**

revoke insert, update on public.profiles from anon, authenticated;

-- 重新授予「玩家自治」的展示字段。
-- 判据来自 docs/65 §六之二 末尾的通用结论：
--   profiles 只适合放展示性字段，参与排名的字段必须走 service-role。
-- display_name / bio / avatar_url 是玩家自己的身份表达，改错了只影响他自己；
-- class_id / level / combat_power 决定名次，必须由服务端从搭配快照现算。
grant insert (id, display_name, bio, avatar_url, updated_at) on public.profiles
  to anon, authenticated;
grant update (display_name, bio, avatar_url, updated_at) on public.profiles
  to anon, authenticated;

-- 建档路径上的兜底默认值。
-- 收权限之后，客户端建档时不能再写这三列，而它们都是 not null；
-- 没有默认值的话第一次 insert 会直接失败。
-- 默认值只是「等 sync-profile 写真值之前的占位」，不参与任何数值口径。
alter table public.profiles alter column class_id set default 'swordsman';
alter table public.profiles alter column level set default 1;
alter table public.profiles alter column combat_power set default 0;

-- ─── 验证方式（执行后请实跑一次，别只看迁移绿）───
-- select grantee, column_name, privilege_type
--   from information_schema.column_privileges
--  where table_schema = 'public' and table_name = 'profiles'
--    and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE')
--  order by grantee, column_name;
-- 期望：只出现 display_name / bio / avatar_url / updated_at（以及 insert 的 id），
-- **不出现 combat_power / level / class_id**。
