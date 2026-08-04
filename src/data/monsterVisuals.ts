import type { MonsterMotionProfile } from './battleMotions';
import { REGION_34_MONSTER_MOTIONS } from './region34';
import { REGION_5_MONSTER_MOTIONS } from './region5';
import {
  REGION_6_MONSTER_MOTIONS,
  REGION_6_STATUE_MONSTER_IDS,
} from './region6';
import { REGION_7_MONSTER_MOTIONS } from './region7';
import { REGION_8_MONSTER_MOTIONS } from './region8';

export interface MonsterVisual {
  asset: string;
  motion: MonsterMotionProfile;
  /** 石像怪入场静止、首次受击苏醒；仅表现，不改变结算。 */
  statueAwaken?: boolean;
}

function buildRegion34MonsterVisuals(): Record<string, MonsterVisual> {
  return Object.fromEntries(
    Object.entries(REGION_34_MONSTER_MOTIONS).map(([id, motion]) => {
      const regionIndex = id.match(/^mon_([34])-/)?.[1];
      if (!regionIndex) {
        throw new Error(`[怪物配置] 区域 3/4 怪物 ID 格式错误：${id}`);
      }
      return [
        id,
        {
          asset: `assets/monsters/r${regionIndex}/${id}.webp`,
          motion,
        },
      ];
    }),
  );
}

/**
 * 区域 3/4 的待启用视觉注册表。
 *
 * 新区域必须在怪物、掉落、强化曲线和全部素材同时完成后原子接入
 * `MONSTER_VISUALS`，避免其他协作者在生产期间读到半套内容。
 */
export const REGION_34_MONSTER_VISUALS: Readonly<Record<string, MonsterVisual>> =
  buildRegion34MonsterVisuals();

export const REGION_5_MONSTER_VISUALS: Readonly<Record<string, MonsterVisual>> =
  Object.fromEntries(
    Object.entries(REGION_5_MONSTER_MOTIONS).map(([id, motion]) => [
      id,
      {
        asset: `assets/monsters/r5/${id}.webp`,
        motion,
      },
    ]),
  );

const REGION_6_STATUE_MONSTER_ID_SET = new Set<string>(REGION_6_STATUE_MONSTER_IDS);

export const REGION_6_MONSTER_VISUALS: Readonly<Record<string, MonsterVisual>> =
  Object.fromEntries(
    Object.entries(REGION_6_MONSTER_MOTIONS).map(([id, motion]) => [
      id,
      {
        asset: `assets/monsters/r6/${id}.webp`,
        motion,
        ...(REGION_6_STATUE_MONSTER_ID_SET.has(id) ? { statueAwaken: true } : {}),
      },
    ]),
  );

export const REGION_8_MONSTER_VISUALS: Readonly<Record<string, MonsterVisual>> =
  Object.fromEntries(
    Object.entries(REGION_8_MONSTER_MOTIONS).map(([id, motion]) => [
      id,
      { asset: `assets/monsters/r8/${id}.webp`, motion },
    ]),
  );

export const REGION_7_MONSTER_VISUALS: Readonly<Record<string, MonsterVisual>> =
  Object.fromEntries(
    Object.entries(REGION_7_MONSTER_MOTIONS).map(([id, motion]) => [
      id,
      {
        asset: `assets/monsters/r7/${id}.webp`,
        motion,
      },
    ]),
  );

/**
 * 已完成制作和校验的怪物素材注册表。
 * 未进入本表的怪物会直接报配置错误，禁止用文字占位掩盖资源漏接。
 */
