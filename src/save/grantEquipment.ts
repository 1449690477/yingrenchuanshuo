/**
 * 装备入包的唯一收口（docs/63 §4.2）。
 *
 * ── 为什么需要一个收口 ──
 * 改造前，装备进背包有 11 处各自 `save.bag.equipment.push(...)`
 * （game.ts 9 处 + arena.ts 2 处）。要给「曾经获得过」建账本，
 * 靠在 11 个地方各加一行是守不住的：下一个人加第 12 处掉落时不会知道
 * 这件事，而漏掉的后果是**图鉴少一件却没有任何报错**。
 *
 * 所以这里把「入包」与「记账」绑成一件事：想让装备进背包，就只能走这个函数。
 *
 * ── 什么不该走这里 ──
 * **穿脱装备的换位**（穿上新的、把旧的放回背包）不是「获得」，
 * 那些地方继续用裸 push。区别不是形式而是语义：
 * 换位时这件装备早就在账本里了，走这里只会让「获得」这个词失去意义。
 */

import { recordDiscoveredEquipment } from '@/core/equipmentCodex';
import type { EquipmentInstance } from '@/core/types';
import type { SaveData } from './schema';

/**
 * 把装备放进背包，并记进永久图鉴。
 *
 * @returns 本次**首次获得**的定义 id；上层可据此做「图鉴新增」表现。
 */
export function grantEquipment(
  save: SaveData,
  instances: readonly EquipmentInstance[],
): string[] {
  if (instances.length === 0) return [];
  save.bag.equipment.push(...instances);
  const { ledger, newlyDiscovered } = recordDiscoveredEquipment(
    save.equipmentCodex,
    instances.map((instance) => instance.defId),
  );
  save.equipmentCodex = ledger;
  return newlyDiscovered;
}
