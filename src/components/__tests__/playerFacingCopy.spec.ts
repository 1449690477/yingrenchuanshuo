import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('玩家界面文案收口', () => {
  it('更多页不再把已上线的图鉴与排行榜列为即将开放', () => {
    const source = read('../../views/MoreView.vue');

    expect(source).toContain('title="旅途计划"');
    expect(source).not.toContain('排行榜 · M7-4');
    expect(source).not.toContain('图鉴 · M4-8');
    expect(source).not.toContain('开发版 M2');
  });

  it('养成、副本与关卡弹层不向玩家展示内部里程碑编号', () => {
    const growth = read('../../views/GrowthView.vue');
    const dungeon = read('../../views/DungeonView.vue');
    const stageSelect = read('../StageSelect.vue');

    expect(growth).not.toContain('技能 · M3-5');
    expect(growth).not.toContain('宠物 · M6-1');
    expect(dungeon).not.toContain("when: 'M4-4'");
    expect(dungeon).not.toContain("when: 'M6-4'");
    expect(dungeon).not.toContain("when: 'M8-1'");
    expect(dungeon).not.toContain("when: 'M8-5'");
    expect(stageSelect).not.toContain('疾风扫荡 · M3-7');
  });
});

describe('背包首屏触控精度', () => {
  it('分页、批量操作和排序入口不再落入 28～39px 的误触区', () => {
    const bag = read('../../views/BagView.vue');

    expect(bag).toMatch(/\.t\s*\{[\s\S]*?min-height:\s*44px/);
    expect(bag).toMatch(/\.sm\s*\{[\s\S]*?min-height:\s*44px/);
    expect(bag).toMatch(/\.score-sort button\s*\{[\s\S]*?min-height:\s*40px/);
  });
});
