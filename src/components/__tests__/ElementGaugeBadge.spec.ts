import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import ElementGaugeBadge from '../ElementGaugeBadge.vue';

async function render(
  monsterElement: 'fire' | 'ice' | 'thunder' | 'none',
  playerElement: 'fire' | 'ice' | 'thunder' | 'none' = 'none',
  stacks?: number,
): Promise<string> {
  return renderToString(
    createSSRApp({
      render: () =>
        h(ElementGaugeBadge, {
          monsterElement,
          playerElement,
          ...(stacks === undefined ? {} : { stacks }),
        }),
    }),
  );
}

describe('ElementGaugeBadge（docs/83 批 1 感知层）', () => {
  it('展示敌人元素与克制标签（真实公式源）', async () => {
    const html = await render('ice', 'fire');
    expect(html).toContain('冰');
    expect(html).toContain('克制 ×1.25');
  });

  it('被克时展示被克标签', async () => {
    const html = await render('fire', 'ice');
    expect(html).toContain('炎');
    expect(html).toContain('被克 ×0.85');
  });

  it('未提供 stacks 时不渲染层数（不伪造不存在的机制）', async () => {
    const html = await render('thunder', 'fire');
    expect(html).not.toContain('印记');
  });

  it('提供 stacks 时展示层数（批 3 接入后的数据位）', async () => {
    const html = await render('thunder', 'fire', 3);
    expect(html).toContain('印记 ×3');
  });

  it('aria-label 可读（敌人属性 + 关系）', async () => {
    const html = await render('ice', 'fire');
    expect(html).toContain('aria-label');
    expect(html).toContain('敌人属性');
  });
});
