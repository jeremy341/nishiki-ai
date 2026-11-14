import "../vendor/ascii-koi/pond.js"; // MIT: pursurer/ascii-koi, see vendor/ascii-koi/LICENSE

// Sets up a koi pond in a box, with the app's colours. It stops moving with "reduce motion" and follows the box size.
// The engine sizes the koi by the pond's size in pixels, so a scale above 1 gives it a bigger pond that is drawn smaller:
// smaller koi. Returns { pond, stop }; feed() takes box coordinates.
export function startPond(el, canvas, getScale = () => 1) {
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
  const pond = window.AsciiKoi.createPond({ canvas, palette, reduce });
  const fit = () => {
    const r = el.getBoundingClientRect();
    const k = getScale();
    if (r.width && r.height) pond.size(r.width * k, r.height * k);
  };
  fit();
  pond.start();
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
