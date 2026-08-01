-- 周常试炼公式版本戳。
--
-- 旧成绩只有最终 damage，没有完整战斗过程；五职业真实技能引擎上线后，不能拿
-- 新引擎的上界反判旧引擎成绩。迁移必须先于新版 submit-trial 部署：窗口内旧函数
-- 未显式写列时会落到默认值 1（与它正在运行的旧公式一致），新版函数才写 2。
alter table public.trial_scores
  add column if not exists trial_formula_version smallint not null default 1;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'trial_scores_formula_version_positive'
       and conrelid = 'public.trial_scores'::regclass
  ) then
    alter table public.trial_scores
      add constraint trial_scores_formula_version_positive
      check (trial_formula_version >= 1);
  end if;
end
$$;

comment on column public.trial_scores.trial_formula_version is
  '算出 damage 的试炼公式版本（见 src/core/trialFormulaVersion.ts）。旧成绩保留，但只能由同版本判据审计。默认 1 对应迁移窗口内仍在线的旧 submit-trial。';

-- 部署后验证：旧行应全部为 1；新版函数产生或成功重算的行才会变成 2。
-- select trial_formula_version, count(*)
--   from public.trial_scores group by 1 order by 1;
