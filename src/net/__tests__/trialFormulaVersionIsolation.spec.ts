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

  it('旧 PWA 直读基表也只能看 v1，不会把新旧伤害混排', () => {
    expect(migrationSource).toMatch(
      /create\s+policy\s+"trial readable"[\s\S]*?for\s+select\s+using\s*\(\s*trial_formula_version\s*=\s*1\s*\)/i,
    );
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

  it('新邻域榜使用 security definer 穿过 v1 RLS，并显式回收 public 权限', () => {
    const rpc = migrationSource.match(
      /create\s+or\s+replace\s+function\s+public\.trial_neighborhood_versioned\([\s\S]*?comment\s+on\s+function\s+public\.trial_neighborhood_versioned\(/i,
    )?.[0];
    expect(rpc).toBeDefined();
    expect(rpc).toMatch(/security\s+definer/i);
    expect(rpc).toMatch(/revoke\s+all[\s\S]*?from\s+public/i);
    expect(rpc).toMatch(/rank\(\)\s+over\s*\(\s*order\s+by\s+t\.damage\s+desc\s*\)/i);
  });

  it('新总榜 RPC 存在且强制版本，limit=null 也不能绕过 100 行上限', () => {
    const rpc = migrationSource.match(
      /create\s+or\s+replace\s+function\s+public\.trial_top_versioned\([\s\S]*?comment\s+on\s+function\s+public\.trial_top_versioned\(/i,
    )?.[0];
    expect(rpc).toBeDefined();
    expect(rpc).toMatch(/p_formula_version\s+smallint(?!\s+default)/i);
    expect(rpc).toContain('t.trial_formula_version = p_formula_version');
    expect(rpc).toMatch(/security\s+definer/i);
    expect(rpc).toMatch(/rank\(\)\s+over\s*\(\s*order\s+by\s+t\.damage\s+desc\s*\)/i);
    expect(rpc).toMatch(
      /limit\s+least\(\s*greatest\(\s*coalesce\(\s*p_limit\s*,\s*100\s*\)\s*,\s*1\s*\)\s*,\s*100\s*\)/i,
    );
    expect(rpc).toMatch(/revoke\s+all[\s\S]*?from\s+public/i);
  });
});
