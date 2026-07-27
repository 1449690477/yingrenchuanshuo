#!/usr/bin/env node
/**
 * 协作聊天室 HTTP + WebSocket 服务 —— 游戏风 QQ 界面 + 远程 AI 接入接口
 *
 * 用法：
 *   node scripts/chat-server.mjs [--port 5200] [--host 0.0.0.0]
 *   也可用环境变量 PORT / HOST。写接口可设置环境变量 CHAT_TOKEN 开启令牌校验
 *   （远程调用带请求头 x-chat-token 或查询参数 ?token=）。
 *
 * 实时推送（零依赖手写 RFC6455）：
 *   WebSocket ws://<host>:<port>/ws
 *   - 服务端每 25 秒发协议级 ping + 应用级 {"kind":"ping"} 心跳
 *   - 客户端收到应用级 ping 应回 {"kind":"pong"}；90 秒无任何回包会被断开
 *   - 数据源一变化（HTTP 写入或 CLI 写入）立即推送 {"kind":"state", ...}
 *
 * HTTP API（跨域已放开，方便远程 AI 直接 fetch）：
 *   GET  /api/state            当前状态：消息记录 + 文件占用 + 成员
 *   GET  /api/help             本说明（机读）
 *   POST /api/say     { "name": "codex-A", "type": "进度", "text": "..." }   type 可省，默认 聊天
 *   POST /api/claim   { "name": "codex-A", "files": ["src/a.ts"] }           冲突返回 409
 *   POST /api/release { "name": "codex-A", "files": ["src/a.ts"] }           files 省略=全部释放
 * 所有 POST 成功都返回最新 state，远程 AI 可以立即看到结果。
 */
import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { setInterval } from 'node:timers';
import { ROOT, DOC, TYPES, getState, say, claim, release } from './chat-core.mjs';

const UI_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'chat-ui.html');
const PUBLIC_DIR = path.join(ROOT, 'public');
const TOKEN = process.env.CHAT_TOKEN || '';
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const HEARTBEAT_MS = 25_000; // 心跳间隔
const STALE_MS = 90_000; // 超过这么久没有任何回包就断开
const WATCH_MS = 1_500; // 轮询数据源 mtime（覆盖 CLI 写入）

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function parseArgs() {
  const argv = process.argv.slice(2);
  const opt = { port: Number(process.env.PORT) || 5200, host: process.env.HOST || '0.0.0.0' };
  for (let i = 0; i < argv.length; i++) {
    if ((argv[i] === '--port' || argv[i] === '-p') && argv[i + 1]) opt.port = Number(argv[++i]);
    else if (argv[i] === '--host' && argv[i + 1]) opt.host = argv[++i];
    else if (argv[i].startsWith('--port=')) opt.port = Number(argv[i].slice(7));
    else if (argv[i].startsWith('--host=')) opt.host = argv[i].slice(7);
  }
  return opt;
}

function send(res, status, body, headers = {}) {
  const isObj = typeof body === 'object' && body !== null && !Buffer.isBuffer(body);
  const data = isObj ? JSON.stringify(body) : body;
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,x-chat-token',
    ...(isObj ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
    ...headers,
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 64 * 1024) {
        reject(new Error('请求体过大（上限 64KB）'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('请求体必须是 JSON'));
      }
    });
    req.on('error', reject);
  });
}

function checkToken(req, url) {
  if (!TOKEN) return true;
  return req.headers['x-chat-token'] === TOKEN || url.searchParams.get('token') === TOKEN;
}

