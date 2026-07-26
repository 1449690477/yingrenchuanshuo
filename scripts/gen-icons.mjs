/**
 * 生成 PWA 占位图标（纯色渐变 + 中心方块）。
 *
 * 这是临时占位资源，M12-3 阶段应替换为正式美术图标。
 * 之所以用脚本生成而不是提交二进制图片，是为了让任何人都能复现，
 * 且不需要安装图像处理依赖（只用 Node 内置的 zlib）。
 *
 * 用法：node scripts/gen-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../public/icons');

// ---- CRC32（PNG 分块校验）----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/** 生成 size×size 的 RGBA PNG，像素由 painter(x, y) 决定 */
function makePng(size, painter) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filter type: None
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = painter(x, y, size);
      raw[p++] = r;
      raw[p++] = g;
      raw[p++] = b;
      raw[p++] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// 樱粉 → 紫 的对角渐变，中心一个亮色菱形（象征刀刃）
function painter(x, y, size) {
  const t = (x + y) / (2 * size);
  const r = Math.round(255 + (167 - 255) * t);
  const g = Math.round(126 + (139 - 126) * t);
  const b = Math.round(182 + (250 - 182) * t);

  const cx = size / 2;
  const cy = size / 2;
  const d = Math.abs(x - cx) + Math.abs(y - cy); // 曼哈顿距离 → 菱形
  if (d < size * 0.26) return [250, 245, 255, 255];
  if (d < size * 0.3) return [90, 60, 120, 255];

  return [r, g, b, 255];
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [192, 512]) {
  const file = resolve(OUT_DIR, `icon-${size}.png`);
  writeFileSync(file, makePng(size, painter));
  console.log(`✔ ${file}`);
}
