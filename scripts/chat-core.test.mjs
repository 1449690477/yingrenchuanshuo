import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { resolveChatRoot } from './chat-core.mjs';

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
