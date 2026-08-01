/**
 * 战力公式版本戳（docs/73 批3-3）。
 *
 * ── 为什么需要它 ──
 * `profiles.combat_power` 只存一个数字，**不存算出这个数字的搭配**
 * （`sync-profile` 拿 `sub.equipped` 算完 CP 就丢，没有落库）。所以战力公式
 * 一改，线上存量**没有任何重算路径** —— 服务端手里没有重算所需的输入。
 * 这一点由小榜（读 sync-profile 源码）与我（查表结构 + 线上数据，
 * arena_ranks.build_snapshot 是唯一有搭配的表而它 0 行）两条独立路径确认。
 *
 * 既然重算不了，就只能**如实标注**：每行战力记下它是用哪版公式算的，
 * 榜单据此决定怎么排、怎么标。旧行等玩家下次同步时自然被新公式重写，
 * 不需要玩家做任何操作，也不需要我们改任何一行存量数据。
 *
 * ── 被否决的替代方案 ──
 * **按系数整体缩放存量**：重定价不是一个均匀系数（不同 build 受影响不同），
 * 缩放会产出一批「看起来合理、实际是错的」数字 —— 比明着标注旧值更坏，
 * 因为错得看不出来。
 * **混排不处理**：战力榜是 `profiles` 按 combat_power 直接排序，新旧混排
 * 就是名次失真；而榜看起来完全正常，没有任何人会发现。
 *
 * ── 改公式的人要做什么 ──
 * 与「改 SAVE_VERSION 者负全链」同一条纪律：**任何改变 combatPower 输出的
 * 改动，都必须在同一个提交里把 CP_FORMULA_VERSION +1**。
 * 忘了会怎样：新旧两把尺的数字在同一张榜上按同一个字段排序，
 * 而两边都自称当前版本 —— 榜单永久失真且无法事后区分。
 *
 * 这条纪律不靠人记：`cpFormulaVersion.spec.ts` 用下面那组固定探针
 * 给公式行为做指纹，公式一变测试就红，并直接告诉你要把版本改成几。
 */

import type { Stats } from './types';

/**
 * 当前战力公式版本。
 *
 * 1 = 加权和 × spd（ADR-009 的形状），即 2026-08-01 之前一直在用的那版。
 *     线上存量按这版算，所以迁移把已有行直接标成 1 —— 它们**确实是**这版算的，
 *     标 0（未知）反而会把 60 行真实档案误判成旧口径、当天从榜上清空。
 */
export const CP_FORMULA_VERSION = 1;

/**
 * 公式指纹探针：一组固定的属性向量，**永远不要改动**。
 *
 * 它们的存在只有一个目的 —— 让 `combatPower` 的行为变化必然触发测试失败。
 * 数值本身没有游戏含义，改动它们会让指纹失去与历史版本的可比性。
 * 覆盖面刻意包含：全零、单属性、暴击相关项、以及 spd ≠ 1 的行
 * （spd 是整条战力的乘数，只测 spd = 1 会漏掉乘法侧的改动）。
 *
 * ── 如果某一行在新公式下退化了（抛错 / NaN / 恒为 0）怎么办 ──
 * 会遇到这种情况：全零那一行在「加权和」形状下是个正常的 0，但在
 * 「输出 × 抗揍的几何平均」这类形状下可能除零或抛。
 * **不要悄悄改掉那一行的数值** —— 它是历史版本指纹的一部分，改了之后
 * 上面那句「不要修改已有版本那一行」就失去了意义。
 * **正确做法**：保留原向量，在**新版本**的指纹里如实记录它的新结果
 * （包括 0 或 NaN）；如果它现在会抛异常，就在本数组**末尾追加**一个
 * 不退化的替代向量，并在这里写一句为什么加它。
 * 探针只增不改 —— 与它守护的版本号同一条纪律。
 */
export const CP_FORMULA_PROBE_STATS: readonly Stats[] = Object.freeze([
  { atk: 0, def: 0, hp: 0, acc: 0, eva: 0, critRate: 0, critDmg: 0, spd: 1 },
  { atk: 100, def: 0, hp: 0, acc: 0, eva: 0, critRate: 0, critDmg: 0, spd: 1 },
  { atk: 0, def: 100, hp: 0, acc: 0, eva: 0, critRate: 0, critDmg: 0, spd: 1 },
  { atk: 0, def: 0, hp: 1000, acc: 0, eva: 0, critRate: 0, critDmg: 0, spd: 1 },
  { atk: 0, def: 0, hp: 0, acc: 100, eva: 100, critRate: 0, critDmg: 0, spd: 1 },
  { atk: 0, def: 0, hp: 0, acc: 0, eva: 0, critRate: 50, critDmg: 200, spd: 1 },
  { atk: 500, def: 300, hp: 5000, acc: 200, eva: 150, critRate: 35, critDmg: 180, spd: 1 },
  // spd ≠ 1：乘法侧。0.9 与 1.25 是魔女与猫族的职业基础攻速。
  { atk: 500, def: 300, hp: 5000, acc: 200, eva: 150, critRate: 35, critDmg: 180, spd: 0.9 },
  { atk: 500, def: 300, hp: 5000, acc: 200, eva: 150, critRate: 35, critDmg: 180, spd: 1.25 },
  // 攻速词条堆到 1.6：这正是当前上界会误伤真人的那一档，指纹里留一行盯着它。
  { atk: 500, def: 300, hp: 5000, acc: 200, eva: 150, critRate: 35, critDmg: 180, spd: 1.6 },
]);

/**
 * 这个版本号是否可能由某个已发布的客户端写出来。
 *
 * 服务端只信任「当前版本」与「历史版本」，不信任未来版本 —— 一个比服务端
 * 还新的版本号只可能来自伪造（客户端拿不到未来的公式）。
 */
export function isKnownCpFormulaVersion(version: number): boolean {
  return Number.isInteger(version) && version >= 1 && version <= CP_FORMULA_VERSION;
}
