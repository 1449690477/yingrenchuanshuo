/**
 * 区域 5 全资产总门禁。
 *
 * 四条生产管线仍各自负责尺寸、透明度、去绿边、SHA、提示词与联系表；
 * 这里负责证明它们最终拼成同一份 78 项运行时原子清单，防止单批全绿但整区缺件。
 */

import { spawnSync } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REGION5_BATTLEFIELDS,
  REGION5_COUNTS,
  REGION5_EQUIPMENT,
  REGION5_ITEMS,
  REGION5_MAPS,
  REGION5_MODULAR_LAYERS,
  REGION5_MONSTERS,
  REGION5_SET_EQUIPMENT,
  REGION5_SET_MODULAR_LAYERS,
} from './region5-assets-manifest.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const CHECK_SOURCES = process.argv.includes('--with-sources');
const validatorArgs = CHECK_SOURCES ? ['--with-sources'] : [];
const validators = [
  'validate-region5-scene-assets.mjs',
  'validate-region5-monsters.mjs',
  'validate-region5-items-equipment.mjs',
  'validate-region5-modular-assets.mjs',
];

for (const validator of validators) {
  const result = spawnSync(process.execPath, [resolve(SCRIPT_DIR, validator), ...validatorArgs], {
    cwd: ROOT,
    env: process.env,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    console.error(`区域 5 总门禁中止：${validator} 未通过。`);
    process.exit(result.status ?? 1);
  }
}

const runtimePaths = [
  ...REGION5_MAPS.map(({ id }) => `public/assets/maps/${id}.webp`),
  ...REGION5_BATTLEFIELDS.map(({ id }) => `public/assets/battlefields/${id}.webp`),
  ...REGION5_MONSTERS.map(({ id }) => `public/assets/monsters/r5/${id}.webp`),
  ...REGION5_ITEMS.map(({ id }) => `public/assets/items/${id}.png`),
  ...REGION5_EQUIPMENT.map(({ slot }) => `public/assets/equipment/r5/${slot}.png`),
  ...REGION5_SET_EQUIPMENT.map(({ slot }) => `public/assets/equipment/sets/r5-crimson/${slot}.png`),
  ...REGION5_MODULAR_LAYERS.map(
    ({ classId, slot }) => `public/assets/characters/modular/${classId}/r5-${slot}.png`,
  ),
  ...REGION5_SET_MODULAR_LAYERS.map(
    ({ classId, slot }) => `public/assets/characters/modular/${classId}/r5-crimson-${slot}.png`,
  ),
];

if (runtimePaths.length !== REGION5_COUNTS.runtimeTotal) {
  throw new Error(
    `[配置错误] R5 运行资产总数错位：${runtimePaths.length} !== ${REGION5_COUNTS.runtimeTotal}`,
  );
}
if (new Set(runtimePaths).size !== runtimePaths.length) {
  throw new Error('[配置错误] R5 运行资产路径重复');
}

for (const relativePath of runtimePaths) {
  const file = await stat(resolve(ROOT, relativePath));
  if (!file.isFile() || file.size <= 0) {
    throw new Error(`[资产错误] R5 运行资产不是有效文件：${relativePath}`);
  }
}

console.log(
  `区域 5 全资产门禁通过：4 条独立管线，${runtimePaths.length} / ${REGION5_COUNTS.runtimeTotal} 项运行资产${CHECK_SOURCES ? '，外置源 SHA 同步通过' : ''}。`,
);
