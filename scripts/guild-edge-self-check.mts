/** npm run edge:build 末尾执行：锁定公会 Edge bundle 与源码的逐点一致性。 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generated = await import(
  pathToFileURL(path.join(root, 'supabase/functions/guild-expedition/_core.ts')).href
);
const guildSource = await import('../src/core/guildExpedition.ts');
const trialSource = await import('../src/core/trial.ts');

const input = {
  name: '公会自检',
  classId: 'swordsman' as const,
  level: 45,
  equipped: [null, null, null, null, null, null, null, null],
};
const seasonId = 's1';
const weekIndex = 30;
// 分段 id 随赛季重划轮换，绝不硬编码——从源实现按等级现算。
const bracketId = trialSource.trialBracketFor(input.level).id;
const generatedBuild = generated.buildTrialCombatant(input);
const sourceBuild = trialSource.buildTrialCombatant(input);
const generatedBoss = generated.guildExpeditionBoss(seasonId, weekIndex, bracketId);
const sourceBoss = guildSource.guildExpeditionBoss(seasonId, weekIndex, bracketId);
const generatedSeed = generated.guildRunSeed(
  seasonId,
  weekIndex,
  'edge-self-check',
  '2026-07-30',
  1,
  generatedBuild.buildHash,
);
const sourceSeed = guildSource.guildRunSeed(
  seasonId,
  weekIndex,
  'edge-self-check',
  '2026-07-30',
  1,
  sourceBuild.buildHash,
);
const generatedRun = generated.runTrial(generatedBuild, generatedBoss.combatant, generatedSeed);
const sourceRun = trialSource.runTrial(sourceBuild, sourceBoss.combatant, sourceSeed);
const generatedPoints = generated.guildContributionPoints(
  generatedRun.damage,
  generatedRun.bossHpMax,
);
const sourcePoints = guildSource.guildContributionPoints(sourceRun.damage, sourceRun.bossHpMax);

if (generatedRun.damage !== sourceRun.damage || generatedPoints !== sourcePoints) {
  throw new Error(
    `公会远征自检失败：bundle ${generatedRun.damage}/${generatedPoints} ≠ source ${sourceRun.damage}/${sourcePoints}`,
  );
}
console.log(`✓ 公会远征确定性自检通过：伤害 ${sourceRun.damage}，贡献 ${sourcePoints}`);
