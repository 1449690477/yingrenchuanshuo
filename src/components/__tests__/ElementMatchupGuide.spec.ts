import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import ElementMatchupGuide from '../ElementMatchupGuide.vue';

async function render(
  attackerElement: 'fire' | 'ice' | 'thunder' | 'none',
  defenderElement: 'fire' | 'ice' | 'thunder' | 'none',
  compact = false,
): Promise<string> {
  return renderToString(
    createSSRApp({
      render: () =>
        h(ElementMatchupGuide, {
          attackerElement,
          defenderElement,
          compact,
        }),
    }),
  );
}

describe('ElementMatchupGuide', () => {
  it('完整态展示双方属性、真实倍率和解释', async () => {
    const html = await render('fire', 'ice');
    expect(html).toContain('我方武器');
    expect(html).toContain('当前敌人');
    expect(html).toContain('克制 +25%');
    expect(html).toContain('×1.25');
    expect(html).toContain('aria-label');
  });

  it('未触发克制时明确推荐正确武器', async () => {
    const html = await render('none', 'thunder');
    expect(html).toContain('中性 ×1.00');
    expect(html).toContain('换冰武器');
  });

  it('无属性关卡不伪造推荐', async () => {
    const html = await render('fire', 'none');
    expect(html).toContain('无属性关卡');
    expect(html).toContain('自由配装');
    expect(html).not.toContain('可克制本关');
  });

  it('紧凑态保留行动建议但收起第二行摘要', async () => {
    const html = await render('ice', 'fire', true);
    expect(html).toContain('compact');
    expect(html).toContain('被克 -15%');
    expect(html).toContain('换雷武器');
    expect(html).not.toContain('guide-copy');
  });
});
