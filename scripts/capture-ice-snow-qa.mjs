/* global document, HTMLElement, requestAnimationFrame, window */
/**
 * 冰雪华年五职业真实 CharacterAppearance 浏览器截图。
 *
 * 依赖 dev-appearance.html 的 dev-only 体检页；不创建测试专用角色渲染逻辑，
 * 因此截图与玩家端共用同一组件、装备注册表和叠层顺序。
 */
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const OUTPUT_ROOT = resolve(ROOT, 'art-source/qa');
const BASE_URL = 'http://127.0.0.1:4318/yingrenchuanshuo';
const CLASSES = ['swordsman', 'witch', 'shaman', 'catkin', 'kenshi'];
const SIZES = [
  { width: 390, height: 844, label: '390x844' },
  { width: 320, height: 568, label: '320x568' },
];

async function importPlaywright() {
  const candidates = [
    'playwright',
    'C:/Users/Administrator/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright',
  ];
  for (const candidate of candidates) {
    try {
      if (candidate.includes(':')) return await import(pathToFileURL(`${candidate}/index.mjs`).href);
      return await import(candidate);
    } catch {
      // 尝试下一处本机既有安装；不在线安装依赖。
    }
  }
  throw new Error(`找不到 Playwright；已尝试：${candidates.join(' / ')}`);
}

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function waitForServer(timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${BASE_URL}/dev-appearance.html`);
      if (response.ok) return;
    } catch {
      // Vite 尚未监听。
    }
    await wait(250);
  }
  throw new Error('冰雪实穿截图：Vite 30 秒内未启动');
}

async function allImagesReady(page) {
  await page.waitForFunction(() =>
    [...document.images].every((image) => image.complete && image.naturalWidth > 0),
  );
}

async function resetAndAssertScrollTop(page, label) {
  const state = await page.evaluate(async () => {
    const roots = [document.scrollingElement, document.documentElement, document.body];
    for (const root of roots) {
      if (!root) continue;
      root.scrollTop = 0;
      root.scrollLeft = 0;
    }
    for (const selector of ['.preview-page', '.main', '.shop-view', '.shelf']) {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) continue;
      element.scrollTop = 0;
      element.scrollLeft = 0;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
    return {
      windowY: window.scrollY,
      scrollingTop: document.scrollingElement?.scrollTop ?? -1,
      documentTop: document.documentElement.scrollTop,
      bodyTop: document.body.scrollTop,
      previewTop: document.querySelector('.preview-page')?.scrollTop ?? 0,
      mainTop: document.querySelector('.main')?.scrollTop ?? 0,
      shopTop: document.querySelector('.shop-view')?.scrollTop ?? 0,
      shelfTop: document.querySelector('.shelf')?.scrollTop ?? 0,
    };
  });
  if (Object.values(state).some((value) => value !== 0)) {
    throw new Error(`冰雪截图 ${label} 未归零：${JSON.stringify(state)}`);
  }
}

async function findIceRow(page) {
  // 每个精品主题固定五行。逐行探测避免一次渲染全仓数百张大图。
  for (let rowIndex = 0; rowIndex < 40; rowIndex += 1) {
    await page.goto(`${BASE_URL}/dev-appearance.html?rows=${rowIndex}`, { waitUntil: 'networkidle' });
    const text = await page.locator('body').innerText();
    if (text.includes('商店 · 冰雪华年新春礼装') && text.includes('全套可见槽')) {
      return rowIndex;
    }
  }
  throw new Error('预览页未找到 boutique-ice-snow 全套行；请先完成数据注册');
}

async function seedIceShopSave(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const [{ createSave }, { saveSave }] = await Promise.all([
      import('/yingrenchuanshuo/src/save/schema.ts'),
      import('/yingrenchuanshuo/src/save/storage.ts'),
    ]);
    const save = createSave('冰雪华年实机验收', 'swordsman', 0x20260802, Date.now());
    save.player.level = 78;
    save.player.gold = 2_000_000_000;
    save.progress.currentStageId = 'stage_7-5_6';
    save.progress.clearedStageIds = ['stage_7-5_6'];
    await saveSave(save);
  });
}

async function openIceShop(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.locator('.tabbar').waitFor();
  await page.getByRole('button', { name: '更多', exact: true }).click();
  await page.locator('.boutique-entry').click();
  await page.locator('.shop-view').waitFor();
  await page.locator('.shelf-switcher button.ice').click();
  await page.locator('.shop-scene.ice-snow').waitFor();
  await allImagesReady(page);
}

await mkdir(OUTPUT_ROOT, { recursive: true });
const viteEntry = resolve(ROOT, 'node_modules/vite/bin/vite.js');
await readFile(viteEntry);
const server = spawn(process.execPath, [viteEntry, '--host', '127.0.0.1', '--port', '4318'], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

let stderr = '';
server.stderr.on('data', (chunk) => {
  stderr += chunk.toString();
});

try {
  await waitForServer();
  const { chromium } = await importPlaywright();
  const browser = await chromium.launch({ headless: true });
  try {
    const contactPage = await browser.newPage({ viewport: { width: 1160, height: 760 } });
    const rowIndex = await findIceRow(contactPage);
    await allImagesReady(contactPage);
    const section = contactPage.locator('section.preview-row').first();
    const contactPng = await section.screenshot({ type: 'png' });
    await sharp(contactPng)
      .webp({ quality: 92, effort: 6 })
      .toFile(resolve(OUTPUT_ROOT, 'ice-snow-appearance-contact.webp'));
    await contactPage.close();

    for (const size of SIZES) {
      for (let index = 0; index < CLASSES.length; index += 1) {
        const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
        const errors = [];
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(message.text());
        });
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(`${BASE_URL}/dev-appearance.html?rows=${rowIndex}`, { waitUntil: 'networkidle' });
        await allImagesReady(page);
        await page.addStyleTag({
          content: `
            figure.cell { display: none !important; }
            figure.cell:nth-child(${index + 1}) { display: block !important; }
            .cell-grid { justify-content: center !important; }
            .preview-page { box-sizing: border-box; width: 100%; }
          `,
        });
        await resetAndAssertScrollTop(page, `${CLASSES[index]}-${size.label}`);
        await page.waitForTimeout(120);
        await resetAndAssertScrollTop(page, `${CLASSES[index]}-${size.label}-capture`);
        const health = await page.evaluate(() => ({
          width: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          brokenImages: [...document.images]
            .filter((image) => image.complete && image.naturalWidth === 0)
            .map((image) => image.src),
        }));
        if (health.scrollWidth > health.width || health.brokenImages.length > 0 || errors.length > 0) {
          throw new Error(
            `冰雪实穿 ${CLASSES[index]}-${size.label} 失败：${JSON.stringify({ health, errors })}`,
          );
        }
        await page.screenshot({
          path: resolve(OUTPUT_ROOT, `ice-snow-${CLASSES[index]}-${size.label}.png`),
          type: 'png',
        });
        await page.close();
      }
    }

    // browser.newPage() 每次都会创建隔离上下文；货架两种尺寸必须共用同一个
    // BrowserContext，才能证明正式 IndexedDB 存档重载后仍能进入已解锁货架。
    const shopContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    });
    const page = await shopContext.newPage();
    await seedIceShopSave(page);
    for (const size of SIZES) {
      await page.setViewportSize({ width: size.width, height: size.height });
      const errors = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));
      await openIceShop(page);
      await resetAndAssertScrollTop(page, `shop-${size.label}`);
      const health = await page.evaluate(() => ({
        width: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        brokenImages: [...document.images]
          .filter((image) => image.complete && image.naturalWidth === 0)
          .map((image) => image.src),
      }));
      if (health.scrollWidth > health.width || health.brokenImages.length > 0 || errors.length > 0) {
        throw new Error(
          `冰雪货架 ${size.label} 实机失败：${JSON.stringify({ health, errors })}`,
        );
      }
      await page.screenshot({
        path: resolve(OUTPUT_ROOT, `ice-snow-shop-${size.label}.png`),
        type: 'png',
      });
    }
    await shopContext.close();
  } finally {
    await browser.close();
  }
} finally {
  server.kill('SIGTERM');
  await wait(250);
}

if (server.exitCode && server.exitCode !== 0) {
  throw new Error(`Vite 截图服务异常退出 ${server.exitCode}: ${stderr.slice(-1000)}`);
}

console.log('冰雪华年实穿截图完成：五职业 × 双尺寸 + 独立货架双尺寸 + 联系表。');
