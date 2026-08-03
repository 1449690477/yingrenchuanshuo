// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp, nextTick, type App } from 'vue';
import { createPinia } from 'pinia';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSave } from '@/save/schema';
import { useGameStore } from '@/stores/game';
import ShopView from '@/views/ShopView.vue';

let app: App | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  app?.unmount();
  host?.remove();
  vi.unstubAllGlobals();
  app = null;
  host = null;
});

function mountShop() {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  host = document.createElement('div');
  document.body.appendChild(host);
  const pinia = createPinia();
  app = createApp(ShopView);
  app.use(pinia);
  const game = useGameStore(pinia);
  const save = createSave('冰雪货架测试', 'swordsman', 20260802, Date.now());
  save.player.level = 78;
  save.player.gold = 2_000_000_000;
  save.progress.currentStageId = 'stage_7-5_6';
  save.progress.clearedStageIds = ['stage_7-5_6'];
  game.loadFrom(save);
  app.mount(host);
  return { element: host, game };
}

describe('冰雪华年独立货架 UI', () => {
  it('用数据驱动货架切换，并只展示当前职业八件冰雪装备', async () => {
    const { element } = mountShop();
    const iceButton = element.querySelector<HTMLButtonElement>('.shelf-switcher button.ice')!;

    expect(iceButton).toBeTruthy();
    expect(iceButton.getAttribute('aria-pressed')).toBe('false');
    iceButton.click();
    await nextTick();

    expect(iceButton.getAttribute('aria-pressed')).toBe('true');
    const source = readFileSync(resolve('src/views/ShopView.vue'), 'utf8');
    expect(source).toMatch(/\.shelf-switcher button\s*\{[\s\S]*?min-height:\s*44px/);
    expect(element.querySelector<HTMLImageElement>('.shop-scene img')?.src).toContain(
      '/assets/shops/ice-snow-shelf.webp',
    );
    expect(element.querySelectorAll('.offer-card')).toHaveLength(8);
    expect(element.textContent).toContain('冰雪华年');
    expect(element.textContent).not.toContain('草莓奶霜伞剑');
  });

  it('冰雪商品可打开真实试穿详情，关闭按钮与筛选按钮保持移动端触控尺寸', async () => {
    const { element } = mountShop();
    element.querySelector<HTMLButtonElement>('.shelf-switcher button.ice')!.click();
    await nextTick();
    element.querySelector<HTMLButtonElement>('.offer-card')!.click();
    await nextTick();

    expect(element.querySelector('.detail-sheet')).toBeTruthy();
    expect(element.querySelector('.character-appearance')).toBeTruthy();
    expect(element.textContent).toContain('固定属性与外观换肤已真实生效');
    const source = readFileSync(resolve('src/views/ShopView.vue'), 'utf8');
    expect(source).toMatch(/\.shop-filters button\s*\{[\s\S]*?min-height:\s*44px/);
    expect(source).toMatch(/\.close\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px/);
  });

  it('无独立纸娃娃层的饰品明确说明系列演出，不再冒充逐件外观', async () => {
    const { element } = mountShop();
    element.querySelector<HTMLButtonElement>('.shelf-switcher button.ice')!.click();
    await nextTick();

    const necklaceCard = [...element.querySelectorAll<HTMLButtonElement>('.offer-card')].find(
      (card) => card.textContent?.includes('雪魄珍珠项链'),
    );
    expect(necklaceCard).toBeTruthy();
    necklaceCard!.click();
    await nextTick();

    expect(element.querySelector('.detail-sheet')).toBeTruthy();
    expect(element.querySelector('.effect-copy strong')?.textContent).toContain('系列演出');
    expect(element.textContent).toContain('饰品本身不单独叠加纸娃娃图层');
    expect(element.textContent).toContain('当前穿戴中品阶最高的精品主题');
    expect(element.textContent).toContain('不会单独显示项链、腕饰、戒指或腰封');
    expect(element.textContent).not.toContain('本装备会改变人物立绘层');
  });

  it('打开商城时不让底层更多页撑大移动端弹层高度', () => {
    const source = readFileSync(resolve('src/views/MoreView.vue'), 'utf8');

    expect(source).toMatch(
      /v-show="!\(showShop \|\| shopLeaving \|\| showGuild \|\| guildLeaving \|\| showCodex \|\| codexLeaving\)"[\s\S]*?class="more-content"/,
    );
  });
});
