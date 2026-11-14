import { useEffect, useRef, useState } from "react";
import "../vendor/ascii-koi/pond.js"; // MIT: pursurer/ascii-koi, see vendor/ascii-koi/LICENSE

// The ambient pond (DESIGN.md, "The ambient pond"): a very quiet version of the start screen's pond behind a page.
// A few big, slow koi swim in the margins and fade out under the reading column (the engine's "dim" box).
//
//   <PondField column={columnRef} />   as the first child of a `relative` page; the page content sits on top.
//
// column: a ref to the element that holds the text. Koi fade under it. Without it the koi swim everywhere.
// minWidth: no pond below this screen width (default 0: always).
// still:  draw one frame and stop (phones, reduced motion). Default: still on phones.
// paused: stop moving, for example while a dialog is open.
// scale: the engine sizes the koi by the pond's size, so a scale above 1 gives it a bigger pond that is drawn
//        smaller, which makes the koi smaller. A slim strip (a header) needs about 4.
// It also stops when the tab is hidden, and it ignores the pointer, so nothing underneath is blocked.
export default function PondField({ column, most = 3, still, paused = false, opacity = 0.55, scale = 1, minWidth = 0, className = "", style }) {
  // Below minWidth (in CSS pixels) there is no pond at all: a still frame on a phone looks like smudges.
  const [wide, setWide] = useState(() => window.innerWidth >= minWidth);
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= minWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [minWidth]);
  const wrap = useRef(null);
  const canvas = useRef(null);
  const pondRef = useRef(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    if (!wide || !window.AsciiKoi) return undefined;
    const el = wrap.current;
    const cv = canvas.current;
    let reduce = false;
    try {
      reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      /* keep moving */
    }
    const phone = window.innerWidth < 768;
    const frozen = reduce || (still ?? phone);

    const cssVar = (name) => getComputedStyle(el).getPropertyValue(name).trim();
    const palette = () => ({
      water: cssVar("--pond"), ink: cssVar("--ink"), accent: cssVar("--accent"),
      koiLight: cssVar("--koi-light"), koiDark: cssVar("--koi-dark"),
      dark: cssVar("color-scheme").includes("dark"),
    });
    // The text column's box, in this canvas's own pixels.
    const dim = () => {
      const col = column?.current;
      if (!col) return null;
      const r = col.getBoundingClientRect();
      const c = cv.getBoundingClientRect();
      if (!r.width) return null;
      const k = scale;
      return {
        left: (r.left - c.left) * k, top: (r.top - c.top) * k, right: (r.right - c.left) * k, bottom: (r.bottom - c.top) * k,
        x: (r.left - c.left) * k, y: (r.top - c.top) * k, width: r.width * k, height: r.height * k,
      };
    };

    const pond = window.AsciiKoi.createPond({ canvas: cv, palette, reduce: frozen, most, dim });
    pondRef.current = pond;
    const fit = () => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) pond.size(r.width * scale, r.height * scale);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    if (column?.current) observer.observe(column.current);

    let running = false;
    const run = () => {
      if (running || frozen || pausedRef.current || document.hidden) return;
      running = true;
      try {
        pond.start();
      } catch {
        running = false; // not sized yet; the next check tries again
      }
    };
    const halt = () => {
      if (!running) return;
      running = false;
      pond.stop();
    };
    if (frozen) {
      try {
        pond.start(); // one frame; the engine does not move with "reduce"
      } catch {
        /* hidden: nothing to draw */
      }
    }
    else run();
    const onVisibility = () => (document.hidden ? halt() : run());
    document.addEventListener("visibilitychange", onVisibility);
    // A tap on empty space is a cat's paw: the nearest koi turns toward it.
    const onDown = (event) => {
      if (frozen || event.button !== 0 || event.target.closest?.("input, textarea, select, button, a, label, [role='button'], [data-no-ripple]")) return;
      const r = el.getBoundingClientRect();
      pond.paw((event.clientX - r.left) * scale, (event.clientY - r.top) * scale);
    };
    window.addEventListener("pointerdown", onDown);
    const timer = setInterval(() => (pausedRef.current ? halt() : run()), 600);

    return () => {
      clearInterval(timer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", onDown);
      pond.stop();
      pondRef.current = null;
    };
    // The pond is made once per page (and again when the screen becomes wide); `still` and `column` do not change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wide]);

  if (!wide) return null;
  return (
    <div
      ref={wrap}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{
        "--pond": "var(--canvas)", "--ink": "var(--fg)", "--accent": "var(--accent)",
        "--koi-light": "var(--koi-white, #ece6da)", "--koi-dark": "var(--koi-ink, #3a3632)",
        opacity,
        ...style,
      }}
    >
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
