import { readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import sharp from 'sharp';

const EQUIPMENT = {
  swordsman: [
    'morning-oath-sakura-crown',
    'guardian-heart-petal-necklace',
    'side-by-side-ribbon-bracelet',
    'everlasting-vow-ring',
    'wish-rose-belt',
    'lightstep-dance-shoes',
    'sakura-oath-knight-dress',
    'heart-rainbow-vow-rapier',
    'sunset-date-gala-dress',
    'morning-sakura-guardian-blade',
  ],
  witch: [
    'confession-starveil-witch-hat',
    'heartbeat-starcore-necklace',
    'starbound-lace-bracelet',
    'moonlit-wish-ring',
    'startrail-butterfly-waistbelt',
    'shooting-star-candy-dance-shoes',
    'star-sugar-witch-lolita-dress',
    'heart-rainbow-star-key-staff',
    'galaxy-date-evening-dress',
    'fluttering-moon-sugar-wand',
  ],
  shaman: [
    'wish-guardian-butterfly-crown',
    'kindred-omamori-necklace',
    'homebound-butterfly-bracelet',
    'together-prayer-ring',
    'dream-tassel-belt',
    'moonstep-embroidered-shoes',
    'spirit-butterfly-prayer-ceremonial-dress',
    'heart-rainbow-prayer-bell',
    'moon-lantern-date-dress',
    'together-moon-lantern-fan',
  ],
  catkin: [
    'heartbeat-cat-ear-bow',
    'heart-sound-bell-necklace',
    'paw-gummy-bracelet',
    'partner-wish-ring',
    'honey-bow-belt',
    'cloud-paw-dance-shoes',
    'honey-cat-lolita-dress',
    'heart-rainbow-honey-claws',
    'moonlit-cat-dance-dress',
    'flutter-bell-star-claws',
  ],
};

const GIFTS = [
  'gift_swordsman_sakura_roast_tea',
  'gift_swordsman_guard_care_case',
  'gift_swordsman_morning_training_cloth',
  'gift_witch_deviant_star_ink',
  'gift_witch_blank_starmap_notebook',
  'gift_witch_meteor_candy_jar',
  'gift_shaman_blank_wish_album',
  'gift_shaman_moonwhite_rest_tea',
  'gift_shaman_clear_lantern_cover',
  'gift_catkin_modular_field_case',
  'gift_catkin_dual_repair_lamp',
  'gift_catkin_victory_candy_pack',
];

const SCENES = [
  'swordsman-training-dawn',
  'swordsman-rain-gate',
  'swordsman-victory-night',
  'swordsman-paired-trial-sunset',
  'swordsman-lantern-dayoff',
  'swordsman-homecoming-sunrise',
  'swordsman-gift-tea-dawn',
  'swordsman-rain-market-tasting',
  'swordsman-reciprocal-gift-sunset',
  'witch-atelier-spark',
  'witch-observatory-night',
  'witch-secret-festival',
  'witch-atelier-afterglow',
  'witch-star-skiff-night',
  'witch-observatory-dawn',
  'witch-gift-safety-atelier',
  'witch-secret-library-night',
  'witch-reciprocal-star-dawn',
  'shaman-shrine-morning',
  'shaman-firefly-lake',
  'shaman-bell-corridor-rain',
  'shaman-quiet-tea-afternoon',
  'shaman-storm-lantern-path',
  'shaman-first-snow-garden',
  'shaman-blank-gift-paper-morning',
  'shaman-moontea-rest-evening',
  'shaman-return-charm-night',
  'catkin-box-base',
  'catkin-workbench-evening',
  'catkin-rooftop-moon',
  'catkin-base-expansion-day',
  'catkin-rainy-workshop-night',
  'catkin-sunrise-departure-platform',
  'catkin-gift-inspection-workshop',
  'catkin-sentimental-shelf-rain',
  'catkin-shared-expedition-locker-sunrise',
];

const CGS = [
  'swordsman-ribbon-promise',
  'witch-coordinate-crystal',
  'shaman-split-wish',
  'catkin-paw-highfive',
  'swordsman-homecoming-knot',
  'witch-shared-constellation',
  'shaman-paired-lantern-charm',
  'catkin-partner-badges',
  'swordsman-two-way-gift-ribbons',
  'witch-reciprocal-star-ink',
  'shaman-open-knot-keepsakes',
  'catkin-two-way-supply-tags',
];

const equipmentIconFiles = Object.entries(EQUIPMENT).flatMap(([classId, slugs]) =>
  slugs.map((slug) => `public/assets/equipment/affection/${classId}/${slug}.png`),
);
const giftIconFiles = GIFTS.map((id) => `public/assets/affection/gifts/${id}.png`);
const sceneFiles = SCENES.map((slug) => `public/assets/affection/scenes/${slug}.webp`);
const cgFiles = CGS.map((slug) => `public/assets/affection/cg/${slug}.webp`);

function assertManifest() {
  const allFiles = [
    ...equipmentIconFiles,
    ...giftIconFiles,
    ...sceneFiles,
    ...cgFiles,
  ];
  const expectedCounts = [
    [equipmentIconFiles.length, 40, '心虹装备图标'],
    [giftIconFiles.length, 12, '角色礼物图标'],
    [sceneFiles.length, 36, '好感剧情场景'],
    [cgFiles.length, 12, '好感高潮 CG'],
  ];
  for (const [actual, expected, label] of expectedCounts) {
    if (actual !== expected) {
      throw new Error(`${label}清单应为 ${expected} 项，当前为 ${actual}`);
    }
  }
  if (new Set(allFiles).size !== 100) {
    throw new Error('好感度美术清单存在重复运行时路径');
  }
}

async function filesUnder(directory) {
  const absolute = resolve(directory);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = join(absolute, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await filesUnder(child)));
    } else if (entry.isFile()) {
      files.push(relative(resolve('.'), child).replaceAll('\\', '/'));
    }
  }
  return files;
}

