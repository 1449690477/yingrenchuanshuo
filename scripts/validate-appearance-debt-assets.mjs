#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const ROOT = resolve('.');
const CLASS_IDS = ['swordsman', 'witch', 'shaman', 'catkin', 'kenshi'];
const DUNGEON_TIERS = ['azure', 'violet', 'auric', 'crimson'];

const weapons = [
  ...Array.from({ length: 7 }, (_, index) => `public/assets/characters/modular/kenshi/r${index + 1}-weapon.png`),
  'public/assets/characters/modular/kenshi/r5-crimson-weapon.png',
  'public/assets/characters/modular/kenshi/r6-shadow-weapon.png',
  'public/assets/characters/modular/kenshi/r7-bloodmoon-weapon.png',
  ...DUNGEON_TIERS.map((tier) => `public/assets/characters/modular/dungeon/${tier}/kenshi-weapon.png`),
  ...['berry-cream', 'moon-sugar', 'rose-night'].map(
    (theme) => `public/assets/characters/modular/shop/${theme}/kenshi-weapon.png`,
  ),
  'public/assets/characters/modular/affection/kenshi/thousand-sakura-homecoming-blade.png',
  'public/assets/characters/modular/affection/kenshi/heart-rainbow-frost-sakura-katana.png',
  'public/assets/characters/modular/arena/kenshi/blinkbloom-boundary-katana.png',
];

const bodyIds = [
  ...Array.from({ length: 7 }, (_, index) => `r${index + 1}-body`),
  'r5-set-body', 'r6-set-body', 'r7-set-body',
  ...DUNGEON_TIERS.map((tier) => `dungeon-${tier}-body`),
  'boutique-berry-cream-body', 'boutique-moon-sugar-body', 'boutique-rose-night-body',
  'affection-kenshi-moonblue-lantern-date-kimono',
];
const bodies = bodyIds.map((id) => `public/assets/equipment/bodies/${id}/kenshi.png`);

const arenaSlugs = {
  swordsman: ['triumph-verdict-blade', 'triumph-laurel-crown', 'triumph-battle-mantle'],
  witch: ['starjudge-scale-staff', 'starjudge-observatory-crown', 'starjudge-orbit-robe'],
  shaman: ['oracle-spirit-bell-staff', 'oracle-rite-crown', 'oracle-ritual-vestment'],
  catkin: ['swiftshadow-twin-claws', 'swiftshadow-nighthunt-ears', 'swiftshadow-stalker-suit'],
};
const arena = Object.entries(arenaSlugs).flatMap(([classId, slugs]) =>
  slugs.map((slug) => `public/assets/characters/modular/arena/${classId}/${slug}.png`),
);

const shoes = [
  ...DUNGEON_TIERS.flatMap((tier) =>
    CLASS_IDS.map((classId) => `public/assets/characters/modular/dungeon/${tier}/${classId}-shoes.png`),
  ),
  ...CLASS_IDS.flatMap((classId) =>
    Array.from({ length: 7 }, (_, index) => `public/assets/characters/modular/${classId}/r${index + 1}-shoes.png`),
  ),
];

const sources = [
  ...Array.from({ length: 4 }, (_, index) => `art-source/characters/kenshi/body-icons/body-icons-batch-${index + 1}.png`),
  'art-source/characters/kenshi/body-icons/contact-sheet.png',
  'art-source/qa/arena-wearables-contact-sheet.png',
  'art-source/characters/modular/shoes-contact-sheet.png',
];

async function inspect(path, width, height, kind) {
  if (!existsSync(resolve(ROOT, path))) throw new Error(`[外观补全] 缺少 ${kind}：${path}`);
  const image = await sharp(resolve(ROOT, path)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (image.info.width !== width || image.info.height !== height || image.info.channels !== 4) {
    throw new Error(`[外观补全] ${kind} 尺寸/通道错误：${path}`);
  }
  let alphaPixels = 0;
  let greenPixels = 0;
  let top = height;
  let bottom = -1;
  for (let index = 0; index < image.data.length; index += 4) {
    const alpha = image.data[index + 3];
    if (alpha <= 20) continue;
    alphaPixels += 1;
    const pixel = index / 4;
    const y = Math.floor(pixel / width);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
    const r = image.data[index];
    const g = image.data[index + 1];
    const b = image.data[index + 2];
    if (g > 150 && g - Math.max(r, b) > 55) greenPixels += 1;
  }
  const coverage = alphaPixels / (width * height);
  if (coverage < (kind === '服装图标' ? 0.08 : 0.002)) {
    throw new Error(`[外观补全] ${kind} 可见像素过少：${path} ${(coverage * 100).toFixed(2)}%`);
  }
  if (greenPixels > Math.max(8, alphaPixels * 0.0005)) {
    throw new Error(`[外观补全] ${kind} 有荧光绿残留：${path} ${greenPixels}px`);
  }
  return { coverage, top, bottom };
}

if (weapons.length !== 20 || bodies.length !== 18 || arena.length !== 12 || shoes.length !== 55) {
  throw new Error(`[外观补全] 清单计数错位：${weapons.length}/${bodies.length}/${arena.length}/${shoes.length}`);
}

for (const path of weapons) {
  const result = await inspect(path, 640, 960, '樱酱武器层');
  if (result.top < 300 || result.bottom < 650) {
    throw new Error(`[外观补全] 樱酱武器未落到手提/佩刀区：${path} y=${result.top}..${result.bottom}`);
  }
}
for (const path of bodies) await inspect(path, 256, 256, '服装图标');
for (const path of arena) await inspect(path, 640, 960, '竞技场上身层');
for (const path of shoes) {
  const result = await inspect(path, 640, 960, '鞋层');
  if (result.top < 700 || result.bottom > 950) {
    throw new Error(`[外观补全] 鞋层未贴脚：${path} y=${result.top}..${result.bottom}`);
  }
}
for (const path of sources) {
  if (!existsSync(resolve(ROOT, path))) throw new Error(`[外观补全] 缺少权威源板/验收板：${path}`);
}

const appearanceSource = readFileSync(resolve(ROOT, 'src/data/characterAppearance.ts'), 'utf8');
const iconSource = readFileSync(resolve(ROOT, 'src/components/EquipmentIcon.vue'), 'utf8');
for (const forbidden of ['KENSHI_WEAPON_CARRY', 'kenshiWornIconOverride']) {
  if (appearanceSource.includes(forbidden) || iconSource.includes(forbidden)) {
    throw new Error(`[外观补全] 止血代码仍残留：${forbidden}`);
  }
}

console.log('✓ 外观补全门禁通过：樱酱武器 20 / 正式服装图标 18 / 老职业圣痕 12 / 鞋层 55');
