/**
 * 线上探针：部署后的 submit-trial 到底收不收 selectedActiveSkillIds 这个新字段？
 *
 * ── 为什么需要线上验这一条 ──
 * 载荷 schema 是 strict 的：多一个不认识的字段会被 **400 拒**，不是忽略。
 * 所以「服务端先能收、客户端才能发」这个顺序里，前半句必须在生产上被证明，
 * 单测证明不了线上那个打包产物是哪一版。
 *
 * ── 零写入设计 ──
 * 两次请求都带一个**结构合法但定义不存在**的装备，于是在 schema 之后、
 * 任何数据库写入之前就返回 400。对比两次的错误文案即可判定：
 *   · 对照组（不带新字段）  → 期望「装备定义不存在」
 *   · 实验组（带新字段）    → 若同样是「装备定义不存在」⇒ **字段被 schema 接受**
 *                            若变成「提交的搭配快照不合法」⇒ **字段被拒，部署没生效**
 * 有对照组才能把「字段被拒」和「这个请求本来就不合法」分开 ——
 * 只跑实验组的话，两种情况都是 400，看起来一模一样。
 */

import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const PROJECT_REF = 'rwtuhwizoohvwerqkhgb';

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

const client = createClient(`https://${PROJECT_REF}.supabase.co`, anonKey());
const { data: session, error: signInError } = await client.auth.signInAnonymously();
if (signInError || !session.user) {
  console.error('匿名登录失败：', signInError?.message);
  process.exit(1);
}

/**
 * 一件**真实存在**的武器 —— 但下面会把它放进第 2 个槽位。
 *
 * ★ 第一版探针用的是「定义不存在的装备」，结果对照组也被 schema 拒了：
 * `save/schema.ts` 的 superRefine **自己就查定义存在性**，所以未知 defId
 * 根本走不到 index.ts 的装备循环。改用「真装备放错槽」，
 * 那个检查（`def.slot !== SLOT_ORDER[i]`）才是真正在 schema 之后。
 */
const realWeapon = {
  uid: 'probe-1',
  defId: 'eq_r1_weapon_common',
  enhance: 0,
  baseRollPermille: 1000,
  // 必须正好 ENHANCE_MAX(15) 项 —— 空数组会被 schema 拒，我为此白打了两轮生产请求
  enhanceGainPermille: Array<number>(15).fill(125),
  enhanceLuck: {},
  affixes: [],
  reforgeResonance: 0,
  locked: false,
};

const basePayload = {
  seasonId: 's1',
  weekIndex: 0,
  bracketId: 'b_bud',
  classId: 'swordsman',
  level: 10,
  displayName: '小库探针',
  // 武器放进第 2 槽（本该是防具）⇒ 过得了 schema，会在 index.ts 的槽位校验处被拒
  equipped: [null, realWeapon, null, null, null, null, null, null],
};

async function call(label: string, payload: unknown): Promise<string> {
  const { data, error } = await client.functions.invoke('submit-trial', { body: payload });
  let reason = (data as { error?: string } | null)?.error ?? '';
  const ctx = (error as { context?: unknown } | null)?.context;
  if (ctx instanceof Response) {
    try {
      reason = ((await ctx.clone().json()) as { error?: string })?.error ?? reason;
    } catch {
      reason = (await ctx.clone().text()).slice(0, 120) || reason;
    }
    console.log(`  ${label}：HTTP ${ctx.status} — ${reason}`);
  } else {
    console.log(`  ${label}：无错误返回（意外）— ${JSON.stringify(data).slice(0, 120)}`);
  }
  return reason;
}

console.log('\n线上探针 · submit-trial 收不收 selectedActiveSkillIds\n');
const control = await call('对照组（不带新字段）', basePayload);
const experiment = await call('实验组（带新字段）', {
  ...basePayload,
  selectedActiveSkillIds: ['skill_swordsman_slash', 'skill_that_does_not_exist'],
});

console.log('');
if (experiment === control && control.includes('槽位')) {
  console.log('✓ 两组错误一致且都停在槽位校验 ⇒ **新字段已被 schema 接受**，部署生效。');
  console.log('  客户端现在可以开始发这个字段了。\n');
} else if (experiment.includes('不合法') && !control.includes('不合法')) {
  console.log('✗ 实验组被 schema 拒、对照组没有 ⇒ **线上仍是旧版本**，字段没生效。');
  console.log('  客户端此刻绝不能发这个字段，会直接提交失败。\n');
  process.exit(1);
} else {
  console.log(`⚠ 结果不属于任何预期分支，需人工判读：对照=[${control}] 实验=[${experiment}]\n`);
  process.exit(1);
}
