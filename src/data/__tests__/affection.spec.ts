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
  it('四位成年角色各有 3 幕剧情、每幕 3 个等价回答和 6 种互动', () => {
    expect(AFFECTION_STORIES).toHaveLength(12);

    for (const classId of CLASS_IDS) {
      const character = AFFECTION_CHARACTERS[classId];
      expect(character.adult).toBe(true);
      expect(character.stories).toHaveLength(3);
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
    }
  });

  it('剧情 ID 全局唯一，前置只指向同角色更早章节', () => {
    const ids = AFFECTION_STORIES.map((story) => story.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const classId of CLASS_IDS) {
      const stories = AFFECTION_CHARACTERS[classId].stories;
      for (const [index, story] of stories.entries()) {
        const earlier = new Set(stories.slice(0, index).map((entry) => entry.id));
        expect(story.requiredStoryIds.every((id) => earlier.has(id))).toBe(true);
        expect(requireAffectionStory(classId, story.id)).toBe(story);
      }
    }
  });

  it('记忆回调只引用真实章节与真实回答', () => {
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
    }
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
    expect(scenePaths.size).toBe(12);
    expect(AFFECTION_STORIES.filter((story) => story.cgAsset)).toHaveLength(4);
  });

  it('十二张场景与四张高潮插画真实存在且保持 3:2 横图', async () => {
    const assets = new Set<string>();
    for (const story of AFFECTION_STORIES) {
      assets.add(story.backgroundAsset);
      if (story.cgAsset) assets.add(story.cgAsset);
    }
    expect(assets.size).toBe(16);

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
