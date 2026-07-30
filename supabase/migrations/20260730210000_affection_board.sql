-- 羁绊榜（docs/63 §三 · P2）：profiles 加心意总分列。
--
-- 口径：四角色心意点数之和，由 submit-affection Edge Function 只升不降写入。
-- 榜上只有这个总数 —— 单角色明细是私事，不落库、不展示（docs/63 红线）。
-- 与 combat_power 同规：全员可读（profiles 既有 RLS），只有 service role 能写。

alter table public.profiles
  add column if not exists affection_total integer not null default 0;

-- 榜单元数据约束：心意总分不可能是负数
alter table public.profiles
  drop constraint if exists profiles_affection_total_nonnegative;
alter table public.profiles
  add constraint profiles_affection_total_nonnegative check (affection_total >= 0);

-- 榜单查询：按总分降序取前列；0 分玩家不进榜（部分索引省体积）
create index if not exists profiles_affection_total_idx
  on public.profiles (affection_total desc)
  where affection_total > 0;
