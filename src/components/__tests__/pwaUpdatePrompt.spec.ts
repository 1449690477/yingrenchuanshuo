// @vitest-environment jsdom

import { createApp, nextTick, type App } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pwaMocks = vi.hoisted(() => ({
  options: null as {
    onNeedRefresh?: () => void;
    onRegisterError?: () => void;
  } | null,
  update: vi.fn(async () => undefined),
}));

vi.mock('@/pwa/register', () => ({
  registerPwaUpdates: (options: NonNullable<typeof pwaMocks.options>): typeof pwaMocks.update => {
    pwaMocks.options = options;
    return pwaMocks.update;
  },
}));

import PwaUpdatePrompt from '../PwaUpdatePrompt.vue';

describe('PwaUpdatePrompt', () => {
  let app: App<Element> | null;
  let host: HTMLDivElement;

  beforeEach(() => {
    pwaMocks.options = null;
    pwaMocks.update.mockClear();
    host = document.createElement('div');
    document.body.append(host);
    app = createApp(PwaUpdatePrompt);
    app.mount(host);
  });

  afterEach(() => {
    app?.unmount();
    host.remove();
    app = null;
  });

  it('新 Service Worker 等待时提示玩家，并由玩家触发同版本刷新', async () => {
    expect(host.textContent).not.toContain('发现新版本');

    pwaMocks.options?.onNeedRefresh?.();
    await nextTick();

    expect(host.textContent).toContain('发现新版本');
    expect(host.textContent).toContain('榜单与游戏资源会同步到同一版本');

    const button = host.querySelector('button');
    expect(button).not.toBeNull();
    button?.click();
    await nextTick();

    expect(pwaMocks.update).toHaveBeenCalledWith(true);
    expect(button?.textContent).toContain('更新中');
  });

  it('插件注册失败时不伪装成功，保留可重试提示', async () => {
    pwaMocks.options?.onNeedRefresh?.();
    pwaMocks.options?.onRegisterError?.();
    await nextTick();

    expect(host.textContent).toContain('更新没有完成');
    expect(host.textContent).toContain('重试更新');
  });

  it('PWA 使用等待确认模式，避免新缓存先清掉旧页面仍需的懒加载资源', () => {
    const configSource = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');
    expect(configSource).toContain("registerType: 'prompt'");
    expect(configSource).not.toMatch(/registerType:\s*'autoUpdate'/);
  });
});
