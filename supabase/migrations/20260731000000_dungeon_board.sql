-- ═══════════════════════════════════════════════════════════════════
-- 秘境榜 · 建表与策略（docs/51 §4 榜 5，排期 docs/63 §二，契约 docs/64）
--
-- 每座秘境一张榜，按最快通关用时升序；用时并列时看谁更早首通
-- （与 docs/51 榜 3「同关按最早达成排」同一条口径 —— 并列不该按写入
-- 顺序随机决定，那等于奖励谁的网络更快）。
--
-- 设计红线（沿用 docs/51 §6，与 milestones 同规）：
--   - 成绩表【不给客户端任何写策略】：只能走 Edge Function submit-dungeon
--   - 榜单对所有人可读（排行榜是公开信息）
--   - 合理性不通过的行 verified = false，只移出展示，不封号
-- ═══════════════════════════════════════════════════════════════════

-- ─── 秘境最快通关（每人每座副本一行） ───
create table if not exists public.dungeon_records (
  user_id          uuid not null references public.profiles(id) on delete cascade,
  -- 与存档 EquipmentDungeonState.records 的键一致，如 equipment_weapon_auric_d3
  -- （docs/66 深度模型：榜单的「一座」是关卡的某一层，不同深度是难度
  --   完全不同的战斗，用时放在一起排没有意义）
  dungeon_id       text not null,
  -- 档位与层数由服务端从 dungeon_id 反查权威条目表后写入，**不接受客户端上报**。
  -- 它们存在只为一件事：深度链校验要按「同档已达最高层」查自己的表。
  tier_id          text not null,
  depth            int  not null check (depth >= 1),
  -- 只放「正整数」这一条绝不会随平衡改动的底线约束。
  -- 真正的合理性口径（100ms 格律、两波上下界、白名单、等级交叉验证）
  -- 全部在 src/core/dungeonBoard.ts 一处实现，服务端通过 edge:build 打包
  -- 同一份代码 —— 在这里再抄一遍数值，就是 docs/61 §2.2 那个
  -- 「同一口径两处实现，只有一处正确」事故的复刻。
  best_duration_ms int not null check (best_duration_ms > 0),
  first_cleared_at timestamptz not null,
  verified         boolean not null default false,
  updated_at       timestamptz not null default now(),
  primary key (user_id, dungeon_id)
);

-- 榜单查询的唯一形状：某座副本、只看可信、用时升序、并列看首通更早。
-- 部分索引（where verified）—— 不可信的行永远不参与榜单查询，
-- 不该占索引，也不该影响榜单的规划。
create index if not exists dungeon_records_board_idx
  on public.dungeon_records (dungeon_id, best_duration_ms asc, first_cleared_at asc)
  where verified;

-- 深度链校验的唯一查询形状：某人某档已经站稳的最高层。
-- 这条索引是反作弊路径上的，不是展示路径上的 —— 每次上报都会走它。
create index if not exists dungeon_records_chain_idx
  on public.dungeon_records (user_id, tier_id, depth desc)
  where verified;

-- ─── RLS：必须开（§6.2） ───
-- Supabase 默认把 public schema 的表授权给 anon，没开 RLS 等于完全敞开。
alter table public.dungeon_records enable row level security;

drop policy if exists "dungeon records readable" on public.dungeon_records;
create policy "dungeon records readable" on public.dungeon_records for select using (true);

-- 【故意没有 insert / update / delete 策略】
-- 成绩只能由 Edge Function（service role，绕过 RLS）写入。
-- 玩家能直写成绩表的那一刻，这个榜就没有意义了。
--
-- 再补一道 revoke（与 20260730143000_guilds.sql 同规）：RLS 无策略已经
-- 拦住了写入，但将来任何人手滑加一条宽松策略时，权限这一层还在。
revoke insert, update, delete on public.dungeon_records from anon, authenticated;
