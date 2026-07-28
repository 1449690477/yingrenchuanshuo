import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '@/core/types';
import {
  AFFECTION_CHARACTERS,
  AFFECTION_STORIES,
  affectionMemoryDialogue,
  requireAffectionStory,
} from '../affection';

describe('affection content', () => {
  it('四位成年角色各有 6 幕剧情、每幕 3 个等价回答和 6 种互动', () => {
    expect(AFFECTION_STORIES).toHaveLength(24);

    for (const classId of CLASS_IDS) {
      const character = AFFECTION_CHARACTERS[classId];
      expect(character.adult).toBe(true);
      expect(character.stories).toHaveLength(6);
      expect(character.interactions).toHaveLength(6);
      expect(new Set(character.interactions.map((entry) => entry.id)).size).toBe(6);
      expect(new Set(character.interactions.map((entry) => entry.points))).toEqual(new Set([10]));

      character.stories.forEach((story, index) => {
        expect(story.classId).toBe(classId);
        expect(story.episode).toBe(index + 1);
        expect(story.choices).toHaveLength(3);
        expect(new Set(story.choices.map((choice) => choice.id)).size).toBe(3);
        expect(story.openingDialogue.length).toBeGreaterThanOrEqual(2);
        for (const choice of story.choices) {
          expect(choice.responseDialogue.length).toBeGreaterThanOrEqual(2);
        }
      });

      expect(character.stories.map((story) => story.unlockPoints)).toEqual([
        0, 80, 240, 520, 900, 1_400,
      ]);
      expect(character.stories.slice(3).map((story) => story.completionPoints)).toEqual([
        60, 60, 60,
      ]);
    }
  });

  it('第二批十二幕精确绑定已验收的标题、场景与高潮物件素材', () => {
    const expected = [
      ['aff_swordsman_04_backguard', '把背后交给你', 'swordsman-paired-trial-sunset.webp'],
      ['aff_swordsman_05_dayoff', '今夜不必守在最前面', 'swordsman-lantern-dayoff.webp'],
      ['aff_swordsman_06_homecoming', '归来时，座位仍在这里', 'swordsman-homecoming-sunrise.webp'],
      ['aff_witch_04_miscalculation', '不完美也会发光', 'witch-atelier-afterglow.webp'],
      ['aff_witch_05_nightflight', '把暂停咒语交给你', 'witch-star-skiff-night.webp'],
      ['aff_witch_06_constellation', '不会偏航的坐标', 'witch-observatory-dawn.webp'],
      ['aff_shaman_04_quiet', '把沉默也分给你', 'shaman-quiet-tea-afternoon.webp'],
      ['aff_shaman_05_storm', '这次让我也被守护', 'shaman-storm-lantern-path.webp'],
      ['aff_shaman_06_firstsnow', '愿望里已经有你', 'shaman-first-snow-garden.webp'],
      ['aff_catkin_04_expansion', '两把平等的钥匙', 'catkin-base-expansion-day.webp'],
      ['aff_catkin_05_rainwatch', '队长也可以说累', 'catkin-rainy-workshop-night.webp'],
      ['aff_catkin_06_departure', '下一次也并肩出发', 'catkin-sunrise-departure-platform.webp'],
    ] as const;

    const secondBatch = AFFECTION_STORIES.filter((story) => story.episode >= 4);
    expect(
      secondBatch.map((story) => [
        story.id,
        story.title,
        story.backgroundAsset.split('/').at(-1),
      ]),
    ).toEqual(expected);
    expect(
      secondBatch.filter((story) => story.episode === 6).map((story) => story.cgAsset),
    ).toEqual([
      'assets/affection/cg/swordsman-homecoming-knot.webp',
      'assets/affection/cg/witch-shared-constellation.webp',
      'assets/affection/cg/shaman-paired-lantern-charm.webp',
      'assets/affection/cg/catkin-partner-badges.webp',
    ]);
  });

  it('剧情 ID 全局唯一，六幕严格按同角色上一幕线性解锁', () => {
    const ids = AFFECTION_STORIES.map((story) => story.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const classId of CLASS_IDS) {
      const stories = AFFECTION_CHARACTERS[classId].stories;
      for (const [index, story] of stories.entries()) {
        const earlier = new Set(stories.slice(0, index).map((entry) => entry.id));
        expect(story.requiredStoryIds.every((id) => earlier.has(id))).toBe(true);
        expect(story.requiredStoryIds).toEqual(index === 0 ? [] : [stories[index - 1]!.id]);
        expect(requireAffectionStory(classId, story.id)).toBe(story);
      }
    }
  });

  it('第二批按 1+3、2+4、3+4+5 回忆，并覆盖每个来源章节的所有选择', () => {
    for (const classId of CLASS_IDS) {
      const character = AFFECTION_CHARACTERS[classId];
      const byId = new Map(character.stories.map((story) => [story.id, story]));
      for (const story of character.stories) {
        for (const callback of story.memoryCallbacks ?? []) {
          const source = byId.get(callback.fromStoryId);
          expect(source).toBeDefined();
          expect(source?.choices.some((choice) => choice.id === callback.choiceId)).toBe(true);
        }
      }

      const third = character.stories[2]!;
      const source = character.stories[1]!;
      const history = { [source.id]: source.choices[0].id };
      expect(affectionMemoryDialogue(third, history).length).toBeGreaterThan(0);

      const memorySourceEpisodes = [[1, 3], [2, 4], [3, 4, 5]] as const;
      for (const [offset, sourceEpisodes] of memorySourceEpisodes.entries()) {
        const target = character.stories[offset + 3]!;
        const callbacks = target.memoryCallbacks ?? [];
        expect(new Set(callbacks.map((entry) => byId.get(entry.fromStoryId)?.episode))).toEqual(
          new Set(sourceEpisodes),
        );

        for (const sourceEpisode of sourceEpisodes) {
          const memorySource = character.stories[sourceEpisode - 1]!;
          const coveredChoices = callbacks
            .filter((entry) => entry.fromStoryId === memorySource.id)
            .map((entry) => entry.choiceId);
          expect(new Set(coveredChoices)).toEqual(
            new Set(memorySource.choices.map((choice) => choice.id)),
          );
        }

        const completeHistory = Object.fromEntries(
          character.stories
            .slice(0, target.episode - 1)
            .map((sourceStory) => [sourceStory.id, sourceStory.choices[0]!.id]),
        );
        expect(affectionMemoryDialogue(target, completeHistory)).toHaveLength(
          sourceEpisodes.length,
        );
      }
    }
  });

  it('所有选择奖励等额且不包含惩罚字段，喵喵始终采用成年平等搭档表达', () => {
    for (const story of AFFECTION_STORIES) {
      expect(story.completionPoints).toBeGreaterThan(0);
      for (const choice of story.choices) {
        expect(Object.keys(choice).sort()).toEqual(
          ['id', 'label', 'mood', 'responseDialogue'].sort(),
        );
      }
    }

    const catkinText = JSON.stringify(AFFECTION_CHARACTERS.catkin.stories);
    expect(catkinText).not.toMatch(/主人|宠物|饲养|收养/);
    expect(catkinText).toMatch(/搭档/);
  });

  it('所有场景与高潮插画都使用固定运行时路径，不依赖外链', () => {
    const scenePaths = new Set<string>();
    for (const story of AFFECTION_STORIES) {
      expect(story.backgroundAsset).toMatch(/^assets\/affection\/scenes\/[a-z0-9-]+\.webp$/);
      expect(scenePaths.has(story.backgroundAsset)).toBe(false);
      scenePaths.add(story.backgroundAsset);
      if (story.cgAsset) {
        expect(story.cgAsset).toMatch(/^assets\/affection\/cg\/[a-z0-9-]+\.webp$/);
      }
    }
    expect(scenePaths.size).toBe(24);
    expect(AFFECTION_STORIES.filter((story) => story.cgAsset)).toHaveLength(8);
  });

  it('两批二十四张场景与八张高潮插画均真实存在且保持 3:2 横图', async () => {
    const assets = new Set<string>();
    for (const story of AFFECTION_STORIES) {
      assets.add(story.backgroundAsset);
      if (story.cgAsset) assets.add(story.cgAsset);
    }
    expect(assets.size).toBe(32);

    for (const asset of assets) {
      const assetPath = resolve('public', asset);
      expect(existsSync(assetPath), asset).toBe(true);
      const metadata = await sharp(assetPath).metadata();
      expect(metadata.format, asset).toBe('webp');
      expect(metadata.width, asset).toBeGreaterThanOrEqual(960);
      expect(metadata.height, asset).toBeGreaterThanOrEqual(640);
      expect(metadata.width! / metadata.height!, asset).toBeCloseTo(1.5, 3);
    }
  });
});
