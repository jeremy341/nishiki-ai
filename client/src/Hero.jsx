import { useEffect, useRef } from "react";
import "./vendor/ascii-koi/pond.js"; // MIT: pursurer/ascii-koi, see vendor/ascii-koi/LICENSE
import "./vendor/ascii-koi/pond-hero.css";
import { t } from "./i18n/index.js";
import { Button } from "./ui/ui.jsx";
import OrbView from "./OrbView.jsx";
import PixelField from "./ui/PixelField.jsx";
import { useStyle } from "./style.js";
import { effectiveTheme } from "./theme.js";

// The first screen: the koi pond with the assistant's name written in it, and a button to sign in.
// While the session loads, the same pond shows without the button.

const SERIF = `"Noto Serif Display", "Iowan Old Style", Georgia, serif`;

function prefers(query) {
  try {
    return window.matchMedia(query).matches;
  } catch {
    return false;
  }
}

function KoiHero({ name, onSignIn, loading }) {
  const rootRef = useRef(null);
  const pondRef = useRef(null);
  const boxRef = useRef(null);
  const wordRef = useRef(null);
  const theme = effectiveTheme() === "light" ? "light" : "pond";

  useEffect(() => {
    const { createPond, AsciiMark } = window.AsciiKoi;
    const root = rootRef.current;
    const reduce = prefers("(prefers-reduced-motion: reduce)");
    const cssVar = (n) => getComputedStyle(root).getPropertyValue(n).trim();
    // The colours come from the hero's own tokens (see pond-hero.css).
    const palette = () => ({
      water: cssVar("--pond"), ink: cssVar("--ink"), accent: cssVar("--accent"),
      koiLight: cssVar("--koi-light"), koiDark: cssVar("--koi-dark"),
      dark: cssVar("color-scheme").includes("dark"),
    });

    const pond = createPond({
      canvas: pondRef.current, palette, reduce,
      // The title's box: the koi fade under it, and the letters take on their colour.
      dim: () => { const r = boxRef.current.getBoundingClientRect(); return r.width ? r : null; },
    });
    pond.size(innerWidth, innerHeight);

    const narrow = () => innerWidth < 720;
    const look = { tint: pond.tint, light: pond.light };
    const title = AsciiMark(wordRef.current, () => ({
      text: name, font: `700 ${narrow() ? 120 : 200}px ${SERIF}`,
      cw: narrow() ? 4 : 7, ch: narrow() ? 5 : 9,
      maxW: Math.min(innerWidth * (narrow() ? 0.9 : 0.8), 820), edge: true, glow: 1,
    }), look);

    const clock = () => performance.now() / 1000;
    const build = () => title.build(clock());
    let alive = true;
    let raf = 0;
    let lastWords = 0;
    let resizeTimer = 0;
    build().then(() => { if (alive) boxRef.current?.classList.add("go"); });
    // The wordmark is drawn from the font outline, so it waits for the serif to load, then draws again.
    document.fonts?.load(`700 120px "Noto Serif Display"`).then(() => { if (alive) build(); }).catch(() => {});
    pond.start();

    // The words redraw at about 15 fps, like a sign; the koi move at full rate.
    const frame = (now) => {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      if (now - lastWords < 66) return;
      lastWords = now;
      const s = now / 1000;
      title.draw(s);
    };
    raf = requestAnimationFrame(frame);

    // Hands: a tap is a cat's paw, a press-and-hold (or right click) drops food.
    let held = null;
    const onDown = (event) => {
      if (event.button !== 0 || event.target.closest?.("button, a")) return;
      if (event.pointerType === "touch" || event.pointerType === "pen") {
        clearTimeout(held?.timer);
        held = {
          x: event.clientX, y: event.clientY,
          timer: setTimeout(() => { if (held) { pond.feed(held.x, held.y); held = null; } }, 450),
        };
        return;
      }
      pond.paw(event.clientX, event.clientY);
    };
    const onMove = (event) => {
      if (held && Math.hypot(event.clientX - held.x, event.clientY - held.y) > 14) { clearTimeout(held.timer); held = null; }
    };
    const onUp = () => { if (held) { clearTimeout(held.timer); pond.paw(held.x, held.y); held = null; } };
    const onContext = (event) => {
      if (event.target.closest?.("button, a")) return;
      event.preventDefault();
      if (held) { clearTimeout(held.timer); held = null; }
      pond.feed(event.clientX, event.clientY);
    };
    const onResize = () => {
      pond.size(innerWidth, innerHeight);
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if (alive) build(); }, 120);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("contextmenu", onContext);
    window.addEventListener("resize", onResize);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
      clearTimeout(held?.timer);
      pond.stop();
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("contextmenu", onContext);
      window.removeEventListener("resize", onResize);
    };
  }, [name]);

  return (
    <section ref={rootRef} className="koi-hero" data-theme={theme} aria-label={name}>
      <canvas ref={pondRef} className="koi-pond" aria-hidden="true" />
      <div className="intro">
        <div ref={boxRef} className="intro-box">
          <h1 className="sr">{name}</h1>
          <canvas ref={wordRef} className="wordmark" aria-hidden="true" />
          <p className="koi-tagline">{t("Your private assistant")}</p>
          {!loading && (
            <div className="koi-enter">
              <Button variant="primary" size="lg" onClick={onSignIn} className="pointer-events-auto min-w-44 justify-center">
                {t("Sign in")}
              </Button>
            </div>
          )}
        </div>
      </div>
      {!loading && (
        <p className="koi-hint">{t("tap: cat's paw · hold or right-click: feed the koi")}</p>
      )}
    </section>
  );
}

// The classic first screen: the orb, the name and the sign-in button, on the plain background.
function ClassicHero({ name, onSignIn, loading }) {
  return (
    <main className="relative grid min-h-dvh place-items-center px-5 py-10" role={loading ? "status" : undefined} aria-busy={loading || undefined}>
      {/* The background reacts to a click: a wave runs out from the point you touch. */}
      <PixelField fixed cell={18} />
      <div className="relative grid w-full max-w-sm justify-items-center gap-6 text-center">
        <OrbView status="idle" size={112} decorative />
        {loading ? <span className="sr-only">{t("Loading…")}</span> : (
          <>
            <div className="grid gap-2">
              <h1 className="text-3xl font-semibold tracking-tight">{name}</h1>
              <p className="text-[15px] text-fg-muted">{t("Your private assistant")}</p>
            </div>
            <Button variant="primary" size="lg" onClick={onSignIn} className="min-w-44 justify-center">{t("Sign in")}</Button>
          </>
        )}
      </div>
    </main>
  );
}

// The first screen before sign-in: the koi pond or the classic page, as the look is set.
export default function Hero({ name = "Nishiki", onSignIn, loading = false }) {
  const style = useStyle();
  return style === "koi"
    ? <KoiHero name={name} onSignIn={onSignIn} loading={loading} />
    : <ClassicHero name={name} onSignIn={onSignIn} loading={loading} />;
}
