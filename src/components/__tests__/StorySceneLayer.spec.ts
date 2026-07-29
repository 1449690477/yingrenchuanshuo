import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import StorySceneLayer from '../StorySceneLayer.vue';

interface LayerTestProps {
  src: string;
  alt?: string;
  breathe?: boolean;
  ambience?:
    | 'auto'
    | 'none'
    | 'petals'
    | 'dust'
    | 'shimmer'
    | 'fireflies'
    | 'rain'
    | 'stars'
    | 'sparkle'
    | 'steam'
    | 'lantern';
  zoomed?: boolean;
}

async function renderLayer(props: LayerTestProps): Promise<string> {
  const app = createSSRApp(h(StorySceneLayer, props));
  return renderToString(app);
}

describe('R1 StorySceneLayer 共享舞台层', () => {
  it('模糊铺底与完整构图双层都渲染，铺底层对读屏隐藏', async () => {
    const html = await renderLayer({ src: '/x/swordsman-lakeside-bento.webp' });
    expect(html).toContain('scene-fill');
    expect(html).toContain('scene-art');
    expect(html).toContain('aria-hidden="true"');
  });

  it('按场景 slug 自动匹配氛围：雨/萤火/星空/湖光/花瓣/默认光尘', async () => {
    expect(await renderLayer({ src: '/x/shaman-rainy-teahouse.webp' })).toContain('kind-rain');
    expect(await renderLayer({ src: '/x/shaman-firefly-ferry.webp' })).toContain(
      'kind-fireflies',
    );
    expect(await renderLayer({ src: '/x/witch-meteor-terrace.webp' })).toContain('kind-stars');
    expect(await renderLayer({ src: '/x/swordsman-lakeside-bento.webp' })).toContain(
      'kind-shimmer',
    );
    expect(await renderLayer({ src: '/x/shaman-shrine-market.webp' })).toContain('kind-petals');
    expect(await renderLayer({ src: '/x/swordsman-morning-market.webp' })).toContain(
      'kind-dust',
    );
  });

  it('14 颗粒子确定性散布，位置只取决于序号', async () => {
    const html = await renderLayer({ src: '/x/shaman-firefly-ferry.webp' });
    expect(html.match(/<i /g)).toHaveLength(14);
  });

  it('ambience=none 关闭粒子，显式氛围优先于 slug 检测', async () => {
    expect(await renderLayer({ src: '/x/shaman-firefly-ferry.webp', ambience: 'none' })).not.toContain(
      'ambience',
    );
    expect(await renderLayer({ src: '/x/shaman-firefly-ferry.webp', ambience: 'rain' })).toContain(
      'kind-rain',
    );
  });

  it('高潮 CG 的读屏描述落在构图层上，装饰场景保持隐藏', async () => {
    const cg = await renderLayer({ src: '/x/cg.webp', alt: '两条剑穗并排躺在剑柄上' });
    expect(cg).toContain('两条剑穗并排躺在剑柄上');
    const plain = await renderLayer({ src: '/x/cg.webp' });
    expect(plain).not.toContain('<img\nclass="scene-art" alt');
  });

  it('回应阶段带 zoomed 推近标记，呼吸默认开启', async () => {
    const html = await renderLayer({ src: '/x/cg.webp', zoomed: true });
    expect(html).toContain('zoomed');
    expect(html).toContain('breathe');
  });
});
