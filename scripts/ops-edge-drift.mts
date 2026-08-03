/**
 * Edge 漂移自检 —— 回答一个问题：**现在生产上跑的 Edge，和 main 是同一份吗？**
 *
 * 用法：npm run ops:edge-drift              查全部 12 个函数
 *       npm run ops:edge-drift sync-profile 只查一个
 *
 * ── 为什么需要它 ──
 * `edge:build` 把 `src/core|data|save` 整个打进每个函数的 `_core.ts`。
 * 于是**任何一笔改 src 的提交都可能改变服务端产物**，哪怕它看起来"只改了前端"。
 * 2026-08-03 实测：一笔只在 `src/data/boutique.ts` 加了个 `listed` 标志的提交，
 * 改变了 **9 / 12** 个函数的产物。当天晚些时候又发现 **6 个函数落后于 main**，
 * 而这两次都**没有任何东西会自己变红** —— 全靠人记得去比。这条命令就是那个"记得"。
 *
 * ── 判据 ──
 * 本地按当前 HEAD 跑 `edge:build`，再把生产上的函数 download 回来，逐字节比 `_core.ts`。
 * **两侧都出自同一个 `edge:build`**，所以哈希相等是硬证据（这一点不能想当然：
 * 前端包不适用此法，本地 Windows 构建与 CI Linux 构建不同源，哈希不等什么都不说明）。
 *
 * ── 它抓不到什么（写清楚，免得有人当成万能门禁）──
 * · 只比 `_core.ts`。函数自身的 `index.ts` 若在生产被改过，这里看不出来。
 * · 只说"一样不一样"，**不说"不一样要不要紧"**。字节漂移经常是行为无害的
 *   （2026-08-03 那次落后 6 个函数，实测 5688 件次装备校验零拒收）。
 *   **红了先查行为，别条件反射去部署。**
 * · 需要网络与 supabase 登录态，**因此不能进 `npm run verify`**。
 *
 * ── ★ 用它之前必须知道的一条（我 2026-08-03 就栽在这里）──
 * **`supabase functions download` 会把本地 `_core.ts` 覆盖成生产那一份。**
 * 那天我先 download 了 submit-trial / submit-dungeon 做行为探针，**接着直接 deploy**，
 * 于是把刚下载回来的旧内容原样传了回去 —— 生产没变坏（传的就是它自己那份），
 * 但那次部署对这两个**完全无效**，而且**看起来和成功部署一模一样**。
 * 是本脚本把它们标红的，标中的正好就是我下载过的那两个。
 *
 * **纪律：download 之后、deploy 之前，一定要重新 `npm run edge:build`。**
 * 本脚本结尾会自动重建一次（见文件末尾），所以**跑完本脚本再部署是安全的**；
 * 危险的是"手动 download 完就部署"。
 */

import { execFileSync, execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT_REF = 'rwtuhwizoohvwerqkhgb';
const FUNCTIONS_DIR = resolve(ROOT, 'supabase/functions');

/** 12 个函数的名单从目录推导，不手写 —— 手写的名单会在新增函数时静默漏掉它。 */
function allFunctionNames(): string[] {
  return execFileSync('git', ['ls-files', 'supabase/functions'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .map((p) => /^supabase\/functions\/([^/]+)\/index\.ts$/.exec(p.trim())?.[1])
    .filter((n): n is string => Boolean(n))
    .sort();
}

function coreHash(fn: string): string | null {
  const p = resolve(FUNCTIONS_DIR, fn, '_core.ts');
  if (!existsSync(p)) return null;
  return createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 16);
}

/**
 * 走 shell 执行。
 *
 * 为什么不用 execFileSync：Windows 上 npm / npx 是 .cmd，
 * `execFileSync('npm', …)` 报 ENOENT，改成 'npm.cmd' 又被 Node 20+ 以安全理由拒绝（EINVAL）。
 * 实测两条都不通，只有走 shell 可行。
 *
 * 命令串里唯一的变量是函数名，而它来自本仓库 `git ls-files` 的推导；
 * 仍然在下面按 /^[a-z0-9-]+$/ 校验一次再拼，不让任何意外字符进 shell。
 */
function run(command: string): boolean {
  try {
    execSync(command, { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const SAFE_NAME = /^[a-z0-9-]+$/;

const only = process.argv[2];
const names = allFunctionNames().filter((n) => !only || n === only);
if (names.length === 0) {
  console.error(`找不到函数：${only}`);
  process.exit(1);
}

const head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
console.log(`\nEdge 漂移自检 —— 本地 HEAD ${head} vs 生产 ${PROJECT_REF}\n`);

// 1) 先按当前 HEAD 构建，记下"main 应该长什么样"
process.stdout.write('构建本地产物…');
if (!run('npm run edge:build')) {
  console.error('\n✗ edge:build 失败，无法比较');
  process.exit(1);
}
const expected = new Map(names.map((n) => [n, coreHash(n)]));
console.log(` 完成（${names.length} 个）\n`);

// 2) 逐个 download 回来比。download 会覆盖本地文件，所以上一步的哈希必须先存好。
const drifted: string[] = [];
const failed: string[] = [];
console.log('函数'.padEnd(22) + 'main 构建'.padEnd(18) + '生产在跑'.padEnd(18) + '状态');
console.log('-'.repeat(72));
for (const fn of names) {
  const exp = expected.get(fn) ?? '(无产物)';
  if (!SAFE_NAME.test(fn)) {
    console.log(`${fn.padEnd(22)}函数名含意外字符，拒绝执行`);
    failed.push(fn);
    continue;
  }
  if (!run(`npx supabase functions download ${fn} --project-ref ${PROJECT_REF}`)) {
    console.log(`${fn.padEnd(22)}${exp.padEnd(18)}${'—'.padEnd(18)}下载失败`);
    failed.push(fn);
    continue;
  }
  const act = coreHash(fn) ?? '(无产物)';
  const same = exp === act;
  if (!same) drifted.push(fn);
  console.log(`${fn.padEnd(22)}${exp.padEnd(18)}${act.padEnd(18)}${same ? '一致' : '★ 漂移'}`);
}

// 3) 把本地恢复成"按 HEAD 构建"的状态 —— 否则下一个人看到的是从生产下载回来的内容。
process.stdout.write('\n恢复本地产物…');
run('npm run edge:build');
console.log(' 完成');

console.log('-'.repeat(72));
if (failed.length > 0) {
  console.error(`\n✗ ${failed.length} 个函数下载失败：${failed.join(', ')}`);
  console.error('  下载失败与"一致"长得完全不同，但与"没查过"长得一样 —— 请重跑，别当成通过。');
  process.exit(1);
}
if (drifted.length > 0) {
  console.error(
    `\n✗ ${drifted.length} / ${names.length} 个函数与 main 不一致：\n` +
      drifted.map((d) => `  ${d}`).join('\n') +
      '\n\n下一步**不是**直接部署，按顺序做：\n' +
      '  1. 先查漂移**要不要紧**：跑一次行为探针（拿生产那份 _core.ts 导出的\n' +
      '     校验函数，喂 main 的全部数据，看有没有拒收）。字节不同常常行为无害。\n' +
      '  2. 确认无害后再 deploy，为的是**恢复"生产==main"这个不变量**——\n' +
      '     它才是下次能三分钟给出判定的前提，不是为了修什么。\n' +
      '  3. 部署完重跑本命令，必须全部"一致"才算数。',
  );
  process.exit(1);
}
console.log(`\n✓ 全部一致：生产上跑的 Edge 与 main(${head}) 逐字节相同。`);
