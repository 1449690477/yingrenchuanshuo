import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  RULES_START,
  RULES_END,
  CLAIMS_START,
  CLAIMS_END,
  resolveChatRoot,
  normalizeClaimFiles,
  ruleLines,
  auditDoc,
} from './chat-core.mjs';

const CHAT_DOC_NAME = '34-协作聊天室.md';

function createChatDoc(root) {
  const docs = path.join(root, 'docs');
  fs.mkdirSync(docs, { recursive: true });
  fs.writeFileSync(path.join(docs, CHAT_DOC_NAME), '# test\n', 'utf8');
}

test('主工作树直接使用自己的聊天室', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-main-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.git'));
  createChatDoc(root);

  assert.equal(resolveChatRoot(root), root);
});

test('linked worktree 通过 commondir 使用主工作树聊天室', (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-linked-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const mainRoot = path.join(base, 'main');
  const linkedRoot = path.join(base, 'linked');
  const worktreeGitDir = path.join(mainRoot, '.git', 'worktrees', 'linked');
  fs.mkdirSync(worktreeGitDir, { recursive: true });
  fs.mkdirSync(linkedRoot, { recursive: true });
  createChatDoc(mainRoot);
  fs.writeFileSync(path.join(worktreeGitDir, 'commondir'), '../..\n', 'utf8');
  fs.writeFileSync(
    path.join(linkedRoot, '.git'),
    `gitdir: ${path.relative(linkedRoot, worktreeGitDir)}\n`,
    'utf8',
  );

  assert.equal(resolveChatRoot(linkedRoot), mainRoot);
});

test('损坏的 linked worktree 不得静默退回独立聊天室', (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-broken-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const linkedRoot = path.join(base, 'linked');
  const worktreeGitDir = path.join(base, 'main', '.git', 'worktrees', 'linked');
  fs.mkdirSync(worktreeGitDir, { recursive: true });
  fs.mkdirSync(linkedRoot, { recursive: true });
  fs.writeFileSync(path.join(linkedRoot, '.git'), `gitdir: ${worktreeGitDir}\n`, 'utf8');

  assert.throws(() => resolveChatRoot(linkedRoot), /拒绝退回本地聊天室/);
});

test('非 Git 副本保持原有本地聊天室行为', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-copy-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.equal(resolveChatRoot(root), root);
});

test('claim 参数统一逗号、顿号、反斜杠并去重', () => {
  assert.deepEqual(
    normalizeClaimFiles(['src/a.ts,src/b.ts', 'src\\c.ts、src/a.ts', '，src/d.ts，']),
    ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts'],
  );
  assert.throws(() => normalizeClaimFiles(['C:/repo/a.ts']), /仓库相对路径/);
  assert.throws(() => normalizeClaimFiles(['src/**/*.ts']), /不能使用通配符/);
  assert.throws(() => normalizeClaimFiles(['scripts']), /不能占用目录/);
});

function rulesBlock(count = 14) {
  return `${RULES_START}\n${Array.from({ length: count }, (_, index) => `${index + 1}. rule`).join('\n')}\n${RULES_END}`;
}

test('权威规则区必须恰好 14 条', () => {
  const valid = `${rulesBlock()}\n${CLAIMS_START}\n## 当前文件占用\n${CLAIMS_END}`;
  assert.equal(ruleLines(valid).length, 14);
  assert.deepEqual(auditDoc(valid).errors, []);

  const invalid = `${rulesBlock(13)}\n${CLAIMS_START}\n## 当前文件占用\n${CLAIMS_END}`;
  assert.match(auditDoc(invalid).errors.join('\n'), /当前 13 条/);
});

test('doctor 审计能发现重复占用并兼容旧式逗号分隔', () => {
  const doc = `${rulesBlock()}\n${CLAIMS_START}\n## 当前文件占用\n- **小甲**: src/a.ts,src/b.ts\n- **小乙**: src/a.ts\n${CLAIMS_END}`;
  const audit = auditDoc(doc);
  assert.match(audit.errors.join('\n'), /src\/a\.ts 被重复占用/);
  assert.match(audit.warnings.join('\n'), /旧式逗号分隔/);
});

function runLockWorker(file) {
  const moduleUrl = new URL('./chat-core.mjs', import.meta.url).href;
  const code = `
    import fs from 'node:fs';
    import { withFileLock } from ${JSON.stringify(moduleUrl)};
    const file = ${JSON.stringify(file)};
    withFileLock(file, () => {
      const value = Number(fs.readFileSync(file, 'utf8'));
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
      fs.writeFileSync(file, String(value + 1), 'utf8');
    });
  `;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', code], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`lock worker ${code}: ${stderr}`)),
    );
  });
}

test('八个并发进程写同一文件不会丢更新', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-lock-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const counter = path.join(root, 'counter.txt');
  fs.writeFileSync(counter, '0', 'utf8');

  await Promise.all(Array.from({ length: 8 }, () => runLockWorker(counter)));

  assert.equal(fs.readFileSync(counter, 'utf8'), '8');
});
