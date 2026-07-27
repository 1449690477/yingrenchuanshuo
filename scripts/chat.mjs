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
 */
import {
  readDoc,
  parseClaims,
  messageLines,
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
  console.log(renderClaims(claims));
  console.log('\n═══ 最近消息 ═══');
  console.log(msgs.length ? msgs.slice(-15).join('\n') : '  （还没有消息，来发第一条吧）');
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
    console.log(mine.length === 0 ? `${name} 当前没有占用任何文件。` : `${name} 并没有占用这些文件，无需释放。`);
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
  default:
    die(`未知命令 "${cmd}"。可用：board / say / claim / release / log（详见 docs/34-协作聊天室.md）`);
}
