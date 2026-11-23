// Determinism rule: no Date, no random, no network, no env-dependent pixels; identical bytes every run.
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { join } from "node:path";

const SIZE = 1024;
const OUTPUT_DIR = process.env["MAKEFUN_OUTPUT_DIR"] ?? "out";
const OUTPUT_FILE = "entry.png";

type RGB = readonly [number, number, number];

const C = {
  ink: [12, 18, 32] as RGB,
  navy: [22, 34, 60] as RGB,
  navyLight: [36, 56, 96] as RGB,
  paper: [245, 246, 248] as RGB,
  red: [214, 40, 57] as RGB,
  gold: [240, 186, 62] as RGB,
  white: [255, 255, 255] as RGB,
  steel: [126, 146, 184] as RGB,
};

const canvas = Buffer.alloc(SIZE * SIZE * 4, 0);

function clamp(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value | 0;
}

function hash(x: number, y: number): number {
  let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

function setPixel(x: number, y: number, color: RGB): void {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const offset = (y * SIZE + x) * 4;
  canvas[offset] = color[0];
  canvas[offset + 1] = color[1];
  canvas[offset + 2] = color[2];
  canvas[offset + 3] = 255;
}

function fillRect(x: number, y: number, w: number, h: number, color: RGB): void {
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) setPixel(col, row, color);
  }
}

function fillGradient(x: number, y: number, w: number, h: number, top: RGB, bottom: RGB): void {
  for (let row = 0; row < h; row++) {
    const t = h === 1 ? 0 : row / (h - 1);
    const color: RGB = [
      clamp(top[0] + (bottom[0] - top[0]) * t),
      clamp(top[1] + (bottom[1] - top[1]) * t),
      clamp(top[2] + (bottom[2] - top[2]) * t),
    ];
    fillRect(x, y + row, w, 1, color);
  }
}

function background(): void {
  for (let y = 0; y < SIZE; y++) {
    const t = y / (SIZE - 1);
    for (let x = 0; x < SIZE; x++) {
      const shade = 1 - 0.18 * Math.abs((x - SIZE / 2) / (SIZE / 2));
      const grain = (hash(x, y) % 7) - 3;
      setPixel(x, y, [
        clamp((C.ink[0] + (C.navy[0] - C.ink[0]) * t) * shade + grain),
        clamp((C.ink[1] + (C.navy[1] - C.ink[1]) * t) * shade + grain),
        clamp((C.ink[2] + (C.navy[2] - C.ink[2]) * t) * shade + grain),
      ]);
    }
  }
}

const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "11110"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "/": ["00001", "00001", "00010", "00100", "01000", "10000", "10000"],
};

function textWidth(text: string, scale: number): number {
  return text.length * 6 * scale - scale;
}

function drawText(x: number, y: number, text: string, scale: number, color: RGB): void {
  let cursor = x;
  for (const raw of text) {
    const glyph = GLYPHS[raw] ?? GLYPHS[" "];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] === "1") fillRect(cursor + col * scale, y + row * scale, scale, scale, color);
      }
    }
    cursor += 6 * scale;
  }
}

function drawTextRight(right: number, y: number, text: string, scale: number, color: RGB): void {
  drawText(right - textWidth(text, scale), y, text, scale, color);
}

function drawGlobe(cx: number, cy: number, radius: number): void {
  const meridians = [-0.8, -0.45, 0, 0.45, 0.8];
  for (let y = cy - radius; y <= cy + radius; y++) {
    const dy = y - cy;
    const extent = Math.sqrt(Math.max(0, radius * radius - dy * dy));
    for (let x = cx - radius; x <= cx + radius; x++) {
      const dx = x - cx;
      if (dx * dx + dy * dy > radius * radius) continue;
      const rim = Math.sqrt(dx * dx + dy * dy) > radius - 7;
      const band = Math.abs(dy % 34) < 1.5;
      const nx = extent === 0 ? 0 : dx / extent;
      const meridian = meridians.some((m) => Math.abs(nx - m) < 0.014);
      let color: RGB = rim ? C.steel : C.navyLight;
      if (Math.abs(dy + 46) < 10 && Math.abs(dx) < extent - 10) color = C.navy;
      if (band || meridian) color = rim ? C.white : [86, 122, 182];
      if (dx < -radius * 0.45 && dy < -radius * 0.35 && !rim && !band && !meridian) color = [48, 74, 124];
      setPixel(x, y, color);
    }
  }
}

