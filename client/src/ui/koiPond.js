import "../vendor/ascii-koi/pond.js"; // MIT: pursurer/ascii-koi, see vendor/ascii-koi/LICENSE

// Sets up a koi pond in a box, with the app's colours. It stops moving with "reduce motion" and follows the box size.
// The engine sizes the koi by the pond's size in pixels, so a scale above 1 gives it a bigger pond that is drawn smaller:
// smaller koi. `extra` is passed to the engine (for example { most: 3 } for at most three koi).
// Returns { pond, stop }; feed() takes box coordinates.
export function startPond(el, canvas, getScale = () => 1, extra = {}) {
  let reduce = false;
  try {
    reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    /* keep moving */
  }
  const cssVar = (n) => getComputedStyle(el).getPropertyValue(n).trim();
  const palette = () => ({
    water: cssVar("--pond"), ink: cssVar("--ink"), accent: cssVar("--accent"),
    koiLight: cssVar("--koi-light"), koiDark: cssVar("--koi-dark"),
    dark: cssVar("color-scheme").includes("dark"),
  });
  const pond = window.AsciiKoi.createPond({ canvas, palette, reduce, ...extra });
  // The engine needs a real size before it can draw. A box that is hidden (no size) is left alone until it has one.
  let started = false;
  const fit = () => {
    const r = el.getBoundingClientRect();
    const k = getScale();
    if (!(r.width && r.height)) return;
    pond.size(r.width * k, r.height * k);
    if (!started) {
      started = true;
      try {
        pond.start();
      } catch {
        started = false;
      }
    }
  };
  fit();
  const observer = new ResizeObserver(fit);
  observer.observe(el);
  return {
    pond,
    stop() {
      observer.disconnect();
      pond.stop();
    },
  };
}
