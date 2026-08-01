/**
 * 部署清单 —— 重新部署 Edge Function 之前，先看清楚**你实际会送上生产的是谁的代码**。
 *
 * 用法：npm run deploy:manifest            列出全部 12 个函数
 *       npm run deploy:manifest sync-profile   只看一个
 *
 * ── 这个脚本为什么存在 ──
 * 2026-08-01 我（小库）改了 sync-profile 的一小段并重新部署，验证做得很细：
 * 迁移前后逐行对照、端到端线上探针、CI、线上产物实证、真实 PostgREST 查询。
 * **但那五步只覆盖了我改的那条路径。**
 * 同一次部署把另一条线前一天加进同一个函数的三个提交**一起送上了生产**，
 * 那部分我一次都没跑过 —— 是对方主动去验才确认完好。
 *
 * 根因不是我漏测了什么，是**验证的边界画错了**：
 * 我按「**我改了什么**」画边界，而生产按「**这个部署单元里有什么**」生效。
 * 多人共用一个函数 + 一份打包 core 时，这两者根本不重合。
 *
 * 所以这个脚本回答的是一个很朴素的问题：
 * **自这个函数上次部署以来，它的部署单元里都进了谁的什么改动？**
 * 自己测不了的，就拿着这张清单去点名请作者测 ——
 * **不要因为「那不是我改的」就默认它已经被验过。**
 *
 * ── 为什么 core 目录是整个算进来的 ──
 * 每个函数的 `_core-entry.ts` 从 `src/core` / `src/data` / `src/save` 里
 * re-export，esbuild 再顺着依赖图把它们打进 `_core.ts`。
 * 一个函数到底吃到了哪几个文件，取决于打包时的依赖图，**不是靠读 entry 就能知道的**。
 * 与其给一个漏掉东西的精确答案，不如给一个**包含冗余但不漏**的粗答案 ——
 * 这张清单是用来「别忘了看」的，不是用来精确定责的。
 *
 * ── 已知的两个偏差，都偏向「多报」而不是「漏报」 ──
 * ① **部署可以来自工作树，不必来自提交**（`supabase functions deploy` 打包的是本地文件）。
 *    所以一个「部署时间之后才提交」的改动，其代码可能**早就在线上了**，
 *    这里仍会把它列出来。宁可多看一眼，也不要漏掉真正没上线的。
 * ② core 目录整个算进来（见上一段），一个函数未必真的吃到其中每个文件。
 *
 * 两个偏差都是**故意选的方向**：这张单子的用途是「别忘了看」，
 * 漏报会让人误以为安全，多报只是多花十秒钟。
 *
 * ── 这个脚本不做什么 ──
 * **只读、不部署、不改任何东西。** 它也不判断安全与否 ——
 * 判断是人的事，它只保证你做判断时手里有完整的名单。
 */

import { execFileSync, spawnSync } from 'node:child_process';

const PROJECT_REF = 'rwtuhwizoohvwerqkhgb';

/** 打包进 _core.ts 的源码目录（见文件头「为什么整个算进来」）。 */
const CORE_DIRS = ['src/core', 'src/data', 'src/save'];

interface DeployedFn {
  slug: string;
  version: number;
  status: string;
  /** 上次部署时刻（毫秒） */
  updatedAt: number;
}

function sh(cmd: string, args: string[]): string {
  return execFileSync(cmd, args, { encoding: 'utf8', shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
}

/** 发布只能来自包含最新 main 的干净提交，绝不把工作树半成品送上生产。 */
function assertReleaseHead(): void {
  const dirty = sh('git', ['status', '--porcelain=v1', '--untracked-files=all']).trim();
  if (dirty) {
    throw new Error(`工作树不是干净提交，拒绝生成部署清单：\n${dirty}`);
  }

  const containsMain = spawnSync(
    'git',
    ['merge-base', '--is-ancestor', 'origin/main', 'HEAD'],
    { shell: true, stdio: 'ignore' },
  );
  if (containsMain.status !== 0) {
    throw new Error('当前 HEAD 未包含 origin/main，拒绝部署过期基线');
  }
}

function listDeployed(): DeployedFn[] {
  const raw = sh('npx', [
    'supabase',
    'functions',
    'list',
    '--project-ref',
    PROJECT_REF,
    '-o',
    'json',
  ]);
  const json = JSON.parse(raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1)) as {
    slug: string;
    version: number;
    status: string;
    updated_at: number;
  }[];
  return json.map((f) => ({
    slug: f.slug,
    version: f.version,
    status: f.status,
    updatedAt: f.updated_at,
  }));
}

/** 某个时刻之后、落在给定路径上的提交（最新在前）。 */
function commitsSince(sinceIso: string, paths: string[]): string[] {
  const out = sh('git', [
    'log',
    '--oneline',
    `--since="${sinceIso}"`,
    'HEAD',
    '--',
    ...paths,
  ]);
  return out.split('\n').map((l) => l.trim()).filter(Boolean);
}

assertReleaseHead();

if (process.argv.includes('--preflight-only')) {
  console.log(`部署前置通过：干净 HEAD 已包含 origin/main，目标项目 ${PROJECT_REF}`);
  process.exit(0);
}

const only = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
const fns = listDeployed()
  .filter((f) => !only || f.slug === only)
  .sort((a, b) => a.slug.localeCompare(b.slug));

if (fns.length === 0) {
  console.log(only ? `没有名为 ${only} 的线上函数` : '线上没有任何函数');
  process.exit(1);
}

console.log('\n部署清单（只读）—— 重新部署前，先看清楚你会送上生产的是谁的代码\n');

let anyPending = false;
for (const fn of fns) {
  const sinceIso = new Date(fn.updatedAt).toISOString();
  const own = commitsSince(sinceIso, [`supabase/functions/${fn.slug}/`]);
  const core = commitsSince(sinceIso, CORE_DIRS);
  const total = own.length + core.length;
  if (total > 0) anyPending = true;

  const local = new Date(fn.updatedAt).toLocaleString('zh-CN', { hour12: false });
  console.log(`── ${fn.slug}  v${fn.version} ${fn.status}  上次部署 ${local}（本地时区）`);
  if (total === 0) {
    console.log('   与线上一致，无待送改动\n');
    continue;
  }
  if (own.length > 0) {
    console.log(`   函数自身 ${own.length} 个提交：`);
    own.forEach((c) => console.log(`     ${c}`));
  }
  if (core.length > 0) {
    console.log(`   ★ 打包 core 变动 ${core.length} 个提交（**这些也会随本次部署上线**）：`);
    core.forEach((c) => console.log(`     ${c}`));
  }
  console.log('');
}

if (anyPending) {
  console.log('⚠ 上面每一条都会随下一次部署进入生产。');
  console.log('  自己测不了的，拿这张单子去点名请作者测 —— 不要因为「那不是我改的」就默认它验过了。\n');
} else {
  console.log('全部函数与 origin/main 一致，没有待送改动。\n');
}
