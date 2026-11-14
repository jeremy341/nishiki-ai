import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Brain } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { t } from "../i18n/index.js";

// How much the model thinks before it answers.
// - Computer and iPad: a compact slider sits in the message box, next to the other tools, like
//   the inline thinking slider in modern chat apps. Arrow keys and Home/End work (native range).
// - Phone: the same slider opens as an Apple-style bottom sheet, with a grabber and "Done".
export const THINKING_LEVELS = [
  { value: "none", label: "Off", hint: "Answers come at once. Fastest, and the cheapest." },
  { value: "low", label: "Low", hint: "A little thinking. Good for everyday questions and voice." },
  { value: "medium", label: "Medium", hint: "More thinking for harder questions." },
  { value: "high", label: "High", hint: "Thinks longest. Best for hard problems; slower and costs more." },
];

export function thinkingLabel(value) {
  return t(THINKING_LEVELS.find((l) => l.value === value)?.label || "Low");
}

// Apple's system font, so the control reads like the rest of iOS and macOS.
const SYSTEM_FONT = { fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif' };
const STOPS = THINKING_LEVELS.length - 1;

// Sizes per presentation. The thumb travels between the two insets, so the stops line up with the labels.
const SIZES = {
  sheet: { track: "h-14", thumb: 44, inset: 4, edge: 6 },
  inline: { track: "h-6", thumb: 18, inset: 3, edge: 4 },
};

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

// The track, the blue fill, the ticks, the white thumb, and a transparent native range input on top.
// The native input does touch, mouse and keyboard work, so VoiceOver and arrow keys behave normally.
function ThinkingTrack({ value, onChange, size }) {
  const { track, thumb, inset, edge } = SIZES[size];
  const index = Math.max(0, THINKING_LEVELS.findIndex((l) => l.value === value));
  const fraction = index / STOPS;
  const lastIndex = useRef(index);
  const centreAt = (f) => `calc(${inset + thumb / 2}px + (100% - ${2 * inset + thumb}px) * ${f})`;
  const edgeAt = (f) => `calc(${inset + thumb}px + (100% - ${2 * inset + thumb}px) * ${f})`;

  function choose(next) {
    if (next !== lastIndex.current) {
      lastIndex.current = next;
      navigator.vibrate?.(6); // Android only; iPhone Safari has no vibration API
    }
    onChange(THINKING_LEVELS[next].value);
  }

  return (
    <div className={`relative ${track} w-full select-none rounded-full bg-[var(--glass)] shadow-[inset_0_0_0_0.5px_var(--glass-stroke)]`}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-[var(--ios-blue)] transition-[width] duration-500 ease-[cubic-bezier(.34,1.25,.64,1)]"
        style={{ width: edgeAt(fraction) }}
      />
      {THINKING_LEVELS.map((level, i) => (
        <span
          key={level.value}
          aria-hidden
          className={`pointer-events-none absolute top-1/2 rounded-full transition-colors duration-300 -translate-x-1/2 -translate-y-1/2 ${
            i <= index ? "bg-white/75" : "bg-[var(--tick)]"
          }`}
          style={{ left: centreAt(i / STOPS), width: edge, height: edge }}
        />
      ))}
      <input
        type="range"
        min={0}
        max={STOPS}
        step={1}
        value={index}
        aria-label={t("Thinking level")}
        aria-valuetext={t(THINKING_LEVELS[index].label)}
        onChange={(e) => choose(Number(e.target.value))}
        className="peer absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none opacity-0"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.25),0_1px_1px_rgba(0,0,0,0.08)] transition-[left,transform] duration-500 ease-[cubic-bezier(.34,1.25,.64,1)] peer-active:scale-[1.07]"
        style={{ width: thumb, height: thumb, left: `calc(${inset}px + (100% - ${2 * inset + thumb}px) * ${fraction})` }}
      />
    </div>
  );
}

// The inline control in the message box (computer and iPad).
function InlineThinking({ value, onChange }) {
  return (
    <div className="flex h-11 items-center gap-2 rounded-full pl-2 pr-2.5 text-[13px] text-fg-muted" style={SYSTEM_FONT}>
      <Brain size={15} aria-hidden="true" className="shrink-0" />
      <div className="w-32 shrink-0">
        <ThinkingTrack value={value} onChange={onChange} size="inline" />
      </div>
      <span className="w-12 text-fg font-medium">{thinkingLabel(value)}</span>
    </div>
  );
}

// The sheet on a phone: big value, the hint, the slider, the labels as buttons.
function SheetPanel({ value, onChange }) {
  const level = THINKING_LEVELS.find((l) => l.value === value) || THINKING_LEVELS[1];
  return (
    <div className="grid gap-6" style={SYSTEM_FONT}>
      <div className="text-center" aria-live="polite">
        <div className="text-[34px] font-bold leading-none tracking-[-0.02em]">{t(level.label)}</div>
        <p className="mx-auto mt-2 max-w-[30ch] text-[15px] leading-snug text-fg-muted">{t(level.hint)}</p>
      </div>
      <div className="grid gap-2">
        <ThinkingTrack value={value} onChange={onChange} size="sheet" />
        <div className="relative h-9 text-[13px]">
          {THINKING_LEVELS.map((level, i) => {
            const index = Math.max(0, THINKING_LEVELS.findIndex((l) => l.value === value));
            return (
              <button
                key={level.value}
                type="button"
                onClick={() => { navigator.vibrate?.(6); onChange(level.value); }}
                aria-pressed={i === index}
                className={`absolute top-0 flex h-9 w-16 -translate-x-1/2 items-center justify-center rounded-full whitespace-nowrap transition-colors duration-300 active:bg-fg/10 ${
                  i === index ? "font-semibold text-fg" : "text-fg-muted hover:text-fg"
                }`}
                style={{ left: `calc(${4 + 22}px + (100% - ${2 * 4 + 44}px) * ${i / STOPS})` }}
              >
                {t(level.label)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Thinking({ value, onChange }) {
  const desktop = useDesktop();
  const [open, setOpen] = useState(false);

  if (desktop) return <InlineThinking value={value} onChange={onChange} />;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("Thinking level")}
        className="flex h-11 items-center gap-1.5 rounded-full px-2.5 text-[13px] text-fg-muted transition-colors hover:bg-raised hover:text-fg"
      >
        <Brain size={15} aria-hidden="true" />
        <span>{thinkingLabel(value)}</span>
      </button>
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-scrim animate-enter" />
          <DialogPrimitive.Content
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-[32px] bg-overlay/95 pb-[max(20px,env(safe-area-inset-bottom))] text-fg shadow-[0_-10px_40px_rgba(0,0,0,0.18)] outline-none backdrop-blur-2xl"
            style={SYSTEM_FONT}
          >
            <div aria-hidden className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-fg/30" />
            <header className="grid grid-cols-[4rem_1fr_4rem] items-center px-5 pb-1 pt-3">
              <span />
              <DialogPrimitive.Title className="text-center text-[17px] font-semibold">{t("Thinking level")}</DialogPrimitive.Title>
              <DialogPrimitive.Close className="justify-self-end text-[17px] font-semibold text-[var(--ios-blue)] transition-opacity active:opacity-50">
                {t("Done")}
              </DialogPrimitive.Close>
            </header>
            <DialogPrimitive.Description className="sr-only">{t("Thinking level")}</DialogPrimitive.Description>
            <div className="px-6 pb-2 pt-6">
              <SheetPanel value={value} onChange={onChange} />
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
