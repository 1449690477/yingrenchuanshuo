/**
 * 存量试炼成绩审计（docs/78 §六）。
 *
 * 2026-07-30 的绕过（自报等级 → 跨分段刷分）在 submit-trial 补上权威等级判据
 * 之前已经产生过数据。本脚本用**同一个判据**回扫存量：
 * 拿每个玩家的权威等级（profiles.level，由 sync-profile 从真实存档写入）
 * 算出他物理上能打出的最高伤害，超了就是物理不可能。
 *
 * 默认 **dry-run 只报不改**；确认读数后加 --apply 才会写库。
 *
 * 用法：
 *   npx tsx scripts/audit-trial-scores.mts            # 只看
 *   npx tsx scripts/audit-trial-scores.mts --apply    # 落地：移出榜单 + 记证据
 */

import { createClient } from '@supabase/supabase-js';
import { isPlausibleTrialDamage, trialBracketDamageCeiling } from '../src/core/trialBound';
import { judgeCheatEvidence, buildCheatEvidenceRow } from '../src/core/cheatEvidence';
import { TRIAL_FORMULA_VERSION } from '../src/core/trialFormulaVersion';
import type { ClassId } from '../src/core/types';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const apply = process.argv.includes('--apply');
const admin = createClient(url, serviceKey);

const { data, error } = await admin
  .from('trial_scores')
  .select(
    'id, user_id, class_id, damage, week_index, verified, trial_formula_version, profiles(display_name, level)',
  )
  .order('damage', { ascending: false });
if (error) {
  console.error('读取失败：', error.message);
  process.exit(1);
}

console.log(`\n模式：${apply ? '★ 落地（会写库）' : 'dry-run（只报不改）'}`);
console.log(`成绩条数：${data?.length ?? 0}\n`);
console.log(
  '名字'.padEnd(12),
  '权威Lv'.padStart(6),
  '伤害'.padStart(10),
  '判定上界'.padStart(10),
  '占比'.padStart(8),
  ' 结论',
);

let flagged = 0;
let checked = 0;
let legacySkipped = 0;
for (const row of (data ?? []) as any[]) {
  const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  if (!p || typeof p.level !== 'number') continue;
  if (row.trial_formula_version !== TRIAL_FORMULA_VERSION) {
    legacySkipped += 1;
    console.log(
      String(p.display_name).slice(0, 11).padEnd(12),
      String(p.level).padStart(6),
      String(row.damage).padStart(10),
      '-'.padStart(10),
      '-'.padStart(8),
      ` 历史 v${String(row.trial_formula_version)}，保留且不按 v${TRIAL_FORMULA_VERSION} 反判`,
    );
    continue;
  }
  checked += 1;
  const level: number = p.level;
  // 必须使用成绩行自己的职业；玩家之后切换当前职业，不应改变旧成绩的审计尺。
  const classId: ClassId = row.class_id;
  const damage = Number(row.damage);
  const ceiling = trialBracketDamageCeiling(level, classId, row.week_index);
  const ok = isPlausibleTrialDamage(damage, level, classId, row.week_index);
  const pct = ((damage / ceiling) * 100).toFixed(1) + '%';
  console.log(
    String(p.display_name).slice(0, 11).padEnd(12),
    String(level).padStart(6),
    String(damage).padStart(10),
    String(Math.round(ceiling)).padStart(10),
    pct.padStart(8),
    ok ? ' 正常' : ' ★ 物理不可能',
  );
  if (ok) continue;
  flagged += 1;
  if (!apply) continue;

  const { count } = await admin
    .from('cheat_evidence')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', row.user_id)
    .eq('published', true)
    .is('cleared_at', null);
  const evidence = {
    source: 'submit-trial' as const,
    claimField: 'trial_damage' as const,
    claimedValue: damage,
    boundValue: ceiling,
    boundKind: 'upper' as const,
    priorEvidenceCount: count ?? 0,
  };
  const verdict = judgeCheatEvidence(evidence);
  if (!verdict.isProven) continue;
  await admin.from('cheat_evidence').insert(
    buildCheatEvidenceRow({
      userId: row.user_id,
      evidence,
      verdict,
      bundleVersion: 'audit-2026-07-31',
    }),
  );
  await admin.from('trial_scores').update({ verified: false }).eq('id', row.id);
  if (verdict.shouldPublish) {
    await admin.rpc('demote_cheater_board_rows', { p_user_id: row.user_id });
  }
  console.log(
    `   → 已处置：证据已记（${verdict.shouldPublish ? '公开上榜' : '待复核 ' + verdict.holdReason}），成绩移出榜单`,
  );
}

console.log(
  `\n当前公式 v${TRIAL_FORMULA_VERSION} 已审计：${checked} 条；历史版本跳过：${legacySkipped} 条；物理不可能：${flagged} 条`,
);
if (flagged > 0 && !apply) console.log('确认无误后加 --apply 落地。');
