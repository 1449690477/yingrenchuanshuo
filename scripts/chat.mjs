#!/usr/bin/env node
/**
 * 协作聊天室 CLI —— 多 AI 同工作区的公共频道
 * 文档见 docs/34-协作聊天室.md。逻辑在 scripts/chat-core.mjs（与 HTTP 服务共用）。
 *
 * 用法：
 *   node scripts/chat.mjs                          看板：谁占着什么 + 最近消息
 *   node scripts/chat.mjs say <名字> [类型] <消息> 发消息（类型默认 聊天）
 *   node scripts/chat.mjs claim <名字> <文件...>   占用文件（冲突会拒绝）
 *   node scripts/chat.mjs release <名字> [文件...] 释放文件（不带文件名=全部释放）
 *   node scripts/chat.mjs log [n]                  只看最近 n 条消息（默认 20）
 *   node scripts/chat.mjs rules                    打印 14 条权威规则的一页执行版
 *   node scripts/chat.mjs doctor                   检查共享源、规则、占用与写锁
 *   node scripts/chat.mjs join <小名> <挂牌> [说明] 首次显名
 *   node scripts/chat.mjs boss <小名> <老板指令>    代播老板令
 */
import {
  ROOT,
  CHAT_ROOT,
  DOC,
  readDoc,
  parseClaims,
  parseMessages,
  messageLines,
  ruleLines,
  auditDoc,
  withFileLock,
  say as coreSay,
  claim as coreClaim,
  release as coreRelease,
  TYPES,
} from './chat-core.mjs';

function die(msg, code = 1) {
  console.error(`✗ ${msg}`);
  process.exit(code);
}

function renderClaims(claims) {
  if (claims.size === 0) return '  （无人占用任何文件）';
  const out = [];
  for (const [name, files] of claims) {
    out.push(`  ${name}:`);
    for (const f of files) out.push(`    - ${f}`);
  }
  return out.join('\n');
}

function cmdBoard(doc) {
  const claims = parseClaims(doc);
  const msgs = messageLines(doc);
  console.log('═══ 文件占用 ═══');
  console.log(`  数据源：${DOC}${ROOT === CHAT_ROOT ? '' : '（跨 worktree 共享）'}`);
  console.log(renderClaims(claims));
  console.log('\n═══ 最近消息 ═══');
  console.log(msgs.length ? msgs.slice(-15).join('\n') : '  （还没有消息，来发第一条吧）');
}

function cmdRules(doc) {
  const rules = ruleLines(doc);
  if (rules.length === 0) die('权威规则标记区缺失，请先修 docs/34-协作聊天室.md');
  console.log('═══ 协作规矩 · 一页执行版 ═══');
  console.log(rules.join('\n'));
}

function cmdDoctor(doc) {
  const audit = auditDoc(doc);
  console.log('═══ 聊天室自检 ═══');
  console.log(`✓ 当前工作树：${ROOT}`);
  console.log(`✓ 公共聊天室：${DOC}`);
  console.log(
    ROOT === CHAT_ROOT
      ? '✓ 当前位于 Git 主工作树，直接使用公共频道'
      : `✓ linked worktree 已指向公共根：${CHAT_ROOT}`,
  );
  try {
    withFileLock(DOC, () => true);
    console.log('✓ 跨进程写锁可获取并释放');
  } catch (err) {
    audit.errors.push(err.message);
  }
  console.log(`✓ 权威规则：${audit.ruleCount} 条`);
  console.log(`✓ 当前占用：${audit.claimCount} 个具体文件`);
  for (const warning of audit.warnings) console.warn(`! ${warning}`);
  if (audit.errors.length) {
    for (const error of audit.errors) console.error(`✗ ${error}`);
    die(`自检失败：${audit.errors.length} 项错误`);
  }
  console.log('✓ 自检通过');
}

