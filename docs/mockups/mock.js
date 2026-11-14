// Shared bits for the mockups: the dotted orb and the koi pond (the real engine from client/src/vendor/ascii-koi).

// A sphere of small squares seen from slightly above: nearer squares are bigger and darker.
function drawOrb(svg, size, { dots = 640, tiltDeg = 18, base = 0.036 } = {}) {
  svg.setAttribute("viewBox", "-1.05 -1.05 2.1 2.1");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.classList.add("orb");
  const phi = Math.PI * (3 - Math.sqrt(5));
  const tilt = (tiltDeg * Math.PI) / 180;
  let out = "";
  for (let i = 0; i < dots; i += 1) {
    const y = 1 - (i / (dots - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = phi * i;
    const x = Math.cos(th) * r;
    const z = Math.sin(th) * r;
    const py = y * Math.cos(tilt) - z * Math.sin(tilt);
    const pz = y * Math.sin(tilt) + z * Math.cos(tilt);
    const depth = (pz + 1) / 2;
    const s = base * (0.45 + 0.95 * depth);
    const o = 0.2 + 0.8 * depth;
    out += `<rect x="${(x - s / 2).toFixed(3)}" y="${(py - s / 2).toFixed(3)}" width="${s.toFixed(3)}" height="${s.toFixed(3)}" opacity="${o.toFixed(2)}"/>`;
  }
  svg.innerHTML = out;
}

// The koi pond behind the page. clear: a function returning the box (in canvas pixels) the koi keep away from.
function startPond(canvas, { theme = "paper", clear, most = 4 } = {}) {
  const light = theme !== "pond";
  const palette = () => ({
    water: light ? "#e9e4da" : "#0e2a32",
    ink: light ? "#1c1a17" : "#ebe6dc",
    accent: light ? "#9e3214" : "#e8784f",
    koiLight: light ? "#f7f2e8" : "#ece6da",
    koiDark: light ? "#2b2723" : "#3a3632",
    dark: !light,
  });
  const pond = window.AsciiKoi.createPond({ canvas, palette, reduce: false, most, dim: clear });
  pond.size(canvas.clientWidth, canvas.clientHeight);
  pond.start();
  return pond;
}
