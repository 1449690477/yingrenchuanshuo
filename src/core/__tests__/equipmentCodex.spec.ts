/**
 * 装备永久图鉴账本的测试。
 *
 * 这个账本存在的全部意义是**分解不抹掉曾经获得过的事实**，
 * 所以第一条测试就钉这件事：账本里没有任何「移除」的入口。
 */

import { describe, expect, it } from 'vitest';
import {
  backfillDiscoveredEquipment,
  codexOwnedDefIds,
  createEquipmentCodexLedger,
  hasDiscoveredEquipment,
  recordDiscoveredEquipment,
} from '../equipmentCodex';
import * as codexModule from '../equipmentCodex';

describe('只增不删', () => {
  it('模块不导出任何移除入口 —— 这是设计约束，不是遗漏', () => {
    const removalLike = Object.keys(codexModule).filter((name) =>
      /remove|delete|clear|forget|reset/i.test(name),
    );
    expect(removalLike).toEqual([]);
  });

  it('记录后再记同一件，不会重复也不会消失', () => {
    let ledger = createEquipmentCodexLedger();
    ledger = recordDiscoveredEquipment(ledger, ['eq_a', 'eq_b']).ledger;
    ledger = recordDiscoveredEquipment(ledger, ['eq_a']).ledger;

    expect(ledger.discoveredDefIds).toEqual(['eq_a', 'eq_b']);
  });

  it('按首次获得顺序追加，不排序 —— 顺序本身是玩家的历史', () => {
    let ledger = createEquipmentCodexLedger();
    ledger = recordDiscoveredEquipment(ledger, ['eq_z']).ledger;
    ledger = recordDiscoveredEquipment(ledger, ['eq_a']).ledger;

    expect(ledger.discoveredDefIds).toEqual(['eq_z', 'eq_a']);
  });
});

describe('newlyDiscovered 供上层做首次获得表现', () => {
  it('只报真正新增的那些', () => {
    const first = recordDiscoveredEquipment(createEquipmentCodexLedger(), ['eq_a', 'eq_b']);
    expect(first.newlyDiscovered).toEqual(['eq_a', 'eq_b']);

    const second = recordDiscoveredEquipment(first.ledger, ['eq_b', 'eq_c']);
    expect(second.newlyDiscovered).toEqual(['eq_c']);
  });

  it('没有新增时原样返回同一个账本对象，避免无谓的存档写入', () => {
    const ledger = recordDiscoveredEquipment(createEquipmentCodexLedger(), ['eq_a']).ledger;
    const again = recordDiscoveredEquipment(ledger, ['eq_a']);

    expect(again.ledger).toBe(ledger);
    expect(again.newlyDiscovered).toEqual([]);
  });

  it('空 id 与空批次都不会污染账本', () => {
    const ledger = recordDiscoveredEquipment(createEquipmentCodexLedger(), ['', 'eq_a', '']).ledger;
    expect(ledger.discoveredDefIds).toEqual(['eq_a']);
  });
});

describe('老档回填与展示并集', () => {
  it('回填把当前持有补进账本，不动已有记录', () => {
    const ledger = backfillDiscoveredEquipment(
      recordDiscoveredEquipment(createEquipmentCodexLedger(), ['eq_old']).ledger,
      ['eq_bag_1', 'eq_old'],
    );
    expect(ledger.discoveredDefIds).toEqual(['eq_old', 'eq_bag_1']);
  });

  it('展示集合是「曾经获得」并上「此刻持有」——任何中间状态都不倒退', () => {
    const ledger = recordDiscoveredEquipment(createEquipmentCodexLedger(), ['eq_sold']).ledger;

    // 玩家已经把 eq_sold 分解了，背包里只剩 eq_now
    const owned = codexOwnedDefIds(ledger, ['eq_now']);

    expect(owned.has('eq_sold')).toBe(true); // 分解了仍然算收集过
    expect(owned.has('eq_now')).toBe(true);
    expect(owned.size).toBe(2);
  });

  it('账本为空时展示集合退化为当前持有 —— 迁移前后都不会更差', () => {
    const owned = codexOwnedDefIds(createEquipmentCodexLedger(), ['eq_now']);
    expect([...owned]).toEqual(['eq_now']);
  });
});

describe('查询', () => {
  it('hasDiscoveredEquipment 认账本而不是背包', () => {
    const ledger = recordDiscoveredEquipment(createEquipmentCodexLedger(), ['eq_a']).ledger;
    expect(hasDiscoveredEquipment(ledger, 'eq_a')).toBe(true);
    expect(hasDiscoveredEquipment(ledger, 'eq_b')).toBe(false);
  });
});
