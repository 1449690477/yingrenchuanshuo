// @vitest-environment jsdom

import { createApp, h, nextTick, type App } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import ProfileAvatar from '../ProfileAvatar.vue';

describe('榜单头像失败回落', () => {
  let app: App<Element> | null = null;
  let host: HTMLDivElement | null = null;

  afterEach(() => {
    app?.unmount();
    app = null;
    host?.remove();
    host = null;
  });

  async function mountAvatar(avatarUrl: string | null): Promise<void> {
    host = document.createElement('div');
    document.body.append(host);
    app = createApp({
      render: () =>
        h(ProfileAvatar, {
          avatarUrl,
          classId: 'catkin',
          alt: '测试头像',
        }),
    });
    app.mount(host);
    await nextTick();
  }

  it('自定义头像失败后切到职业默认图，默认图再失败则切到职业符号', async () => {
    await mountAvatar('https://example.invalid/avatar.webp');

    const custom = host?.querySelector<HTMLImageElement>('img');
    expect(custom?.getAttribute('src')).toBe('https://example.invalid/avatar.webp');
    custom?.dispatchEvent(new Event('error'));
    await nextTick();

    const fallback = host?.querySelector<HTMLImageElement>('img');
    expect(fallback?.getAttribute('src')).toContain('assets/characters/catkin-sakura.png');
    fallback?.dispatchEvent(new Event('error'));
    await nextTick();

    expect(host?.querySelector('img')).toBeNull();
    expect(host?.textContent).toContain('🐾');
  });

  it('没有自定义头像时直接显示职业默认图', async () => {
    await mountAvatar(null);
    expect(host?.querySelector<HTMLImageElement>('img')?.getAttribute('src')).toContain(
      'assets/characters/catkin-sakura.png',
    );
  });
});
