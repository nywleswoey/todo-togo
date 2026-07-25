/**
 * Dependency-free PNG icon generator for the PWA.
 *
 * Produces the home-screen / manifest icons from a simple drawn design (brand
 * teal square + white mic glyph) so we don't carry binary blobs we can't diff.
 * Re-run with `node scripts/generate-icons.mjs` if the brand color changes.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

const BRAND = [15, 118, 110]; // #0f766e
const WHITE = [255, 255, 255];

// --- CRC32 (for PNG chunks) ---
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
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Draw an RGBA pixel buffer for a size, then encode to PNG. */
function makeIcon(size, { maskable = false } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, [r, g, b], a = 255) => {
    const i = (y * size + x) * 4;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = a;
  };

  // Background: rounded square (or full-bleed for maskable safe zone).
  const radius = maskable ? 0 : size * 0.22;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inside = true;
      if (radius > 0) {
        const cx = Math.min(x, size - 1 - x);
        const cy = Math.min(y, size - 1 - y);
        if (cx < radius && cy < radius) {
          const dx = radius - cx;
          const dy = radius - cy;
          inside = dx * dx + dy * dy <= radius * radius;
        }
      }
      set(x, y, BRAND, inside ? 255 : 0);
    }
  }

  // Mic glyph: rounded capsule body + stand, centered.
  const cx = size / 2;
  const bodyW = size * 0.2;
  const bodyTop = size * 0.26;
  const bodyBot = size * 0.56;
  const bodyR = bodyW / 2;
  const inCapsule = (x, y) => {
    if (x < cx - bodyR || x > cx + bodyR) return false;
    if (y < bodyTop + bodyR && Math.hypot(x - cx, y - (bodyTop + bodyR)) > bodyR)
      return false;
    if (y > bodyBot - bodyR && Math.hypot(x - cx, y - (bodyBot - bodyR)) > bodyR)
      return false;
    return y >= bodyTop && y <= bodyBot;
  };
  // Arc (mic cradle) + stem + base.
  const arcR = size * 0.16;
  const arcCy = size * 0.5;
  const stemTop = arcCy + arcR;
  const baseY = size * 0.74;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let on = inCapsule(x, y);
      // U-shaped cradle around lower half of the capsule.
      const d = Math.hypot(x - cx, y - arcCy);
      if (!on && y >= arcCy && Math.abs(d - arcR) < size * 0.02) on = true;
      // Stem down to the base.
      if (!on && Math.abs(x - cx) < size * 0.012 && y > stemTop && y < baseY) on = true;
      // Base line.
      if (!on && Math.abs(y - baseY) < size * 0.012 && Math.abs(x - cx) < size * 0.09)
        on = true;
      if (on) set(x, y, WHITE, 255);
    }
  }

  // Encode: IHDR + IDAT (filter byte 0 per scanline) + IEND.
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "icon-192.png"), makeIcon(192));
writeFileSync(join(OUT, "icon-512.png"), makeIcon(512));
writeFileSync(join(OUT, "icon-512-maskable.png"), makeIcon(512, { maskable: true }));
writeFileSync(join(OUT, "apple-touch-icon.png"), makeIcon(180));
console.log("Wrote icons to", OUT);
