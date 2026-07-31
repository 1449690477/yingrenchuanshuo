/**
 * 深度标定的**独立复算**（docs/72 第 1 步）。
 *
 * ── 为什么要有第二把尺 ──
 * K 曲线要写进玩家会撞上的难度里。今天频道里已经出过两次
 * 「自证断言全绿、实则空转」（G-1 / G-2），两次都是因为只有一份实现
 * 自己验自己。这个脚本刻意**不复用** scripts/equipment-dungeon-balance.mts
 * 的任何函数，也不复用督导那份扫描脚本 —— 自己搭玩家、自己跑战斗、
 * 自己统计。两把独立的尺给出同一组读数，那组数才算数。
 *
 * ── 只量结果侧（督导 10:48 裁定）──
 * 胜率 / 胜局均时 / 超时占比 / 四职业胜率极差。
 * **全程不读战力**：CP 目前含已确认的暴击错价（实锤 B），
 * 用一把已知失真的尺子去校准，绿灯比红灯更危险。
 *
 * ── 两种人群一起报（F5 那个没定的问题）──
 * 「门禁该用静态玩家还是养成后模板」目前没有结论，而**结论会因人群而翻**。
 * 与其替人拍板，不如两种都跑出来：
 *   entry  = 该层标称等级的典型品质装备，**零强化**（刚够门槛就来打）
 *   grown  = 同一套装备，**全 +9**（养了一阵子再来打，对应典型强化 1.6×）
 * 若两种人群给出同一个结论，那这条结论与 F5 无关，可以放心用；
 * 若结论相反，那 F5 就必须先定，标定不能绕过它。
 *
 * 用法：npx tsx scripts/depth-crosscheck.mts [每组样本数，默认 120]
 */

import { CLASS_IDS, type ClassId, type EquipmentInstance } from '../src/core/types';
import { addStats } from '../src/core/formula';
import { totalEquipStats } from '../src/core/equipment';
import { applyEquipmentSetStats, resolveEquipmentSetBonuses } from '../src/core/equipmentSets';
import {
  applyClassMods,
  averageSkillMultiplier,
  baseStatsFor,
  makePlayer,
} from '../src/core/progression';
import {
  createEquipmentDungeonState,
  resolveEquipmentDungeonChallenge,
} from '../src/core/equipmentDungeon';
import { depthNominalLevel } from '../src/core/equipmentDungeonDepth';
import { ENHANCE_MAX, SLOT_ORDER } from '../src/data/constants';
import { EQUIPMENT_DUNGEON_DEPTH_ANCHORS } from '../src/data/equipmentDungeonDepthRules';
import { EQUIPMENT, getEquipment } from '../src/data/equipment';
import { EQUIPMENT_DUNGEON_STAGE_LIST } from '../src/data/equipmentDungeons';
import {
  EQUIPMENT_DUNGEON_TIERS,
  type EquipmentDungeonTierId,
} from '../src/data/equipmentDungeonGear';
import { getEquipmentSet } from '../src/data/equipmentSets';
import { typicalQualityAt } from '../src/data/expectedPower';
import { EQUIPMENT_DUNGEON_RULES } from '../src/data/equipmentDungeonRules';

const SAMPLES = Number(process.argv[2] ?? 120);
const NOW = Date.parse('2026-07-31T12:00:00+08:00');
const CONTENT_TOP_LEVEL = 78;
/** 超时判定：单波打满这个秒数即为打不动，而不是被打死 */
const TIMEOUT_MS = EQUIPMENT_DUNGEON_RULES.maxFightSeconds * 1000;

type Population = 'entry' | 'grown';

/**
 * 该等级该职业「正常会穿」的一件：取典型品质里等级最高的可穿定义。
 *
 * 与 balance 脚本按入场模板取装备是两条独立路径 —— 这里刻意按
 * typicalQualityAt 选品质，因为「玩家在这个等级手上有什么」是内容决定的，
 * 不该由某张入场模板表决定。
 */
function typicalDefFor(slot: string, level: number, classId: ClassId): string | null {
  const quality = typicalQualityAt(level);
  let best: { id: string; level: number } | null = null;
  for (const def of Object.values(EQUIPMENT)) {
    if (def.slot !== slot) continue;
    if (def.level > level) continue;
    if (def.quality !== quality) continue;
    if (def.classId !== undefined && def.classId !== classId) continue;
    if (!best || def.level > best.level) best = { id: def.id, level: def.level };
  }
  // 该等级还没有典型品质的定义时（低等级常见），退到等级最高的任意可穿件
  if (!best) {
    for (const def of Object.values(EQUIPMENT)) {
      if (def.slot !== slot || def.level > level) continue;
      if (def.classId !== undefined && def.classId !== classId) continue;
      if (!best || def.level > best.level) best = { id: def.id, level: def.level };
    }
  }
  return best?.id ?? null;
}

function instanceOf(defId: string, uid: string, enhance: number): EquipmentInstance {
  return {
    uid,
    defId,
    enhance,
    baseRollPermille: 1000,
    // 每级取「稳定」档下限 80‰：不掷骰，保证两次运行完全可复现
    enhanceGainPermille: Array<number>(ENHANCE_MAX)
      .fill(0)
      .map((_, index) => (index < enhance ? 80 : 0)),
    enhanceLuck: {},
    affixes: [],
    reforgeResonance: 0,
    locked: false,
  };
}

