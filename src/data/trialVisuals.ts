/**
 * 周常试炼表现配置。
 *
 * 这里只有资产与文案映射，不含伤害或排名逻辑。9 种「词条倾向 × 元素」
 * 组合都有独立 Boss 立绘，未知组合直接报错，禁止退回符号占位图。
 */
import type { Element } from '@/core/types';

export type TrialBossElement = Exclude<Element, 'none'>;
export type TrialBossMotion = 'weighty' | 'elusive' | 'fierce';

export interface TrialMotionTiming {
  /** Boss 从开始蓄力到真正命中的时间。 */
  windupMs: number;
  /** 命中后回到待机姿态所需的时间。 */
  recoveryMs: number;
}

/**
 * 三类试炼 Boss 的动作重量集中登记。
 *
 * 这些值只控制演出，不参与战斗结算。沉重型需要更长的预备动作，
 * 诡谲型出手更快，狂攻型介于二者之间。
 */
export const TRIAL_MOTION_TIMINGS: Readonly<Record<TrialBossMotion, TrialMotionTiming>> = {
  weighty: { windupMs: 455, recoveryMs: 330 },
  elusive: { windupMs: 285, recoveryMs: 245 },
  fierce: { windupMs: 350, recoveryMs: 270 },
};

export interface TrialVisual {
  sceneAsset: string;
  bossAsset: string;
  arenaName: string;
  signatureMove: string;
  motion: TrialBossMotion;
  bossScale: number;
  accent: string;
  glow: string;
}

const SCENE_ASSET = 'assets/trial/trial-arena.webp';

const ELEMENT_STYLE: Record<TrialBossElement, Pick<TrialVisual, 'accent' | 'glow'>> = {
  fire: { accent: '#ff8b5b', glow: '#ffcf95' },
  ice: { accent: '#69c9f4', glow: '#c9f4ff' },
  thunder: { accent: '#a678ee', glow: '#ead8ff' },
};

const BOSS_VISUALS = {
  shell: {
    fire: {
      bossAsset: 'assets/trial/shell-fire.webp',
      signatureMove: '烬甲震界',
      motion: 'weighty',
      bossScale: 1.04,
    },
    ice: {
      bossAsset: 'assets/trial/shell-ice.webp',
      signatureMove: '霜壳镇压',
      motion: 'weighty',
      bossScale: 1.04,
    },
    thunder: {
      bossAsset: 'assets/trial/shell-thunder.webp',
      signatureMove: '霆鳞山崩',
      motion: 'weighty',
      bossScale: 1.03,
    },
  },
  mirage: {
    fire: {
      bossAsset: 'assets/trial/mirage-fire.webp',
      signatureMove: '流萤焰舞',
      motion: 'elusive',
      bossScale: 0.98,
    },
    ice: {
      bossAsset: 'assets/trial/mirage-ice.webp',
      signatureMove: '冰羽幻身',
      motion: 'elusive',
      bossScale: 1,
    },
    thunder: {
      bossAsset: 'assets/trial/mirage-thunder.webp',
      signatureMove: '雷痕瞬闪',
      motion: 'elusive',
      bossScale: 0.98,
    },
  },
  fury: {
    fire: {
      bossAsset: 'assets/trial/fury-fire.webp',
      signatureMove: '绯焰怒冲',
      motion: 'fierce',
      bossScale: 1.05,
    },
    ice: {
      bossAsset: 'assets/trial/fury-ice.webp',
      signatureMove: '凛牙碎寒',
      motion: 'fierce',
      bossScale: 1.05,
    },
    thunder: {
      bossAsset: 'assets/trial/fury-thunder.webp',
      signatureMove: '奔雷裂空',
      motion: 'fierce',
      bossScale: 1.03,
    },
  },
} as const;

export const TRIAL_PHASES = [
  { at: 0, label: '镜门开启' },
  { at: 15, label: '元素激化' },
  { at: 30, label: 'Boss 狂化' },
  { at: 45, label: '最终冲刺' },
] as const;

export function requireTrialVisual(tiltId: string, element: Element): TrialVisual {
  if (element === 'none') {
    throw new Error('[试炼表现] 周常 Boss 不允许使用无属性');
  }
  if (!Object.hasOwn(BOSS_VISUALS, tiltId)) {
    throw new Error(`[试炼表现] 未登记词条倾向：${tiltId}`);
  }
  const tiltVisuals = BOSS_VISUALS[tiltId as keyof typeof BOSS_VISUALS];
  const boss = tiltVisuals[element];
  if (!boss) {
    throw new Error(`[试炼表现] 未登记 Boss 组合：${tiltId}/${element}`);
  }
  return {
    ...boss,
    sceneAsset: SCENE_ASSET,
    arenaName: '镜界试炼场',
    ...ELEMENT_STYLE[element],
  };
}

export function requireTrialMotionTiming(motion: TrialBossMotion): TrialMotionTiming {
  const timing = TRIAL_MOTION_TIMINGS[motion];
  if (!timing) {
    throw new Error(`[试炼表现] 未登记 Boss 动作节奏：${String(motion)}`);
  }
  return timing;
}
