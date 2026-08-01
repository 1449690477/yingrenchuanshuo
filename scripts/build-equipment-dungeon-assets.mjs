import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import sharp from 'sharp';

const ROOT = resolve('.');
const CHROMA_HELPER =
  'C:\\Users\\Administrator\\.codex\\skills\\.system\\imagegen\\scripts\\remove_chroma_key.py';

const TIERS = ['azure', 'violet', 'auric', 'crimson'];
const CLASSES = ['swordsman', 'witch', 'shaman', 'catkin', 'kenshi'];
const ICON_KEYS = [
  'weapon-swordsman',
  'weapon-witch',
  'weapon-shaman',
  'weapon-catkin',
  'weapon-kenshi',
  'body-swordsman',
  'body-witch',
  'body-shaman',
  'body-catkin',
  'body-kenshi',
  'head-starlace',
  'head-dreamhat',
  'necklace-heart',
  'necklace-moon',
  'bracelet-butterfly',
  'bracelet-rose',
  'ring-star',
  'ring-guard',
  'belt-bow',
  'belt-starlight',
  'shoes-stardust',
  'shoes-ribbon',
];
const SLOTS = ['weapon', 'head', 'body', 'necklace', 'bracelet', 'ring', 'belt', 'shoes'];
const MONSTER_KINDS = ['minion', 'boss'];
const DOLL_SLOTS = ['body', 'head', 'shoes', 'weapon'];
const REFERENCE_THEME = {
  azure: 'berry-cream',
  violet: 'moon-sugar',
  auric: 'rose-night',
  crimson: 'rose-night',
};
const KENSHI_DUNGEON_APPEARANCE = {
  azure: 'r2',
  violet: 'r6-shadow',
  auric: 'r7-bloodmoon',
  crimson: 'r5-crimson',
};

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${args.join(' ')} 退出码 ${code}`));
    });
  });
}

async function removeChroma(source) {
  const tempPath = resolve(
    tmpdir(),
    `sakura-equipment-dungeon-${process.pid}-${basename(source, '.png')}.png`,
  );
  await run('python', [
    CHROMA_HELPER,
    '--input',
    source,
    '--out',
    tempPath,
    '--key-color',
    '#00ff00',
    '--soft-matte',
    '--transparent-threshold',
    '34',
    '--opaque-threshold',
    '112',
    '--edge-contract',
    '1',
    '--edge-feather',
    '0.7',
    '--spill-cleanup',
    '--force',
  ]);
  return tempPath;
}

async function buildTransparentAsset({
  source,
  output,
  width,
  height,
  innerWidth,
  innerHeight,
  format,
  sourceHasAlpha = false,
}) {
  await mkdir(dirname(output), { recursive: true });
  const keyed = sourceHasAlpha ? source : await removeChroma(source);
  try {
    const subject = await sharp(keyed)
      .ensureAlpha()
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize(innerWidth, innerHeight, {
        fit: 'inside',
        withoutEnlargement: false,
      })
      .toBuffer();
    let pipeline = sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    }).composite([{ input: subject, gravity: 'centre' }]);
    pipeline =
      format === 'webp'
        ? pipeline.webp({ quality: 82, alphaQuality: 100, smartSubsample: true })
        : pipeline.png({ compressionLevel: 9, palette: true, quality: 94 });
    await pipeline.toFile(output);
  } finally {
    if (!sourceHasAlpha) await rm(keyed, { force: true });
  }
}

function equipmentIconSource(tier, iconKey) {
  if (iconKey === 'body-kenshi') {
    return {
      source: resolve(`art-source/characters/kenshi/dungeon/${tier}-body-alpha.png`),
      sourceHasAlpha: true,
    };
  }
  if (iconKey === 'weapon-kenshi') {
    const appearance = KENSHI_DUNGEON_APPEARANCE[tier];
    return {
      source: resolve(`art-source/characters/kenshi/regions/${appearance}-weapon-alpha.png`),
      sourceHasAlpha: true,
    };
  }
  return {
    source: resolve(`art-source/equipment/dungeon/${tier}/${iconKey}-chroma.png`),
    sourceHasAlpha: false,
  };
}

async function buildRegisteredKenshiLayer(tier, slot) {
  const family =
    slot === 'body' ? `dungeon/${tier}-body` : `regions/${KENSHI_DUNGEON_APPEARANCE[tier]}-${slot}`;
  const source = resolve(`art-source/characters/kenshi/${family}-alpha.png`);
  const output = resolve(`public/assets/characters/modular/dungeon/${tier}/kenshi-${slot}.png`);
  await mkdir(dirname(output), { recursive: true });
  await sharp(source)
    .resize(640, 960, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, palette: true, quality: 96 })
    .toFile(output);
}

async function alphaBounds(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * info.channels + 3];
      if (alpha <= 16) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) throw new Error(`${file} 没有可见主体`);
  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

async function buildCharacterBody(tier, classId) {
  if (classId === 'kenshi') {
    await buildRegisteredKenshiLayer(tier, 'body');
    return;
  }
  const source = resolve(
    `art-source/characters/modular/dungeon/${tier}/${classId}-body-chroma.png`,
  );
  const output = resolve(`public/assets/characters/modular/dungeon/${tier}/${classId}-body.png`);
  await mkdir(dirname(output), { recursive: true });
  const keyed = await removeChroma(source);
  try {
    const subject = await sharp(keyed)
      .ensureAlpha()
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize(596, 912, { fit: 'inside', withoutEnlargement: false })
      .png()
      .toBuffer();
    await sharp({
      create: {
        width: 640,
        height: 960,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: subject, gravity: 'south' }])
      .png({ compressionLevel: 9, palette: true, quality: 96 })
      .toFile(output);
  } finally {
    await rm(keyed, { force: true });
  }
}

async function buildCharacterAccessory(tier, classId, slot) {
  if (classId === 'kenshi' && (slot === 'head' || slot === 'weapon')) {
    await buildRegisteredKenshiLayer(tier, slot);
    return;
  }
  const iconKey =
    slot === 'weapon' ? `weapon-${classId}` : slot === 'head' ? 'head-starlace' : 'shoes-stardust';
  const icon = resolve(`public/assets/equipment/dungeon/${tier}/${iconKey}.png`);
  const reference = resolve(
    `public/assets/characters/modular/shop/${REFERENCE_THEME[tier]}/${classId}-${slot}.png`,
  );
  const output = resolve(`public/assets/characters/modular/dungeon/${tier}/${classId}-${slot}.png`);
  if (slot === 'shoes') {
    // 整身礼服已经画有同档鞋型；这里仅叠一个小型足下徽光。
    // 直接按旧商店鞋层包围盒放大“鞋图标”会产生悬浮巨鞋，属于不可用素材。
    const emblem = await sharp(icon)
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize(86, 70, { fit: 'inside', withoutEnlargement: false })
      .ensureAlpha()
      .linear([1, 1, 1, 0.68], [0, 0, 0, 0])
      .png()
      .toBuffer();
    const metadata = await sharp(emblem).metadata();
    const left = Math.floor((640 - (metadata.width ?? 86)) / 2);
    const top = 864;
    await mkdir(dirname(output), { recursive: true });
    await sharp({
      create: {
        width: 640,
        height: 960,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: emblem, left, top }])
      .png({ compressionLevel: 9, palette: true, quality: 94 })
      .toFile(output);
    return;
  }
  const bounds = await alphaBounds(reference);
  const subject = await sharp(icon)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(bounds.width, bounds.height, {
      fit: 'inside',
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();
  const metadata = await sharp(subject).metadata();
  const left = bounds.left + Math.floor((bounds.width - (metadata.width ?? bounds.width)) / 2);
  const top = bounds.top + Math.floor((bounds.height - (metadata.height ?? bounds.height)) / 2);
  await mkdir(dirname(output), { recursive: true });
  await sharp({
    create: {
      width: 640,
      height: 960,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: subject, left, top }])
    .png({ compressionLevel: 9, palette: true, quality: 94 })
    .toFile(output);
}

async function runPool(tasks, concurrency = 4) {
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < tasks.length) {
      const taskIndex = nextIndex;
      nextIndex += 1;
      await tasks[taskIndex]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
}

await runPool(
  SLOTS.map((slot) => async () => {
    const source = resolve(`art-source/dungeons/equipment/${slot}-battle.png`);
    const output = resolve(`public/assets/dungeons/equipment/${slot}-battle.webp`);
    await mkdir(dirname(output), { recursive: true });
    await sharp(source)
      .resize(1536, 1024, { fit: 'cover', position: 'centre' })
      .webp({ quality: 88, smartSubsample: true })
      .toFile(output);
  }),
);

await runPool(
  SLOTS.flatMap((slot) =>
    MONSTER_KINDS.map(
      (kind) => () =>
        buildTransparentAsset({
          source: resolve(`art-source/monsters/equipment-dungeon/${slot}-${kind}-chroma.png`),
          output: resolve(`public/assets/monsters/equipment-dungeon/${slot}-${kind}.webp`),
          width: 512,
          height: 512,
          innerWidth: 476,
          innerHeight: 476,
          format: 'webp',
        }),
    ),
  ),
);

await runPool(
  TIERS.flatMap((tier) =>
    ICON_KEYS.map((iconKey) => () => {
      const source = equipmentIconSource(tier, iconKey);
      return buildTransparentAsset({
        ...source,
        output: resolve(`public/assets/equipment/dungeon/${tier}/${iconKey}.png`),
        width: 256,
        height: 256,
        innerWidth: 224,
        innerHeight: 224,
        format: 'png',
      });
    }),
  ),
);

await runPool(
  TIERS.flatMap((tier) => CLASSES.map((classId) => () => buildCharacterBody(tier, classId))),
);

await runPool(
  TIERS.flatMap((tier) =>
    CLASSES.flatMap((classId) =>
      DOLL_SLOTS.filter((slot) => slot !== 'body').map(
        (slot) => () => buildCharacterAccessory(tier, classId, slot),
      ),
    ),
  ),
);

console.log('装备副本资产构建完成：8 张地图、16 个怪物、88 个装备图标、80 个纸娃娃外观。');
