import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { ENCOUNTERS, encounterIdsForProgress } from '../encounters';
import {
  requireEncounterCharacterVisual,
  requireEncounterPortraitAsset,
} from '../encounterVisuals';
import { ALL_CHAPTERS, requireRegionOfChapter } from '../regions';
import { getItem } from '../items';

describe('奇遇章节开放配置', () => {
  it('区域 2 的三个奇遇按 2-2、2-3、2-5 逐步开放', () => {
    expect(encounterIdsForProgress('r2', new Set(['2-1']))).toEqual([]);
    expect(encounterIdsForProgress('r2', new Set(['2-1', '2-2']))).toEqual(['enc_r2_napper']);
    expect(encounterIdsForProgress('r2', new Set(['2-1', '2-2', '2-3']))).toEqual([
      'enc_r2_napper',
      'enc_r2_honey',
    ]);
    expect(encounterIdsForProgress('r2', new Set(['2-1', '2-2', '2-3', '2-4', '2-5']))).toEqual([
      'enc_r2_napper',
      'enc_r2_honey',
      'enc_r2_altar',
    ]);
  });

  it('两条角色线各有三幕主线与一件日常，前置和记忆回调都指向合法选择', () => {
    for (const characterId of ['char_akane', 'char_sui']) {
      const arcs = Object.values(ENCOUNTERS)
        .filter((encounter) => encounter.storyArc?.characterId === characterId)
        .sort((a, b) => a.storyArc!.episode - b.storyArc!.episode);
      expect(
        arcs.map((encounter) => encounter.storyArc!.episode),
        characterId,
      ).toEqual([1, 2, 3, 4]);
      expect(arcs.slice(0, 3).every((encounter) => !encounter.storyArc!.repeatable)).toBe(true);
      expect(arcs[3]?.storyArc?.repeatable).toBe(true);

      for (const [index, encounter] of arcs.entries()) {
        const arc = encounter.storyArc!;
        expect(new Set(arc.storyChoices.map((choice) => choice.id)).size).toBe(2);
        expect(arc.storyChoices.every((choice) => choice.responseDialogue.length > 0)).toBe(true);
        if (index === 0) expect(arc.requiredEncounterIds).toEqual([]);
        else expect(arc.requiredEncounterIds).toEqual([arcs[index - 1]!.id]);

        for (const callback of arc.memoryCallbacks ?? []) {
          expect(arc.requiredEncounterIds).toContain(callback.fromEncounterId);
          const source = ENCOUNTERS[callback.fromEncounterId];
          expect(source?.storyArc?.characterId).toBe(characterId);
          expect(
            source?.storyArc?.storyChoices.some((choice) => choice.id === callback.choiceId),
          ).toBe(true);
          expect(callback.dialogue.length).toBeGreaterThan(0);
        }
      }
      expect(
        arcs.slice(1, 3).every((encounter) => encounter.storyArc!.memoryCallbacks?.length),
      ).toBe(true);
    }
  });
  it('角色日常有唯一对白变体、四档关系问候和递增援助章节', () => {
    const dailyEncounters = Object.values(ENCOUNTERS).filter(
      (encounter) => encounter.storyArc?.repeatable,
    );
    expect(dailyEncounters).toHaveLength(2);
    for (const encounter of dailyEncounters) {
      const variants = encounter.dailyVariants ?? [];
      expect(variants.length, encounter.id).toBeGreaterThanOrEqual(3);
      expect(new Set(variants.map((variant) => variant.id)).size).toBe(variants.length);
      for (const variant of variants) {
        expect(variant.dialogue.length, `${encounter.id}/${variant.id}`).toBeGreaterThan(0);
        expect(Object.keys(variant.relationshipDialogue).sort()).toEqual([
          '亲近',
          '信赖',
          '初遇',
          '熟悉',
        ]);
      }

      const tiers = encounter.supportTiers ?? [];
      expect(tiers.length, encounter.id).toBeGreaterThanOrEqual(2);
      const chapterIndexes = tiers.map((tier) =>
        ALL_CHAPTERS.findIndex((chapter) => chapter.id === tier.unlockChapterId),
      );
      expect(chapterIndexes.every((index) => index >= 0)).toBe(true);
      expect(chapterIndexes).toEqual([...chapterIndexes].sort((left, right) => left - right));
      expect(new Set(chapterIndexes).size).toBe(chapterIndexes.length);
      expect(tiers.every((tier) => tier.choice.id === encounter.choices[0].id)).toBe(true);
    }
  });

  it('每个日常援助档位只使用当章已有材料且最低奖励价值不低于成本', () => {
    for (const encounter of Object.values(ENCOUNTERS).filter(
      (entry) => entry.supportTiers?.length,
    )) {
      for (const tier of encounter.supportTiers ?? []) {
        const chapter = ALL_CHAPTERS.find((entry) => entry.id === tier.unlockChapterId);
        expect(chapter, `${encounter.id}/${tier.unlockChapterId}`).toBeDefined();
        if (!chapter) continue;
        const region = requireRegionOfChapter(chapter.id);
        expect(encounter.regionIds).toContain(region.id);
        const chapterIndex = region.chapters.findIndex((entry) => entry.id === chapter.id);
        const availableMaterials = new Set(
          region.chapters.slice(0, chapterIndex + 1).flatMap((entry) => entry.materials),
        );
        for (const itemId of Object.keys(tier.choice.costs?.items ?? {})) {
          expect(
            availableMaterials.has(itemId),
            `${encounter.id}/${tier.unlockChapterId} 提前使用 ${itemId}`,
          ).toBe(true);
        }
        const costValue = Object.entries(tier.choice.costs?.items ?? {}).reduce(
          (sum, [id, count]) => sum + getItem(id)!.sellPrice * count,
          tier.choice.costs?.gold ?? 0,
        );
        for (const variant of tier.choice.rewardPool ?? []) {
          const rewardValue = Object.entries(variant.rewards.items ?? {}).reduce(
            (sum, [id, range]) => sum + getItem(id)!.sellPrice * range.min,
            variant.rewards.gold?.min ?? 0,
          );
          expect(rewardValue, `${encounter.id}/${tier.unlockChapterId}`).toBeGreaterThanOrEqual(
            costValue,
          );
        }
      }
    }
  });

  it('待处理角色会排除同角色其他事件，普通事件仍只按自身 ID 去重', () => {
    const chapters = new Set(ALL_CHAPTERS.map((chapter) => chapter.id));
    const characters = {
      char_akane: {
        bond: 3,
        completedEncounterIds: [
          'enc_r1_petalsmith',
          'enc_r1_petalsmith_doubt',
          'enc_r1_petalsmith_first_blade',
        ],
        choiceHistory: {},
      },
    };
    expect(
      encounterIdsForProgress(
        'r2',
        chapters,
        characters,
        new Set(['enc_r1_petalsmith_first_blade']),
      ),
    ).not.toContain('enc_r1_petalsmith_daily');
    const ordinary = encounterIdsForProgress('r1', chapters, {}, new Set(['enc_r1_bell']));
    expect(ordinary).not.toContain('enc_r1_bell');
    expect(ordinary).toContain('enc_r1_barrier');
  });
  it('每项奇遇材料在开放章节或更早章节已有本地区来源', () => {
    for (const encounter of Object.values(ENCOUNTERS)) {
      const unlockChapter = ALL_CHAPTERS.find(
        (chapter) => chapter.id === encounter.unlockChapterId,
      );
      expect(unlockChapter, `${encounter.id} 开放章节不存在`).toBeDefined();
      if (!unlockChapter) continue;

      const region = requireRegionOfChapter(unlockChapter.id);
      expect(encounter.regionIds, `${encounter.id} 开放章节不在配置地区`).toContain(region.id);
      const unlockIndex = region.chapters.findIndex((chapter) => chapter.id === unlockChapter.id);
      const availableMaterials = new Set(
        region.chapters.slice(0, unlockIndex + 1).flatMap((chapter) => chapter.materials),
      );

      for (const choice of encounter.choices) {
        for (const itemId of Object.keys(choice.costs?.items ?? {})) {
          expect(
            availableMaterials.has(itemId),
            `${encounter.id}/${choice.id} 的 ${itemId} 在 ${unlockChapter.id} 尚无来源`,
          ).toBe(true);
        }
      }
    }
  });
});