export const MONSTER_VISUALS: Readonly<Record<string, MonsterVisual>> = {
  // 区域 3/4 与 regions.ts 同一批接入：素材、掉落、强化曲线全部就绪后才展开，
  // 展开前 REGION_34_MONSTER_VISUALS 只作为待启用注册表存在。
  ...REGION_34_MONSTER_VISUALS,
  ...REGION_5_MONSTER_VISUALS,
  ...REGION_6_MONSTER_VISUALS,
  ...REGION_7_MONSTER_VISUALS,
  ...REGION_8_MONSTER_VISUALS,
  'mon_1-1_0': { asset: 'assets/monsters/r1/mon_1-1_0.webp', motion: 'flutter' },
  'mon_1-1_1': { asset: 'assets/monsters/r1/mon_1-1_1.webp', motion: 'hopper' },
  'mon_1-1_2': { asset: 'assets/monsters/r1/mon_1-1_2.webp', motion: 'flutter' },
  'mon_1-1_3': { asset: 'assets/monsters/r1/mon_1-1_3.webp', motion: 'flutter' },
  'mon_1-2_0': { asset: 'assets/monsters/r1/mon_1-2_0.webp', motion: 'bounce' },
  'mon_1-2_1': { asset: 'assets/monsters/r1/mon_1-2_1.webp', motion: 'hopper' },
  'mon_1-2_2': { asset: 'assets/monsters/r1/mon_1-2_2.webp', motion: 'bounce' },
  'mon_1-2_3': { asset: 'assets/monsters/r1/mon_1-2_3.webp', motion: 'flutter' },
  'mon_1-3_0': { asset: 'assets/monsters/r1/mon_1-3_0.webp', motion: 'sway' },
  'mon_1-3_1': { asset: 'assets/monsters/r1/mon_1-3_1.webp', motion: 'flutter' },
  'mon_1-3_2': { asset: 'assets/monsters/r1/mon_1-3_2.webp', motion: 'sway' },
  'mon_1-3_3': { asset: 'assets/monsters/r1/mon_1-3_3.webp', motion: 'sway' },
  'mon_1-3_elite': { asset: 'assets/monsters/r1/mon_1-3_elite.webp', motion: 'guard' },
  'mon_1-4_0': { asset: 'assets/monsters/r1/mon_1-4_0.webp', motion: 'sway' },
  'mon_1-4_1': { asset: 'assets/monsters/r1/mon_1-4_1.webp', motion: 'hopper' },
  'mon_1-4_2': { asset: 'assets/monsters/r1/mon_1-4_2.webp', motion: 'flutter' },
  'mon_1-4_3': { asset: 'assets/monsters/r1/mon_1-4_3.webp', motion: 'hopper' },
  'mon_1-4_elite': { asset: 'assets/monsters/r1/mon_1-4_elite.webp', motion: 'guard' },
  'mon_1-5_0': { asset: 'assets/monsters/r1/mon_1-5_0.webp', motion: 'guard' },
  'mon_1-5_1': { asset: 'assets/monsters/r1/mon_1-5_1.webp', motion: 'flutter' },
  'mon_1-5_2': { asset: 'assets/monsters/r1/mon_1-5_2.webp', motion: 'flutter' },
  'mon_1-5_3': { asset: 'assets/monsters/r1/mon_1-5_3.webp', motion: 'sway' },
  'mon_1-5_elite': { asset: 'assets/monsters/r1/mon_1-5_elite.webp', motion: 'guard' },
  'mon_1-5_boss': { asset: 'assets/monsters/r1/mon_1-5_boss.webp', motion: 'royal' },
  'mon_2-1_0': { asset: 'assets/monsters/r2/mon_2-1_0.webp', motion: 'bounce' },
  'mon_2-1_1': { asset: 'assets/monsters/r2/mon_2-1_1.webp', motion: 'hopper' },
  'mon_2-1_2': { asset: 'assets/monsters/r2/mon_2-1_2.webp', motion: 'bounce' },
  'mon_2-1_3': { asset: 'assets/monsters/r2/mon_2-1_3.webp', motion: 'flutter' },
  'mon_2-2_0': { asset: 'assets/monsters/r2/mon_2-2_0.webp', motion: 'sway' },
  'mon_2-2_1': { asset: 'assets/monsters/r2/mon_2-2_1.webp', motion: 'flutter' },
  'mon_2-2_2': { asset: 'assets/monsters/r2/mon_2-2_2.webp', motion: 'bounce' },
  'mon_2-2_3': { asset: 'assets/monsters/r2/mon_2-2_3.webp', motion: 'sway' },
  'mon_2-2_elite': { asset: 'assets/monsters/r2/mon_2-2_elite.webp', motion: 'guard' },
  'mon_2-3_0': { asset: 'assets/monsters/r2/mon_2-3_0.webp', motion: 'flutter' },
  'mon_2-3_1': { asset: 'assets/monsters/r2/mon_2-3_1.webp', motion: 'flutter' },
  'mon_2-3_2': { asset: 'assets/monsters/r2/mon_2-3_2.webp', motion: 'guard' },
  'mon_2-3_3': { asset: 'assets/monsters/r2/mon_2-3_3.webp', motion: 'bounce' },
  'mon_2-3_elite': { asset: 'assets/monsters/r2/mon_2-3_elite.webp', motion: 'guard' },
  'mon_2-4_0': { asset: 'assets/monsters/r2/mon_2-4_0.webp', motion: 'hopper' },
  'mon_2-4_1': { asset: 'assets/monsters/r2/mon_2-4_1.webp', motion: 'flutter' },
  'mon_2-4_2': { asset: 'assets/monsters/r2/mon_2-4_2.webp', motion: 'bounce' },
  'mon_2-4_3': { asset: 'assets/monsters/r2/mon_2-4_3.webp', motion: 'sway' },
  'mon_2-4_elite': { asset: 'assets/monsters/r2/mon_2-4_elite.webp', motion: 'guard' },
  'mon_2-5_0': { asset: 'assets/monsters/r2/mon_2-5_0.webp', motion: 'guard' },
  'mon_2-5_1': { asset: 'assets/monsters/r2/mon_2-5_1.webp', motion: 'bounce' },
  'mon_2-5_2': { asset: 'assets/monsters/r2/mon_2-5_2.webp', motion: 'sway' },
  'mon_2-5_3': { asset: 'assets/monsters/r2/mon_2-5_3.webp', motion: 'bounce' },
  'mon_2-5_elite': { asset: 'assets/monsters/r2/mon_2-5_elite.webp', motion: 'royal' },
  'mon_2-5_boss': { asset: 'assets/monsters/r2/mon_2-5_boss.webp', motion: 'royal' },
};

export function requireMonsterVisual(id: string): MonsterVisual {
  const visual = MONSTER_VISUALS[id];
  if (!visual) {
    throw new Error(`[怪物配置] 未登记视觉资源：${id}`);
  }
  return visual;
}