async function assertExactRuntimeFiles() {
  const roots = [
    'public/assets/equipment/affection',
    'public/assets/affection/gifts',
    'public/assets/affection/scenes',
    'public/assets/affection/cg',
  ];
  const expected = new Set([
    ...equipmentIconFiles,
    ...giftIconFiles,
    ...sceneFiles,
    ...cgFiles,
  ]);
  const actual = (await Promise.all(roots.map(filesUnder))).flat();
  const actualSet = new Set(actual);
  const missing = [...expected].filter((file) => !actualSet.has(file));
  const unexpected = actual.filter((file) => !expected.has(file));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      [
        '好感度运行时美术目录必须严格匹配 40 装备图标 + 12 礼物图标 + 36 场景 + 12 CG。',
        `缺失：${missing.join('、') || '无'}`,
        `多余：${unexpected.join('、') || '无'}`,
      ].join('\n'),
    );
  }
}

async function validateIcon(file) {
  const absolute = resolve(file);
  const [metadata, raw] = await Promise.all([
    sharp(absolute).metadata(),
    sharp(absolute).raw().toBuffer({ resolveWithObject: true }),
  ]);

  if (
    metadata.format !== 'png' ||
    metadata.width !== 256 ||
    metadata.height !== 256 ||
    metadata.channels !== 4 ||
    metadata.hasAlpha !== true
  ) {
    throw new Error(
      `${file} 必须是 256×256 RGBA PNG；当前为 ` +
        `${metadata.width ?? '?'}×${metadata.height ?? '?'} ` +
        `${metadata.channels ?? '?'} 通道 ${metadata.format ?? '未知格式'}`,
    );
  }

  const { data, info } = raw;
  const cornerAlpha = [
    data[3],
    data[(info.width - 1) * info.channels + 3],
    data[(info.height - 1) * info.width * info.channels + 3],
    data[(info.height * info.width - 1) * info.channels + 3],
  ];
  if (cornerAlpha.some((alpha) => alpha !== 0)) {
    throw new Error(`${file} 四角必须完全透明，当前 alpha 为 ${cornerAlpha.join('/')}`);
  }

  let visiblePixels = 0;
  let greenPixels = 0;
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let offset = 0; offset < data.length; offset += info.channels) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const alpha = data[offset + 3];
    if (alpha <= 8) continue;

    const pixel = offset / info.channels;
    const x = pixel % info.width;
    const y = Math.floor(pixel / info.width);
    visiblePixels += 1;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);

    if (green >= 120 && green - red >= 55 && green - blue >= 55) {
      greenPixels += 1;
    }
  }

  if (visiblePixels < 256 * 256 * 0.01) {
    throw new Error(`${file} 可见主体不足，只剩 ${visiblePixels} 个有效像素`);
  }
  if (visiblePixels > 256 * 256 * 0.9) {
    throw new Error(`${file} 主体异常占满画布，疑似没有正确抠图`);
  }
  if (minX <= 0 || minY <= 0 || maxX >= info.width - 1 || maxY >= info.height - 1) {
    throw new Error(
      `${file} 主体必须在四边保留透明边距；当前 bbox=[${minX},${minY},${maxX},${maxY}]`,
    );
  }

  const greenLimit = Math.max(64, Math.floor(visiblePixels * 0.003));
  if (greenPixels > greenLimit) {
    throw new Error(
      `${file} 检出 ${greenPixels} 个明显残绿像素，超过阈值 ${greenLimit}`,
    );
  }
}

async function validateStoryImage(file) {
  const metadata = await sharp(resolve(file)).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (
    metadata.format !== 'webp' ||
    width < 960 ||
    height < 640 ||
    width * 2 !== height * 3
  ) {
    throw new Error(
      `${file} 必须是严格 3:2 且至少 960×640 的 WebP；当前为 ` +
        `${width || '?'}×${height || '?'} ${metadata.format ?? '未知格式'}`,
    );
  }
}

assertManifest();
await assertExactRuntimeFiles();
for (const file of [...equipmentIconFiles, ...giftIconFiles]) await validateIcon(file);
for (const file of [...sceneFiles, ...cgFiles]) await validateStoryImage(file);

console.log(
  '好感度美术审计通过：40 张装备 RGBA 图标 + 12 张礼物 RGBA 图标 + 36 张 3:2 场景 + 12 张 3:2 CG。',
);