const HELP = {
  name: '樱刃传说 · AI 协作聊天室',
  about: '多个 AI 在同一工作区协作的公共频道。所有状态持久化在 docs/34-协作聊天室.md，与 npm run chat CLI 完全互通。',
  auth: TOKEN ? '写接口需要请求头 x-chat-token 或 ?token= 参数' : '当前未设置 CHAT_TOKEN，写接口开放（建议仅在受信网络使用）',
  websocket: {
    url: 'ws://<host>:<port>/ws',
    heartbeat: `服务端每 ${HEARTBEAT_MS / 1000} 秒发协议 ping 和应用级 {"kind":"ping"}；请回 {"kind":"pong"}；${STALE_MS / 1000} 秒无回包断开`,
    push: '数据源变化时推送 {"kind":"state", "claims":[...], "messages":[...], "members":[...]}',
  },
  endpoints: {
    'GET /api/state': '返回 { now, claims: [{name, files}], messages: [{ts, type, name, text}], members }',
    'POST /api/say': '{ name, type?, text } — type 可选：' + TYPES.join('/'),
    'POST /api/claim': '{ name, files: [...] } — 占用文件，冲突返回 409 { error, conflicts }',
    'POST /api/release': '{ name, files? } — 释放文件，省略 files 则全部释放',
  },
  rules: ['开工先 GET /api/state 看谁占着什么', '动手前先 claim，提交后立刻 release', '占用要具体到文件'],
};

// ── WebSocket（手写 RFC6455，零依赖）─────────────────────
const wsClients = new Map(); // socket → { lastSeen }

function wsEncode(opcode, payload) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), 'utf8');
  const len = data.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, data]);
}

function wsSend(socket, obj) {
  if (socket.destroyed) return;
  socket.write(wsEncode(0x1, JSON.stringify(obj)), (err) => {
    if (err) dropClient(socket);
  });
}

function dropClient(socket) {
  wsClients.delete(socket);
  if (!socket.destroyed) socket.destroy();
}

function broadcast(obj) {
  for (const socket of wsClients.keys()) wsSend(socket, obj);
}

function pushState() {
  try {
    broadcast({ kind: 'state', ...getState() });
    lastMtime = fs.statSync(DOC).mtimeMs; // 同步 mtime，避免 watcher 重复推送
  } catch {
    /* 数据源暂时不可读时跳过本轮 */
  }
}

/** 解析客户端帧（带掩码）。buffer 里可能有多个帧或不完整帧。 */
function consumeFrames(socket, state) {
  const buf = state.buf;
  let off = 0;
  while (buf.length - off >= 2) {
    const fin = (buf[off] & 0x80) !== 0;
    const opcode = buf[off] & 0x0f;
    const masked = (buf[off + 1] & 0x80) !== 0;
    let len = buf[off + 1] & 0x7f;
    let pos = off + 2;
    if (len === 126) {
      if (buf.length - pos < 2) break;
      len = buf.readUInt16BE(pos);
      pos += 2;
    } else if (len === 127) {
      if (buf.length - pos < 8) break;
      len = Number(buf.readBigUInt64BE(pos));
      pos += 8;
    }
    const maskLen = masked ? 4 : 0;
    if (buf.length - pos < maskLen + len) break;
    let payload = buf.subarray(pos + maskLen, pos + maskLen + len);
    if (masked) {
      const mask = buf.subarray(pos, pos + 4);
      payload = Buffer.from(payload.map((b, i) => b ^ mask[i % 4]));
    }
    off = pos + maskLen + len;
    state.lastSeen = Date.now();

    if (opcode === 0x8) {
      // close
      if (!socket.destroyed) socket.end(wsEncode(0x8, ''));
      dropClient(socket);
      return;
    }
    if (opcode === 0x9) {
      // ping → pong
      if (!socket.destroyed) socket.write(wsEncode(0xA, payload));
      continue;
    }
    if (opcode === 0xA) continue; // pong
    if (opcode === 0x1 || opcode === 0x0) {
      state.text += payload.toString('utf8');
      if (fin) {
        const msg = state.text;
        state.text = '';
        try {
          const data = JSON.parse(msg);
          // 应用级心跳应答；其他上行消息暂不需要（写操作走 HTTP API）
          if (data?.kind !== 'pong') {
            wsSend(socket, { kind: 'ack', hint: '写操作请走 POST /api/say|claim|release' });
          }
        } catch {
          /* 非 JSON 上行忽略 */
        }
      }
    }
  }
  state.buf = buf.subarray(off);
}

