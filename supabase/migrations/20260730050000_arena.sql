-- ═══════════════════════════════════════════════════════════════════
-- 竞技场 · 排名与对战（docs/52-竞技场对战设计.md §8）
--
-- 在 Supabase SQL Editor 整段执行，或 `supabase db push`。
-- 设计红线：
--   - 两张表【都不给客户端写权限】：押注结算、排名顶替、战报全部
--     由 Edge Function（service role）写入，客户端只能调用函数
--   - arena_ranks 只给本人读：候选对手由 arena-candidates 函数服务端
--     挑选后下发，客户端无法扫全表捏软柿子（§3.2 只给 3 个候选）
--   - arena_battles 攻守双方可读：它是防线战报与战报回放的数据源
--   - 排名变动必须发生在【单个 SQL 事务】里（§8）：arena_apply_battle
--     一个存储过程完成 锁定→结算→区间下移→写入战报
-- ═══════════════════════════════════════════════════════════════════

-- ─── 竞技场排名（每人一行） ───
create table if not exists public.arena_ranks (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  season_id    text not null references public.seasons(id),
  rank         int  not null,
  tier         text not null default 'qingying'
               check (tier in ('qingying','feiyue','hupo','feiying','yingguan')),
  honor        bigint not null default 0 check (honor >= 0),
  win_streak   int  not null default 0,
  build_snapshot jsonb not null,           -- 防守用搭配，服务端复算的输入
  combat_power bigint not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists arena_ranks_rank_uidx
  on public.arena_ranks (season_id, rank);
create index if not exists arena_ranks_power_idx
  on public.arena_ranks (season_id, combat_power desc);

-- ─── 对战记录（战报可回放：battle_log 逐回合） ───
create table if not exists public.arena_battles (
  id            bigserial primary key,
  season_id     text not null references public.seasons(id),
  attacker_id   uuid not null references public.profiles(id) on delete cascade,
  defender_id   uuid not null references public.profiles(id) on delete cascade,
  day_key       text not null,             -- '2026-07-29'，北京时间 04:00 日切
  attempt_index int  not null,
  stake         int  not null check (stake in (0, 10, 25, 50)),  -- 复仇反击押注为 0（§六）
  attacker_won  boolean not null,
  honor_delta   int  not null,             -- 挑战者荣誉净变化（含退还押注与奖励）
  rank_before   int  not null,
  rank_after    int  not null,
  battle_log    jsonb not null,
  is_revenge    boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists arena_battles_defender_day_idx
  on public.arena_battles (defender_id, day_key);
create index if not exists arena_battles_attacker_day_idx
  on public.arena_battles (attacker_id, day_key);
-- 防并发重复扣次数：同一玩家同一天同一 attempt 只能落一条，
-- 重复提交在数据库层直接失败（配合 arena_apply_battle 单事务，整体回滚）。
-- 复仇不消耗每日次数、不占 attempt 序号，单独按「每天每对手一次」约束。
create unique index if not exists arena_battles_attempt_uidx
  on public.arena_battles (attacker_id, day_key, attempt_index)
  where not is_revenge;
create unique index if not exists arena_battles_revenge_uidx
  on public.arena_battles (attacker_id, defender_id, day_key)
  where is_revenge;

-- ─── RLS（§8：只给 select，写入只能走 Edge Function） ───
alter table public.arena_ranks   enable row level security;
alter table public.arena_battles enable row level security;

-- 只能读自己的排名行（候选由服务端挑选下发，见文件头注释）
drop policy if exists "own arena rank readable" on public.arena_ranks;
create policy "own arena rank readable" on public.arena_ranks
  for select using (auth.uid() = user_id);

-- 攻守双方可读对战记录（防线战报与回放）
drop policy if exists "own battles readable" on public.arena_battles;
create policy "own battles readable" on public.arena_battles
  for select using (auth.uid() = attacker_id or auth.uid() = defender_id);

-- ─── 挑战结算（单事务：锁定 → 结算 → 顶替 → 战报） ───
-- 排名顶替算法（挑战者赢，挑战者排名 Ra、防守者 Rd，Ra > Rd）：
--   1. 区间 [Rd, Ra-1] 整体下移一位（含防守者 → Rd+1）
--   2. 挑战者落到 Rd
-- 用 +1,000,000 临时让位，避免唯一索引在逐行更新时自相碰撞。
-- 挑战者输：排名不动，连胜归零，只结算荣誉与战报。
create or replace function public.arena_apply_battle(
  p_season_id text,
  p_attacker_id uuid,
  p_defender_id uuid,
  p_day_key text,
  p_attempt_index int,
  p_stake int,
  p_attacker_won boolean,
  p_honor_delta int,
  p_battle_log jsonb,
  p_is_revenge boolean default false
)
returns table (
  attacker_rank_before int,
  attacker_rank_after int,
  defender_rank_after int,
  attacker_honor bigint,
  attacker_win_streak int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_att public.arena_ranks%rowtype;
  v_def public.arena_ranks%rowtype;
  v_new_streak int;
  v_new_honor bigint;
begin
  -- 按 uuid 顺序锁定两行，防止并发挑战互相死锁
  if p_attacker_id < p_defender_id then
    select * into v_att from public.arena_ranks
      where season_id = p_season_id and user_id = p_attacker_id for update;
    select * into v_def from public.arena_ranks
      where season_id = p_season_id and user_id = p_defender_id for update;
  else
    select * into v_def from public.arena_ranks
      where season_id = p_season_id and user_id = p_defender_id for update;
    select * into v_att from public.arena_ranks
      where season_id = p_season_id and user_id = p_attacker_id for update;
  end if;

  if v_att.user_id is null or v_def.user_id is null then
    raise exception 'arena ranks missing for attacker or defender';
  end if;

  -- 只能挑战排名在自己上方的人（§七：欺负低于自己的人没有通道）
  if v_att.rank <= v_def.rank then
    raise exception 'attacker rank % must be below defender rank %', v_att.rank, v_def.rank;
  end if;

  v_new_honor := v_att.honor + p_honor_delta;
  if v_new_honor < 0 then
    raise exception 'honor would go negative (% + %)', v_att.honor, p_honor_delta;
  end if;

  attacker_rank_before := v_att.rank;

  if p_attacker_won then
    -- 区间 [Rd, Ra-1] 先整体让位再下移一位
    update public.arena_ranks set rank = rank + 1000000
      where season_id = p_season_id and rank >= v_def.rank and rank < v_att.rank;
    update public.arena_ranks set rank = rank - 1000000 + 1
      where season_id = p_season_id and rank >= 1000000;

    -- 复仇不碰连胜（§六：复仇是零成本白给的机会，输赢都不应影响押注连胜）
    v_new_streak := case when p_is_revenge then v_att.win_streak else v_att.win_streak + 1 end;
    update public.arena_ranks
      set rank = v_def.rank,
          honor = v_new_honor,
          win_streak = v_new_streak,
          updated_at = now()
      where season_id = p_season_id and user_id = p_attacker_id;

    attacker_rank_after := v_def.rank;
    defender_rank_after := v_def.rank + 1;
  else
    v_new_streak := case when p_is_revenge then v_att.win_streak else 0 end;
    update public.arena_ranks
      set honor = v_new_honor,
          win_streak = v_new_streak,
          updated_at = now()
      where season_id = p_season_id and user_id = p_attacker_id;

    attacker_rank_after := v_att.rank;
    defender_rank_after := v_def.rank;
  end if;

  insert into public.arena_battles (
    season_id, attacker_id, defender_id, day_key, attempt_index,
    stake, attacker_won, honor_delta, rank_before, rank_after,
    battle_log, is_revenge
  ) values (
    p_season_id, p_attacker_id, p_defender_id, p_day_key, p_attempt_index,
    p_stake, p_attacker_won, p_honor_delta, attacker_rank_before, attacker_rank_after,
    p_battle_log, p_is_revenge
  );

  attacker_honor := v_new_honor;
  attacker_win_streak := v_new_streak;
  return next;
end;
$$;

-- 只有 service role 能调用（Edge Function）；客户端直连会被拒绝
revoke all on function public.arena_apply_battle(text, uuid, uuid, text, int, int, boolean, int, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.arena_apply_battle(text, uuid, uuid, text, int, int, boolean, int, jsonb, boolean)
  to service_role;
