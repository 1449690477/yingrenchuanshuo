import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import { region5GrowthSnapshot } from '@/data/region5Growth';
import { region5SetEquipmentId } from '@/data/region5';
import Region5GrowthTrack from '../Region5GrowthTrack.vue';

async function render(snapshot = region5GrowthSnapshot({
  playerLevel: 44,
  currentFragments: 23,
  discoveredDefIds: [region5SetEquipmentId('weapon')],
})): Promise<string> {
  return renderToString(
    createSSRApp({
      render: () => h(Region5GrowthTrack, { snapshot }),
    }),
  );
}

describe('熔心成长轨 UI', () => {
  it('把真实节奏、品质与绯焰收集三条进度放在同一张可读卡片', async () => {
    const html = await render();
    expect(html).toContain('熔心成长轨');
    expect(html).toContain('Lv.45 节奏跃迁');
    expect(html).toContain('1.7× → 2.0×');
    expect(html).toContain('Lv.52 普通传说');
    expect(html).toContain('63');
    expect(html).toContain('/</i>240');
    expect(html).toContain('去背包重铸');
  });

  it('完成态仍保留六个永久收集节点和明确结束文案', async () => {
    const discoveredDefIds = ['weapon', 'head', 'body', 'necklace', 'ring', 'bracelet'].map(
      (slot) => region5SetEquipmentId(slot as Parameters<typeof region5SetEquipmentId>[0]),
    );
    const html = await render(
      region5GrowthSnapshot({ playerLevel: 52, currentFragments: 0, discoveredDefIds }),
    );
    expect(html).toContain('全部完成');
    expect(html).toContain('区域成长目标完成');
    expect(html.match(/class="active"/g)).toHaveLength(6);
  });

  it('保留 350px 竖屏重排和减少动画门禁', async () => {
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    const source = await readFile(resolve('src/components/Region5GrowthTrack.vue'), 'utf8');
    expect(source).toContain('@media (max-width: 350px)');
    expect(source).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('挂机页只在 R5 投影真实存档，并把按钮接到既有背包页', async () => {
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    const source = await readFile(resolve('src/views/IdleView.vue'), 'utf8');
    expect(source).toContain("region.value.id !== 'r5'");
    expect(source).toContain('inventory.discoveredDefIds');
    expect(source).toContain('inventory.bag?.items[REGION_5_FRAGMENT_ID]');
    expect(source).toContain("ui.setTab('bag')");
    expect(source).toContain('@open-forge="openRegion5Forge"');
  });
});
