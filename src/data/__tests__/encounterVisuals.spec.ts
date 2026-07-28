import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENCOUNTERS } from '../encounters';
import {
  ENCOUNTER_CHARACTER_VISUALS,
  encounterPortraitAssets,
  journalPortraitCue,
  requireEncounterCharacterVisual,
  requireEncounterPortraitAsset,
} from '../encounterVisuals';

describe('奇遇角色视觉注册表', () => {
  it('茜与穗各有 14 张唯一差分，手札立绘也来自同一清单', () => {
    expect(Object.keys(ENCOUNTER_CHARACTER_VISUALS).sort()).toEqual(['char_akane', 'char_sui']);
    for (const visual of Object.values(ENCOUNTER_CHARACTER_VISUALS)) {
      expect(Object.keys(visual.portraits), visual.characterId).toHaveLength(14);
      expect(visual.portraits[visual.journalPortraitId], visual.characterId).toBeTruthy();
    }
    const assets = encounterPortraitAssets();
    expect(assets).toHaveLength(28);
    expect(new Set(assets).size).toBe(assets.length);
  });

  it('严格解析人物与差分，不用默认图掩盖拼错的配置键', () => {
    expect(requireEncounterCharacterVisual('char_akane').displayName).toBe('刀匠·茜');
    expect(requireEncounterPortraitAsset(journalPortraitCue('char_sui'))).toContain(
      '/sui/morning-route-trust.png',
    );
    expect(() => requireEncounterCharacterVisual('char_missing')).toThrow('视觉不存在');
    expect(() =>
      requireEncounterPortraitAsset({ characterId: 'char_akane', portraitId: 'missing' }),
    ).toThrow('立绘不存在');
  });

  it('注册的运行时立绘全部真实存在', () => {
    for (const asset of encounterPortraitAssets()) {
      expect(existsSync(resolve(process.cwd(), 'public', asset)), asset).toBe(true);
    }
  });

  it('28 张差分都被真实剧情节点引用，没有只入库不演出的孤儿图', () => {
    const referenced = new Set<string>();
    for (const encounter of Object.values(ENCOUNTERS)) {
      const lines = [
        ...(encounter.dialogue ?? []),
        ...(encounter.storyArc?.storyChoices ?? []).flatMap((choice) => choice.responseDialogue),
        ...(encounter.storyArc?.memoryCallbacks ?? []).flatMap((callback) => callback.dialogue),
        ...(encounter.dailyVariants ?? []).flatMap((variant) => [
          ...variant.dialogue,
          ...Object.values(variant.relationshipDialogue).flatMap((dialogue) => dialogue ?? []),
        ]),
      ];
      if (encounter.initialPortrait) {
        referenced.add(requireEncounterPortraitAsset(encounter.initialPortrait));
      }
      for (const variant of encounter.dailyVariants ?? []) {
        if (variant.initialPortrait) {
          referenced.add(requireEncounterPortraitAsset(variant.initialPortrait));
        }
      }
      for (const line of lines) {
        if (line.portraitCue) referenced.add(requireEncounterPortraitAsset(line.portraitCue));
      }
    }
    expect([...referenced].sort()).toEqual([...encounterPortraitAssets()].sort());
  });
});
