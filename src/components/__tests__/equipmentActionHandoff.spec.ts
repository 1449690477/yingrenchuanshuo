import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('装备操作窗口单层交接契约', () => {
  it('装备详情只发出 UID 请求，不再渲染洗练或升阶面板', () => {
    const detail = source('../EquipDetail.vue');

    expect(detail).toContain('requestReforge: [uid: string]');
    expect(detail).toContain('requestAdvancement: [uid: string]');
    expect(detail).toContain("emit('requestReforge', inst.uid)");
    expect(detail).toContain("emit('requestAdvancement', inst.uid)");
    expect(detail).not.toContain('import ReforgePanel from');
    expect(detail).not.toContain('import EquipmentAdvancementPanel from');
    expect(detail).not.toContain('<ReforgePanel');
    expect(detail).not.toContain('<EquipmentAdvancementPanel');
  });

  it('背包、养成和挂机页先关闭详情，再打开页面级操作台', () => {
    const bag = source('../../views/BagView.vue');
    const growth = source('../../views/GrowthView.vue');
    const idle = source('../../views/IdleView.vue');

    for (const page of [bag, growth, idle]) {
      expect(page).toContain('@request-reforge="openReforgeFromDetail"');
      expect(page).toContain('@request-advancement="openAdvancementFromDetail"');
      expect(page).toMatch(/detail\.value = null|selectedEquip\.value = null/);
      expect(page).toContain('await nextTick()');
      expect(page).toContain('<ReforgeStudio');
      expect(page).toContain(':initial-uid=');
      expect(page).toContain('<EquipmentAdvancementPanel');
    }
  });

  it('副本奖励详情禁止继续打开第三层养成窗口', () => {
    const reward = source('../EquipmentDungeonReward.vue');

    expect(reward).toContain(':allow-advanced-actions="false"');
    expect(reward).not.toContain('@request-reforge');
    expect(reward).not.toContain('@request-advancement');
  });

  it('洗练坊支持初始 UID，结果只在原窗口内让玩家保留或替换', () => {
    const studio = source('../reforge/ReforgeStudio.vue');

    expect(studio).toContain('initialUid?: string | null');
    expect(studio).toContain('entry.uid === props.initialUid');
    expect(studio).toContain('保留原词条');
    expect(studio).toContain('替换为新词条');
    expect(studio).not.toContain('<ReforgePanel');
  });
});
