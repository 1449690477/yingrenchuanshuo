export type IdleEfficiencyLevel = 'smooth' | 'strained' | 'pressured';

export interface IdleEfficiencyPresentation {
  level: IdleEfficiencyLevel;
  percent: number;
  detail: '' | '略吃力' | '建议换图或提升装备';
}

/**
 * 把核心层给出的战斗效率映射为挂机页三档提示。
 *
 * 核心层保证效率位于 0~1；这里拒绝非法值，避免用 UI 钳制掩盖结算错误。
 */
export function idleEfficiencyPresentation(efficiency: number): IdleEfficiencyPresentation {
  if (!Number.isFinite(efficiency) || efficiency < 0 || efficiency > 1) {
    throw new Error(`[挂机界面错误] 战斗效率必须在 0~1 之间：${efficiency}`);
  }

  const percent = Math.floor(efficiency * 100);
  if (percent >= 90) return { level: 'smooth', percent, detail: '' };
  if (percent >= 60) return { level: 'strained', percent, detail: '略吃力' };
  return { level: 'pressured', percent, detail: '建议换图或提升装备' };
}