// ── HTTP ────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const route = url.pathname;

  if (req.method === 'OPTIONS') return send(res, 204, '');

  try {
    // ── 静态：UI 与游戏素材 ─────────────────────────────
    if (req.method === 'GET' && (route === '/' || route === '/index.html')) {
      return send(res, 200, fs.readFileSync(UI_FILE), { 'Content-Type': MIME['.html'] });
    }
    if (req.method === 'GET' && route.startsWith('/assets/')) {
      const file = path.join(PUBLIC_DIR, route);
      if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        return send(res, 404, { error: '素材不存在' });
      }
      return send(res, 200, fs.readFileSync(file), { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    }

    // ── 只读 API ────────────────────────────────────────
    if (req.method === 'GET' && route === '/api/state') return send(res, 200, { ok: true, ...getState() });
    if (req.method === 'GET' && route === '/api/help') return send(res, 200, { ok: true, ...HELP });

    // ── 写 API（远程 AI 接入点）──────────────────────────
    if (req.method === 'POST' && route.startsWith('/api/')) {
      if (!checkToken(req, url)) return send(res, 401, { ok: false, error: '令牌无效：请带 x-chat-token 头或 ?token= 参数' });
      const body = await readBody(req);
      if (route === '/api/say') {
        const { type } = say(body.name, body.type, body.text);
        pushState();
        return send(res, 200, { ok: true, type, ...getState() });
      }
      if (route === '/api/claim') {
        try {
          const { added } = claim(body.name, body.files);
          pushState();
          return send(res, 200, { ok: true, added, ...getState() });
        } catch (err) {
          if (err.conflicts) return send(res, 409, { ok: false, error: err.message, conflicts: err.conflicts });
          throw err;
        }
      }
      if (route === '/api/release') {
        const { released } = release(body.name, body.files);
        pushState();
        return send(res, 200, { ok: true, released, ...getState() });
      }
      return send(res, 404, { ok: false, error: `未知接口 ${route}，GET /api/help 查看可用接口` });
    }

    send(res, 404, { ok: false, error: 'Not Found' });
  } catch (err) {
    send(res, 400, { ok: false, error: err.message });
  }
});

// ── WebSocket 升级 ──────────────────────────────────────
server.on('upgrade', (req, socket) => {
  let pathname;
  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
  } catch {
    socket.destroy();
    return;
  }
  const key = req.headers['sec-websocket-key'];
  if (pathname !== '/ws' || !key) {
    socket.destroy();
    return;
  }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );
  socket.setNoDelay(true);
  const state = { buf: Buffer.alloc(0), text: '', lastSeen: Date.now() };
  wsClients.set(socket, state);
  wsSend(socket, { kind: 'hello', now: HELP.name, heartbeatMs: HEARTBEAT_MS });
  wsSend(socket, { kind: 'state', ...getState() });
  socket.on('data', (chunk) => {
    state.buf = Buffer.concat([state.buf, chunk]);
    consumeFrames(socket, state);
  });
  socket.on('error', () => dropClient(socket));
  socket.on('close', () => dropClient(socket));
});

// 心跳：协议 ping + 应用级 ping；清理超时无回包的连接
setInterval(() => {
  const nowTs = Date.now();
  for (const [socket, state] of wsClients) {
    if (nowTs - state.lastSeen > STALE_MS) {
      dropClient(socket);
      continue;
    }
    if (!socket.destroyed) socket.write(wsEncode(0x9, 'hb'));
    wsSend(socket, { kind: 'ping', ts: nowTs });
  }
}, HEARTBEAT_MS);

// 数据源监听：CLI 写入时也能实时推送（mtime 轮询，Windows 上比 fs.watch 稳）
let lastMtime = 0;
setInterval(() => {
  try {
    const m = fs.statSync(DOC).mtimeMs;
    if (lastMtime && m !== lastMtime) pushState();
    lastMtime = m;
  } catch {
    /* 文件暂时不可读跳过 */
  }
}, WATCH_MS);

const { port, host } = parseArgs();
server.listen(port, host, () => {
  console.log(`樱刃传说 · AI 协作聊天室已开服`);
  console.log(`  本地围观:  http://localhost:${port}/`);
  console.log(`  实时推送:  ws://<本机IP>:${port}/ws（${HEARTBEAT_MS / 1000} 秒心跳）`);
  console.log(`  远程接入:  http://<本机IP>:${port}/api/help${TOKEN ? '（已启用 CHAT_TOKEN 校验）' : '（未设 CHAT_TOKEN，写接口开放）'}`);
});
