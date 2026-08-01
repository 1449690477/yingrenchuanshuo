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
  kenshi: [
    'snow-sakura-cat-ear-ribbon',
    'blue-bell-swordheart-necklace',
    'side-by-side-sheath-bracelet',
    'homeward-sakura-ring',
    'iai-tassel-belt',
    'snowstep-sakura-sandals',
    'white-feather-guardian-kimono',
    'heart-rainbow-frost-sakura-katana',
    'moonblue-lantern-date-kimono',
    'thousand-sakura-homecoming-blade',
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
  'gift_kenshi_moonwhite_whetstone_case',
  'gift_kenshi_twin_sakura_tassel_case',
  'gift_kenshi_sakura_blade_care_paper',
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
  'swordsman-morning-market',
  'swordsman-lakeside-bento',
  'swordsman-lantern-bridge',
  'witch-starcandy-atelier',
  'witch-planetarium-repair',
  'witch-meteor-terrace',
  'shaman-shrine-market',
  'shaman-firefly-ferry',
  'shaman-rainy-teahouse',
  'catkin-supply-market',
  'catkin-workshop-coffee',
  'catkin-rooftop-platform',
  'kenshi-dojo-sakura-dawn',
  'kenshi-rain-eaves-blue',
  'kenshi-moonlit-scabbard',
  'kenshi-workbench-afterglow',
  'kenshi-dojo-nightwatch',
  'kenshi-dojo-homecoming-sunrise',
  'kenshi-gift-whetstone-morning',
  'kenshi-sakura-market-rain',
  'kenshi-route-map-sunset',
  'kenshi-tassel-market-morning',
  'kenshi-riverside-tea-afternoon',
  'kenshi-dojo-lantern-night',
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
  'swordsman-paired-tassels',
  'witch-meteor-journal',
  'shaman-paired-teacups',
  'catkin-two-tickets',
  'kenshi-bluebell-scabbard',
  'kenshi-paired-dojo-lanterns',
  'kenshi-shared-patrol-map',
  'kenshi-dojo-keyplate',
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
    [equipmentIconFiles.length, 50, '心虹装备图标'],
    [giftIconFiles.length, 15, '角色礼物图标'],
    [sceneFiles.length, 60, '好感剧情场景'],
    [cgFiles.length, 20, '好感高潮 CG'],
  ];
  for (const [actual, expected, label] of expectedCounts) {
    if (actual !== expected) {
      throw new Error(`${label}清单应为 ${expected} 项，当前为 ${actual}`);
    }
  }
  if (new Set(allFiles).size !== 145) {
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
        '好感度运行时美术目录必须严格匹配 50 装备图标 + 15 礼物图标 + 60 场景 + 20 CG。',
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

/**
 * 像素级查重：任何两张剧情图都不许「同图复用」。
 * 缩成 16×16 灰度指纹后逐对比较，平均像素差 ≤ 2 即视为同图。
 */
async function assertStoryImagesDistinct(files) {
  const fingerprints = await Promise.all(
    files.map(async (file) => ({
      file,
      data: await sharp(resolve(file))
        .resize(16, 16, { fit: 'fill' })
        .grayscale()
        .raw()
        .toBuffer(),
    })),
  );
  for (let a = 0; a < fingerprints.length; a += 1) {
    for (let b = a + 1; b < fingerprints.length; b += 1) {
      const left = fingerprints[a];
      const right = fingerprints[b];
      let total = 0;
      for (let i = 0; i < left.data.length; i += 1) {
        total += Math.abs(left.data[i] - right.data[i]);
      }
      const meanDiff = total / left.data.length;
      if (meanDiff <= 2) {
        throw new Error(
          `疑似同图复用：${left.file} 与 ${right.file} 平均像素差仅 ${meanDiff.toFixed(2)}`,
        );
      }
    }
  }
}

assertManifest();
await assertExactRuntimeFiles();
for (const file of [...equipmentIconFiles, ...giftIconFiles]) await validateIcon(file);
for (const file of [...sceneFiles, ...cgFiles]) await validateStoryImage(file);
await assertStoryImagesDistinct([...sceneFiles, ...cgFiles]);

console.log(
  '好感度美术审计通过：50 张装备 RGBA 图标 + 15 张礼物 RGBA 图标 + 60 张 3:2 场景 + 20 张 3:2 CG（像素查重无异）。',
);
