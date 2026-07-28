import { describe, expect, it } from 'vitest';
import { requireMonster } from '../monsters';
import { STAGES } from '../stages';

function waveTypes(stageId: string): string[][] {
  const stage = STAGES[stageId];
  if (!stage) throw new Error(`测试关卡不存在：${stageId}`);
  return stage.waves.map((wave) =>
    wave.monsters.map(({ id }) => requireMonster(id).type),
  );
}

describe('章节关卡波次编排', () => {
  it('没有精英或 BOSS 的章节在第 3 / 6 关仍保留三波小怪', () => {
    expect(waveTypes('stage_1-1_3')).toEqual([
      ['normal', 'normal'],
      ['normal', 'normal'],
      ['normal', 'normal'],
    ]);
    expect(waveTypes('stage_1-1_6')).toEqual([
      ['normal', 'normal'],
      ['normal', 'normal'],
      ['normal', 'normal'],
    ]);
  });

  it('精英关只用一波精英替换第三波，不凭空增减普通波', () => {
    expect(waveTypes('stage_1-3_3')).toEqual([
      ['normal', 'normal'],
      ['normal', 'normal'],
      ['elite'],
    ]);
    expect(waveTypes('stage_1-3_6')).toEqual([
      ['normal', 'normal'],
      ['normal', 'normal'],
      ['elite'],
    ]);
  });

  it('章节最终关按两波小怪、精英、BOSS 的顺序收束', () => {
    expect(waveTypes('stage_1-5_6')).toEqual([
      ['normal', 'normal'],
      ['normal', 'normal'],
      ['elite'],
      ['boss'],
    ]);
  });
});
