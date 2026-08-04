import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  TRIAL_FORMULA_VERSION,
  buildTrialFormulaStamp,
} from '@/core/trialFormulaVersion';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const submitTrialSource = read('../../../supabase/functions/submit-trial/index.ts');
const coreEntrySource = read('../../../supabase/functions/submit-trial/_core-entry.ts');
const auditSource = read('../../../scripts/audit-trial-scores.mts');
const migrationSource = read(
  '../../../supabase/migrations/20260801060000_trial_formula_version.sql',
);

describe('试炼公式版本端到端接线', () => {
  it('迁移把存量和部署窗口内的旧函数写入明确标为 v1', () => {
    expect(migrationSource).toContain(
      'trial_formula_version smallint not null default 1',
    );
    expect(migrationSource).toContain('check (trial_formula_version >= 1)');
  });

  it('Edge 打包入口导出唯一版本戳构造点', () => {
    expect(coreEntrySource).toContain(
      "export { buildTrialFormulaStamp, TRIAL_FORMULA_VERSION } from '@/core/trialFormulaVersion';",
    );
    expect(TRIAL_FORMULA_VERSION).toBe(3);
    // 运行时行为：构造点返回的就是当前常量，不存在第二处版本号。
    expect(buildTrialFormulaStamp()).toEqual({
      trial_formula_version: TRIAL_FORMULA_VERSION,
    });
  });

  it('插入、更高分替换、同分复核三条写路径全部盖当前版本戳', () => {
    // 语义检查而非文本形状：构造点必须存在（不钉变量名/前缀），
    // 三条写路径（insert/replace/reverify）每一条都必须展开 stamp；
    // 若重构改写了这些路径的写法，本断言红是提醒你重新验证三条路径，
    // 而不是让你去同步一个字符串。
    expect(submitTrialSource).toContain('buildTrialFormulaStamp()');
    expect(submitTrialSource.match(/\.\.\.trialFormulaStamp/g)).toHaveLength(3);
    // 查库/名次过滤必须用 stamp 的字段，不得出现数字字面量版本戳——
    // 防止「写库用常量、查库用手写数字」的脱钩（2026-08-04 小督复核意见落地）。
    expect(
      submitTrialSource.match(/\.eq\('trial_formula_version',\s*trialFormulaStamp\.trial_formula_version\)/g),
    ).toHaveLength(2);
    expect(submitTrialSource.match(/trial_formula_version:\s*\d+/)).toBeNull();
  });

  it('审计只用当前版本判据，历史成绩保留且使用成绩当时的职业', () => {
    expect(auditSource).toContain(
      'row.trial_formula_version !== TRIAL_FORMULA_VERSION',
    );
    expect(auditSource).toContain('const classId: ClassId = row.class_id;');
    expect(auditSource).not.toContain('const classId: ClassId = p.class_id;');
  });
});
