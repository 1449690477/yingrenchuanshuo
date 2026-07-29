import { describe, expect, it } from 'vitest';
import {
  parseStoryEmphasis,
  storyTypeDelayAfter,
  stripStoryEmphasis,
  STORY_TYPE_BASE_MS,
} from '../storyText';

describe('R1 文字演出：强调标记解析', () => {
  it('无标记的台词原样分为一段纯文本', () => {
    expect(parseStoryEmphasis('旧穗磨到起毛了。')).toEqual([
      { text: '旧穗磨到起毛了。', emphasis: false },
    ]);
  });

  it('《…》内的词成为强调段，其余保持纯文本', () => {
    expect(parseStoryEmphasis('那就《它》吧。以后每次收剑，都会看见。')).toEqual([
      { text: '那就', emphasis: false },
      { text: '它', emphasis: true },
      { text: '吧。以后每次收剑，都会看见。', emphasis: false },
    ]);
  });

  it('多个标记逐段解析，空标记被丢弃', () => {
    expect(parseStoryEmphasis('《先问》摊主，也《先问》你。《》完')).toEqual([
      { text: '先问', emphasis: true },
      { text: '摊主，也', emphasis: false },
      { text: '先问', emphasis: true },
      { text: '你。', emphasis: false },
      { text: '完', emphasis: false },
    ]);
  });

  it('未闭合的书名号按纯文本处理，绝不吃掉整句', () => {
    expect(parseStoryEmphasis('她说到一半《就停了')).toEqual([
      { text: '她说到一半《就停了', emphasis: false },
    ]);
  });

  it('stripStoryEmphasis 去掉全部标记留给读屏与回看', () => {
    expect(stripStoryEmphasis('你总是《先问》。所以答案是——可以。')).toBe(
      '你总是先问。所以答案是——可以。',
    );
  });
});

describe('R1 文字演出：标点节奏', () => {
  it('普通字用基础速度', () => {
    expect(storyTypeDelayAfter('她')).toBe(STORY_TYPE_BASE_MS);
  });

  it('逗号小顿、句读长停、省略号拖慢', () => {
    expect(storyTypeDelayAfter('，')).toBeGreaterThan(STORY_TYPE_BASE_MS);
    expect(storyTypeDelayAfter('。')).toBeGreaterThan(storyTypeDelayAfter('，'));
    expect(storyTypeDelayAfter('…')).toBeGreaterThan(STORY_TYPE_BASE_MS);
    expect(storyTypeDelayAfter('！')).toBe(storyTypeDelayAfter('。'));
  });
});
