import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import AffectionCompanionPanel from '../AffectionCompanionPanel.vue';

async function renderPanel(
  overrides: Partial<InstanceType<typeof AffectionCompanionPanel>['$props']> = {},
): Promise<string> {
  const app = createSSRApp(
    h(AffectionCompanionPanel, {
      characterName: '剑姬',
      tierLabel: '心动',
      accent: '#ff7fa9',
      glow: '#ffe2ed',
      unlockedLetterCount: 2,
      totalLetterCount: 4,
      unlockedMemoryCount: 7,
      totalMemoryCount: 16,
      ...overrides,
    }),
  );
  return renderToString(app);
}

describe('AffectionCompanionPanel', () => {
  it('提供闲聊、来信、回忆三个 44px 以上入口的完整文案', async () => {
    const html = await renderPanel();
    expect(html).toContain('与剑姬的心之间');
    expect(html).toContain('和她聊聊');
    expect(html).toContain('心之间信');
    expect(html).toContain('回忆画廊');
    expect(html).toContain('不消耗次数');
  });

  it('展示真实解锁计数而不是伪造 NEW 角标', async () => {
    const html = await renderPanel({
      unlockedLetterCount: 3,
      unlockedMemoryCount: 11,
    });
    expect(html).toContain('3/4');
    expect(html).toContain('11/16');
    expect(html).not.toContain('NEW');
  });
});
