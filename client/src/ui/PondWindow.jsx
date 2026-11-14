import { useEffect, useRef } from "react";
import { t } from "../i18n/index.js";
import { startPond } from "./koiPond.js";

// The pond window (DESIGN.md, "The pond window"): a framed window onto the koi pond, for the bottom of the sidebar
// and of the settings navigation. Nothing is read here, so the koi are at full colour. Tapping it drops food and the
// koi swim over. It is a button so it works with the keyboard too.
const SCALE = 1.7; // the engine sizes koi by the pond's size; a bigger virtual pond drawn smaller gives smaller koi

export default function PondWindow({ height = 150, className = "" }) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const pondRef = useRef(null);

  useEffect(() => {
    const { pond, stop } = startPond(wrap.current, canvas.current, () => SCALE, { most: 3 });
    pondRef.current = pond;
    return () => {
      stop();
      pondRef.current = null;
    };
  }, []);

  function feed(x, y) {
    pondRef.current?.feed(x * SCALE, y * SCALE);
  }

  return (
    <button
      type="button"
      ref={wrap}
      aria-label={t("Feed the koi")}
      onClick={(event) => {
        const r = event.currentTarget.getBoundingClientRect();
        // From the keyboard there is no pointer position: drop the food in the middle.
        const keyboard = event.detail === 0;
        feed(keyboard ? r.width / 2 : event.clientX - r.left, keyboard ? r.height / 2 : event.clientY - r.top);
      }}
      className={`relative block w-full overflow-hidden rounded-lg border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${className}`}
      style={{
        height,
        "--pond": "var(--canvas)", "--ink": "var(--fg)", "--accent": "var(--accent)",
        "--koi-light": "var(--koi-white, #ece6da)", "--koi-dark": "var(--koi-ink, #3a3632)",
      }}
    >
      <canvas ref={canvas} aria-hidden="true" className="absolute inset-0 h-full w-full" />
    </button>
  );
}
