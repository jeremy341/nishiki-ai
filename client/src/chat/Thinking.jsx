import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Brain } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { t } from "../i18n/index.js";

// How much the model thinks before it answers.
// - Computer and iPad: a compact three-step segmented control sits in the message box, next to the
//   other tools. It is a radio group: arrow keys, Home and End move the choice.
// - Phone: a small button shows the level and opens a bottom sheet with the same control.
export const THINKING_LEVELS = [
  { value: "low", label: "Low", hint: "A little thinking. Fast and cheap. Good for everyday questions and voice." },
  { value: "medium", label: "Medium", hint: "More thinking for harder questions." },
  { value: "high", label: "High", hint: "Thinks longest. Best for hard problems; slower and costs more." },
];

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

// Three flat segments in one hairline frame. The chosen one is raised; the rest are quiet text.
function Segmented({ value, onChange, size }) {
  const index = Math.max(0, THINKING_LEVELS.findIndex((l) => l.value === value));
  const refs = useRef([]);
  const sizes = size === "sheet" ? "h-11 text-sm" : "h-7 text-[12px]";

  function choose(next) {
    if (next === index) return;
    navigator.vibrate?.(6); // Android only; iPhone Safari has no vibration API
    onChange(THINKING_LEVELS[next].value);
  }

  function onKeyDown(event) {
    const last = THINKING_LEVELS.length - 1;
    let next = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(last, index + 1);
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, index - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    choose(next);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={t("Thinking level")}
      onKeyDown={onKeyDown}
      className="grid grid-cols-3 gap-0.5 rounded-md border border-border bg-surface p-0.5"
    >
      {THINKING_LEVELS.map((level, i) => {
        const on = i === index;
        return (
          <button
            key={level.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => choose(i)}
            className={`${sizes} min-w-0 rounded-[4px] px-3 font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-fg ${
              on ? "bg-raised text-fg" : "text-fg-subtle hover:text-fg"
            }`}
          >
            {t(level.label)}
          </button>
        );
      })}
    </div>
  );
}

// The inline control in the message box (computer and iPad).
function InlineThinking({ value, onChange }) {
  return (
    <div className="flex items-center gap-2 pl-1.5 text-fg-subtle">
      <Brain size={14} aria-hidden="true" className="shrink-0" />
      <Segmented value={value} onChange={onChange} size="inline" />
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
            <div className="grid gap-3 px-4 pb-2 pt-4">
              <Segmented value={value} onChange={onChange} size="sheet" />
              <p className="min-h-[3rem] text-sm leading-6 text-fg-muted" aria-live="polite">{t(level.hint)}</p>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
