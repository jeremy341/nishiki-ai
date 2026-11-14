import { useEffect, useRef } from "react";
import { effectiveTheme } from "../theme.js";

// The koi pond behind a whole page, as on the start screen. The page's content sits on top of it.
// The pond looks the same on every page that uses it, so the look stays when the page changes.
// clearRef: a ref to the block the koi keep away from (the sign-in column), so they never swim across the words.
export default function KoiBackdrop({ children, clearRef }) {
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
    const pond = createPond({
      canvas: canvas.current, palette, reduce,
      dim: () => {
        const target = clearRef?.current;
        if (!target) return null;
        const r = target.getBoundingClientRect();
        if (!r.width) return null;
        const pad = 30;
        return [{ left: r.left - pad, top: r.top - pad, right: r.right + pad, bottom: r.bottom + pad, fade: 46, min: 0.04 }];
      },
    });
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
