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
  'submit-milestone',
  'submit-affection',
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
// 分段 id 会随赛季轮换重划（docs/61 §3.2：4 段→5 段、id 全换新），
// 绝不硬编码 —— 从源实现按等级现算，与线上函数行为同口径。
const bracketId = trialSource.trialBracketFor(input.level).id;

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

const legacyV9Instance = {
  uid: 'edge-selfcheck-v9',
  defId: 'eq_r1_weapon_rare',
  enhance: 0,
  baseRollPermille: 1000,
  enhanceGainPermille: Array<number>(15).fill(0),
  enhanceLuck: {},
  affixes: [{ key: 'atk', value: 8.7, tier: 5 }],
  reforgeResonance: 0,
  locked: false,
};
const legacyIssueFromGenerated = trialGenerated.trialEquipmentSnapshotIssue(
  legacyV9Instance,
  'swordsman',
  6,
);
const legacyIssueFromSource = trialSource.trialEquipmentSnapshotIssue(
  legacyV9Instance,
  'swordsman',
  6,
);
if (legacyIssueFromGenerated !== null || legacyIssueFromSource !== null) {
  console.error(
    `✗ 历史词条自检失败：打包产物=${String(legacyIssueFromGenerated)}，源实现=${String(legacyIssueFromSource)}`,
  );
  process.exit(1);
}
console.log('✓ 历史词条自检通过：v9 正式生成并迁移的装备可进入服务端复算');

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

// ── 确定性自检 3：里程碑合理性下界（docs/51 §4 榜 4）──
//
// 这个榜没有「服务端复算」可言（「你何时到达 Lv60」无法重建），
// 下界表是唯一的防线。若打包产物里的表与 src/data 漂移，
// 服务端就会按另一套标准判定，而这类漂移正是 docs/61 §2.2 那个
// 「同一口径两处实现」bug 的成因 —— 必须在部署前拦住。
const milestoneGenerated = await import(
  pathToFileURL(path.join(root, 'supabase/functions/submit-milestone/_core.ts')).href
);
const milestoneSource = await import('../src/core/milestones.ts');
const milestoneRules = await import('../src/data/milestoneRules.ts');

for (const level of milestoneRules.MILESTONE_LEVELS) {
  const floor = milestoneRules.MILESTONE_MIN_ELAPSED_MS[level];
  // 下界上下各取一点：边界两侧的判定都必须两边一致
  for (const elapsedMs of [floor - 1, floor, floor + 1]) {
    const claim = { level, elapsedMs };
    const fromGenerated = milestoneGenerated.isPlausibleMilestone(claim);
    const fromSource = milestoneSource.isPlausibleMilestone(claim);
    if (fromGenerated !== fromSource) {
      console.error(
        `✗ 里程碑自检失败：Lv${level} 用时 ${elapsedMs}ms —— ` +
          `打包产物=${String(fromGenerated)}，源实现=${String(fromSource)}`,
      );
      process.exit(1);
    }
  }
}
if (milestoneGenerated.MILESTONE_LEVELS.join() !== milestoneRules.MILESTONE_LEVELS.join()) {
  console.error(
    `✗ 里程碑档位漂移：打包产物=[${milestoneGenerated.MILESTONE_LEVELS.join()}]，` +
      `源实现=[${milestoneRules.MILESTONE_LEVELS.join()}]`,
  );
  process.exit(1);
}
console.log(
  `✓ 里程碑确定性自检通过：档位 [${milestoneRules.MILESTONE_LEVELS.join(', ')}] 与下界判定两边一致`,
);

// ── 确定性自检 4：羁绊榜合理性下界（docs/63 §三 · P2）──
//
// 与里程碑同构：这个榜同样没有服务端复算可言，下界公式是唯一防线。
// 常量全部从好感数据推导（幕数上限 / 单次上限 / 单幕点数），
// 数据批次更新后打包产物必须跟上 —— 逐点比对打包产物与源实现。
const affectionGenerated = await import(
  pathToFileURL(path.join(root, 'supabase/functions/submit-affection/_core.ts')).href
);
const affectionSource = await import('../src/core/affectionBoard.ts');

const affectionProbes: { claim: { points: number; totalInteractions: number; storyCount: number }; accountAgeMs: number }[] = [
  // 30 天满勤满幕的理论极限（真实玩家上限）
  { claim: { points: 4 * 30 * 18 + 12 * 60, totalInteractions: 120, storyCount: 12 }, accountAgeMs: 30 * 86_400_000 },
  // 新号顶格（作弊声明）
  { claim: { points: 99_999, totalInteractions: 10_000, storyCount: 12 }, accountAgeMs: 86_400_000 },
  // 虚报互动次数（日上限防线）
  { claim: { points: 10_000, totalInteractions: 360, storyCount: 0 }, accountAgeMs: 10 * 86_400_000 },
  // 首日新手
  { claim: { points: 40, totalInteractions: 4, storyCount: 0 }, accountAgeMs: 0 },
  // 边界上下各一点
  { claim: { points: 99_999, totalInteractions: 5_555, storyCount: 15 }, accountAgeMs: 365 * 86_400_000 },
];
for (const probe of affectionProbes) {
  const fromGenerated = affectionGenerated.isPlausibleAffectionClaim(probe.claim, probe.accountAgeMs);
  const fromSource = affectionSource.isPlausibleAffectionClaim(probe.claim, probe.accountAgeMs);
  if (fromGenerated !== fromSource) {
    console.error(
      `✗ 羁绊自检失败：${JSON.stringify(probe)} —— ` +
        `打包产物=${String(fromGenerated)}，源实现=${String(fromSource)}`,
    );
    process.exit(1);
  }
}
console.log('✓ 羁绊榜确定性自检通过：下界判定打包产物与 src/core 逐点一致');

await import('./guild-edge-self-check.mts');
