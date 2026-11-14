import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Brain } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { t } from "../i18n/index.js";

// How much the model thinks before it answers: a slider with three stops, Low, Normal and High.
// - Computer and iPad: a compact slider sits in the message box, next to the other tools. The native
//   range input does the work (touch, mouse, arrow keys, Home/End, screen readers).
// - Phone: a small button shows the level and opens a bottom sheet with a larger slider.
// The stored value for "Normal" stays "medium".
export const THINKING_LEVELS = [
  { value: "low", label: "Low", hint: "A little thinking. Fast and cheap. Good for everyday questions and voice." },
  { value: "medium", label: "Normal", hint: "More thinking for harder questions." },
  { value: "high", label: "High", hint: "Thinks longest. Best for hard problems; slower and costs more." },
];
const STOPS = THINKING_LEVELS.length - 1;

export function thinkingLabel(value) {
  return t(THINKING_LEVELS.find((l) => l.value === value)?.label || "Low");
}

function useDesktop() {
  const query = "(min-width: 768px)";
  const [desktop, setDesktop] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setDesktop(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return desktop;
}

// A flat track with the accent colour up to the thumb and a dot for each stop. The transparent native
// range input on top takes all the input, so it behaves like any slider.
function ThinkingSlider({ value, onChange, size }) {
  const index = Math.max(0, THINKING_LEVELS.findIndex((l) => l.value === value));
  const last = useRef(index);
  const big = size === "sheet";
  const thumb = big ? 28 : 16;
  const inset = thumb / 2;
  const at = (i) => `calc(${inset}px + (100% - ${thumb}px) * ${i / STOPS})`;

  function choose(next) {
    if (next === last.current) return;
    last.current = next;
    navigator.vibrate?.(6); // Android only; iPhone Safari has no vibration API
    onChange(THINKING_LEVELS[next].value);
  }

  return (
    <div className={`relative w-full select-none ${big ? "h-11" : "h-7"}`}>
      <div className={`absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full bg-border-strong ${big ? "h-1.5" : "h-1"}`} />
      <div
        className={`absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-accent transition-[width] duration-150 ease-[var(--ease-snappy)] ${big ? "h-1.5" : "h-1"}`}
        style={{ width: at(index) }}
      />
      {THINKING_LEVELS.map((level, i) => (
        <span
          key={level.value}
          aria-hidden="true"
          className={`absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${i <= index ? "bg-accent-fg/70" : "bg-fg-subtle"}`}
          style={{ left: at(i) }}
        />
      ))}
      <span
        aria-hidden="true"
        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border-strong bg-surface shadow-sm transition-[left,box-shadow] duration-150 ease-[var(--ease-snappy)] peer-focus-visible:ring-2 peer-focus-visible:ring-accent"
        style={{ left: at(index), width: thumb, height: thumb }}
      />
      <input
        type="range"
        min={0}
        max={STOPS}
        step={1}
        value={index}
        aria-label={t("Thinking level")}
        aria-valuetext={thinkingLabel(value)}
        onChange={(e) => choose(Number(e.target.value))}
        className="peer absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none opacity-0"
      />
    </div>
  );
}

// The inline control in the message box (computer and iPad): icon, slider, current level.
function InlineThinking({ value, onChange }) {
  return (
    <div className="flex items-center gap-2 pl-1.5 text-fg-subtle">
      <Brain size={14} aria-hidden="true" className="shrink-0" />
      <div className="w-24"><ThinkingSlider value={value} onChange={onChange} size="inline" /></div>
      <span className="w-12 text-[12px] text-fg-muted" aria-hidden="true">{thinkingLabel(value)}</span>
    </div>
  );
}

export default function Thinking({ value, onChange }) {
  const desktop = useDesktop();
  const [open, setOpen] = useState(false);
  const level = THINKING_LEVELS.find((l) => l.value === value) || THINKING_LEVELS[0];

  if (desktop) return <InlineThinking value={value} onChange={onChange} />;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("Thinking level")}
        className="flex h-11 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-fg-muted transition-colors hover:bg-raised hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
      >
        <Brain size={15} aria-hidden="true" />
        <span>{thinkingLabel(value)}</span>
      </button>
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="motion-overlay fixed inset-0 z-40 bg-scrim" />
          <DialogPrimitive.Content
            className="motion-sheet-bottom fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-xl border-t border-border bg-overlay pb-[max(16px,env(safe-area-inset-bottom))] text-fg outline-none"
          >
            <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
              <DialogPrimitive.Title className="text-[15px] font-semibold">{t("Thinking level")}</DialogPrimitive.Title>
              <DialogPrimitive.Close className="h-11 rounded-md px-3 text-[15px] font-medium text-fg hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg">
                {t("Done")}
              </DialogPrimitive.Close>
            </header>
            <DialogPrimitive.Description className="sr-only">{t("Thinking level")}</DialogPrimitive.Description>
            <div className="grid gap-2 px-6 pb-2 pt-5">
              <ThinkingSlider value={value} onChange={onChange} size="sheet" />
              <div className="flex justify-between text-[13px] text-fg-muted" aria-hidden="true">
                {THINKING_LEVELS.map((l) => (
                  <span key={l.value} className={l.value === value ? "font-medium text-fg" : ""}>{t(l.label)}</span>
                ))}
              </div>
              <p className="mt-2 min-h-[3rem] text-sm leading-6 text-fg-muted" aria-live="polite">{t(level.hint)}</p>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
