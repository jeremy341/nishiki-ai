// Home screen: the orb (a dotted sphere with soft depth), its ring, the mini orb, and the pond with its clearings.
// Add ?live to the URL to watch it move; otherwise the page shows one fixed frame (?still=SECONDS picks which).

const q = new URLSearchParams(location.search);
const LIVE = q.has("live");
const STILL = Number(q.get("still") || 30);
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

// A sphere of small squares, seen from a little above, lit from the upper left. Like a halftone: squares are
// larger in shade, smaller in light, and the far side shows through faintly. A few squares are lighter.
// One square is vermilion (accent = true): the tancho spot, the only red on the screen apart from the koi.
function makeOrb(svg, { dots = 1000, base = 0.044, accent = false, tiltDeg = 16, light = true } = {}) {
  svg.setAttribute("viewBox", "-1.05 -1.05 2.1 2.1");
  svg.classList.add("orb");
  const phi = Math.PI * (3 - Math.sqrt(5));
  const tilt = (tiltDeg * Math.PI) / 180, ct = Math.cos(tilt), st = Math.sin(tilt);
  const L = [-0.46, -0.52, 0.72];
  const pts = [];
  for (let i = 0; i < dots; i += 1) {
    const y = 1 - ((i + 0.5) / dots) * 2, r = Math.sqrt(1 - y * y), th = phi * i;
    const h = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r, h });
  }
  // the vermilion square: the one nearest to a spot on the front, upper right of the centre (at angle 0)
  let tan = -1, best = 9;
  if (accent) pts.forEach((p, i) => { const py = p.y * ct - p.z * st, pz = p.y * st + p.z * ct, d = Math.hypot(p.x - 0.42, py + 0.36) + (pz < 0.4 ? 5 : 0); if (d < best) { best = d; tan = i; } });
  return function draw(angle = 0) {
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const order = [];
    for (let i = 0; i < pts.length; i += 1) {
      const p = pts[i];
      const x = p.x * ca + p.z * sa, z = -p.x * sa + p.z * ca;
      const py = p.y * ct - z * st, pz = p.y * st + z * ct;
      order.push({ i, x, py, pz, h: p.h });
    }
    order.sort((a, b) => a.pz - b.pz);
    let out = "";
    for (const o of order) {
      const depth = (o.pz + 1) / 2;
      const lit = light ? Math.max(0, o.x * L[0] + o.py * L[1] + o.pz * L[2]) : 0.5;
      const front = o.pz > 0 ? 1 : 0;
      const shade = front ? 1 - lit : 0.55;
      const limb = front ? 0.62 + 0.38 * Math.min(1, o.pz / 0.45) : 1;
      const s = base * (0.34 + 0.42 * depth + 0.62 * shade * depth) * limb * (o.i === tan ? 1.35 : 1);
      let a = front ? 0.5 + 0.5 * Math.pow(depth, 0.9) : 0.1 + 0.2 * depth;
      if (o.h < 0.1) a *= 0.45;
      out += `<rect${o.i === tan && o.pz > 0 ? ' class="tan"' : ""} x="${(o.x - s / 2).toFixed(3)}" y="${(o.py - s / 2).toFixed(3)}" width="${s.toFixed(3)}" height="${s.toFixed(3)}" opacity="${(o.i === tan && o.pz > 0 ? 1 : a).toFixed(2)}"/>`;
    }
    svg.innerHTML = out;
  };
}

// The ring: tiny squares on a circle, like a ripple that has stopped. Gaps at two places so it reads as hand-made, not a spinner.
function makeRing(svg, size, r) {
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  const n = 72, c = size / 2;
  let out = "";
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const gap = Math.abs(((a + Math.PI * 2) % (Math.PI * 2)) - 4.4) < 0.34;
    if (gap) continue;
    const t = 0.5 + 0.5 * Math.sin(i * 1.7);
    const w = 1.3 + t * 0.5;
    out += `<rect x="${(c + Math.cos(a) * r - w / 2).toFixed(2)}" y="${(c + Math.sin(a) * r - w / 2).toFixed(2)}" width="${w.toFixed(2)}" height="${w.toFixed(2)}" opacity="${(0.4 + t * 0.5).toFixed(2)}"/>`;
  }
  svg.innerHTML = out;
}

