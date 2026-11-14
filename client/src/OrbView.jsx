import { t } from "./i18n/index.js";
import { Orb } from "@yogesharc/thinking-orbs";

// Maps the app's own status to an orb look. The orb only shows real app states.
const LOOK = {
  idle: { state: "idle" },
  listening: { state: "using", variant: "record" },
  thinking: { state: "reasoning" },
  speaking: { state: "working" },
  error: { state: "retrying", variant: "surge" },
};

const LABEL = {
  idle: "Ready",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  error: "Something went wrong",
};

// decorative: just the dots, hidden from screen readers (use next to a text label).
export default function OrbView({ status = "idle", size = 120, decorative = false, className = "", render, tilt }) {
  const look = LOOK[status] || LOOK.idle;
  const label = t(LABEL[status] || LABEL.idle);
  if (decorative) {
    return (
      <span className={`inline-grid place-items-center text-fg ${className}`}>
        <Orb state={look.state} variant={look.variant} size={size} render={render} tilt={tilt} />
      </span>
    );
  }
  return (
    <div className={`flex flex-col items-center gap-2 text-fg ${className}`} role="status" aria-live="polite">
      <Orb state={look.state} variant={look.variant} size={size} label={label} />
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-fg-subtle">{label}</span>
    </div>
  );
}
