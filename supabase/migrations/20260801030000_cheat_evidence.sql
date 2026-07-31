-- ═══════════════════════════════════════════════════════════════════
-- 作弊证据与封神榜（docs/78）
--
-- 服务端各条上报路径本来就在拒绝「物理上不可能」的提交，但拒完就扔。
-- 本表把那一刻的判据留成结构化证据：封神榜的数据源与作弊遥测同时到手。
--
-- 设计红线（沿用 docs/51 §6，与 milestones / dungeon_records 同规）：
--   - 证据表【不给客户端任何写策略】：只有 Edge Function（service_role）能写
--   - 封神榜视图对所有人可读（公示是它的全部意义）
--   - 只移出榜单 + 公开陈列，不封号、不清档、不扣数值（docs/40 红线）
--
-- ★ 准确性（docs/78 §2.3 三道闸门，判定在 src/core/cheatEvidence.ts）：
--   闸门一 只认物理不可能（不认「进度快/金币多/运气好」这类统计可疑）
--   闸门二 超额 ≥ 2 倍才可能公开 —— 挡的是 Edge 未重打包时合法新装备的小幅超限
--   闸门三 2 次独立铁证，或单次超 10 倍
--   兜底   bundle_version 可按版本批量作废；cleared_at 人工洗白
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.cheat_evidence (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  detected_at    timestamptz not null default now(),

  -- 哪条链发现的（与 supabase/functions 目录名一致，便于回溯）
  source         text not null,
  -- 改的是什么。取值受 src/core/cheatEvidence.ts 的 CheatClaimField 约束，
  -- 这里不再抄一份枚举 —— 同一口径两处实现，只有一处正确（docs/61 §2.2）。
  claim_field    text not null,

  -- 他报的值 / 物理界限 / 超了多少倍。三者都留，便于日后复核判据本身是否正确。
  claimed_value  double precision not null,
  bound_value    double precision not null check (bound_value > 0),
  bound_kind     text not null check (bound_kind in ('upper', 'lower')),
  overage_ratio  double precision not null check (overage_ratio > 0),

  -- 展示文案由 core 统一生成后落库：UI 与证据表共用一套措辞，不各写各的。
  summary        text not null,

  -- ★ 检测时的服务端核心版本。若日后发现某版本的上界函数本身有错，
  --   可按此列批量作废该批证据 —— 这是「我们自己判错了」时唯一的批量后悔药。
  bundle_version text not null default 'unknown',

  -- 是否已公开上榜（三道闸门全开才 true；否则只记录，进老板复核队列）
  published      boolean not null default false,
  -- 未公开时的原因：below-margin（超得不够多）/ awaiting-second-evidence（等第二条）
  hold_reason    text not null default 'none',

  -- 人工洗白：误判后的撤回通道。写了 cleared_at 的行一律不再出现在封神榜。
  cleared_at     timestamptz,
  cleared_reason text
);

create index if not exists cheat_evidence_user_idx
  on public.cheat_evidence (user_id, detected_at desc);
create index if not exists cheat_evidence_published_idx
  on public.cheat_evidence (published, detected_at desc)
  where cleared_at is null;

alter table public.cheat_evidence enable row level security;

-- 客户端不得读原始证据表：里面有未公开的待复核项，公示之前不该外泄。
-- 也不得写：证据只能由服务端在拒绝提交的那一刻产生。
-- （不建任何 policy = 除 service_role 外全部拒绝）

-- ─── 封神榜视图（公开只读） ───
-- 每人只展示最新一条已公开证据：榜是「谁作弊了、改了什么」，不是流水账。
create or replace view public.cheater_board as
select distinct on (e.user_id)
  e.user_id,
  coalesce(p.display_name, '匿名旅人') as display_name,
  e.claim_field,
  e.claimed_value,
  e.bound_value,
  e.bound_kind,
  e.overage_ratio,
  e.summary,
  e.detected_at,
  -- 该玩家累计已公开的铁证条数，展示为「累计 N 次」
  (select count(*)
     from public.cheat_evidence c2
    where c2.user_id = e.user_id
      and c2.published
      and c2.cleared_at is null) as evidence_count
from public.cheat_evidence e
join public.profiles p on p.id = e.user_id
where e.published and e.cleared_at is null
order by e.user_id, e.detected_at desc;

alter view public.cheater_board set (security_invoker = off);
grant select on public.cheater_board to anon, authenticated;

-- ─── 上榜者从所有正常榜单移出 ───
-- 已公开的作弊者，其历史成绩行一律 verified=false（只移出展示，不删数据）。
-- 做成函数而不是触发器：触发器会在每次写证据时扫全部榜表，
-- 而这件事只需要在「首次公开」那一刻做一次。
create or replace function public.demote_cheater_board_rows(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.trial_scores    set verified = false where user_id = p_user_id;
  update public.milestones      set verified = false where user_id = p_user_id;
  update public.progress_records set verified = false where user_id = p_user_id;
  update public.dungeon_records set verified = false where user_id = p_user_id;
end;
$$;

revoke all on function public.demote_cheater_board_rows(uuid) from public;
