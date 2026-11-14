import { useEffect, useRef } from "react";
import { startPond } from "./koiPond.js";

// On phones the koi are drawn smaller so they stay clear of the orb.
const phoneScale = () => (window.innerWidth < 768 ? 1.8 : 1);

// The koi pond behind the orb in conversation mode. The orb sits in the middle, and the koi react to its state:
// when the assistant listens or thinks, a bit of food lands under the orb and the koi swim over to it.
// The pond takes the app's own colours and stops moving with "reduce motion".
export default function KoiStage({ status = "idle", className = "", clearRef, children }) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const pondRef = useRef(null);

  useEffect(() => {
    // The koi fade out under the clearing (the orb), so they never swim across it.
    const dim = () => {
      const target = clearRef?.current;
      if (!target) return null;
      const r = target.getBoundingClientRect();
      const c = wrap.current.getBoundingClientRect();
      const k = phoneScale();
      const pad = 18;
      if (!r.width) return null;
      return {
        left: (r.left - c.left - pad) * k, top: (r.top - c.top - pad) * k,
        right: (r.right - c.left + pad) * k, bottom: (r.bottom - c.top + pad) * k,
        x: (r.left - c.left - pad) * k, y: (r.top - c.top - pad) * k,
        width: (r.width + 2 * pad) * k, height: (r.height + 2 * pad) * k,
      };
    };
    const { pond, stop } = startPond(wrap.current, canvas.current, phoneScale, { dim });
    pondRef.current = pond;
    return () => {
      stop();
      pondRef.current = null;
    };
  }, []);

  // Listening and thinking: a bit of food under the middle, and the koi come over to look.
  useEffect(() => {
    const pond = pondRef.current;
    const el = wrap.current;
    if (!pond || !el) return;
    if (status === "listening" || status === "thinking") {
      const r = el.getBoundingClientRect();
      const k = phoneScale();
      pond.feed((r.width / 2) * k, (r.height / 2) * k);
    }
  }, [status]);

  return (
    <div
      ref={wrap}
      className={`relative grid place-items-center overflow-hidden ${className}`}
      style={{ "--pond": "var(--canvas)", "--ink": "var(--fg)", "--accent": "var(--accent)", "--koi-light": "#ece6da", "--koi-dark": "#3a3632" }}
    >
      <canvas ref={canvas} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
      <div className="relative">{children}</div>
    </div>
  );
}
