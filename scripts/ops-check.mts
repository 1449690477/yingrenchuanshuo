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
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { CP_FORMULA_VERSION } from '../src/core/cpFormulaVersion.ts';
import { TRIAL_FORMULA_VERSION } from '../src/core/trialFormulaVersion.ts';

const PROJECT_REF = 'rwtuhwizoohvwerqkhgb';

function assertLinkedProject(): void {
  const linkedRef = readFileSync('supabase/.temp/project-ref', 'utf8').trim();
  if (linkedRef !== PROJECT_REF) {
    throw new Error(
      `Supabase 链接目标错误：期望 ${PROJECT_REF}，实际 ${linkedRef || '未链接'}`,
    );
  }
}

assertLinkedProject();

interface Check {
  name: string;
  sql: string;
  /** 返回 null 表示通过；返回字符串表示失败原因 */
  verdict: (rows: Record<string, unknown>[]) => string | null;
  /** 没通过时该怎么办 */
  remedy: string;
}

/** sync-profile 的上次部署时刻（毫秒）—— 用作「本次发车之后」的时间锚点。 */
const SYNC_PROFILE_DEPLOYED_MS = (() => {
  try {
    const raw = execFileSync(
      'npx',
      ['supabase', 'functions', 'list', '--project-ref', PROJECT_REF, '-o', 'json'],
      { encoding: 'utf8', shell: true, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const fns = JSON.parse(raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1)) as {
      slug: string;
      updated_at: number;
    }[];
    return fns.find((f) => f.slug === 'sync-profile')?.updated_at ?? 0;
  } catch {
    // 取不到就退化成 0（= 检查全表），宁可多报不漏报。
    return 0;
  }
})();

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
  {
    // 这一条守的是**顺序**，方向与上一条正好相反，别照上一条的直觉理解。
    // 上一条（收权限）晚做才安全；这一条（加列）**早做才安全**：
    // 新客户端的 fetchPowerTop 会 select 并 eq 这一列，列不存在时 PostgREST
    // 返回 42703，玩家看到「战力榜读取失败」——**整张榜打不开**，不是少几行。
    // 而这个失败**只在真实浏览器里出现**：单元测试用桩客户端，永远是绿的。
    name: '战力公式版本戳列已就位（必须早于新客户端发布）',
    sql: `select column_name, column_default, is_nullable
            from information_schema.columns
           where table_schema='public' and table_name='profiles'
             and column_name='cp_formula_version'`,
    verdict: (rows) => {
      if (rows.length === 0) {
        return '列不存在 —— 一旦发布读它的客户端，战力榜会整张打不开（PostgREST 42703）';
      }
      if (rows[0]!.is_nullable !== 'NO') return '列可空 —— null 版本无法参与「当前版本」判定';
      return null;
    },
    remedy:
      '执行 20260801040000_cp_formula_version.sql。⚠ 顺序与上一条相反：' +
      '本迁移必须**先于** sync-profile 部署与新客户端发布（详见该迁移文件头顶部）',
  },
  {
    // 版本戳的可信度**整个建立在「profiles 没有表级写授权」这一条上**
    // （见上一条检查）。这里查的是另一半：库里有没有出现无法解释的版本号。
    // 只应存在「当前版本」与「更旧的历史版本」；**比代码还新的版本号只可能来自伪造**
    // ——客户端拿不到未来的公式。这条为零成本，出现即为强信号。
    name: 'profiles 里没有比服务端更新的公式版本号',
    // 用 to_jsonb 取键而不是直接引用列名：**列还不存在时，缺键返回 null 而不是报错**。
    // 直接写 select cp_formula_version 会让这一条在迁移落地前抛 42703，
    // 于是本该由上一条负责报告的「列不存在」，在这里变成一句语焉不详的
    // 「查询失败」加一段驴唇不对马嘴的补救建议 —— 一个失败伪装成另一个失败。
    sql: `select max((to_jsonb(p) ->> 'cp_formula_version')::int) as v
            from public.profiles p`,
    verdict: (rows) => {
      const raw = rows[0]?.v;
      if (raw === null || raw === undefined) return null; // 列还没建，由上一条负责报
      const max = Number(raw);
      return max > CP_FORMULA_VERSION
        ? `出现版本 ${max}，而服务端当前是 ${CP_FORMULA_VERSION} —— ` +
            '要么有人漏了 edge:build/重部署，要么表级写授权被恢复了'
        : null;
    },
    remedy:
      '先查 information_schema.column_privileges 确认玩家写不了这一列；' +
      '再确认 12 个 Edge Function 都用当前 core 重打包并部署过（npm run edge:build）',
  },
  {
    name: '试炼公式版本戳列已就位（必须早于新版榜单）',
    sql: `select column_name, column_default, is_nullable
            from information_schema.columns
           where table_schema='public' and table_name='trial_scores'
             and column_name='trial_formula_version'`,
    verdict: (rows) => {
      if (rows.length === 0) return '列不存在 —— 新旧试炼成绩仍会混在同一榜单';
      if (rows[0]!.is_nullable !== 'NO') return '列可空 —— 无法可靠隔离历史公式成绩';
      return null;
    },
    remedy:
      '依次执行 20260801060000_trial_formula_version.sql 与 ' +
      '20260801070000_trial_formula_version_isolation.sql，再部署 submit-trial 和客户端',
  },
  {
    name: '试炼榜唯一键包含公式版本',
    sql: `select pg_get_constraintdef(oid) as definition
            from pg_constraint
           where conrelid='public.trial_scores'::regclass
             and conname='trial_scores_user_season_week_bracket_formula_key'`,
    verdict: (rows) => {
      if (rows.length !== 1) return '缺少版本化唯一约束 —— v1 成绩仍可能阻止新版成绩写入';
      const definition = String(rows[0]!.definition ?? '');
      return definition.includes('trial_formula_version')
        ? null
        : `唯一约束未含 trial_formula_version：${definition}`;
    },
    remedy: '执行 20260801070000_trial_formula_version_isolation.sql',
  },
  {
    name: '新旧试炼邻域榜 RPC 均存在',
    sql: `select proname from pg_proc
           where pronamespace='public'::regnamespace
             and proname in ('trial_neighborhood','trial_neighborhood_versioned')`,
    verdict: (rows) => {
      const names = new Set(rows.map((row) => String(row.proname)));
      const missing = ['trial_neighborhood', 'trial_neighborhood_versioned'].filter(
        (name) => !names.has(name),
      );
      return missing.length === 0 ? null : `缺少 RPC：${missing.join(', ')}`;
    },
    remedy: '执行 20260801070000_trial_formula_version_isolation.sql',
  },
  {
    name: 'trial_scores 里没有比服务端更新的公式版本号',
    sql: `select max((to_jsonb(t) ->> 'trial_formula_version')::int) as v
            from public.trial_scores t`,
    verdict: (rows) => {
      const raw = rows[0]?.v;
      if (raw === null || raw === undefined) return null;
      const max = Number(raw);
      return max > TRIAL_FORMULA_VERSION
        ? `出现版本 ${max}，而服务端当前是 ${TRIAL_FORMULA_VERSION}`
        : null;
    },
    remedy:
      '停止发布并核对 submit-trial 的真实部署版本；成绩版本由服务端生成，不能出现未来值',
  },
  {
    // ★ 版本戳的写入点不止一个，这一条抓「写了值却没更新戳」的那些。
    //
    // 2026-08-01 实查：**五个** Edge Function 会写 profiles.combat_power ——
    // submit-trial / submit-progress / arena-snapshot / arena-challenge /
    // guild-expedition —— 而当时只有 sync-profile 会同时写 cp_formula_version。
    // 我加版本戳时以为 sync-profile 是唯一写入点，**没有 grep 全部函数就下了结论**。
    //
    // 症状是安全那一侧（该显示的没显示，而不是不可比的数字混进排名），
    // 所以它不会自己暴露出来 —— 玩家只是从榜上消失，没有任何东西会红。
    // 判据：**一行的 updated_at 晚于 sync-profile 的上次部署时刻，戳却不是当前版本**
    // ⇒ 它被某条不打戳的路径写过。部署时刻由脚本自己从线上取，不手写。
    name: '所有写入点都更新了公式版本戳',
    sql: `select count(*) as n from public.profiles
           where cp_formula_version <> ${CP_FORMULA_VERSION}
             and updated_at > (timestamp 'epoch' + ${SYNC_PROFILE_DEPLOYED_MS} / 1000 * interval '1 second')`,
    verdict: (rows) => {
      const n = Number(rows[0]?.n ?? 0);
      return n === 0
        ? null
        : `${n} 行在本次部署之后被写过，但版本戳仍不是 ${CP_FORMULA_VERSION} —— ` +
            '说明有写入点只写了 combat_power 没写戳，那些玩家会从榜上消失';
    },
    remedy:
      '给这五个函数的 progress 对象补 cp_formula_version（写法抄 sync-profile），' +
      '并从各自的 _core-entry 导出该常量；改完 npm run edge:build 并重新部署',
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
