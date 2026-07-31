/**
 * 存档读写真机验证（AGENTS.md 铁律 5 第 4、5 条要求跑的那一条）。
 *
 * ── 为什么单元测试不够 ──
 * src/save 的单元测试跑在**假的 IndexedDB** 上。而 storage.ts 真正负责的是
 * 真实 IndexedDB 的读写、主备链与跨页 CAS —— **假的绿，不等于真浏览器里
 * 存档不丢**。存档丢了不可逆，这一层不能只靠单元测试。
 *
 * 2026-07-31 实证：PR#13 重写 storage.ts（+696/−158）合并时，
 * 单元测试与全量 1783 项全绿，但没有任何一条覆盖「真浏览器刷新后还在不在」。
 * 这个脚本就是补那一层。
 *
 * ── 怎么用 ──
 *   node scripts/smoke-save.mjs                     # 验线上
 *   node scripts/smoke-save.mjs http://localhost:5173/  # 验本地 dev
 *
 * 五项全过才算通过；任何一项红都不要发版。
 *
 * ── 依赖 ──
 * 需要 playwright。本机装在全局 @playwright/cli 里；换机器时把下面的
 * PLAYWRIGHT_PATHS 补一条即可，找不到会明确报错而不是静默跳过。
 */

import { createRequire } from 'node:module';

/*
 * page.evaluate 的回调是**在浏览器里**执行的，document / indexedDB 只在那边存在；
 * 而 eslint 按 node 环境检查本文件，会把它们判成未定义。
 * 用 globals 注释显式声明，而不是关掉 no-undef —— 关规则会连同真正的笔误一起放过。
 */
/* global document, indexedDB */

const require = createRequire(import.meta.url);

const PLAYWRIGHT_PATHS = [
  'playwright',
  'C:/Users/Administrator/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright',
];

function loadPlaywright() {
  for (const candidate of PLAYWRIGHT_PATHS) {
    try {
      return require(candidate);
    } catch {
      // 试下一个候选路径
    }
  }
  throw new Error(
    `[存档冒烟] 找不到 playwright。试过：${PLAYWRIGHT_PATHS.join(' / ')}。\n` +
      '装一个（npm i -D playwright）或把你的路径加进 PLAYWRIGHT_PATHS。',
  );
}

const BASE = process.argv[2] ?? 'https://1449690477.github.io/yingrenchuanshuo/';
const { chromium } = loadPlaywright();

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' —— ' + detail : ''}`);
}

const browser = await chromium.launch();
// 同一个 context 全程复用：换 context 等于换浏览器，存档本来就该丢，验不出东西
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});

const NAME = '存档冒烟';
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.getByPlaceholder('不填就叫「无名少女」').fill(NAME);
await page.getByRole('button', { name: '开始冒险' }).click();
// 挂机几秒，让它产生真实进度并至少落一次盘
await page.waitForTimeout(4000);
check('创角进入游戏', (await page.evaluate(() => document.body.innerText)).includes(NAME));

/** 刷新后仍在游戏里（而不是被打回创角页）= 存档确实读回来了。 */
async function reloadAndCheck(label) {
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const text = await page.evaluate(() => document.body.innerText);
  check(label, text.includes(NAME) && !text.includes('给你的少女起个名字'));
}

await reloadAndCheck('刷新后存档读回，没被打回创角页');
// 第二次刷新验的是写-读-写循环：主备链与 CAS 有没有互相打架
await reloadAndCheck('二次刷新仍然稳定（写-读-写循环）');

const databases = await page.evaluate(async () =>
  (await indexedDB.databases()).map((db) => `${db.name}@v${db.version}`).join(', '),
);
check('IndexedDB 里确实建了库', databases.length > 0, databases);
check('全程控制台零错误', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const failed = results.filter((result) => !result.ok);
console.log(`\n结果：${results.length - failed.length} / ${results.length} 通过`);
process.exit(failed.length ? 1 : 0);
