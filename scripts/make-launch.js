// Draws the iPhone and iPad launch screens (apple-touch-startup-image): the app's dot sphere on a plain
// background, in light and dark. Run once after a design change: node scripts/make-launch.js
// The sizes match the portrait screens listed in client/index.html.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "client", "public", "launch");

const SIZES = [
  [1290, 2796], // iPhone Pro Max
  [1179, 2556], // iPhone Pro
  [1170, 2532], // iPhone 12 to 14
  [1284, 2778], // iPhone 13/14 Pro Max
  [1242, 2688], // iPhone XS Max, 11 Pro Max
  [828, 1792], // iPhone 11, XR
  [2048, 2732], // iPad Pro 12.9
  [1668, 2388], // iPad Pro 11
];

const THEMES = {
  light: { canvas: [255, 255, 255], tile: [0, 0, 0] },
  dark: { canvas: [0, 0, 0], tile: [28, 28, 30] },
};

function crc32(buf) {
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n += 1) {
    let c = (crc ^ buf[n]) & 0xff;
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

// RGB PNG (no alpha: launch images are opaque).
function png(width, height, pixels) {
  const stride = width * 3;
  const rows = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    rows[y * (stride + 1)] = 0;
    pixels.copy(rows, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function draw(width, height, theme) {
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i += 1) {
    pixels[i * 3] = theme.canvas[0];
    pixels[i * 3 + 1] = theme.canvas[1];
    pixels[i * 3 + 2] = theme.canvas[2];
  }
  const side = Math.round(Math.min(width, height) * 0.26);
  const x0 = (width - side) / 2;
  const y0 = (height - side) / 2;
  const radius = side * 0.2;
  const inTile = (x, y) => {
    const cx = Math.min(Math.max(x, x0 + radius), x0 + side - radius);
    const cy = Math.min(Math.max(y, y0 + radius), y0 + side - radius);
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
  };
  const put = (px, py, rgb) => {
    const i = (py * width + px) * 3;
    pixels[i] = rgb[0];
    pixels[i + 1] = rgb[1];
    pixels[i + 2] = rgb[2];
  };

  // The rounded tile.
  for (let py = Math.floor(y0); py < Math.ceil(y0 + side); py += 1) {
    for (let px = Math.floor(x0); px < Math.ceil(x0 + side); px += 1) {
      if (inTile(px + 0.5, py + 0.5)) put(px, py, theme.tile);
    }
  }

  // The dots on a sphere, drawn back to front, brighter at the front (same shape as the app icon).
  const count = 240;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const cx = x0 + side / 2;
  const cy = y0 + side / 2;
  const sphereR = side * 0.3;
  const dotR = side * 0.022;
  const cosT = Math.cos(0.45);
  const sinT = Math.sin(0.45);
  const dots = [];
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    const y2 = y * cosT - z * sinT;
    const z2 = y * sinT + z * cosT;
    dots.push({ x: cx + x * sphereR, y: cy + y2 * sphereR, depth: (z2 + 1) / 2 });
  }
  dots.sort((a, b) => a.depth - b.depth);
  for (const d of dots) {
    const rad = dotR * (0.6 + 0.6 * d.depth);
    const v = Math.round(120 + 135 * d.depth);
    for (let py = Math.floor(d.y - rad); py <= Math.ceil(d.y + rad); py += 1) {
      for (let px = Math.floor(d.x - rad); px <= Math.ceil(d.x + rad); px += 1) {
        if (Math.hypot(px + 0.5 - d.x, py + 0.5 - d.y) <= rad && inTile(px + 0.5, py + 0.5)) put(px, py, [v, v, v]);
      }
    }
  }
  return pixels;
}

fs.mkdirSync(out, { recursive: true });
for (const [width, height] of SIZES) {
  for (const [name, theme] of Object.entries(THEMES)) {
    const file = `launch-${width}x${height}-${name}.png`;
    fs.writeFileSync(path.join(out, file), png(width, height, draw(width, height, theme)));
    console.log("wrote", file);
  }
}
