/**
 * 线上探针：**满词条真人的档案，线上那个 sync-profile 收不收？**
 *
 * 用法：npm run probe:sync-profile
 *
 * ── 它验的是单测验不了的那一层 ──
 * `sync-profile` 在服务端复算战力之后会自查一次
 * （`isPlausibleCombatPower`，index.ts 第 213 行）：不通过就**返回 500 并记一条
 * 作弊证据**。玩家侧的表现是「档案永远同步不上去，每次打开排行榜都失败」。
 *
 * 单元测试用桩客户端，**证明不了线上那个打包产物里的 core 是哪一版**；
 * 而战力公式、上界、余量三者任何一个变了、或者哪个函数漏了重新部署，
 * 都会让这条自查在生产上翻脸。**只有真的打一次线上才知道。**
 *
 * 2026-08-01 实测背景：满词条真人 ÷ 上界，旧公式 2.07~2.36、新公式 1.30~1.50，
 * **两把尺下都越界** —— 也就是说这条探针**当前预期是失败的**。
 * 它不是「跑绿了就没事」的形式检查，是 HEADROOM 修好之后**验收它真的修好了**的量具。
 *
 * ── 安全边界 ──
 * · 它会用**匿名会话**在生产建一条档案，跑完**无论成败都删掉**（finally 保证）
 * · 只碰它自己建的那一行，用 id 精确定位，不按任何条件批量删
 * · 不改任何既有玩家数据，不部署，不改代码
 */

import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { EQUIPMENT } from '../src/data/equipment';
import {
  ENHANCE_GAIN_MAX,
  ENHANCE_MAX,
  EQUIPMENT_BASE_ROLL_MAX,
  QUALITY_AFFIX_COUNT,
  SLOT_ORDER,
} from '../src/data/constants';
import { affixValueRange, itemBaseValue, REGIONAL_BLANK_ID } from '../src/core/equipment';
import type { Affix, AffixKey, ClassId, EquipmentInstance, EquipSlot } from '../src/core/types';

const PROJECT_REF = 'rwtuhwizoohvwerqkhgb';
const URL = `https://${PROJECT_REF}.supabase.co`;
/** 探针档案的昵称：出问题时一眼能在库里认出来是谁留下的。 */
const PROBE_NAME = '小库探针-勿留';
const LEVEL = 81;
const CLASS: ClassId = 'swordsman';

/**
 * 每件装备的词条键，**按对 CP 的贡献排序，且必须互不重复**。
 *
 * ★ 这里最容易写错、我第一版就写错了：原本是「每槽塞满 N 条同一个键」。
 * `save/schema.ts:503~511` 规定**同一件装备上词条键不可重复**（含固定词条），
 * 所以那种装备**任何玩家都不可能拥有**，服务端直接 400 拒收 ——
 * 探针会红，但红的原因是构造非法，**不是线上有缺陷**。
 *
 * 而且方向还与直觉相反：新公式是 √(dps × ehp)，**几何平均奖励均衡**，
 * 所以合法的多键组合**比单键堆叠更强**（实测高 7% 左右）。
 * 也就是说单键构造既非法、又偏弱，两头都不对。
 */
const AFFIX_KEYS: readonly AffixKey[] = ['spd', 'atk', 'critDmg', 'critRate', 'hp', 'def'];

function strongestDef(slot: EquipSlot, level: number, classId: ClassId) {
  let floor = Number.POSITIVE_INFINITY;
  for (const d of Object.values(EQUIPMENT)) {
    if (!REGIONAL_BLANK_ID.test(d.id)) continue;
    if (d.classId !== undefined && d.classId !== classId) continue;
    if (d.level < floor) floor = d.level;
  }
  const anchor = Number.isFinite(floor) ? Math.max(level, floor) : level;
  let best: { def: (typeof EQUIPMENT)[string]; v: number } | null = null;
  for (const d of Object.values(EQUIPMENT)) {
    if (d.slot !== slot || d.level > anchor) continue;
    if (d.classId !== undefined && d.classId !== classId) continue;
    const v = itemBaseValue(d.level, d.quality);
    if (!best || v > best.v) best = { def: d, v };
  }
  return best?.def ?? null;
}

