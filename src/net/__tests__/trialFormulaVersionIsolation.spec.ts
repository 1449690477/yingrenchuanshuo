import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationSource = readFileSync(
  new URL(
    '../../../supabase/migrations/20260801070000_trial_formula_version_isolation.sql',
    import.meta.url,
  ),
  'utf8',
);

describe('试炼公式版本榜单隔离迁移', () => {
  it('唯一键和榜单索引都把公式版本纳入身份', () => {
    expect(migrationSource).toMatch(
      /unique\s*\(\s*user_id,\s*season_id,\s*week_index,\s*bracket_id,\s*trial_formula_version\s*\)/i,
    );
    expect(migrationSource).toMatch(
      /create\s+index\s+trial_scores_board_idx[\s\S]*trial_formula_version[\s\S]*damage\s+desc/i,
    );
  });

  it('旧 RPC 固定读取 v1，继续服务部署窗口内的旧 PWA', () => {
    const oldRpc = migrationSource.match(
      /create\s+or\s+replace\s+function\s+public\.trial_neighborhood\([\s\S]*?grant\s+execute\s+on\s+function\s+public\.trial_neighborhood\(/i,
    )?.[0];
    expect(oldRpc).toBeDefined();
    expect(oldRpc).toContain('t.trial_formula_version = 1');
  });

  it('新 RPC 强制显式版本，并只读取该版本', () => {
    expect(migrationSource).toMatch(
      /function\s+public\.trial_neighborhood_versioned\(\s*p_season_id\s+text,\s*p_week_index\s+int,\s*p_bracket_id\s+text,\s*p_formula_version\s+smallint,/i,
    );
    expect(migrationSource).toContain(
      't.trial_formula_version = p_formula_version',
    );
    expect(migrationSource).not.toMatch(/p_formula_version\s+smallint\s+default/i);
  });
});
