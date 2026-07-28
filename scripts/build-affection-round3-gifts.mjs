import { execFile } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);
const ICON_SIZE = 256;
const SUBJECT_SIZE = 224;
const GIFT_IDS = [
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

const codexRoot = process.env.CODEX_HOME ?? join(homedir(), '.codex');
const chromaHelper = join(
  codexRoot,
  'skills',
  '.system',
  'imagegen',
  'scripts',
  'remove_chroma_key.py',
);
const pythonCommand = process.env.PYTHON ?? 'python';
const sourceRoot = resolve('art-source/affection/gifts/round3');
const runtimeRoot = resolve('public/assets/affection/gifts');
const temporaryRoot = resolve('art-source/affection/gifts/round3/.alpha-tmp');

async function buildGiftIcon(giftId) {
  const source = join(sourceRoot, `${giftId}-chroma.png`);
  const temporary = join(temporaryRoot, `${giftId}-alpha.png`);
  const output = join(runtimeRoot, `${giftId}.png`);
  const metadata = await sharp(source).metadata();

  if (metadata.format !== 'png' || !metadata.width || !metadata.height) {
    throw new Error(`${source} 必须是可解码的 PNG 绿幕母版`);
  }

  await mkdir(dirname(temporary), { recursive: true });
  await mkdir(dirname(output), { recursive: true });
  await execFileAsync(
    pythonCommand,
    [
      chromaHelper,
      '--input',
      source,
      '--out',
      temporary,
      '--auto-key',
      'border',
      '--soft-matte',
      '--transparent-threshold',
      '12',
      '--opaque-threshold',
      '220',
      '--despill',
      '--force',
    ],
    { windowsHide: true },
  );

  await sharp(temporary)
    .ensureAlpha()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(SUBJECT_SIZE, SUBJECT_SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .extend({
      top: (ICON_SIZE - SUBJECT_SIZE) / 2,
      bottom: (ICON_SIZE - SUBJECT_SIZE) / 2,
      left: (ICON_SIZE - SUBJECT_SIZE) / 2,
      right: (ICON_SIZE - SUBJECT_SIZE) / 2,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(output);
}

async function buildContactSheet() {
  const tileSize = 160;
  const columns = 4;
  const rows = 3;
  const gutter = 12;
  const composites = await Promise.all(
    GIFT_IDS.map(async (giftId, index) => ({
      input: await sharp(join(runtimeRoot, `${giftId}.png`))
        .resize(tileSize, tileSize, { fit: 'contain' })
        .flatten({ background: '#6b607c' })
        .png()
        .toBuffer(),
      left: gutter + (index % columns) * (tileSize + gutter),
      top: gutter + Math.floor(index / columns) * (tileSize + gutter),
    })),
  );
  const output = resolve('art-source/qa/affection-round3-gifts-contact-sheet.png');
  await mkdir(dirname(output), { recursive: true });
  await sharp({
    create: {
      width: tileSize * columns + gutter * (columns + 1),
      height: tileSize * rows + gutter * (rows + 1),
      channels: 3,
      background: '#191528',
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(output);
}

for (const giftId of GIFT_IDS) await buildGiftIcon(giftId);
await buildContactSheet();
await rm(temporaryRoot, { recursive: true, force: true });

console.log('第三批礼物图标构建完成：12 张 256×256 RGBA PNG + 1 张联系表。');
