-- ═══════════════════════════════════════════════════════════════════
-- 竞技场 · 每日结算与奖励发放（docs/52 §九 / docs/53 §4.3）
--
-- 设计红线：
--   - 奖励「直接进背包」，不需要玩家点领取；哪天不上线也不损失（docs/40
--     惩罚红线：不领取就清空）。实现口径：结算由 arena-daily-settle 函数
--     以 service role 写入本表，客户端下次进竞技场时自动同步进背包并
--     标记 claimed —— 玩家无操作，奖励在服务端持久等待，永不清空
--   - 客户端对本表【只读 + 只能标记自己的 claimed_at】，内容与荣誉结算
--     只能由 Edge Function（service role）写入
--   - 每用户每赛季每天最多一条 settle 记录（防结算函数重复执行双发）
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.arena_grants (
  id          uuid primary key default gen_random_uuid(),
  season_id   text not null references public.seasons(id),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  day_key     text not null,             -- 结算归属的业务日（'2026-07-30'）
  kind        text not null check (kind in ('settle', 'shop')),
  -- settle: { tier, tierHonor, defense: { challenged, held, reward },
  --           boxes: [{ boxId, honor, items: { itemId: count } }] }
  -- shop:   { entryId, defId, seed }（seed 供客户端确定性生成装备实例）
  payload     jsonb not null,
  created_at  timestamptz not null default now(),
  claimed_at  timestamptz               -- 客户端同步进背包后标记；NULL = 待同步
);

create index if not exists arena_grants_pending_idx
  on public.arena_grants (user_id)
  where claimed_at is null;

-- 防结算函数重复执行双发：每用户每赛季每天最多一条 settle
create unique index if not exists arena_grants_settle_uidx
  on public.arena_grants (season_id, user_id, day_key)
  where kind = 'settle';

alter table public.arena_grants enable row level security;

-- 本人可读自己的奖励记录
drop policy if exists "own arena grants readable" on public.arena_grants;
create policy "own arena grants readable" on public.arena_grants
  for select using (auth.uid() = user_id);

-- 本人只能把 claimed_at 从 NULL 标记为当前时间（不能改其他任何列）
drop policy if exists "own arena grants claimable" on public.arena_grants;
create policy "own arena grants claimable" on public.arena_grants
  for update using (auth.uid() = user_id and claimed_at is null)
  with check (auth.uid() = user_id);

-- 内容写入只能由 service role（Edge Function）执行，客户端无 insert 权限
revoke insert on public.arena_grants from authenticated, anon;

-- ─── 每日结算的单事务落库（防结算函数重跑双发） ───
-- 与 arena_apply_battle 同一模式：存储过程一个事务完成
-- 「写入奖励记录（唯一索引幂等）→ 加荣誉 → 段位只升不降」，
-- 函数重跑时奖励记录撞唯一索引直接返回 false，荣誉不会重复加。
create or replace function public.arena_apply_settle(
  p_season_id   text,
  p_user_id     uuid,
  p_day_key     text,
  p_tier        text,
  p_honor_delta int,
  p_payload     jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.arena_grants (season_id, user_id, day_key, kind, payload)
  values (p_season_id, p_user_id, p_day_key, 'settle', p_payload)
  on conflict (season_id, user_id, day_key) where kind = 'settle' do nothing;
  if not found then
    return false;
  end if;

  update public.arena_ranks
  set
    honor = honor + p_honor_delta,
    -- 段位赛季内只升不降（docs/52 §4.3）：取历史最高
    tier = case
      when array_position(
        array['qingying','feiyue','hupo','feiying','yingguan'], p_tier
      ) > array_position(
        array['qingying','feiyue','hupo','feiying','yingguan'], tier
      ) then p_tier
      else tier
    end,
    updated_at = now()
  where season_id = p_season_id and user_id = p_user_id;

  return true;
end;
$$;

revoke execute on function public.arena_apply_settle(text, uuid, text, text, int, jsonb)
  from public, authenticated, anon;
grant execute on function public.arena_apply_settle(text, uuid, text, text, int, jsonb)
  to service_role;

-- ─── 荣誉商店兑换的单事务落库 ───
-- 余额校验在 SQL 内完成（honor >= p_price），不足直接返回 false，
-- 「查余额 → 扣减」之间不存在可并发插入的缝隙。
create or replace function public.arena_apply_shop_buy(
  p_season_id text,
  p_user_id   uuid,
  p_price     int,
  p_payload   jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.arena_ranks
  set honor = honor - p_price,
      updated_at = now()
  where season_id = p_season_id
    and user_id = p_user_id
    and honor >= p_price;
  if not found then
    return false;
  end if;

  insert into public.arena_grants (season_id, user_id, day_key, kind, payload)
  values (
    p_season_id,
    p_user_id,
    to_char(now() at time zone 'Asia/Shanghai', 'YYYY-MM-DD'),
    'shop',
    p_payload
  );

  return true;
end;
$$;

revoke execute on function public.arena_apply_shop_buy(text, uuid, int, jsonb)
  from public, authenticated, anon;
grant execute on function public.arena_apply_shop_buy(text, uuid, int, jsonb)
  to service_role;
