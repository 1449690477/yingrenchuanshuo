/**
 * 协作聊天室核心逻辑 —— CLI（chat.mjs）与 HTTP 服务（chat-server.mjs）共用。
 * 唯一数据源是 docs/34-协作聊天室.md：消息追加在文件末尾，
 * 文件占用看板由 markers 之间的区块维护。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHAT_DOC_NAME = '34-协作聊天室.md';

/**
 * linked worktree 的源码各有一份，但聊天室必须只有一份。
 * Git 在 linked worktree 的 `.git` 文件里记录管理目录，并通过 `commondir`
 * 指回主工作树的共享 `.git`；以它的父目录作为公共聊天室根目录。
 */
export function resolveChatRoot(localRoot) {
  const root = path.resolve(localRoot);
  const gitMarker = path.join(root, '.git');
  if (!fs.existsSync(gitMarker)) return root;

  const markerStat = fs.statSync(gitMarker);
  if (markerStat.isDirectory()) return root;
  if (!markerStat.isFile()) throw new Error(`无法识别 Git 元数据：${gitMarker}`);

  const marker = fs.readFileSync(gitMarker, 'utf8').trim();
  const match = marker.match(/^gitdir:\s*(.+)$/i);
  if (!match) throw new Error(`linked worktree 的 .git 文件格式无效：${gitMarker}`);

  const worktreeGitDir = path.resolve(root, match[1].trim());
  const commonDirFile = path.join(worktreeGitDir, 'commondir');
  if (!fs.existsSync(commonDirFile)) {
    throw new Error(`linked worktree 缺少 commondir，拒绝退回本地聊天室：${commonDirFile}`);
  }

  const commonDirRef = fs.readFileSync(commonDirFile, 'utf8').trim();
  if (!commonDirRef) throw new Error(`linked worktree 的 commondir 为空：${commonDirFile}`);
  const commonDir = path.resolve(worktreeGitDir, commonDirRef);
  if (path.basename(commonDir).toLowerCase() !== '.git') {
    throw new Error(`Git 公共目录不是标准 .git，无法定位唯一聊天室：${commonDir}`);
  }

  const sharedRoot = path.dirname(commonDir);
  const sharedDoc = path.join(sharedRoot, 'docs', CHAT_DOC_NAME);
  if (!fs.existsSync(sharedDoc)) {
    throw new Error(`Git 主工作树缺少公共聊天室文档：${sharedDoc}`);
  }
  return sharedRoot;
}

export const CHAT_ROOT = resolveChatRoot(ROOT);
export const DOC = path.join(CHAT_ROOT, 'docs', CHAT_DOC_NAME);
export const CLAIMS_START = '<!-- chat:claims:start -->';
export const CLAIMS_END = '<!-- chat:claims:end -->';
export const TYPES = ['显名', '进度', '占用', '释放', '求助', '决策', '预警', '聊天'];

const CLAIM_LINE = /^- \*\*(.+?)\*\*: (.*)$/;
const MSG_LINE = /^- \[(.+?)\] 【(.+?)】\*\*(.+?)\*\*：(.*)$/;

export function readDoc() {
  if (!fs.existsSync(DOC))
    throw new Error(`找不到 ${path.relative(CHAT_ROOT, DOC)}，聊天室文档不存在`);
  return fs.readFileSync(DOC, 'utf8');
}

export function now() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 解析看板区块 → Map<名字, string[]> */
export function parseClaims(doc) {
  const start = doc.indexOf(CLAIMS_START);
  const end = doc.indexOf(CLAIMS_END);
  const claims = new Map();
  if (start === -1 || end === -1) return claims;
  for (const line of doc.slice(start, end).split('\n')) {
    const m = line.trim().match(CLAIM_LINE);
    if (m)
      claims.set(
        m[1],
        m[2]
          .split('、')
          .map((s) => s.trim())
          .filter(Boolean),
      );
  }
  return claims;
}

/** 把占用状态写回看板区块（markers 之间的内容整体重建） */
export function writeClaims(doc, claims) {
  const start = doc.indexOf(CLAIMS_START);
  const end = doc.indexOf(CLAIMS_END);
  if (start === -1 || end === -1) throw new Error('文档里缺少占用看板标记，无法更新占用状态');
  const lines = [`## 当前文件占用`, ''];
  if (claims.size === 0) {
    lines.push('_当前无人占用任何文件。_');
  } else {
    for (const [name, files] of claims) lines.push(`- **${name}**: ${files.join('、')}`);
  }
  lines.push('', `_看板更新于 ${now()}_`);
  const block = `${CLAIMS_START}\n${lines.join('\n')}\n`;
  fs.writeFileSync(DOC, doc.slice(0, start) + block + doc.slice(end), 'utf8');
}