function playerFor(tierId: EquipmentDungeonTierId, depth: number, classId: ClassId, population: Population) {
  const level = depthNominalLevel(tierId, depth);
  const enhance = population === 'grown' ? 9 : 0;
  const equipment = SLOT_ORDER.map((slot, index) => {
    const defId = typicalDefFor(slot, level, classId);
    return defId ? instanceOf(defId, `x${index}`, enhance) : null;
  });
  const resolution = resolveEquipmentSetBonuses(equipment, getEquipment, getEquipmentSet);
  const stats = applyClassMods(
    classId,
    applyEquipmentSetStats(
      addStats(baseStatsFor(classId, level), totalEquipStats(equipment, getEquipment, classId)),
      resolution,
    ),
  );
  return {
    combatant: makePlayer(classId, level, stats),
    skillMultiplier: averageSkillMultiplier(level) + resolution.skillMultiplierBonus,
  };
}

interface Cell {
  wins: number;
  runs: number;
  winMsTotal: number;
  timeouts: number;
}

function runCell(
  tierId: EquipmentDungeonTierId,
  depth: number,
  classId: ClassId,
  population: Population,
): Cell {
  // 取该档最难的门户（武器炉 atkMul 最高），与两份既有脚本口径一致
  const stage = EQUIPMENT_DUNGEON_STAGE_LIST.find(
    (candidate) => candidate.tierId === tierId && candidate.slot === 'weapon',
  )!;
  const cell: Cell = { wins: 0, runs: 0, winMsTotal: 0, timeouts: 0 };

  for (let i = 0; i < SAMPLES; i++) {
    const { combatant, skillMultiplier } = playerFor(tierId, depth, classId, population);
    const base = createEquipmentDungeonState(NOW);
    const state = depth > 1 ? { ...base, depth: { [tierId]: depth - 1 } } : base;
    const result = resolveEquipmentDungeonChallenge({
      stage,
      state,
      depth,
      pity: {},
      player: combatant,
      classId,
      playerSkillMultiplier: skillMultiplier,
      // 每次换种子：同一套搭配的胜负分布才有意义
      rngState: 0x9e3779b9 ^ (i * 2654435761),
      now: NOW,
      contentTopLevel: CONTENT_TOP_LEVEL,
    });
    if (!result.ok) throw new Error(`[复算] ${tierId} d${depth} 打不进去：${result.reason}`);
    cell.runs++;
    if (result.win) {
      cell.wins++;
      cell.winMsTotal += result.durationMs;
    } else {
      // 输掉的两种死法要分开：被打死 vs 打不完。后者是限时结构问题，
      // 调 K 救不了，只能压血量或放宽限时（F4）。
      const lastWave = result.waves[result.waves.length - 1];
      if (lastWave && lastWave.result.duration * 1000 >= TIMEOUT_MS - 1) cell.timeouts++;
    }
  }
  return cell;
}

console.log(`深度标定独立复算 · 每组 ${SAMPLES} 次 · 只量结果侧，不读战力`);
console.log('列：胜率 | 胜局均时 | 超时占比（输局中打不完的比例）\n');

for (const population of ['entry', 'grown'] as Population[]) {
  console.log(
    `═══ 人群 ${population}（${population === 'entry' ? '零强化，刚够门槛' : '全 +9，养成后'}）═══`,
  );
  for (const tier of EQUIPMENT_DUNGEON_TIERS) {
    const anchor = EQUIPMENT_DUNGEON_DEPTH_ANCHORS[tier.id];
    for (let depth = 1; depth <= anchor.openDepths; depth++) {
      const cells = CLASS_IDS.map((classId) => ({
        classId,
        cell: runCell(tier.id, depth, classId, population),
      }));
      const rates = cells.map(({ cell }) => (cell.wins / cell.runs) * 100);
      const spread = Math.max(...rates) - Math.min(...rates);
      const winMs = cells.reduce((sum, { cell }) => sum + cell.winMsTotal, 0);
      const wins = cells.reduce((sum, { cell }) => sum + cell.wins, 0);
      const losses = cells.reduce((sum, { cell }) => sum + (cell.runs - cell.wins), 0);
      const timeouts = cells.reduce((sum, { cell }) => sum + cell.timeouts, 0);
      const meanWinSec = wins > 0 ? (winMs / wins / 1000).toFixed(1) : '—';
      const timeoutShare = losses > 0 ? `${((timeouts / losses) * 100).toFixed(0)}%` : '—';
      console.log(
        `${tier.id.padEnd(8)} d${depth} | 胜率 ${rates.map((r) => r.toFixed(0).padStart(3)).join('/')} ` +
          `| 极差 ${spread.toFixed(0).padStart(3)}pt | 均时 ${meanWinSec.padStart(5)}s | 超时 ${timeoutShare.padStart(4)}`,
      );
    }
  }
  console.log('');
}
console.log('职业顺序：' + CLASS_IDS.join(' / '));
