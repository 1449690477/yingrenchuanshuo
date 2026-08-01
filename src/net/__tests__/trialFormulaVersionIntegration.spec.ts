import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TRIAL_FORMULA_VERSION } from '@/core/trialFormulaVersion';

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
    expect(TRIAL_FORMULA_VERSION).toBe(2);
  });

  it('插入、更高分替换、同分复核三条写路径全部盖当前版本戳', () => {
    expect(submitTrialSource).toContain('const trialFormulaStamp = buildTrialFormulaStamp();');
    expect(submitTrialSource.match(/\.\.\.trialFormulaStamp/g)).toHaveLength(3);
  });

  it('审计只用当前版本判据，历史成绩保留且使用成绩当时的职业', () => {
    expect(auditSource).toContain(
      'row.trial_formula_version !== TRIAL_FORMULA_VERSION',
    );
    expect(auditSource).toContain('const classId: ClassId = row.class_id;');
    expect(auditSource).not.toContain('const classId: ClassId = p.class_id;');
  });
});