function cmdJoin(doc, args) {
  const [name, plaque, ...descriptionParts] = args;
  if (!name || !plaque) die('用法：join <小名> <挂牌> [本轮说明]');
  if (!/^小[\p{Script=Han}A-Za-z0-9_-]{1,5}$/u.test(name)) {
    die('小名格式必须是「小X」，长度 2～6 字；小名固定，挂牌另填');
  }
  if (/[·。\s]/u.test(plaque)) die('挂牌请用一个短语，不要包含空格、「·」或句号');
  const claims = parseClaims(doc);
  if (claims.has(name)) die(`${name} 当前仍有文件占用，可能已有同名实例在飞；先查频道并解决撞名`);
  if (parseMessages(doc).some((message) => message.name === name)) {
    console.warn(`! 历史中已有 ${name}；仅当你是同一实例恢复工作时继续，否则必须换小名。`);
  }
  const description = descriptionParts.join(' ').trim();
  const text = `${name}·${plaque}${description ? `。本轮：${description}` : ''}`;
  coreSay(name, '显名', text);
  console.log(`✓ 已显名：${text}`);
}

function cmdBoss(args) {
  const [name, ...textParts] = args;
  const text = textParts.join(' ').trim();
  if (!name || !text) die('用法：boss <你的名字> <老板指令>');
  const body = text.startsWith('老板令：') ? text : `老板令：${text}`;
  coreSay(name, '决策', body);
  console.log(`✓ 已广播 【决策】${name}: ${body}`);
}

function cmdSay(args) {
  const [name, ...rest] = args;
  if (!name) die('用法：say <名字> [类型] <消息>');
  let type = '聊天';
  let textParts = rest;
  if (rest.length && TYPES.includes(rest[0])) {
    type = rest[0];
    textParts = rest.slice(1);
  }
  const text = textParts.join(' ').trim();
  try {
    const { type: t } = coreSay(name, type, text);
    console.log(`✓ 已发送 【${t}】${name}: ${text}`);
  } catch (err) {
    die(err.message);
  }
}

function cmdClaim(args) {
  const [name, ...files] = args;
  try {
    const { added } = coreClaim(name, files);
    if (added.length === 0) {
      console.log('这些文件你都已经占着了，无需重复 claim。');
      return;
    }
    console.log(`✓ ${name} 已占用：${added.join('、')}`);
  } catch (err) {
    if (err.conflicts) {
      for (const c of err.conflicts) console.error(`✗ ${c.file} 正被 ${c.owner} 占用`);
      die('有文件冲突，本次 claim 未生效。先去频道里沟通，或换个任务。');
    }
    die(err.message);
  }
}

function cmdRelease(args) {
  const [name, ...files] = args;
  if (!name) die('用法：release <名字> [文件...]（不带文件名=全部释放）');
  let result;
  try {
    result = coreRelease(name, files);
  } catch (err) {
    die(err.message);
  }
  const { released } = result;
  if (released.length === 0) {
    const claims = parseClaims(readDoc());
    const mine = claims.get(name) ?? [];
    console.log(
      mine.length === 0
        ? `${name} 当前没有占用任何文件。`
        : `${name} 并没有占用这些文件，无需释放。`,
    );
    return;
  }
  console.log(`✓ ${name} 已释放：${released.join('、')}`);
}

function cmdLog(doc, args) {
  const n = Number.parseInt(args[0] ?? '20', 10);
  if (Number.isNaN(n) || n <= 0) die('用法：log [正整数]');
  const msgs = messageLines(doc);
  console.log(msgs.length ? msgs.slice(-n).join('\n') : '（还没有消息）');
}

const [cmd = 'board', ...args] = process.argv.slice(2);
let doc;
try {
  doc = readDoc();
} catch (err) {
  die(err.message);
}
switch (cmd) {
  case 'board':
    cmdBoard(doc);
    break;
  case 'say':
    cmdSay(args);
    break;
  case 'claim':
    cmdClaim(args);
    break;
  case 'release':
    cmdRelease(args);
    break;
  case 'log':
    cmdLog(doc, args);
    break;
  case 'rules':
    cmdRules(doc);
    break;
  case 'doctor':
    cmdDoctor(doc);
    break;
  case 'join':
    cmdJoin(doc, args);
    break;
  case 'boss':
    cmdBoss(args);
    break;
  default:
    die(
      `未知命令 "${cmd}"。可用：board / rules / doctor / join / boss / say / claim / release / log（详见 docs/34-协作聊天室.md）`,
    );
}
