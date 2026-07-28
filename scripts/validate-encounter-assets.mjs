import { createHash } from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import sharp from 'sharp';

const PORTRAITS = {
  akane: [
    'nervous-request',
    'lasting-grip',
    'prove-it',
    'rejected-clutch',
    'ask-herself',
    'not-wrong',
    'first-blade-present',
    'give-name',
    'test-blade',
    'blind-grip-trust',
    'rain-wrap-trust',
    'small-hands-trust',
    'soft-response',
    'steady-response',
  ],
  sui: [
    'hay-sleep',
    'take-breath',
    'go-together',
    'old-letter-anxious',
    'apologize',
    'still-matters',
    'storm-run-ready',
    'trust-her',
    'run-beside',
    'morning-route-trust',
    'windy-knot-trust',
    'quiet-letter-trust',
    'praise-response',
    'rest-response',
  ],
};

const SCENES = {
  akane: [
    'petalsmith-road',
    'rejected-workbench',
    'first-blade-gate',
    'daily-blind-grip',
    'daily-rain-wrap',
    'daily-small-hands',
  ],
  sui: [
    'hayfield-wakeup',
    'old-letter-door',
    'storm-delivery',
    'daily-morning-route',
    'daily-windy-knot',
    'daily-quiet-letter',
  ],
  ordinary: ['r1-bell-path', 'r1-barrier-glade', 'r2-honey-tea', 'r2-altar-echo'],
};

const CGS = ['akane-first-blade', 'sui-return-letter'];

const portraitFiles = Object.entries(PORTRAITS).flatMap(([character, slugs]) =>
  slugs.map((slug) => `public/assets/encounters/portraits/${character}/${slug}.png`),
);
const sceneFiles = Object.entries(SCENES).flatMap(([group, slugs]) =>
  slugs.map((slug) => `public/assets/encounters/scenes/${group}/${slug}.webp`),
);
const cgFiles = CGS.map((slug) => `public/assets/encounters/cg/${slug}.webp`);
const runtimeFiles = [...portraitFiles, ...sceneFiles, ...cgFiles];

const portraitSources = Object.entries(PORTRAITS).flatMap(([character, slugs]) => [
  `art-source/encounters/portraits/${character}/anchor-chroma.png`,
  ...slugs.map((slug) => `art-source/encounters/portraits/${character}/${slug}-chroma.png`),
]);
const sceneSources = Object.entries(SCENES).flatMap(([group, slugs]) =>
  slugs.map((slug) => `art-source/encounters/scenes/${group}/${slug}-source.png`),
);
const cgSources = CGS.map((slug) => `art-source/encounters/cg/${slug}-source.png`);
const promptFiles = [
  'art-source/encounters/PROMPTS-AKANE.md',
  'art-source/encounters/PROMPTS-SUI.md',
  'art-source/encounters/PROMPTS-MAIN-SCENES.md',
  'art-source/encounters/PROMPTS-ORDINARY.md',
];

async function filesUnder(directory) {
  const absolute = resolve(directory);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = join(absolute, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(child)));
    else if (entry.isFile()) {
      files.push(relative(resolve('.'), child).replaceAll('\\', '/'));
    }
  }
  return files;
}

function assertManifest() {
  if (portraitFiles.length !== 28) {
    throw new Error(`奇遇人物差分清单应为 28 张，当前为 ${portraitFiles.length}`);
  }
  if (sceneFiles.length !== 16) {
    throw new Error(`奇遇场景清单应为 16 张，当前为 ${sceneFiles.length}`);
  }
  if (cgFiles.length !== 2) {
    throw new Error(`奇遇高潮 CG 清单应为 2 张，当前为 ${cgFiles.length}`);
  }
  if (new Set(runtimeFiles).size !== 46) {
    throw new Error('奇遇运行时美术清单存在重复路径');
  }
}

async function assertExactRuntimeFiles() {
  const actual = await filesUnder('public/assets/encounters');
  const expected = new Set(runtimeFiles);
  const actualSet = new Set(actual);
  const missing = runtimeFiles.filter((file) => !actualSet.has(file));
  const unexpected = actual.filter((file) => !expected.has(file));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      [
        '奇遇运行时目录必须严格匹配 28 立绘 + 16 场景 + 2 CG。',
        `缺失：${missing.join('、') || '无'}`,
        `多余：${unexpected.join('、') || '无'}`,
      ].join('\n'),
    );
  }
}

async function assertSourcesExist() {
  for (const file of [...portraitSources, ...sceneSources, ...cgSources, ...promptFiles]) {
    const info = await stat(resolve(file));
    if (!info.isFile() || info.size === 0) throw new Error(`${file} 不是有效生产源文件`);
    if (info.size > 6 * 1024 * 1024) {
      throw new Error(`${file} 超过 6MB，请压缩生产源后再提交`);
    }
  }
}