const orbEl = document.getElementById("orb");
const orb = makeOrb(orbEl, { dots: 1050, base: 0.047, accent: true });
orbEl.setAttribute("width", 176); orbEl.setAttribute("height", 176);
orb(0.35);
makeRing(document.getElementById("ring"), 216, 103);
const mini = document.getElementById("mini");
mini.setAttribute("width", 24); mini.setAttribute("height", 24);
makeOrb(mini, { dots: 110, base: 0.2, tiltDeg: 14 })(0.35);

// The pond keeps out of: the orb's clearing (a circle), the words, the dock and the two header buttons.
const rect = (id, pad = 0, extra = {}) => { const r = document.getElementById(id).getBoundingClientRect(); const ph = document.querySelector(".phone").getBoundingClientRect(); return { left: r.left - ph.left - pad, top: r.top - ph.top - pad, right: r.right - ph.left + pad, bottom: r.bottom - ph.top + pad, ...extra }; };
const clearings = () => {
  const o = document.getElementById("orbbtn").getBoundingClientRect(), ph = document.querySelector(".phone").getBoundingClientRect();
  const h = document.getElementById("hint").getBoundingClientRect();
  return [
    { cx: o.left - ph.left + o.width / 2, cy: o.top - ph.top + o.height / 2, r: 96, fade: 34, min: 0.05 },
    { left: h.left - ph.left + 6, top: h.top - ph.top - 2, right: h.right - ph.left - 6, bottom: h.bottom - ph.top + 4, fade: 22, min: 0.02 },
    rect("words", 2, { fade: 18, min: 0.03 }),
    rect("dock", 0, { fade: 8, min: 0.04 }),
    rect("hb-menu", 0, { fade: 18, min: 0.12 }),
    rect("hb-new", 0, { fade: 18, min: 0.12 }),
  ];
};

const canvas = document.getElementById("pond");
const palette = () => {
  const pond = document.documentElement.dataset.theme === "pond" || document.body.dataset.theme === "pond";
  return {
    water: pond ? "#0e2a32" : "#e9e4da", ink: pond ? "#ebe6dc" : "#1c1a17", accent: pond ? "#e8784f" : "#9e3214",
    koiLight: pond ? "#ece6da" : "#f7f2e8", koiDark: pond ? "#3a3632" : "#2b2723", dark: pond,
  };
};
const pond = window.AsciiKoi.createPond({ canvas, palette, reduce: !LIVE || calm, most: 5, count: 5, dim: clearings });
pond.size(canvas.clientWidth, canvas.clientHeight);

function paint() {
  if (LIVE) {
    pond.start();
    let last = 0, a = 0.35;
    const spin = (now) => { requestAnimationFrame(spin); if (calm || now - last < 66) return; a += (now - last) / 1000 * 0.12; last = now; orb(a); };
    requestAnimationFrame(spin);
    window.addEventListener("pointerdown", (e) => { if (!e.target.closest("button, .pill")) pond.paw(e.clientX, e.clientY); });
  } else {
    pond.colors();
    pond.seek(STILL);
  }
}
// wait for the fonts, so the words box (and with it the clearing) is final
(document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => requestAnimationFrame(paint));

// the theme can change after load (pond / paper): the koi take the new colours at once
new MutationObserver(() => { pond.colors(); if (!LIVE) pond.render(); })
  .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
new MutationObserver(() => { pond.colors(); if (!LIVE) pond.render(); })
  .observe(document.body, { attributes: true, attributeFilter: ["data-theme"] });
