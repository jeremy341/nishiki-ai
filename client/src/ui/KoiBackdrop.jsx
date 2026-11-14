import { useEffect, useRef } from "react";
import { effectiveTheme } from "../theme.js";

// The koi pond behind a whole page, as on the start screen. The page's content sits on top of it.
// The pond looks the same on every page that uses it, so the look stays when the page changes.
export default function KoiBackdrop({ children }) {
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
    const pond = createPond({ canvas: canvas.current, palette, reduce, dim: () => null });
    pond.size(innerWidth, innerHeight);
    pond.start();
    const onResize = () => pond.size(innerWidth, innerHeight);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      pond.stop();
    };
  }, []);

  const light = effectiveTheme() === "light";

  return (
    <div ref={wrap} className="koi-hero fixed inset-0 overflow-hidden" data-theme={light ? "light" : "pond"}>
      <canvas ref={canvas} className="koi-pond" aria-hidden="true" />
      <div className="relative z-10 grid min-h-dvh w-full place-items-center">{children}</div>
    </div>
  );
}