describe('奇遇专属场景', () => {
  it('每个奇遇都配正式横景，角色线还有严格可解析的开场立绘', () => {
    for (const encounter of Object.values(ENCOUNTERS)) {
      expect(encounter.sceneAsset, `${encounter.id} 缺少 sceneAsset`).toBeTruthy();
      expect(encounter.sceneAsset, encounter.id).toMatch(/^assets\/encounters\/scenes\//);
      if (encounter.storyArc) {
        expect(encounter.initialPortrait, encounter.id).not.toBeNull();
        expect(encounter.initialPortrait?.characterId).toBe(encounter.storyArc.characterId);
        expect(
          requireEncounterPortraitAsset(encounter.initialPortrait!),
          encounter.id,
        ).toBeTruthy();
      } else {
        expect(encounter.initialPortrait, encounter.id).toBeNull();
      }
    }
  });

  it('场景图两两不同 —— 共用一张就等于没有专属场景', () => {
    const assets = Object.values(ENCOUNTERS).map((encounter) => encounter.sceneAsset);
    expect(new Set(assets).size).toBe(assets.length);
  });

  it('主线、普通奇遇与六个日常变体一共引用 16 张真实场景', () => {
    const assets = Object.values(ENCOUNTERS).flatMap((encounter) => [
      encounter.sceneAsset,
      ...(encounter.dailyVariants ?? []).map((variant) => variant.sceneAsset),
    ]);
    expect(new Set(assets).size).toBe(16);
    expect(assets.every((asset) => asset.startsWith('assets/encounters/scenes/'))).toBe(true);
  });

  it('引用的图确实存在且是严格 3:2 横版 WebP', async () => {
    const assets = new Set(
      Object.values(ENCOUNTERS).flatMap((encounter) => [
        encounter.sceneAsset,
        ...(encounter.dailyVariants ?? []).map((variant) => variant.sceneAsset),
      ]),
    );
    for (const asset of assets) {
      const path = resolve(process.cwd(), 'public', asset);
      expect(existsSync(path), `场景图不存在：${asset}`).toBe(true);
      const metadata = await sharp(path).metadata();
      expect(metadata.format, asset).toBe('webp');
      expect((metadata.width ?? 0) * 2, asset).toBe((metadata.height ?? 0) * 3);
      expect(metadata.width, asset).toBe(1536);
      expect(metadata.height, asset).toBe(1024);
    }
  });

  it('角色对白的每个立绘 cue 都属于说话角色，日常三景稳定且互不重复', () => {
    expect(requireEncounterCharacterVisual('char_akane')).toMatchObject({
      displayName: '刀匠·茜',
      speakerAliases: ['见习刀匠·茜', '刀匠·茜'],
    });
    expect(requireEncounterCharacterVisual('char_sui')).toMatchObject({
      displayName: '草原信使·穗',
      speakerAliases: ['草原信使·穗'],
    });

    for (const encounter of Object.values(ENCOUNTERS).filter((entry) => entry.storyArc)) {
      const characterId = encounter.storyArc!.characterId;
      const visual = requireEncounterCharacterVisual(characterId);
      expect(
        visual.speakerAliases,
        `${encounter.id}/顶层 speaker ${encounter.speaker ?? '未配置'}`,
      ).toContain(encounter.speaker);
      expect(
        visual.speakerAliases,
        `${encounter.id}/篇章称谓 ${encounter.storyArc!.characterName}`,
      ).toContain(encounter.storyArc!.characterName);
      expect(visual.speakerAliases, `${characterId}/展示名 ${visual.displayName}`).toContain(
        visual.displayName,
      );
      const lines = [
        ...(encounter.dialogue ?? []),
        ...encounter.storyArc!.storyChoices.flatMap((choice) => choice.responseDialogue),
        ...(encounter.storyArc!.memoryCallbacks ?? []).flatMap((callback) => callback.dialogue),
        ...(encounter.dailyVariants ?? []).flatMap((variant) => [
          ...variant.dialogue,
          ...Object.values(variant.relationshipDialogue).flatMap((dialogue) => dialogue ?? []),
        ]),
      ];
      for (const line of lines) {
        if (line.portraitCue) {
          expect(line.portraitCue.characterId, `${encounter.id}/${line.text}`).toBe(characterId);
          expect(requireEncounterPortraitAsset(line.portraitCue)).toBeTruthy();
        }
        if (line.speaker) {
          expect(visual.speakerAliases, `${encounter.id}/${line.speaker}`).toContain(line.speaker);
        }
      }

      const variants = encounter.dailyVariants ?? [];
      if (variants.length > 0) {
        const scenes = variants.map((variant) => variant.sceneAsset);
        expect(new Set(scenes).size, encounter.id).toBe(variants.length);
        expect(
          variants.every(
            (variant) =>
              variant.initialPortrait?.characterId === characterId &&
              Boolean(requireEncounterPortraitAsset(variant.initialPortrait)),
          ),
          encounter.id,
        ).toBe(true);
      }
    }
  });

  it('两条第三幕高潮 CG 都是正式运行时资源', () => {
    const climaxAssets = Object.values(ENCOUNTERS).flatMap((encounter) =>
      encounter.climaxAsset ? [encounter.climaxAsset] : [],
    );
    expect(climaxAssets).toHaveLength(2);
    expect(new Set(climaxAssets).size).toBe(2);
    for (const encounter of Object.values(ENCOUNTERS).filter((entry) => entry.climaxAsset)) {
      const asset = encounter.climaxAsset!;
      expect(asset).toMatch(/^assets\/encounters\/cg\//);
      expect(existsSync(resolve(process.cwd(), 'public', asset)), asset).toBe(true);
      expect(encounter.climaxAlt, `${encounter.id} 缺少高潮 CG 读屏描述`).toMatch(
        /[\u4e00-\u9fff]/,
      );
    }
  });
});
