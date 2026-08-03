/**
 * 怪物图鉴（M4-8 P2）契约测试。
 *
 * 口径：图鉴是只读展示层，怪物名/等级/类型/素材路径一律引用 data 权威表，
 * 本文件锁定「数据组合正确 + 视图只消费组合层 + 账本只增不删」三条红线。
 */

import { readFileSync } from 'node:fs';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import { createMonsterCodexLedger, recordDiscoveredMonsters } from '@/core/monsterCodex';
import { MONSTERS, monstersOfChapter } from '@/data/monsters';
import { REGIONS } from '@/data/regions';
import {
  buildMonsterCodex,
  monsterCodexTotalMonsters,
} from '../monsterCodex/monsterCodexData';
import MonsterCodexView from '@/views/MonsterCodexView.vue';

const viewSource = readFileSync(new URL('../../views/MonsterCodexView.vue', import.meta.url), 'utf8');

describe('monsterCodexData 组合层', () => {
  it('覆盖全部怪物，且每只怪物都来自 MONSTERS 权威表', () => {
    const codex = buildMonsterCodex(createMonsterCodexLedger());
    expect(codex.summary.total).toBe(monsterCodexTotalMonsters());
    expect(codex.summary.total).toBe(Object.keys(MONSTERS).length);
    expect(codex.summary.discovered).toBe(0);
  });

  it('区域/章节分组与 REGIONS 一致，章节内条目数等于该章怪物数', () => {
    const codex = buildMonsterCodex(createMonsterCodexLedger());
    expect(codex.regions.map((r) => r.regionId)).toEqual(REGIONS.map((r) => r.id));
    for (let i = 0; i < REGIONS.length; i += 1) {
      expect(codex.regions[i]!.chapters.map((c) => c.chapterId)).toEqual(
        REGIONS[i]!.chapters.map((c) => c.id),
      );
      for (let j = 0; j < REGIONS[i]!.chapters.length; j += 1) {
        const chapter = REGIONS[i]!.chapters[j]!;
        expect(codex.regions[i]!.chapters[j]!.entries.length).toBe(
          monstersOfChapter(chapter.id).length,
        );
      }
    }
  });

  it('账本命中即点亮，未命中保持未发现，且未知 id 不产生条目', () => {
    const firstMonster = Object.keys(MONSTERS)[0]!;
    const ledger = recordDiscoveredMonsters(createMonsterCodexLedger(), [
      firstMonster,
      'mon_not_exist',
    ]).ledger;
    const codex = buildMonsterCodex(ledger);
    expect(codex.summary.discovered).toBe(1);
    const entries = codex.regions.flatMap((r) => r.chapters.flatMap((c) => c.entries));
    expect(entries.some((e) => e.id === firstMonster && e.discovered)).toBe(true);
    expect(entries.some((e) => e.id === 'mon_not_exist')).toBe(false);
  });

  it('条目引用权威表的名称/等级/类型/素材路径，不复制数值', () => {
    const codex = buildMonsterCodex(createMonsterCodexLedger());
    for (const entry of codex.regions.flatMap((r) => r.chapters.flatMap((c) => c.entries))) {
      const def = MONSTERS[entry.id]!;
      expect(entry.name).toBe(def.name);
      expect(entry.level).toBe(def.level);
      expect(entry.type).toBe(def.type);
      expect(entry.asset).toContain(`/monsters/`);
    }
  });
});

describe('MonsterCodexView 只读展示', () => {
  it('已发现的怪物显示真名，未发现的显示？？？与遮罩', async () => {
    const ids = Object.keys(MONSTERS);
    const ledger = recordDiscoveredMonsters(createMonsterCodexLedger(), [ids[0]!]).ledger;
    const html = await renderToString(
      createSSRApp({
        render: () => h(MonsterCodexView, { ledger }),
      }),
    );
    expect(html).toContain(MONSTERS[ids[0]!]!.name);
    expect(html).toContain('？？？');
    expect(html).toContain('未发现');
    expect(html).toContain('怪物图鉴');
  });

  it('视图只消费组合层，不自己遍历数据（防止双数据源）', () => {
    expect(viewSource).toContain('buildMonsterCodex');
    expect(viewSource).not.toContain('from \'@/data/monsters\'');
    expect(viewSource).not.toContain('from "@/data/monsters"');
  });
});
