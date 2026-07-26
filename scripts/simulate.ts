/**
 * 数值模拟器 —— 放置游戏最重要的开发工具。
 *
 * 用法：npm run sim
 *
 * 输出三份东西：
 *   1. 校验点表     —— 用来核对 docs/10-数值与战斗.md 里的关键数字
 *   2. 30 天成长曲线 —— 玩家每天能到几级，有没有断档
 *   3. 三职业对比    —— 挂机效率是否在 ±20% 平衡带内
 *
 * 之所以能有这个工具，是因为 core 层是纯函数（AGENTS.md 铁律 1）。
 * 任何人改了公式，跑一次这个脚本就知道有没有把曲线搞坏。
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ClassId, Combatant, EquipSlot, Quality, Stats } from '../src/core/types';
import { combatPower, zeroStats } from '../src/core/formula';
import {
  applyClassMods,
  baseStatsFor,
  expToNext,
  makeMonster,
  makePlayer,
  monsterExp,
  monsterGold,
  monsterHp,
} from '../src/core/progression';
import {
  ITEM_BASE,
  ITEM_POW,
  ITEM_SCALE,
  QUALITY_MUL,
  QUALITY_PCT_SCALE,
  SLOT_PCT_WEIGHTS,
  SLOT_WEIGHTS,
  CRIT_RATE_CAP,
} from '../src/data/constants';
import { killsPerSecond } from '../src/core/idle';
import type { IdleContext } from '../src/core/idle';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, 'out');

// ──────────────────────────────────────────────────────────
// 装备强度模型
//
// 按 docs/12-装备体系.md 的真实公式计算 8 个槽位的属性总和：
//   槽位属性 = ITEM_BASE × L^ITEM_POW × 品质系数 × 部位权重 × ITEM_SCALE
//
// 之所以必须用真实公式而不是「乘个平均倍率」：装备属性是随等级
// 按 L^1.35 增长的，用固定倍率会严重低估中后期玩家强度，
// 从而把怪物曲线调错。这是 ADR-005 的由来。
// ──────────────────────────────────────────────────────────

/** 玩家在某等级的典型装备品质。随进度推进而提升。 */
function typicalQuality(level: number): Quality {
  if (level < 15) return 'common';
  if (level < 25) return 'fine';
  if (level < 40) return 'rare';
  if (level < 65) return 'epic';
  if (level < 90) return 'legendary';
  if (level < 110) return 'mythic';
  return 'divine';
}

/** 全身 8 件装备提供的属性总和 */
function gearStats(level: number, quality: Quality): Stats {
  const baseValue = ITEM_BASE * Math.pow(level, ITEM_POW) * QUALITY_MUL[quality] * ITEM_SCALE;
  const pctScale = QUALITY_PCT_SCALE[quality];
  const out = zeroStats();

  for (const slot of Object.keys(SLOT_WEIGHTS) as EquipSlot[]) {
    // 数值型：乘装备基准值，随等级增长
    for (const [key, w] of Object.entries(SLOT_WEIGHTS[slot]) as [keyof Stats, number][]) {
      out[key] += baseValue * w;
    }
    // 百分比型：只随品质增长
    for (const [key, w] of Object.entries(SLOT_PCT_WEIGHTS[slot]) as [keyof Stats, number][]) {
      out[key] += pctScale * w;
    }
  }
  return out;
}

function withGear(cls: ClassId, level: number): Stats {
  const base = baseStatsFor(cls, level);
  const gear = gearStats(level, typicalQuality(level));

  const combined: Stats = {
    atk: base.atk + gear.atk,
    def: base.def + gear.def,
    hp: base.hp + gear.hp,
    acc: base.acc + gear.acc,
    eva: base.eva + gear.eva,
    critRate: Math.min(CRIT_RATE_CAP, base.critRate + gear.critRate),
    critDmg: base.critDmg + gear.critDmg,
    spd: base.spd,
  };

  // 职业系数必须在装备累加之后应用，见 progression.applyClassMods 的注释
  return applyClassMods(cls, combined);
}

/** 玩家平均技能倍率。随等级解锁更多技能而提高。 */
function avgSkillMultiplier(level: number): number {
  if (level < 10) return 1.2;
  if (level < 25) return 1.45;
  if (level < 45) return 1.7;
  if (level < 65) return 2.0;
  if (level < 85) return 2.3;
  return 2.6;
}

function buildContext(cls: ClassId, level: number, stageLevel: number): IdleContext {
  const stats = withGear(cls, level);
  const player: Combatant = makePlayer('sim', level, stats);
  const monster = makeMonster({
    id: 'sim_mon',
    name: 'sim',
    level: stageLevel,
    type: 'normal',
    element: 'none',
    lootTableId: 'sim',
    sprite: '',
  });
  return {
    player,
    monster,
    expPerKill: monsterExp(stageLevel),
    goldPerKill: monsterGold(stageLevel),
    lootTable: { id: 'sim', rolls: 1, entries: [] },
    skillMultiplier: avgSkillMultiplier(level),
  };
}

// ──────────────────────────────────────────────────────────
// 1. 校验点表
// ──────────────────────────────────────────────────────────

