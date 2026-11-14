import { useEffect, useRef } from "react";
import { startPond } from "./koiPond.js";

// On phones the koi are drawn smaller so they stay clear of the orb.
const phoneScale = () => (window.innerWidth < 768 ? 1.8 : 1);

// The koi pond behind the orb in conversation mode. The orb sits in the middle, and the koi react to its state:
// when the assistant listens or thinks, a bit of food lands under the orb and the koi swim over to it.
// The pond takes the app's own colours and stops moving with "reduce motion".
export default function KoiStage({ status = "idle", className = "", children }) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const pondRef = useRef(null);

  useEffect(() => {
    const { pond, stop } = startPond(wrap.current, canvas.current, phoneScale);
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
