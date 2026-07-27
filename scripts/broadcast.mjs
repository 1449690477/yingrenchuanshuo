#!/usr/bin/env node
/**
 * 聊天室消息广播服务 —— 监听聊天室，检测到 @all / @某AI 时自动把消息
 * 发送到对应的 AI 桌面窗口（激活窗口 → 粘贴 → 回车提交）。
 *
 * 用法：
 *   npm run broadcast                 前台运行（看日志）
 *   node scripts/broadcast.mjs        同上
 *
 * 前提：聊天室服务已启动（npm run chat:ui，默认端口 5200）
 *
 * 触发方式：在聊天室网页发消息——
 *   @all 大家开始做第3块          → 广播给所有启用的 AI 窗口
 *   @cursor 你接战斗动作          → 只发给 Cursor
 *   @claude @kimi 你们配合一下    → 发给 Claude 和 Kimi
 *   普通消息（不带 @）            → 只记录在聊天室，不广播
 *
 * 配置见 scripts/broadcast.config.json
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, 'broadcast.config.json');
const PS_SCRIPT = path.join(__dirname, 'broadcast-send.ps1');

// ── 加载配置 ────────────────────────────────────────────
let config;
try {
  config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
} catch (e) {
  console.error(`✗ 无法读取配置 ${CONFIG_PATH}: ${e.message}`);
  process.exit(1);
}

const API_URL = config.apiUrl || 'http://localhost:5200/api/state';
const WS_URL = config.wsUrl || (config.apiUrl || 'http://localhost:5200/api/state').replace(/^http/, 'ws').replace(/\/api\/state$/, '/ws');
const POLL_MS = config.pollMs || 2000; // WebSocket 断线时的轮询兜底
const BROADCAST_KW = config.broadcastKeyword || 'all';
const BLOCK_LIST = (config.senderBlockList || []).map((s) => s.toLowerCase());
const TEMPLATE = config.messageTemplate || '[聊天室 {name}]: {text}';
// 循环模式开关，glm 预留待接入；加下划线是为了通过 no-unused-vars（见 eslint.config.js）
const _LOOP_MODE = config.loopMode || false;
const ENABLED_TARGETS = config.targets.filter((t) => t.enabled);

if (ENABLED_TARGETS.length === 0) {
  console.error('✗ 配置里没有启用的目标窗口，请编辑 broadcast.config.json');
  process.exit(1);
}

// ── 状态 ────────────────────────────────────────────────
let lastMsgCount = 0;
let initialized = false;
let ws = null;
let wsReconnectTimer = null;
// 防死循环：记录最近 30 秒内处理过的消息指纹
const recentMsgs = new Map(); // fingerprint → timestamp
const DEDUP_WINDOW_MS = 30_000;

function nowTs() {
  return new Date().toLocaleTimeString('zh-CN');
}

// ── 初始化：获取当前消息数（不触发广播）────────────────
async function init() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    lastMsgCount = (data.messages || []).length;
    initialized = true;
    console.log(`\n═══════════════════════════════════════════════════`);
    console.log(`  聊天室广播服务已就绪`);
    console.log(`═══════════════════════════════════════════════════`);
    console.log(`  WebSocket: ${WS_URL}`);
    console.log(`  轮询兜底: ${API_URL} (${POLL_MS}ms)`);
    console.log(`  监听目标: ${ENABLED_TARGETS.map((t) => t.name).join(' / ')}`);
    console.log(`  触发方式: "@${BROADCAST_KW} 消息" 广播所有人 / "@cursor 消息" 定向`);
    console.log(`  已有 ${lastMsgCount} 条历史消息（不触发广播）`);
    console.log(`═══════════════════════════════════════════════════\n`);
    console.log(`  等待新消息... (Ctrl+C 退出)\n`);
  } catch (e) {
    console.error(`✗ 初始化失败: ${e.message}`);
    console.error(`  请确认聊天室服务已启动: npm run chat:ui`);
  }
}

// ── WebSocket 连接 ──────────────────────────────────────
function connectWS() {
  try {
    ws = new WebSocket(WS_URL);
  } catch {
    // Node 版本不支持原生 WebSocket 时，回退到轮询
    console.log(`[${nowTs()}] WebSocket 不可用，回退到轮询模式 (${POLL_MS}ms)`);
    setInterval(poll, POLL_MS);
    return;
  }

  ws.addEventListener('open', () => {
    console.log(`[${nowTs()}] ✓ WebSocket 已连接`);
    if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }
  });

  ws.addEventListener('message', async (event) => {
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    if (data.kind === 'state' && Array.isArray(data.messages)) {
      await onMessages(data.messages);
    } else if (data.kind === 'ping') {
      // 应用级心跳应答
      try { ws.send(JSON.stringify({ kind: 'pong' })); } catch {}
    }
  });

  ws.addEventListener('close', () => {
    console.log(`[${nowTs()}] WebSocket 断开，5 秒后重连...`);
    scheduleReconnect();
  });

  ws.addEventListener('error', () => {
    // error 事件后通常会跟 close，不重复打印
  });
}

function scheduleReconnect() {
  if (wsReconnectTimer) return;
  wsReconnectTimer = setTimeout(() => {
    wsReconnectTimer = null;
    connectWS();
  }, 5000);
}

// ── 轮询兜底（WebSocket 断开时使用）────────────────────
async function poll() {
  if (ws && ws.readyState === WebSocket.OPEN) return; // WS 正常时不轮询
  try {
    const res = await fetch(API_URL);
    if (!res.ok) return;
    const data = await res.json();
    await onMessages(data.messages || []);
  } catch {
    // 静默失败，避免刷屏
  }
}

// ── 处理消息列表（去重 + 检测新增）──────────────────────
async function onMessages(msgs) {
  if (!initialized) return;

  if (msgs.length > lastMsgCount) {
    const newMsgs = msgs.slice(lastMsgCount);
    lastMsgCount = msgs.length;
    for (const msg of newMsgs) {
      await handleNewMessage(msg);
    }
  } else if (msgs.length < lastMsgCount) {
    lastMsgCount = msgs.length; // 消息被清空/重建
  }
}

// ── 处理单条新消息 ──────────────────────────────────────
async function handleNewMessage(msg) {
  // 1. 黑名单：不转发这些发送者的消息
  if (BLOCK_LIST.some((name) => msg.name.toLowerCase().includes(name))) {
    return;
  }

  // 2. 去重：30 秒内相同内容不重复分发
  const fp = `${msg.name}:${msg.text}`;
  const now = Date.now();
  if (recentMsgs.has(fp) && now - recentMsgs.get(fp) < DEDUP_WINDOW_MS) {
    return;
  }
  recentMsgs.set(fp, now);
  if (recentMsgs.size > 100) {
    for (const [k, t] of recentMsgs) if (now - t > DEDUP_WINDOW_MS) recentMsgs.delete(k);
  }

  // 3. 解析 @ 目标
  let targets = parseTargets(msg.text);

  // 4. 循环模式：没有明确 @ 目标时，自动广播给所有窗口（让 AI 互相激活）
  if (targets.length === 0 && config.loopMode) {
    targets = ENABLED_TARGETS;
    console.log(`\n[${nowTs()}] 🔄 循环模式：自动激活所有窗口`);
  }

  if (targets.length === 0) return;

  console.log(`\n[${nowTs()}] 📢 广播消息`);
  console.log(`  发送者: ${msg.name}`);
  console.log(`  内容: ${msg.text.substring(0, 80)}`);
  console.log(`  目标: ${targets.map((t) => t.name).join(' / ')}`);

  const text = formatMessage(msg);

  // 5. 串行分发（并行会互相抢焦点）
  for (const target of targets) {
    await dispatchToWindow(target, text);
  }
  console.log(`  ✅ 广播完成\n`);
}

// ── 解析消息里的 @ 目标 ─────────────────────────────────
function parseTargets(text) {
  const matched = [];

  // @all → 所有启用的目标
  const allRe = new RegExp(`@${BROADCAST_KW}\\b`, 'i');
  if (allRe.test(text)) return ENABLED_TARGETS;

  // @某AI → 定向
  for (const t of ENABLED_TARGETS) {
    const re = new RegExp(`@${escapeRegex(t.name)}\\b`, 'i');
    if (re.test(text)) matched.push(t);
  }
  return matched;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── 格式化消息 ──────────────────────────────────────────
function formatMessage(msg) {
  return TEMPLATE.replace(/\{name\}/g, msg.name)
    .replace(/\{text\}/g, msg.text)
    .replace(/\{type\}/g, msg.type || '');
}

// ── 调用 PowerShell 发送到窗口 ──────────────────────────
function dispatchToWindow(target, text) {
  const msgB64 = Buffer.from(text, 'utf8').toString('base64');

  // 用 -Command 方式调用，避免空字符串参数被命令行吞掉
  const psCommand = `& '${PS_SCRIPT.replace(/'/g, "''")}' -titleMatch '${target.titleMatch.replace(/'/g, "''")}' -focusKeys '${(target.focusKeys || '').replace(/'/g, "''")}' -submitKey '${(target.submitKey || '{ENTER}').replace(/'/g, "''")}' -msgBase64 '${msgB64}'`;

  try {
    const out = execFileSync('powershell', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-Command', psCommand,
    ], {
      encoding: 'utf8',
      timeout: 15000,
    }).trim();
    console.log(`  ✓ ${target.name.padEnd(10)} → ${out}`);
    return true;
  } catch (e) {
    const stderr = e.stderr ? e.stderr.trim() : e.message;
    console.log(`  ✗ ${target.name.padEnd(10)} → ${stderr}`);
    return false;
  }
}

// ── 启动 ────────────────────────────────────────────────
console.log('聊天室广播服务启动中...');
console.log(`  读取配置: ${CONFIG_PATH}`);

await init();
connectWS();
// 轮询兜底（WS 断线时自动接管）
setInterval(poll, POLL_MS);
