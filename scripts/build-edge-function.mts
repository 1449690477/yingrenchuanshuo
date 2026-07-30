/**
 * 打包 Edge Functions 的共享 core，并做确定性自检。
 *
 * 为什么需要这一步：
 *   - 服务端复算必须用【与客户端完全相同的】src/core 代码（docs/51 §6.3、
 *     docs/52 §5.3），但本仓 TS 全部是不带扩展名的 `@/` 路径导入，
 *     Deno 原生无法解析
 *   - 于是用 esbuild 把每个函数所需的 core 打成单个自包含文件 _core.ts，
 *     只把 'zod' 留作外部依赖（Deno 端由 supabase/functions/deno.json 映射到 npm:）
 *
 * 自检：打包产物与 src/core 原始实现各跑一次同种子试炼与对决，结果必须
 * 逐点一致。这一步不过，说明打包链路出了问题，绝不应部署。
 *
 * 用法：npm run edge:build
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FUNCTIONS = [
  'submit-trial',
  'arena-snapshot',
  'arena-candidates',
  'arena-challenge',
  'arena-daily-settle',
  'arena-shop-buy',
  'guild-expedition',
] as const;

for (const name of FUNCTIONS) {
  const entry = path.join(root, `supabase/functions/${name}/_core-entry.ts`);
  const outfile = path.join(root, `supabase/functions/${name}/_core.ts`);
  await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    treeShaking: true,
    minify: false,
    external: ['zod'],
    alias: { '@': path.join(root, 'src') },
    banner: {
      js: [
        '// ═══════════════════════════════════════════════════',
        '// 生成文件，请勿手改。来源：src/core（见 _core-entry.ts）',
        '// 重新生成：npm run edge:build',
        '// ═══════════════════════════════════════════════════',
      ].join('\n'),
    },
    outfile,
  });
  console.log(`✓ 已打包 supabase/functions/${name}/_core.ts`);
}

// ── 确定性自检 1：试炼成绩（docs/51 §6.3 的地基）──
const trialGenerated = await import(
  pathToFileURL(path.join(root, 'supabase/functions/submit-trial/_core.ts')).href
);
const trialSource = await import('../src/core/trial.ts');

const equipped = [null, null, null, null, null, null, null, null];
const input = { name: '自检', classId: 'swordsman', level: 45, equipped };
const seasonId = 's1';
const weekIndex = 30;
const bracketId = 'feiyue';

const trialFromGenerated = trialGenerated.runTrial(
  trialGenerated.buildTrialCombatant(input),
  trialGenerated.weeklyTrialBoss(seasonId, weekIndex, bracketId).combatant,
  trialGenerated.trialScoreSeed(
    seasonId,
    weekIndex,
    bracketId,
    trialGenerated.buildTrialCombatant(input).buildHash,
  ),
);
const trialFromSource = trialSource.runTrial(
  trialSource.buildTrialCombatant(input),
  trialSource.weeklyTrialBoss(seasonId, weekIndex, bracketId).combatant,
  trialSource.trialScoreSeed(
    seasonId,
    weekIndex,
    bracketId,
    trialSource.buildTrialCombatant(input).buildHash,
  ),
);

if (trialFromGenerated.damage !== trialFromSource.damage) {
  console.error(
    `✗ 试炼自检失败：打包产物成绩 ${trialFromGenerated.damage} ≠ 源实现成绩 ${trialFromSource.damage}`,
  );
  process.exit(1);
}
console.log(`✓ 试炼确定性自检通过：打包产物与 src/core 成绩一致（${trialFromSource.damage}）`);

// ── 确定性自检 2：竞技场对决（docs/52 §5.3 的地基）──
const duelGenerated = await import(
  pathToFileURL(path.join(root, 'supabase/functions/arena-challenge/_core.ts')).href
);
const duelSource = await import('../src/core/duel.ts');
const duelTrialSource = await import('../src/core/trial.ts');

const attackerInput = { name: '自检·攻', classId: 'witch', level: 80, equipped };
const defenderInput = { name: '自检·守', classId: 'shaman', level: 80, equipped };
const seed = 0x6d2b79f5;

const duelFromGenerated = duelGenerated.simulateDuel(
  duelGenerated.buildTrialCombatant(attackerInput),
  duelGenerated.buildTrialCombatant(defenderInput),
  new duelGenerated.Rng(seed),
);
const duelFromSource = duelSource.simulateDuel(
  duelTrialSource.buildTrialCombatant(attackerInput),
  duelTrialSource.buildTrialCombatant(defenderInput),
  new duelGenerated.Rng(seed),
);

const duelKey = (r: {
  winner: string;
  attackerDamage: number;
  defenderDamage: number;
  log: readonly unknown[];
}) => `${r.winner}|${r.attackerDamage}|${r.defenderDamage}|${r.log.length}`;
if (duelKey(duelFromGenerated) !== duelKey(duelFromSource)) {
  console.error(
    `✗ 对决自检失败：打包产物 ${duelKey(duelFromGenerated)} ≠ 源实现 ${duelKey(duelFromSource)}`,
  );
  process.exit(1);
}
console.log(`✓ 对决确定性自检通过：打包产物与 src/core 胜负一致（${duelKey(duelFromSource)}）`);

await import('./guild-edge-self-check.mts');
