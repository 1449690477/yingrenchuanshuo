-- 邀请码列级权限 · 修正 20260730180000 里那条**静默失效**的 revoke
--
-- 上一条迁移写的是：
--   revoke select (invite_code) on public.guilds from anon, authenticated;
-- 它执行成功、迁移也没报错，但**一点作用都没有**：
-- PostgreSQL 的列级 revoke 不能削掉表级授权，而 Supabase 默认给
-- public schema 的表授了表级 select 给 anon / authenticated。
-- 线上实测（information_schema.column_privileges）确认这两个角色
-- 在 invite_code 上仍然是 SELECT —— 每个登录玩家照样能一句
-- `?select=invite_code` 把全服邀请码拉走。
--
-- **这个坑值得记住**：列级 revoke 在存在表级授权时是空操作，
-- 而 Postgres 只会给一句 warning，迁移照样绿。要限列必须
-- 「先撤表级、再按列重新授」，并且以后加列时要回来补一次授权
-- （新列默认不在授权名单里 —— 这正是我们想要的默认：**新列默认不公开**）。

-- 1) 撤掉表级 select：从此这张表不再整表放行
revoke select on public.guilds from anon, authenticated;

-- 2) 按列重新授权，唯独不给 invite_code
--    （写权限早在 20260730143000 就已 revoke，这里只处理读）
grant select (id, name, notice, leader_id, reputation, expedition_clears, created_at, updated_at)
  on public.guilds to anon, authenticated;

-- 邀请码仍然拿得到，但只能通过 security definer 的 RPC：
--   guild_get_my_state()  → 成员看自己公会的码
--   guild_get_detail(id)  → 任何人看任意公会，故意不含码
-- 客户端从不直读这张表（src/net/guild.ts 全部走 rpc），所以这一步对
-- 现有功能零影响；改动的只是「直连 REST 能不能捞到码」。
