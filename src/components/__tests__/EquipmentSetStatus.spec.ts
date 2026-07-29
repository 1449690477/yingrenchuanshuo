import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import type { ActiveEquipmentSet } from '@/core/equipmentSets';
import { REGION_CRIMSON_SET } from '@/data/regionEquipmentSets';
import EquipmentSetStatus from '../EquipmentSetStatus.vue';

async function render(sets: ActiveEquipmentSet[], compact = false): Promise<string> {
  return renderToString(
    createSSRApp({
      render: () => h(EquipmentSetStatus, { sets, compact }),
    }),
  );
}

describe('通用装备套装共鸣展示', () => {
  it('严格使用权威定义展示穿戴进度、已激活档和下一档，不复制绯焰数值', async () => {
    const view: ActiveEquipmentSet = {
      definition: REGION_CRIMSON_SET,
      equippedPieces: 4,
      activeBonuses: REGION_CRIMSON_SET.bonuses.slice(0, 2),
      nextBonus: REGION_CRIMSON_SET.bonuses[2]!,
    };
    const html = await render([view]);

    expect(html).toContain('绯焰套');
    expect(html).toContain('4');
    expect(html).toContain('6');
    expect(html).toContain('攻击 +8%');
    expect(html).toContain('暴击率 +6%，炎属性伤害 +12%');
    expect(html).toContain('15% 概率追加 120% 攻击力');
    expect(html).toContain('再穿 2 件');
    expect(html.match(/data-state="active"/g)).toHaveLength(2);
    expect(html).toContain('data-state="next"');
  });

  it('无套装时给出可理解的收集目标，不保留“套装 M5-1”开发占位', async () => {
    const html = await render([]);
    expect(html).toContain('穿戴至少 2 件同套装备后');
    expect(html).not.toContain('M5-1');
  });

  it('详情紧凑模式隐藏重复标题，但保留全套效果与竖屏布局门禁', async () => {
    const view: ActiveEquipmentSet = {
      definition: REGION_CRIMSON_SET,
      equippedPieces: 6,
      activeBonuses: REGION_CRIMSON_SET.bonuses,
      nextBonus: null,
    };
    const html = await render([view], true);
    expect(html).toContain('set-status compact');
    expect(html).toContain('全部共鸣已经点亮');

    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    const source = await readFile(resolve('src/components/EquipmentSetStatus.vue'), 'utf8');
    expect(source).toContain('@media (max-width: 350px)');
    expect(source).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('同页多个套装状态实例使用各自标题标识，避免详情弹窗与养成页互相串联', async () => {
    const html = await renderToString(
      createSSRApp({
        render: () =>
          h('main', [
            h(EquipmentSetStatus, { sets: [] }),
            h(EquipmentSetStatus, { sets: [], compact: true }),
          ]),
      }),
    );
    const labelledByIds = [...html.matchAll(/aria-labelledby="([^"]+)"/g)].map(
      (match) => match[1],
    );
    const titleIds = [...html.matchAll(/<strong id="([^"]+)"/g)].map((match) => match[1]);

    expect(labelledByIds).toHaveLength(2);
    expect(new Set(labelledByIds)).toHaveLength(2);
    expect(titleIds).toEqual(labelledByIds);
  });
});
