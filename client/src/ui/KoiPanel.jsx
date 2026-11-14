import { useEffect, useRef } from "react";
import { startPond } from "./koiPond.js";

// The koi pond inside a box (not the full screen). It takes the app's own colours.
export default function KoiPanel({ className = "" }) {
  const wrap = useRef(null);
  const canvas = useRef(null);

  useEffect(() => startPond(wrap.current, canvas.current).stop, []);

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
