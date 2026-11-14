// Draws the app icon (the same dot sphere as the assistant's orb) as PNG files for the
// home screen. Run once: node scripts/make-icons.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "client", "public");

function crc32(buf) {
  let c;
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n += 1) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixels) {
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    rows[y * (size * 4 + 1)] = 0; // filter: none
    pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Black tile with rounded corners, white dots on a sphere, brighter at the front.
function draw(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const radius = size * 0.2;
  const inTile = (x, y) => {
    const cx = Math.min(Math.max(x, radius), size - radius);
    const cy = Math.min(Math.max(y, radius), size - radius);
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
  };
  const dots = [];
  const count = 240;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    dots.push({ x: Math.cos(theta) * r, y, z: Math.sin(theta) * r });
  }
  const sphereR = size * 0.3;
  const dotR = size * 0.022;
  const cx = size / 2;
  const cy = size / 2;
  const tilt = 0.45;
  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);
  const shade = dots.map((d) => {
    const y2 = d.y * cosT - d.z * sinT;
    const z2 = d.y * sinT + d.z * cosT;
    return { x: cx + d.x * sphereR, y: cy + y2 * sphereR, depth: (z2 + 1) / 2 };
  });
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const i = (py * size + px) * 4;
      if (!inTile(px + 0.5, py + 0.5)) {
        pixels[i + 3] = 0;
        continue;
      }
      let value = 0;
      for (const d of shade) {
        const dist = Math.hypot(px + 0.5 - d.x, py + 0.5 - d.y);
        if (dist <= dotR * (0.6 + 0.6 * d.depth)) {
          value = Math.max(value, 120 + 135 * d.depth);
        }
      }
      pixels[i] = value;
      pixels[i + 1] = value;
      pixels[i + 2] = value;
      pixels[i + 3] = 255;
    }
  }
  return pixels;
}

fs.mkdirSync(out, { recursive: true });
for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180]]) {
  fs.writeFileSync(path.join(out, name), png(size, draw(size)));
  console.log("wrote", name);
}