async function validatePortrait(file) {
  const absolute = resolve(file);
  const [{ size }, metadata, raw] = await Promise.all([
    stat(absolute),
    sharp(absolute).metadata(),
    sharp(absolute).raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (size > 550 * 1024) {
    throw new Error(`${file} 为 ${Math.ceil(size / 1024)}KB，超过 550KB`);
  }
  if (
    metadata.format !== 'png' ||
    metadata.width !== 640 ||
    metadata.height !== 960 ||
    metadata.channels !== 4 ||
    metadata.hasAlpha !== true
  ) {
    throw new Error(
      `${file} 必须是 640×960 RGBA PNG；当前为 ${metadata.width ?? '?'}×` +
        `${metadata.height ?? '?'} ${metadata.channels ?? '?'} 通道 ${metadata.format ?? '未知'}`,
    );
  }

  const { data, info } = raw;
  const corners = [
    data[3],
    data[(info.width - 1) * info.channels + 3],
    data[(info.height - 1) * info.width * info.channels + 3],
    data[(info.height * info.width - 1) * info.channels + 3],
  ];
  if (corners.some((alpha) => alpha !== 0)) {
    throw new Error(`${file} 四角必须完全透明，当前为 ${corners.join('/')}`);
  }

  let visible = 0;
  let keyPixels = 0;
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const alpha = data[offset + 3];
    if (alpha <= 8) continue;
    const pixel = offset / info.channels;
    const x = pixel % info.width;
    const y = Math.floor(pixel / info.width);
    visible += 1;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);

    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    if (red >= 215 && blue >= 195 && green <= 85 && Math.abs(red - blue) <= 70) {
      keyPixels += 1;
    }
  }

  const canvas = info.width * info.height;
  if (visible < canvas * 0.06 || visible > canvas * 0.88) {
    throw new Error(`${file} 主体占比异常：${((visible / canvas) * 100).toFixed(1)}%`);
  }
  if (minX <= 1 || minY <= 1 || maxX >= info.width - 2 || maxY >= info.height - 1) {
    throw new Error(`${file} 主体触边：bbox=[${minX},${minY},${maxX},${maxY}]`);
  }
  if (maxY < info.height - 96) {
    throw new Error(`${file} 底部锚点过高：主体最低只到 y=${maxY}`);
  }
  const keyLimit = Math.max(96, Math.floor(visible * 0.003));
  if (keyPixels > keyLimit) {
    throw new Error(`${file} 检出 ${keyPixels} 个残余品红键色像素，阈值 ${keyLimit}`);
  }
}

async function validateStoryImage(file) {
  const absolute = resolve(file);
  const [{ size }, metadata] = await Promise.all([stat(absolute), sharp(absolute).metadata()]);
  if (size > 520 * 1024) {
    throw new Error(`${file} 为 ${Math.ceil(size / 1024)}KB，超过 520KB`);
  }
  if (
    metadata.format !== 'webp' ||
    metadata.width !== 1536 ||
    metadata.height !== 1024 ||
    metadata.hasAlpha === true
  ) {
    throw new Error(
      `${file} 必须是 1536×1024 无透明 WebP；当前为 ${metadata.width ?? '?'}×` +
        `${metadata.height ?? '?'} ${metadata.format ?? '未知'} alpha=${String(metadata.hasAlpha)}`,
    );
  }
}

async function assertUniquePixels() {
  const seen = new Map();
  for (const file of runtimeFiles) {
    const { data, info } = await sharp(resolve(file))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const digest = createHash('sha256')
      .update(`${info.width}x${info.height}x${info.channels}\0`)
      .update(data)
      .digest('hex');
    const duplicate = seen.get(digest);
    if (duplicate) throw new Error(`${file} 与 ${duplicate} 完全重复，不能用复制图冒充新资产`);
    seen.set(digest, file);
  }
}

assertManifest();
await assertExactRuntimeFiles();
await assertSourcesExist();
for (const file of portraitFiles) await validatePortrait(file);
for (const file of [...sceneFiles, ...cgFiles]) await validateStoryImage(file);
await assertUniquePixels();

const runtimeBytes = (
  await Promise.all(runtimeFiles.map(async (file) => (await stat(resolve(file))).size))
).reduce((sum, size) => sum + size, 0);

console.log(
  `奇遇美术审计通过：28 张人物差分 + 16 张 3:2 场景 + 2 张高潮 CG，` +
    `运行时共 ${(runtimeBytes / 1024 / 1024).toFixed(1)}MB。`,
);