/** 追加一条消息到文件末尾 */
export function appendMessage(name, type, text) {
  // 一条消息必须占且只占一行。
  // messageLines() 只认 `- [20xx-` 开头的行，所以多行文本原样写入时，
  // 第二行起会被当成普通正文永远读不到 —— 消息写进去了却没人看得见。
  // 这里把换行折成「 / 」，长交接贴多行也不会丢内容。
  const single = String(text).replace(/\r?\n+/g, ' / ');
  fs.appendFileSync(DOC, `- [${now()}] 【${type}】**${name}**：${single}\n`, 'utf8');
}

/** 原始消息行（兼容旧行为） */
export function messageLines(doc) {
  return doc.split('\n').filter((l) => /^- \[20\d\d-/.test(l));
}

/** 结构化消息列表：[{ ts, type, name, text }] */
export function parseMessages(doc) {
  const out = [];
  for (const line of messageLines(doc)) {
    const m = line.match(MSG_LINE);
    if (m) out.push({ ts: m[1], type: m[2], name: m[3], text: m[4] });
  }
  return out;
}

/** 发消息。返回 { type } */
export function say(name, type, text) {
  if (!name) throw new Error('名字不能为空');
  const t = TYPES.includes(type) ? type : '聊天';
  const body = String(text ?? '').trim();
  if (!body) throw new Error('消息不能为空');
  appendMessage(name, t, body);
  return { type: t };
}

/** 占用文件。有冲突时抛出带 conflicts 属性的错误。 */
export function claim(name, files) {
  if (!name || !files?.length) throw new Error('用法：claim <名字> <文件...>（要具体到文件）');
  const doc = readDoc();
  const claims = parseClaims(doc);
  const conflicts = [];
  for (const [owner, owned] of claims) {
    if (owner === name) continue;
    for (const f of files) if (owned.includes(f)) conflicts.push({ file: f, owner });
  }
  if (conflicts.length) {
    const err = new Error(conflicts.map((c) => `${c.file} 正被 ${c.owner} 占用`).join('；'));
    err.conflicts = conflicts;
    throw err;
  }
  const mine = new Set(claims.get(name) ?? []);
  const added = files.filter((f) => !mine.has(f));
  if (added.length === 0) return { added: [] };
  for (const f of added) mine.add(f);
  claims.set(name, [...mine]);
  writeClaims(doc, claims);
  appendMessage(name, '占用', `占用了 ${added.join('、')}`);
  return { added };
}

/** 释放文件（不带文件名=全部释放）。 */
export function release(name, files) {
  if (!name) throw new Error('用法：release <名字> [文件...]');
  const doc = readDoc();
  const claims = parseClaims(doc);
  const mine = claims.get(name) ?? [];
  if (mine.length === 0) return { released: [] };
  let released;
  if (!files?.length) {
    released = mine;
    claims.delete(name);
  } else {
    const dropping = new Set(files);
    released = mine.filter((f) => dropping.has(f));
    const keep = mine.filter((f) => !dropping.has(f));
    if (keep.length) claims.set(name, keep);
    else claims.delete(name);
    if (released.length === 0) return { released: [] };
  }
  writeClaims(doc, claims);
  appendMessage(name, '释放', `释放了 ${released.join('、')}`);
  return { released };
}

/** 聚合当前状态（HTTP API / UI 用） */
export function getState() {
  const doc = readDoc();
  const claims = parseClaims(doc);
  const messages = parseMessages(doc);
  const members = new Map();
  for (const m of messages)
    if (!members.has(m.name)) members.set(m.name, { name: m.name, lastSeen: m.ts });
  for (const [name, files] of claims) {
    const mem = members.get(name) ?? { name, lastSeen: null };
    mem.files = files;
    members.set(name, mem);
  }
  return {
    now: now(),
    claims: [...claims.entries()].map(([name, files]) => ({ name, files })),
    messages,
    members: [...members.values()],
  };
}
