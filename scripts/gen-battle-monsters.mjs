/**
 * 从无损 PNG 母版生成战斗区使用的透明 WebP。
 *
 * 处理规则：
 * 1. 移除母版四周的透明空白；
 * 2. 将主体等比缩放到 480×480 的可用区域；
 * 3. 在 512×512 透明画布上底部居中，保留 8px 安全边距；
 * 4. 输出高质量透明 WebP，降低 PWA 资源体积。
 *
 * 用法：node scripts/gen-battle-monsters.mjs
 * 依赖：sharp（devDependency）
 */
import { mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { REGION34_MONSTERS } from './region34-assets-manifest.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const MASTER_ROOT = resolve(ROOT, 'art-source/monsters');
const OUTPUT_ROOT = resolve(ROOT, 'public/assets/monsters');
const DEFAULT_REGIONS = ['r1', 'r2'];
const CANVAS_SIZE = 512;
const CONTENT_SIZE = 480;
const BOTTOM_PADDING = 8;
const WORKER_COUNT = 4;

function requestedRegions() {
  const argument = process.argv.find((value) => value.startsWith('--regions='));
  if (!argument) return DEFAULT_REGIONS;
  const regions = argument
    .slice('--regions='.length)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (regions.length === 0) {
    throw new Error('参数 --regions 至少要包含一个区域，例如 --regions=r3,r4');
  }
  const knownRegions = new Set([...DEFAULT_REGIONS, 'r3', 'r4']);
  const unknown = regions.filter((region) => !knownRegions.has(region));
  if (unknown.length > 0) {
    throw new Error(`未知怪物区域：${unknown.join(', ')}`);
  }
  return [...new Set(regions)];
}

const REGIONS = requestedRegions();

function expectedMasterNames(region) {
  if (region !== 'r3' && region !== 'r4') return null;
  return REGION34_MONSTERS.filter((monster) => monster.region === region)
    .map((monster) => `${monster.id}.png`)
    .sort();
}

async function validateOutput(outputFile) {
  const metadata = await sharp(outputFile).metadata();
  if (
    metadata.format !== 'webp' ||
    metadata.width !== CANVAS_SIZE ||
    metadata.height !== CANVAS_SIZE ||
    metadata.channels !== 4 ||
    !metadata.hasAlpha
  ) {
    throw new Error(`怪物输出格式异常：${outputFile}`);
  }

  const { data, info } = await sharp(outputFile).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const cornerAlpha = [
    data[3],
    data[(info.width - 1) * info.channels + 3],
    data[(info.height - 1) * info.width * info.channels + 3],
    data[(info.height * info.width - 1) * info.channels + 3],
  ];
  if (cornerAlpha.some((alpha) => alpha !== 0)) {
    throw new Error(`怪物输出角落必须透明：${outputFile}`);
  }

  let visiblePixelCount = 0;
  let bottomVisibleY = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const alpha = data[(y * info.width + x) * info.channels + 3];
      if (alpha > 8) {
        visiblePixelCount += 1;
        bottomVisibleY = y;
      }
    }
  }
  if (visiblePixelCount === 0) {
    throw new Error(`怪物输出没有可见主体：${outputFile}`);
  }
  const expectedBottomY = CANVAS_SIZE - BOTTOM_PADDING - 1;
  if (bottomVisibleY !== expectedBottomY) {
    throw new Error(
      `怪物脚底锚点异常：${outputFile}，期望 y=${expectedBottomY}，实际 y=${bottomVisibleY}`,
    );
  }
}

async function renderMonster(masterFile, outputFile) {
  const metadata = await sharp(masterFile).metadata();
  if (!metadata.hasAlpha) {
    throw new Error(`怪物母版缺少 Alpha 通道：${masterFile}`);
  }

  const { data: subject, info } = await sharp(masterFile)
    .rotate()
    .ensureAlpha()
    .trim({
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      threshold: 8,
    })
    .resize({
      width: CONTENT_SIZE,
      height: CONTENT_SIZE,
      fit: 'inside',
      withoutEnlargement: false,
    })
    .png()
    .toBuffer({ resolveWithObject: true });

  const left = Math.floor((CANVAS_SIZE - info.width) / 2);
  const top = CANVAS_SIZE - BOTTOM_PADDING - info.height;
  if (left < 0 || top < 0) {
    throw new Error(`怪物主体超出标准画布：${masterFile}`);
  }

  await sharp({
    create: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: subject, left, top }])
    .webp({
      quality: 88,
      alphaQuality: 100,
      effort: 6,
      smartSubsample: true,
      preset: 'picture',
    })
    .toFile(outputFile);

  await validateOutput(outputFile);
  const outputSize = (await stat(outputFile)).size;
  console.log(`✔ ${outputFile} (${(outputSize / 1024).toFixed(1)} KiB)`);
}

const jobs = [];

for (const region of REGIONS) {
  const masterDir = resolve(MASTER_ROOT, region);
  const outputDir = resolve(OUTPUT_ROOT, region);
  await mkdir(outputDir, { recursive: true });

  const discoveredFilenames = (await readdir(masterDir))
    .filter((filename) => extname(filename).toLowerCase() === '.png')
    .sort();
  const expectedFilenames = expectedMasterNames(region);
  const filenames = expectedFilenames ?? discoveredFilenames;

  if (filenames.length === 0) {
    throw new Error(`没有找到怪物母版：${masterDir}`);
  }
  if (expectedFilenames) {
    const discovered = new Set(discoveredFilenames);
    const missing = expectedFilenames.filter((filename) => !discovered.has(filename));
    const unexpected = discoveredFilenames.filter(
      (filename) => !expectedFilenames.includes(filename),
    );
    if (missing.length > 0 || unexpected.length > 0) {
      throw new Error(
        [
          `${region} 怪物母版与清单不一致。`,
          missing.length > 0 ? `缺少：${missing.join(', ')}` : '',
          unexpected.length > 0 ? `多出：${unexpected.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join(' '),
      );
    }
  }

  for (const filename of filenames) {
    const basename = filename.slice(0, -extname(filename).length);
    jobs.push({
      masterFile: resolve(masterDir, filename),
      outputFile: resolve(outputDir, `${basename}.webp`),
    });
  }
}

let nextJob = 0;

async function runWorker() {
  while (nextJob < jobs.length) {
    const job = jobs[nextJob];
    nextJob += 1;
    await renderMonster(job.masterFile, job.outputFile);
  }
}

await Promise.all(Array.from({ length: Math.min(WORKER_COUNT, jobs.length) }, () => runWorker()));

const expectedOutputs = new Set(jobs.map((job) => job.outputFile));
for (const region of REGIONS) {
  const outputDir = resolve(OUTPUT_ROOT, region);
  const runtimeFiles = (await readdir(outputDir))
    .filter((filename) => extname(filename).toLowerCase() === '.webp')
    .map((filename) => resolve(outputDir, filename));
  const orphan = runtimeFiles.filter((filename) => !expectedOutputs.has(filename));
  if (orphan.length > 0) {
    throw new Error(`发现没有对应 PNG 母版的怪物贴图：${orphan.join(', ')}`);
  }
}

console.log(`怪物战斗素材已生成：${jobs.length} 张（${REGIONS.join(', ')}）。`);
