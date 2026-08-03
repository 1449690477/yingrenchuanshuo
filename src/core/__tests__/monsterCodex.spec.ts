/**
 * 怪物永久图鉴账本的测试（M4-8，镜像 equipmentCodex.spec）。
 *
 * 这个账本存在的全部意义是**发现记录不会被抹掉**，所以第一条测试就钉
 * 这件事：账本里没有任何「移除」的入口。
 */

import { describe, expect, it } from 'vitest';
import {
  backfillDiscoveredMonsters,
  createMonsterCodexLedger,
  hasDiscoveredMonster,
  recordDiscoveredMonsters,
} from '../monsterCodex';
import * as codexModule from '../monsterCodex';

describe('只增不删', () => {
  it('模块不导出任何移除入口——这是设计约束，不是遗漏', () => {
    const removalLike = Object.keys(codexModule).filter((name) =>
      /remove|delete|clear|forget|reset/i.test(name),
    );
    expect(removalLike).toEqual([]);
  });

  it('记录后再记同一只，不会重复也不会消失', () => {
    let ledger = createMonsterCodexLedger();
    ledger = recordDiscoveredMonsters(ledger, ['mon_1', 'mon_2']).ledger;
    ledger = recordDiscoveredMonsters(ledger, ['mon_1']).ledger;

    expect(ledger.discoveredMonsterIds).toEqual(['mon_1', 'mon_2']);
  });

  it('按首次发现顺序追加，不排序——顺序本身是玩家的历史', () => {
    let ledger = createMonsterCodexLedger();
    ledger = recordDiscoveredMonsters(ledger, ['mon_z']).ledger;
    ledger = recordDiscoveredMonsters(ledger, ['mon_a']).ledger;

    expect(ledger.discoveredMonsterIds).toEqual(['mon_z', 'mon_a']);
  });
});

describe('newlyDiscovered 供上层做首次发现表现', () => {
  it('只报真正新增的那些', () => {
    const first = recordDiscoveredMonsters(createMonsterCodexLedger(), ['mon_a', 'mon_b']);
    expect(first.newlyDiscovered).toEqual(['mon_a', 'mon_b']);

    const second = recordDiscoveredMonsters(first.ledger, ['mon_b', 'mon_c']);
    expect(second.newlyDiscovered).toEqual(['mon_c']);
  });

  it('没有新增时原样返回同一个账本对象，避免无谓的存档写入', () => {
    const ledger = recordDiscoveredMonsters(createMonsterCodexLedger(), ['mon_a']).ledger;
    const again = recordDiscoveredMonsters(ledger, ['mon_a']);

    expect(again.ledger).toBe(ledger);
    expect(again.newlyDiscovered).toEqual([]);
  });

  it('空 id 与空批次都不会污染账本', () => {
    const ledger = recordDiscoveredMonsters(createMonsterCodexLedger(), ['', 'mon_a', '']).ledger;
    expect(ledger.discoveredMonsterIds).toEqual(['mon_a']);
  });
});

describe('老档回填', () => {
  it('回填把已通关章节必见的怪物补进账本，不动已有记录', () => {
    const ledger = backfillDiscoveredMonsters(
      recordDiscoveredMonsters(createMonsterCodexLedger(), ['mon_old']).ledger,
      ['mon_seen_1', 'mon_old'],
    );
    expect(ledger.discoveredMonsterIds).toEqual(['mon_old', 'mon_seen_1']);
  });
});

describe('查询', () => {
  it('hasDiscoveredMonster 认账本而不是当前内容', () => {
    const ledger = recordDiscoveredMonsters(createMonsterCodexLedger(), ['mon_a']).ledger;
    expect(hasDiscoveredMonster(ledger, 'mon_a')).toBe(true);
    expect(hasDiscoveredMonster(ledger, 'mon_b')).toBe(false);
  });
});
