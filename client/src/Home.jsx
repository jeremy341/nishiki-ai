import { useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import { haptic } from "./feedback.js";
import { currentLocale, t } from "./i18n/index.js";
import HomeOrb from "./ui/HomeOrb.jsx";
import HomePond, { clearingOf } from "./ui/HomePond.jsx";

// The home screen of a new chat (DESIGN.md, "Layout: Home screen"; mockup docs/mockups/home.html). The koi pond fills the
// screen behind; the orb is the main button (tap = talk); the greeting hangs at the left edge in the serif, then a wave and
// one quiet mono line about today. No cards, no suggestions. The koi keep clear of the orb, the words, the pill and the
// header buttons.
//
//   onTalk: opens voice mode.  onOpenCalendar: opens the calendar (the today line is a button when it is given).
//   headerRef / dockRef: the header and the message pill of the chat, so the pond can keep out of them and the content
//   can sit between them.

const SHORT = 18;

function greetingKey(now = new Date()) {
  const h = now.getHours();
  if (h < 11) return "Good morning,";
  if (h < 17) return "Good afternoon,";
  return "Good evening,";
}

// "18:30 zahnarzt · 2 erinnerungen": the next appointment (time and a short, lowercase title) and the reminders due.
function todayLine({ event, reminders }) {
  const parts = [];
  if (event?.title) {
    let time = "";
    if (!event.allDay && event.start) {
      const d = new Date(event.start);
      if (!Number.isNaN(d.getTime())) time = d.toLocaleTimeString(currentLocale(), { hour: "2-digit", minute: "2-digit" });
    }
    const title = String(event.title).trim().toLowerCase();
    const short = title.length > SHORT ? `${title.slice(0, SHORT - 1).trimEnd()}…` : title;
    parts.push(time ? `${time} ${short}` : short);
  }
  if (reminders > 0) parts.push(t(reminders === 1 ? "{n} reminder" : "{n} reminders", { n: reminders }));
  return parts.length ? parts.join(" · ") : t("Nothing planned today");
}

const WAVE = "M1 4c4.5-4.6 8.5-4.6 13 0s8.5 4.6 13 0 8.5-4.6 13 0 8.5 4.6 13 0 8.5-4.6 13 0";

export default function Home({ username, onTalk, voiceOff = false, onOpenCalendar, headerRef, dockRef, paused = false }) {
  // On a short screen (iPhone SE) the orb is smaller so the greeting and the message box still fit.
  const orbSize = typeof window !== "undefined" && window.innerHeight < 660 ? 124 : 176;
  const [today, setToday] = useState(null);
  const [pad, setPad] = useState({ top: 48, bottom: 88 });
  const greeting = useRef(t(greetingKey())).current;
  const name = username ? username.charAt(0).toUpperCase() + username.slice(1) : "";
  const orbRef = useRef(null);
  const hintRef = useRef(null);
  const wordsRef = useRef(null);

  useEffect(() => {
    let alive = true;
    api("/api/today")
      .then((data) => { if (alive) setToday({ event: data.event || null, reminders: Number(data.reminders) || 0 }); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // The content sits between the header and the pill, whatever their heights are.
  useEffect(() => {
    const measure = () => setPad({
      top: headerRef?.current?.offsetHeight ?? 48,
      bottom: dockRef?.current?.offsetHeight ?? 88,
    });
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    if (headerRef?.current) observer.observe(headerRef.current);
    if (dockRef?.current) observer.observe(dockRef.current);
    return () => observer.disconnect();
  }, [headerRef, dockRef]);

  function getClearings(container) {
    const list = [];
    const orb = orbRef.current;
    if (orb) {
      const o = orb.getBoundingClientRect();
      const c = container.getBoundingClientRect();
      list.push({ cx: o.left - c.left + o.width / 2, cy: o.top - c.top + o.height / 2, r: 96, fade: 34, min: 0.05 });
    }
    const hint = clearingOf(hintRef.current, container, 0, { fade: 22, min: 0.02 });
    if (hint) {
      hint.left += 6; hint.right -= 6; hint.top -= 2; hint.bottom += 4;
      list.push(hint);
    }
    list.push(clearingOf(wordsRef.current, container, 2, { fade: 18, min: 0.03 }));
    list.push(clearingOf(dockRef?.current, container, 0, { fade: 8, min: 0.04 }));
    headerRef?.current?.querySelectorAll("button").forEach((button) => {
      if (button.offsetWidth) list.push(clearingOf(button, container, 0, { fade: 18, min: 0.12 }));
    });
    return list;
  }

  const line = today ? todayLine(today) : "";
  const asButton = Boolean(today?.event && onOpenCalendar);

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <HomePond getClearings={getClearings} paused={paused} />
      <div className="absolute inset-0 flex flex-col overflow-y-auto overflow-x-hidden" style={{ paddingTop: pad.top, paddingBottom: pad.bottom }}>
        <div className="mx-auto my-auto w-full max-w-[420px] px-7 py-4">
          {/* The orb sits a little right of the centre line; the hint is centred under it. */}
          <div className="motion-enter flex flex-col items-center" style={{ translate: "min(43px, 11vw) 0" }}>
            <button
              ref={orbRef}
              type="button"
              aria-label={t("Start talking")}
              disabled={voiceOff}
              aria-disabled={voiceOff}
              onClick={() => { haptic("tap"); onTalk?.(); }}
              className={`pointer-events-auto grid shrink-0 place-items-center rounded-full text-fg focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-accent [-webkit-tap-highlight-color:transparent] ${voiceOff ? "cursor-not-allowed opacity-35 grayscale" : "pressable"}`}
            >
              <HomeOrb size={orbSize} />
            </button>
            <p ref={hintRef} className="caption mt-2 max-w-[min(300px,calc(100vw-56px))] text-center">{voiceOff ? t("Voice is switched off for now") : t("Tap the orb to talk")}</p>
          </div>

          <section ref={wordsRef} className="motion-enter mt-10" style={{ animationDelay: "90ms" }}>
            <h1 className="serif m-0 text-[31px] font-medium leading-[40px] tracking-[0.03em] text-fg">
              <span className="block">{greeting}</span>
              {name && <span className="block pl-[38px]">{name}.</span>}
            </h1>
            <svg viewBox="0 0 72 8" aria-hidden="true" className="mb-0.5 ml-0.5 mt-[18px] block h-2 w-[72px] fill-none stroke-fg-subtle opacity-70" strokeWidth="1" strokeLinecap="round">
              <path d={WAVE} />
            </svg>
            {/* Reserve the line while it loads, so nothing jumps. */}
            {asButton ? (
              <button
                type="button"
                onClick={onOpenCalendar}
                className="pointer-events-auto caption block min-h-11 w-full py-3 text-left !text-fg-muted focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-accent"
              >
                {line}
              </button>
            ) : (
              <p className="caption m-0 flex min-h-11 items-center py-3 !text-fg-muted">{line}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