/** 该等级该职业**物理上能穿到的最强一套 + 满词条** —— 一个合法但极限的真人。 */
function maxedRealBuild(): (EquipmentInstance | null)[] {
  return SLOT_ORDER.map((slot, i) => {
    const def = strongestDef(slot, LEVEL, CLASS);
    if (!def) return null;
    // ★ 可填的随机词条数 = 品质容量 − **装备定义自带的固定词条**（schema.ts:461）。
    // 而且随机键不能与固定键重复。只按 QUALITY_AFFIX_COUNT 塞满会撞
    // 「随机词条超过品质剩余容量」而被 400 拒 —— 我连撞两次才查清这一条。
    const fixedKeys = new Set((def.fixedAffixes ?? []).map((a) => a.key));
    const room = QUALITY_AFFIX_COUNT[def.quality] - fixedKeys.size;
    const affixes: Affix[] = AFFIX_KEYS.filter((k) => !fixedKeys.has(k))
      .slice(0, Math.max(0, room))
      .map((key) => ({
        key,
        // 词条值随**装备等级**缩放，不是角色等级
        value: affixValueRange(key, def.level, 5).max,
        tier: 5 as const,
      }));
    return {
      uid: `probe-${i}`,
      defId: def.id,
      enhance: ENHANCE_MAX,
      baseRollPermille: EQUIPMENT_BASE_ROLL_MAX,
      enhanceGainPermille: Array<number>(ENHANCE_MAX).fill(ENHANCE_GAIN_MAX),
      enhanceLuck: {},
      affixes,
      reforgeResonance: 0,
      locked: false,
    };
  });
}

function anonKey(): string {
  const raw = execFileSync(
    'npx',
    ['supabase', 'projects', 'api-keys', '--project-ref', PROJECT_REF, '-o', 'json'],
    { encoding: 'utf8', shell: true, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const keys = JSON.parse(raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1)) as {
    name: string;
    api_key: string;
  }[];
  const anon = keys.find((k) => k.name === 'anon');
  if (!anon) throw new Error('取不到 anon key');
  return anon.api_key;
}

const client = createClient(URL, anonKey());
const { data: session, error: signInError } = await client.auth.signInAnonymously();
if (signInError || !session.user) {
  console.error('匿名登录失败：', signInError?.message);
  process.exit(1);
}
const userId = session.user.id;

let exitCode = 0;
try {
  console.log(`\n线上探针 · sync-profile 收不收满词条真人\n`);
  console.log(`  构造：Lv${LEVEL} ${CLASS}，每槽最强件 + 全 +${ENHANCE_MAX} + 满掷 ${EQUIPMENT_BASE_ROLL_MAX} + 每件 T5 多键不重复 ${AFFIX_KEYS.slice(0,3).join('/')}…`);
  console.log(`  探针 user = ${userId}\n`);

  const { data, error } = await client.functions.invoke('sync-profile', {
    body: {
      displayName: PROBE_NAME,
      classId: CLASS,
      level: LEVEL,
      equipped: maxedRealBuild(),
    },
  });

  const body = data as { error?: string; combatPower?: number; level?: number } | null;

  // ★ 必须读出服务端的真实状态码与原因：supabase-js 的 error.message 只会说
  // 「non-2xx」，而 400（装备/词条校验没过 ⇒ **我的构造不合法**）与
  // 500（上界自查没过 ⇒ **真人被误伤**）含义完全相反。
  // 分不清就会把「探针写错了」误报成「线上有缺陷」。
  let status = 0;
  let reason = body?.error ?? '';
  const ctx = (error as { context?: unknown } | null)?.context;
  if (ctx instanceof Response) {
    status = ctx.status;
    try {
      reason = ((await ctx.clone().json()) as { error?: string })?.error ?? reason;
    } catch {
      reason = (await ctx.clone().text()).slice(0, 200) || reason;
    }
  }
  const serverError = error ?? (body?.error ? new Error(body.error) : null);

  if (serverError) {
    console.log(`  ✗ 被拒：HTTP ${status || '?'} — ${reason || serverError.message}`);
    if (status === 500) {
      console.log(`\n★ 是上界自查拦的（index.ts:213）：**一个合法真人被判成物理不可能**。`);
      console.log(`  他的档案会永远同步不上去，且每次重试再记一条作弊证据。HEADROOM 需要修。\n`);
    } else {
      console.log(`\n⚠ 不是 500 ⇒ **不是上界拦的**，多半是探针构造本身不合法`);
      console.log(`  （装备等级 / 职业 / 词条值校验）。先修探针，别当成线上缺陷上报。\n`);
    }
    exitCode = 1;
  } else {
    console.log(`  ✓ 收下了：战力 ${body?.combatPower}，等级 ${body?.level}`);
    const { data: row } = await client
      .from('profiles')
      .select('level, combat_power, cp_formula_version')
      .eq('id', userId)
      .maybeSingle();
    console.log(`  ✓ 落库：${JSON.stringify(row)}`);
    console.log(`\n★ 满词条真人不会被上界误伤。\n`);
  }
} finally {
  // 无论成败都清理：探针绝不能在生产里留下一行。
  const { error: delError } = await client.from('profiles').delete().eq('id', userId);
  const { count } = await client
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('id', userId);
  if (delError || (count ?? 0) > 0) {
    console.error(`\n⚠⚠ 探针档案未能删除（id=${userId}）——请手工删除，别留在生产里。`);
    exitCode = 1;
  } else {
    console.log(`已清理探针档案（id=${userId}），复查残留 0。`);
  }
}
process.exit(exitCode);