function checkpointTable() {
  const levels = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
  const rows = levels.map((L) => {
    const bare = baseStatsFor('swordsman', L);
    const geared = withGear('swordsman', L);
    return {
      等级: L,
      升级所需经验: expToNext(L),
      小怪血量: monsterHp(L),
      裸战力: combatPower(bare),
      满配战力: combatPower(geared),
    };
  });

  console.log('\n【校验点表】用于核对 docs/10-数值与战斗.md 2.3 节\n');
  console.table(rows);

  // 增速检查：玩家战力增速必须略慢于怪物血量增速（卡点的来源）
  console.log('\n【增速对比】每 10 级的倍率 —— 怪物应略快于玩家\n');
  const growth: Record<string, unknown>[] = [];
  for (let L = 10; L <= 110; L += 10) {
    const cpNow = combatPower(withGear('swordsman', L));
    const cpNext = combatPower(withGear('swordsman', L + 10));
    const hpNow = monsterHp(L);
    const hpNext = monsterHp(L + 10);
    growth.push({
      区间: `Lv${L}→${L + 10}`,
      玩家战力倍率: (cpNext / cpNow).toFixed(3),
      怪物血量倍率: (hpNext / hpNow).toFixed(3),
      差值: (hpNext / hpNow - cpNext / cpNow).toFixed(3),
    });
  }
  console.table(growth);

  return rows;
}

// ──────────────────────────────────────────────────────────
// 2. 30 天成长曲线
// ──────────────────────────────────────────────────────────

interface DayRecord {
  天: number;
  等级: number;
  战力: number;
  当日经验: number;
  挂机关卡: number;
  每秒击杀: string;
}

/** 玩家每天实际挂机的有效秒数：8 小时离线上限 + 白天零散在线，按 14 小时估算 */
const EFFECTIVE_SECONDS_PER_DAY = 14 * 3600;

function simulateDays(cls: ClassId, days: number, levelCap = 120): DayRecord[] {
  let level = 1;
  let exp = 0;
  const records: DayRecord[] = [];

  for (let day = 1; day <= days; day++) {
    let dayExp = 0;
    let remaining = EFFECTIVE_SECONDS_PER_DAY;
    let lastKps = 0;
    let stageLevel = level;

    // 按小时推进，这样升级后能及时换到更高的图
    while (remaining > 0) {
      const chunk = Math.min(3600, remaining);
      remaining -= chunk;

      // 玩家总是挂在自己等级能打的最高图（简化：等于自身等级）
      stageLevel = Math.max(1, Math.min(level, levelCap));
      const ctx = buildContext(cls, level, stageLevel);
      const kps = killsPerSecond(ctx);
      lastKps = kps;

      const gained = Math.floor(kps * chunk * ctx.expPerKill);
      dayExp += gained;
      exp += gained;

      // 结算升级
      while (level < levelCap && exp >= expToNext(level)) {
        exp -= expToNext(level);
        level++;
      }
    }

    records.push({
      天: day,
      等级: level,
      战力: combatPower(withGear(cls, level)),
      当日经验: dayExp,
      挂机关卡: stageLevel,
      每秒击杀: lastKps.toFixed(2),
    });
  }

  return records;
}

// ──────────────────────────────────────────────────────────
// 3. 三职业挂机效率对比
// ──────────────────────────────────────────────────────────

function classBalance() {
  const levels = [10, 30, 50, 70, 90];
  const rows = levels.map((L) => {
    const kps: Record<ClassId, number> = {
      swordsman: killsPerSecond(buildContext('swordsman', L, L)),
      witch: killsPerSecond(buildContext('witch', L, L)),
      shaman: killsPerSecond(buildContext('shaman', L, L)),
    };
    const avg = (kps.swordsman + kps.witch + kps.shaman) / 3;
    const dev = (v: number) => `${(((v - avg) / avg) * 100).toFixed(1)}%`;
    return {
      等级: L,
      剑姬: kps.swordsman.toFixed(3),
      魔女: kps.witch.toFixed(3),
      灵巫: kps.shaman.toFixed(3),
      '剑姬偏离': dev(kps.swordsman),
      '魔女偏离': dev(kps.witch),
      '灵巫偏离': dev(kps.shaman),
    };
  });

  console.log('\n【三职业挂机效率】偏离超过 ±20% 需要调整（docs/13 第四节）\n');
  console.table(rows);
  return rows;
}

// ──────────────────────────────────────────────────────────
// 主流程
// ──────────────────────────────────────────────────────────

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]!);
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map((h) => String(r[h])).join(','));
  return lines.join('\n');
}

function main() {
  const checkpoints = checkpointTable();

  console.log('\n【30 天成长曲线 · 剑姬】每天有效挂机 14 小时\n');
  const curve = simulateDays('swordsman', 30);
  console.table(
    curve.filter((r) => r.天 === 1 || r.天 % 5 === 0).map((r) => ({ ...r, 当日经验: r.当日经验 })),
  );

  const balance = classBalance();

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, 'checkpoints.csv'), toCsv(checkpoints), 'utf8');
  writeFileSync(
    resolve(OUT_DIR, 'growth-30d.csv'),
    toCsv(curve as unknown as Record<string, unknown>[]),
    'utf8',
  );
  writeFileSync(resolve(OUT_DIR, 'class-balance.csv'), toCsv(balance), 'utf8');

  console.log(`\n✔ CSV 已输出到 ${OUT_DIR}`);
  console.log('  checkpoints.csv / growth-30d.csv / class-balance.csv\n');

  // 健康检查
  const day30 = curve[curve.length - 1]!;
  console.log('【健康检查】');
  console.log(`  30 天后等级：Lv${day30.等级}`);
  const stalled = curve.findIndex((r, i) => i > 0 && r.等级 === curve[i - 1]!.等级);
  if (stalled > 0) {
    console.log(`  ⚠ 第 ${curve[stalled]!.天} 天开始出现等级停滞（Lv${curve[stalled]!.等级}）`);
  } else {
    console.log('  ✔ 30 天内无等级停滞');
  }
}

main();
