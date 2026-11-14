import { useEffect, useRef } from "react";
import "../vendor/ascii-koi/pond.js"; // MIT: pursurer/ascii-koi, see vendor/ascii-koi/LICENSE
import { effectiveTheme } from "../theme.js";

// The koi pond behind the home screen (DESIGN.md, "Mood" and "The motifs"): five big, slow koi that keep out of the places
// where something is: the orb, the words, the message pill and the header buttons. It fills its (relative) parent.
//
//   getClearings(): returns the places to keep clear, in this component's own pixel coordinates, as an array of
//                   { left, top, right, bottom, fade?, min? } or { cx, cy, r, fade?, min? }.
//                   Helper: clearingOf(element, container, pad, extra).
//   paused: stop moving, for example while a dialog is open. Still frame with reduced motion.
// A tap on empty water is a cat's paw: the nearest koi turns toward it.

export function clearingOf(element, container, pad = 0, extra = {}) {
  if (!element) return null;
  const r = element.getBoundingClientRect();
  const c = container.getBoundingClientRect();
  return { left: r.left - c.left - pad, top: r.top - c.top - pad, right: r.right - c.left + pad, bottom: r.bottom - c.top + pad, ...extra };
}

const PAPER = { water: "#e9e4da", ink: "#1c1a17", accent: "#9e3214", koiLight: "#f7f2e8", koiDark: "#2b2723", dark: false };
const POND = { water: "#0e2a32", ink: "#ebe6dc", accent: "#e8784f", koiLight: "#ece6da", koiDark: "#3a3632", dark: true };

export default function HomePond({ getClearings, paused = false, className = "" }) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const clearingsRef = useRef(getClearings);
  clearingsRef.current = getClearings;

  useEffect(() => {
    if (!window.AsciiKoi) return undefined;
    const el = wrap.current;
    let reduce = false;
    try {
      reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      /* keep moving */
    }
    const pond = window.AsciiKoi.createPond({
      canvas: canvas.current,
      palette: () => (effectiveTheme() === "light" ? PAPER : POND),
      reduce,
      most: 5,
      count: window.innerWidth < 768 ? 5 : 6,
      dim: () => clearingsRef.current?.(el)?.filter(Boolean) || null,
    });
    const fit = () => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) pond.size(r.width, r.height);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);

    let running = false;
    const run = () => {
      if (running || pausedRef.current || document.hidden) return;
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
    run();
    const onVisibility = () => (document.hidden ? halt() : run());
    document.addEventListener("visibilitychange", onVisibility);
    const timer = setInterval(() => (pausedRef.current ? halt() : run()), 500);
    const onDown = (event) => {
      if (reduce || event.button !== 0 || event.target.closest?.("input, textarea, select, button, a, label, [role='button'], [data-no-ripple]")) return;
      const r = el.getBoundingClientRect();
      pond.paw(event.clientX - r.left, event.clientY - r.top);
    };
    window.addEventListener("pointerdown", onDown);
    // A new theme gives the koi their new colours at once.
    const theme = new MutationObserver(() => pond.colors());
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      clearInterval(timer);
      observer.disconnect();
      theme.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", onDown);
      pond.stop();
    };
  }, []);

  return (
    <div ref={wrap} aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
