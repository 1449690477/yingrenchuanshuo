-- 第五职业樱酱（kenshi）上线前先扩展生产库职业白名单。
--
-- 发布顺序必须保持：本迁移 → Edge Function → 客户端。
-- 老函数的 z.enum(CLASS_IDS) 会拒绝 kenshi，客户端若先发布会让樱酱玩家无法提交。

begin;

alter table public.profiles
  drop constraint if exists profiles_class_id_check;

alter table public.profiles
  add constraint profiles_class_id_check
  check (class_id in ('swordsman', 'witch', 'shaman', 'catkin', 'kenshi'));

alter table public.trial_scores
  drop constraint if exists trial_scores_class_id_check;

alter table public.trial_scores
  add constraint trial_scores_class_id_check
  check (class_id in ('swordsman', 'witch', 'shaman', 'catkin', 'kenshi'));

commit;