function drawSkyline(): void {
  const base = 700;
  let x = 92;
  let index = 0;
  while (x < 560) {
    const width = 34 + (hash(index, 17) % 30);
    const height = 96 + (hash(index, 41) % 150);
    const top = base - height;
    fillRect(x, top, width, height, index % 2 === 0 ? [26, 42, 74] : [31, 50, 86]);
    fillRect(x, top, width, 3, C.steel);
    for (let wy = top + 14; wy < base - 10; wy += 18) {
      for (let wx = x + 8; wx < x + width - 6; wx += 14) {
        if (hash(wx, wy) % 5 === 0) fillRect(wx, wy, 4, 6, C.gold);
        else fillRect(wx, wy, 4, 6, [46, 68, 110]);
      }
    }
    x += width + 8;
    index++;
  }
}

function drawPanel(): void {
  fillGradient(56, 246, 912, 470, C.navy, [18, 28, 50]);
  fillRect(56, 246, 912, 3, C.steel);

  for (let i = 0; i < 70; i++) {
    const x = 72 + (hash(i, 3) % 880);
    const y = 262 + (hash(i, 9) % 190);
    setPixel(x, y, i % 6 === 0 ? C.gold : C.steel);
  }

  drawSkyline();
  drawGlobe(792, 470, 178);

  fillRect(56, 690, 912, 26, [14, 22, 40]);
  fillRect(56, 690, 912, 2, C.red);
  drawText(76, 697, "WORLD", 2, C.white);
  drawText(236, 697, "MARKETS", 2, C.steel);
  drawText(436, 697, "TECHNOLOGY", 2, C.steel);
  drawTextRight(948, 697, "LIVE", 2, C.gold);

  fillRect(884, 262, 68, 30, C.red);
  drawText(893, 268, "LIVE", 3, C.white);
}

function drawMasthead(): void {
  fillRect(0, 0, SIZE, 14, C.red);
  drawText(56, 52, "THE DAILY", 4, C.gold);
  drawText(52, 88, "NEWS", 16, C.white);
  drawTextRight(968, 58, "MONDAY", 4, C.steel);
  drawTextRight(968, 100, "23 NOVEMBER 2026", 4, C.gold);
  fillRect(56, 224, 912, 4, C.red);
  fillRect(56, 224, 300, 4, C.gold);
}

function drawHeadline(): void {
  fillRect(56, 744, 208, 44, C.red);
  drawText(70, 753, "BREAKING", 4, C.white);
  fillRect(284, 744, 684, 44, [24, 38, 66]);

  drawText(52, 808, "GLOBAL SUMMIT", 9, C.white);
  drawTextRight(968, 812, "23", 12, C.gold);

  drawText(56, 890, "LEADERS GATHER AS MARKETS AND TECHNOLOGY SHIFT", 2, C.steel);
  fillRect(56, 924, 912, 2, [58, 78, 118]);
}

function drawFooter(): void {
  fillRect(0, 940, SIZE, 84, C.paper);
  fillRect(0, 940, SIZE, 6, C.red);
  drawText(56, 964, "MAKEFUN", 5, C.ink);
  drawText(276, 968, "NEWS", 4, C.red);
  drawTextRight(968, 968, "23 NOVEMBER 2026", 3, [90, 100, 118]);
  for (let i = 0; i < 26; i++) fillRect(56 + i * 8, 1006, 4, 4, i % 4 === 0 ? C.red : C.steel);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

// CRC-32 rule: reflected polynomial 0xEDB88320, computed over type+data per chunk.
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(): Buffer {
  const stride = SIZE * 4;
  const raw = Buffer.alloc((stride + 1) * SIZE);
  for (let y = 0; y < SIZE; y++) {
    raw[y * (stride + 1)] = 0;
    canvas.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Editorial hierarchy: date headline, Iran and Russia-Ukraine, climate/flight/disaster, culture and science.
const cards = [
  "23 NOVEMBER 2026",
  "IRAN",
  "RUSSIA UKRAINE",
  "CLIMATE FLIGHT DISASTER",
  "CULTURE SCIENCE",
];

background();
drawMasthead();
drawPanel();
drawHeadline();
drawFooter();

mkdirSync(OUTPUT_DIR, { recursive: true });
const outputPath = join(OUTPUT_DIR, OUTPUT_FILE);
writeFileSync(outputPath, encodePng());
process.stdout.write(`Wrote ${outputPath}\n`);
