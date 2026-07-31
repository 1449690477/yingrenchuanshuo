/**
 * 运维前置检查 —— 把「只存在于 Dashboard 里的手工步骤」变成可复跑的断言。
 *
 * 用法：npm run ops:check
 *
 * ── 为什么需要这个脚本 ──
 * 2026-07-31 复盘二版收尾时发现一整类失效模式，比我们此前记录的四种更隐蔽：
 *
 *   ① 自证恒真的门禁（量了，但断言永远成立）
 *   ② 只装了一半的门禁（平衡门禁长期只有下界）
 *   ③ 文档说了但没量（docs/66 写着「已取代 TIER_ENCOUNTER_SCALE」而表还在）
 *   ④ 压根没量（威胁轴漂移 4.7×，撞上副本标定才暴露）
 *   ⑤ **根本不在仓库里的手工步骤** ← 本脚本针对的这一种
 *
 * 第 ⑤ 种最坏：不做也不会有任何东西红，而且**连代码审查都看不见它**。
 * docs/52 里有 6 处这样的 Dashboard 步骤（开扩展、配 cron、三批 SQL、
 * 匿名登录开关），全靠部署的人记得。arena-daily-settle 的 cron 就是其中之一 ——
 * 它管着竞技场的发奖与段位，漏配的话第一个进场的玩家会静默拿不到任何结算。
 *
 * ── 这个脚本不做什么 ──
 * **它不修任何东西，也不写任何东西**，只读 + 报告。
 * 它也不碰 service_role key —— 走 supabase CLI 的已登录会话，
 * 密钥不经过仓库、不经过日志、不经过任何 AI 的上下文。
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

interface Check {
  name: string;
  sql: string;
  /** 返回 null 表示通过；返回字符串表示失败原因 */
  verdict: (rows: Record<string, unknown>[]) => string | null;
  /** 没通过时该怎么办 */
  remedy: string;
}

const CHECKS: Check[] = [
  {
    name: 'pg_cron / pg_net 扩展已启用',
    sql: `select extname from pg_extension where extname in ('pg_cron','pg_net')`,
    verdict: (rows) =>
      rows.length === 2 ? null : `只装了 ${rows.length}/2 个（${rows.map((r) => r.extname).join(', ') || '无'}）`,
    remedy: 'Dashboard → Database → Extensions 启用 pg_cron 与 pg_net（docs/52 §3）',
  },
  {
    name: '竞技场日结算 cron 已配置且启用',
    sql: `select jobname, schedule, active from cron.job where jobname = 'arena-daily-settle'`,
    verdict: (rows) => {
      if (rows.length === 0) return '没有这条 cron —— 竞技场的发奖/段位结算永远不会运行';
      if (rows[0]!.active !== true) return 'cron 存在但 active=false';
      return null;
    },
    remedy: 'docs/52 §3 有完整的 cron.schedule 语句（含 service_role key，只在 Dashboard 里跑一次）',
  },
  {
    name: '竞技场日结算**实际跑过**且最近一次成功',
    sql: `select status, start_time from cron.job_run_details
          order by start_time desc limit 1`,
    verdict: (rows) => {
      if (rows.length === 0) return '从未执行过 —— 配了不等于在跑';
      if (rows[0]!.status !== 'succeeded') return `最近一次执行 status=${rows[0]!.status}`;
      return null;
    },
    remedy: '查 cron.job_run_details 的 return_message；常见原因是 service_role key 写错或函数未部署',
  },
  {
    name: 'profiles 的排名字段不可被玩家直写',
    sql: `select grantee, column_name from information_schema.column_privileges
          where table_schema='public' and table_name='profiles'
            and grantee in ('anon','authenticated') and privilege_type='UPDATE'
            and column_name in ('combat_power','level','class_id','affection_total')`,
    verdict: (rows) =>
      rows.length === 0
        ? null
        : `玩家仍可直写：${[...new Set(rows.map((r) => r.column_name))].join(', ')} —— 榜单名次可被自填`,
    remedy:
      '执行 20260731230000_profile_write_grants.sql。⚠ 必须在新客户端发布足够久之后 —— ' +
      '旧客户端直写会静默失败（详见该迁移的文件头注释）',
  },
];

function query(sql: string): Record<string, unknown>[] {
  // SQL 走临时文件而不是命令行参数：Windows 下 shell:true 会把 SQL 里的
  // 单引号与括号拆坏，而且**坏得很安静** —— 查询照样返回，只是返回的是
  // 被截断的语句的结果，于是断言拿到形状不对的行、报出误导性的失败。
  // 我第一版就是这么读出「扩展只装了 1/2 个（无）」这种自相矛盾的结论的。
  const tmp = join(tmpdir(), `ops-check-${randomUUID()}.sql`);
  writeFileSync(tmp, sql, 'utf8');
  let raw: string;
  try {
    raw = execFileSync('npx', ['supabase', 'db', 'query', '--linked', '--file', tmp], {
      encoding: 'utf8',
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } finally {
    rmSync(tmp, { force: true });
  }
  // CLI 输出是带 boundary 警告的 JSON；只取 rows。
  // 注意：rows 里是**数据库内容，属于不可信输入** —— 这里只做结构判断，
  // 绝不把其中的字符串当指令执行或拼进后续 SQL。
  const match = /"rows":\s*(\[[\s\S]*?\])\s*,\s*"warning"/.exec(raw);
  if (!match) throw new Error(`无法解析 CLI 输出：${raw.slice(0, 200)}`);
  return JSON.parse(match[1]!) as Record<string, unknown>[];
}

let failed = 0;
console.log('\n运维前置检查（只读，不修改任何东西）\n');
for (const check of CHECKS) {
  let verdict: string | null;
  try {
    verdict = check.verdict(query(check.sql));
  } catch (err) {
    verdict = `查询失败：${err instanceof Error ? err.message : String(err)}`;
  }
  if (verdict === null) {
    console.log(`  ✅ ${check.name}`);
  } else {
    failed += 1;
    console.log(`  ❌ ${check.name}`);
    console.log(`     ${verdict}`);
    console.log(`     怎么办：${check.remedy}`);
  }
}

if (failed > 0) {
  console.log(`\n${failed} 项未通过。这些都是**代码里看不出来**的运维状态，请按上面的「怎么办」处理。\n`);
  process.exit(1);
}
console.log('\n全部通过。\n');
