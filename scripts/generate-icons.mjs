// Generates the app's PWA/favicon icons from scratch — a gold checkmark
// (matching the "done" motif used throughout the UI) on a navy background —
// using only Node's built-in zlib for PNG encoding. No image libraries,
// no external assets. Run with: node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const NAVY = [0x1e, 0x2a, 0x44];
const GOLD = [0xf5, 0xb3, 0x01];

// --- tiny PNG encoder -------------------------------------------------

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/** Encodes an RGBA byte buffer (size*size*4) as a PNG file buffer. */
function encodePng(rgba, size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter type: None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// --- icon rendering -----------------------------------------------------

function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const lenSq = abx * abx + aby * aby;
  let t = lenSq ? (apx * abx + apy * aby) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy);
}

/** Renders a navy square with a centered gold checkmark, RGBA, size x size. */
function renderIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  // Checkmark path in a 0-100 unit box, similar proportions to the app's
  // in-UI "done" check glyph (short stroke down-right, long stroke up-right).
  const A = [24, 52];
  const B = [41, 69];
  const C = [78, 28];
  const scale = size / 100;
  const stroke = Math.max(1.6, size * 0.11);
  const feather = size <= 32 ? 0.6 : 1.0;

  const a = [A[0] * scale, A[1] * scale];
  const b = [B[0] * scale, B[1] * scale];
  const c = [C[0] * scale, C[1] * scale];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const d = Math.min(distToSegment(px, py, a[0], a[1], b[0], b[1]), distToSegment(px, py, b[0], b[1], c[0], c[1]));
      const coverage = Math.max(0, Math.min(1, stroke / 2 + feather - d));
      const i = (y * size + x) * 4;
      buf[i] = Math.round(NAVY[0] + (GOLD[0] - NAVY[0]) * coverage);
      buf[i + 1] = Math.round(NAVY[1] + (GOLD[1] - NAVY[1]) * coverage);
      buf[i + 2] = Math.round(NAVY[2] + (GOLD[2] - NAVY[2]) * coverage);
      buf[i + 3] = 255;
    }
  }
  return buf;
}

function pngFor(size) {
  return encodePng(renderIcon(size), size);
}

// --- ICO container (embeds PNG entries directly, supported since Vista) -

function encodeIco(sizes) {
  const images = sizes.map((s) => ({ size: s, png: pngFor(s) }));
  const headerSize = 6 + images.length * 16;
  let offset = headerSize;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  const dirEntries = [];
  const dataBlocks = [];
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size; // width (0 = 256)
    entry[1] = size >= 256 ? 0 : size; // height
    entry[2] = 0; // palette
    entry[3] = 0; // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    dirEntries.push(entry);
    dataBlocks.push(png);
  }
  return Buffer.concat([header, ...dirEntries, ...dataBlocks]);
}

// --- write files ----------------------------------------------------------

const publicDir = join(ROOT, "public");
mkdirSync(publicDir, { recursive: true });
writeFileSync(join(publicDir, "icon-192.png"), pngFor(192));
writeFileSync(join(publicDir, "icon-512.png"), pngFor(512));

writeFileSync(join(ROOT, "src", "app", "favicon.ico"), encodeIco([16, 32, 48]));
writeFileSync(join(ROOT, "src", "app", "apple-icon.png"), pngFor(180));

console.log("Wrote public/icon-192.png, public/icon-512.png, src/app/favicon.ico, src/app/apple-icon.png");
