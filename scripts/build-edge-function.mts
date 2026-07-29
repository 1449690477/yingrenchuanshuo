/**
 * 打包 submit-trial Edge Function 的共享 core，并做确定性自检。
 *
 * 为什么需要这一步：
 *   - 服务端复算必须用【与客户端完全相同的】src/core 代码（docs/51 §6.3），
 *     但本仓 TS 全部是不带扩展名的 `@/` 路径导入，Deno 原生无法解析
 *   - 于是用 esbuild 把所需 core 打成单个自包含文件 _core.ts，
 *     只把 'zod' 留作外部依赖（Deno 端由 supabase/functions/deno.json 映射到 npm:）
 *
 * 自检：打包产物与 src/core 原始实现各跑一次同种子试炼，成绩必须逐点一致。
 * 这一步不过，说明打包链路出了问题，绝不应部署。
 *
 * 用法：npm run edge:build
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(root, 'supabase/functions/submit-trial/_core-entry.ts');
const outfile = path.join(root, 'supabase/functions/submit-trial/_core.ts');

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
console.log(`✓ 已打包 ${path.relative(root, outfile)}`);

// ── 确定性自检：打包产物 == src/core 原实现 ──
const generated = await import(pathToFileURL(outfile).href);
const source = await import('../src/core/trial.ts');

const equipped = [null, null, null, null, null, null, null, null];
const input = { name: '自检', classId: 'swordsman', level: 45, equipped };
const seasonId = 's1';
const weekIndex = 30;
const bracketId = 'feiyue';

const fromGenerated = generated.runTrial(
  generated.buildTrialCombatant(input),
  generated.weeklyTrialBoss(seasonId, weekIndex, bracketId).combatant,
  generated.trialScoreSeed(seasonId, weekIndex, bracketId, generated.buildTrialCombatant(input).buildHash),
);
const fromSource = source.runTrial(
  source.buildTrialCombatant(input),
  source.weeklyTrialBoss(seasonId, weekIndex, bracketId).combatant,
  source.trialScoreSeed(seasonId, weekIndex, bracketId, source.buildTrialCombatant(input).buildHash),
);

if (fromGenerated.damage !== fromSource.damage) {
  console.error(`✗ 自检失败：打包产物成绩 ${fromGenerated.damage} ≠ 源实现成绩 ${fromSource.damage}`);
  process.exit(1);
}
console.log(`✓ 确定性自检通过：打包产物与 src/core 成绩一致（${fromSource.damage}）`);
