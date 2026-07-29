-- ═══════════════════════════════════════════════════════════════════
-- 玩家自定义身份：昵称、简介、头像（承 docs/51 §6.1）
--
-- 所有者决策（2026-07-29）：
--   - 昵称由玩家自己填，不再取游戏角色名，且【不要求全服唯一】
--   - 头像允许自由上传，但必须带防护（见下方限制与举报表）
--
-- 在 Supabase SQL Editor 整段执行，或 `supabase db push`。
-- ═══════════════════════════════════════════════════════════════════

-- ─── 档案扩展 ───
-- display_name 已存在（1~20 字），改由玩家自填，这里只补简介与头像。
alter table public.profiles
  add column if not exists bio text,
  add column if not exists avatar_url text;

-- 简介限长 60 字：榜单卡片一行放得下，也压缩了辱骂性长文的空间
alter table public.profiles drop constraint if exists profiles_bio_len;
alter table public.profiles
  add constraint profiles_bio_len check (bio is null or char_length(bio) <= 60);

-- 头像只接受本项目 Storage 的 avatars 桶，杜绝把榜单当外链图床
-- （外链还会带来 referer 追踪与图片被替换成违规内容的风险）
alter table public.profiles drop constraint if exists profiles_avatar_host;
alter table public.profiles
  add constraint profiles_avatar_host check (
    avatar_url is null
    or avatar_url like '%/storage/v1/object/public/avatars/%'
  );

-- ─── 举报表 ───
-- 自由上传必须配一个可处置的入口，否则出事时只能靠所有者自己刷榜发现。
create table if not exists public.profile_reports (
  id          bigserial primary key,
  target_id   uuid not null references public.profiles(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason      text not null check (char_length(reason) between 1 and 200),
  created_at  timestamptz not null default now(),
  -- 同一个人对同一个目标只能举报一次，防止刷举报
  unique (target_id, reporter_id)
);

create index if not exists profile_reports_target_idx
  on public.profile_reports (target_id, created_at desc);

alter table public.profile_reports enable row level security;

-- 只能以自己的身份举报
drop policy if exists "own report insert" on public.profile_reports;
create policy "own report insert" on public.profile_reports
  for insert with check (auth.uid() = reporter_id);

-- ⚠ 故意不给 select 策略：举报记录对普通玩家完全不可见。
-- 能查看举报会让它变成骚扰工具（「谁举报了我」），
-- 所有者用 service_role 在后台看即可。

-- ─── 头像存储桶 ───
-- 硬限制写在桶上，客户端绕不过去：
--   200KB 上限 + 只收三种图片 MIME
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 204800,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public             = true,
  file_size_limit    = 204800,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- 头像公开可读（榜单要显示）
drop policy if exists "avatars readable" on storage.objects;
create policy "avatars readable" on storage.objects
  for select using (bucket_id = 'avatars');

-- 只能写自己那一张：路径必须是 avatars/<自己的 uid>/xxx
-- 这样任何人都无法覆盖别人的头像
drop policy if exists "own avatar write" on storage.objects;
create policy "own avatar write" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "own avatar update" on storage.objects;
create policy "own avatar update" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "own avatar delete" on storage.objects;
create policy "own avatar delete" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
