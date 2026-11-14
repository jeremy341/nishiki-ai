import { useEffect, useRef } from "react";

// The home orb (DESIGN.md, "Orb"): a sphere of small squares seen a little from above and lit from the upper left, like a
// halftone: shaded squares are bigger, lit ones smaller, the far side shows through faintly. One square is vermilion (the
// tancho spot). A ring of tiny squares around it, like a ripple that has stopped. It turns slowly; with reduced motion it
// holds still. Ported from the home mockup (docs/mockups/home.js).

function makeOrb({ dots = 1000, base = 0.044, accent = false, tiltDeg = 16 } = {}) {
  const phi = Math.PI * (3 - Math.sqrt(5));
  const tilt = (tiltDeg * Math.PI) / 180;
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const L = [-0.46, -0.52, 0.72];
  const pts = [];
  for (let i = 0; i < dots; i += 1) {
    const y = 1 - ((i + 0.5) / dots) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = phi * i;
    const h = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r, h });
  }
  // The vermilion square: the one nearest to a spot on the front, upper right of the centre.
  let tan = -1;
  let best = 9;
  if (accent) {
    pts.forEach((p, i) => {
      const py = p.y * ct - p.z * st;
      const pz = p.y * st + p.z * ct;
      const d = Math.hypot(p.x - 0.42, py + 0.36) + (pz < 0.4 ? 5 : 0);
      if (d < best) { best = d; tan = i; }
    });
  }
  return function draw(angle = 0) {
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    const order = [];
    for (let i = 0; i < pts.length; i += 1) {
      const p = pts[i];
      const x = p.x * ca + p.z * sa;
      const z = -p.x * sa + p.z * ca;
      const py = p.y * ct - z * st;
      const pz = p.y * st + z * ct;
      order.push({ i, x, py, pz, h: p.h });
    }
    order.sort((a, b) => a.pz - b.pz);
    let out = "";
    for (const o of order) {
      const depth = (o.pz + 1) / 2;
      const lit = Math.max(0, o.x * L[0] + o.py * L[1] + o.pz * L[2]);
      const front = o.pz > 0 ? 1 : 0;
      const shade = front ? 1 - lit : 0.55;
      const limb = front ? 0.62 + 0.38 * Math.min(1, o.pz / 0.45) : 1;
      const isTan = o.i === tan && o.pz > 0;
      const s = base * (0.34 + 0.42 * depth + 0.62 * shade * depth) * limb * (o.i === tan ? 1.35 : 1);
      let a = front ? 0.5 + 0.5 * Math.pow(depth, 0.9) : 0.1 + 0.2 * depth;
      if (o.h < 0.1) a *= 0.45;
      out += `<rect${isTan ? ' class="tan"' : ""} x="${(o.x - s / 2).toFixed(3)}" y="${(o.py - s / 2).toFixed(3)}" width="${s.toFixed(3)}" height="${s.toFixed(3)}" opacity="${(isTan ? 1 : a).toFixed(2)}"/>`;
    }
    return out;
  };
}

// Tiny squares on a circle, with gaps at one place so it reads as hand-made, not as a spinner.
function ringMarkup(size, r) {
  const n = 72;
  const c = size / 2;
  let out = "";
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    if (Math.abs(((a + Math.PI * 2) % (Math.PI * 2)) - 4.4) < 0.34) continue;
    const t = 0.5 + 0.5 * Math.sin(i * 1.7);
    const w = 1.3 + t * 0.5;
    out += `<rect x="${(c + Math.cos(a) * r - w / 2).toFixed(2)}" y="${(c + Math.sin(a) * r - w / 2).toFixed(2)}" width="${w.toFixed(2)}" height="${w.toFixed(2)}" opacity="${(0.4 + t * 0.5).toFixed(2)}"/>`;
  }
  return out;
}

// size: the sphere in CSS pixels. ring: draw the ring (needs room around it: the box is 1.23 times the size).
// spin: turn slowly. dots: fewer for small orbs. accent: the vermilion square.
export default function HomeOrb({ size = 176, ring = true, spin = true, dots, accent = true, className = "" }) {
  const sphere = useRef(null);
  const count = dots ?? (size < 60 ? 110 : 1000);
  const base = size < 60 ? 0.2 : 0.046;
  const box = Math.round(size * 1.227);

  useEffect(() => {
    const draw = makeOrb({ dots: count, base, accent: accent && size >= 60, tiltDeg: 15 });
    let calm = false;
    try {
      calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      /* keep moving */
    }
    let angle = 0.35;
    sphere.current.innerHTML = draw(angle);
    if (!spin || calm || size < 60) return undefined;
    let frame = 0;
    let last = performance.now();
    const tick = (now) => {
      frame = requestAnimationFrame(tick);
      if (document.hidden || now - last < 66) return; // about 15 pictures a second, like a sign
      angle += ((now - last) / 1000) * 0.12;
      last = now;
      if (sphere.current) sphere.current.innerHTML = draw(angle);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [count, base, accent, spin, size]);

  return (
    <span className={`relative inline-grid place-items-center text-fg ${className}`} style={{ width: box, height: box }} aria-hidden="true">
      {ring && size >= 60 && (
        <svg
          className="absolute inset-0 text-fg-subtle"
          viewBox={`0 0 ${box} ${box}`}
          fill="currentColor"
          dangerouslySetInnerHTML={{ __html: ringMarkup(box, size * 0.585) }}
        />
      )}
      <svg
        ref={sphere}
        width={size}
        height={size}
        viewBox="-1.05 -1.05 2.1 2.1"
        fill="currentColor"
        className="relative [&_.tan]:fill-[var(--accent)]"
      />
    </span>
  );
}
