import { useEffect, useRef } from "react";
import "../vendor/ascii-koi/pond.js"; // MIT: pursurer/ascii-koi, see vendor/ascii-koi/LICENSE

// The koi pond inside a box (not the full screen). It takes the app's own colours.
export default function KoiPanel({ className = "" }) {
  const wrap = useRef(null);
  const canvas = useRef(null);

  useEffect(() => {
    const { createPond } = window.AsciiKoi;
    const el = wrap.current;
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
    const pond = createPond({ canvas: canvas.current, palette, reduce });
    const fit = () => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) pond.size(r.width, r.height);
    };
    fit();
    pond.start();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => {
      observer.disconnect();
      pond.stop();
    };
  }, []);

  return (
    <div
      ref={wrap}
      aria-hidden="true"
      className={`relative overflow-hidden rounded-[var(--radius-card)] ${className}`}
      style={{
        "--pond": "var(--canvas)", "--ink": "var(--fg)", "--accent": "var(--accent)",
        "--koi-light": "#ece6da", "--koi-dark": "#3a3632",
      }}
    >
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
