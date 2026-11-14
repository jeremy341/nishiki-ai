import { t } from "./i18n/index.js";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import OrbView from "./OrbView.jsx";
import { canRecord, startRecording, transcribe } from "./recorder.js";
import { hasPlaybackMeter, playbackLevel, stopSpeaking, unlockSpeech } from "./speech.js";
import { Button, IconButton } from "./ui/ui.jsx";

// Full-screen conversation: listen -> transcribe -> think -> speak -> listen again.
// Tap the orb to pause listening, or to stop the reply while it is speaking.
export default function VoiceMode({ onClose, ask, speak }) {
  const [phase, setPhase] = useState("starting"); // starting | listening | transcribing | thinking | speaking | paused | error
  const [heard, setHeard] = useState("");
  const [said, setSaid] = useState("");
  const [error, setError] = useState("");
  const [orbSize, setOrbSize] = useState(() => orbSizeFor());
  const orbRef = useRef(null);
  const openRef = useRef(true);
  const phaseRef = useRef("starting");
  const levelRef = useRef(0);
  const recorderRef = useRef(null);
  const restartTimer = useRef(null);
  // Callbacks come from the latest render, not from the render that opened this view.
  const askRef = useRef(ask);
  const speakRef = useRef(speak);
  askRef.current = ask;
  speakRef.current = speak;

  function setPhaseBoth(next) {
    phaseRef.current = next;
    setPhase(next);
  }

  // ---- the loop ----

  function listen() {
    if (!openRef.current || recorderRef.current) return;
    if (!canRecord) {
      setError(t("This browser cannot record audio. Try a recent Chrome, Edge or Safari."));
      setPhaseBoth("error");
      return;
    }
    setHeard("");
    setError("");
    setPhaseBoth("listening");
    const recorder = startRecording({
      onLevel: (level) => { levelRef.current = level; },
    });
    recorderRef.current = recorder;
    recorder.done.then(({ wav, error: micError }) => {
      recorderRef.current = null;
      if (!openRef.current || phaseRef.current !== "listening") return; // paused or closed
      if (micError === "not-allowed") {
        setError(t("Microphone access was blocked. Allow it in your browser settings."));
        setPhaseBoth("error");
        return;
      }
      if (micError) {
        setError(t("The microphone could not be used."));
        setPhaseBoth("error");
        return;
      }
      if (!wav) {
        restartSoon(); // nobody said anything
        return;
      }
      understand(wav);
    });
  }

  async function understand(wav) {
    setPhaseBoth("transcribing");
    let text = "";
    try {
      text = await transcribe(wav);
    } catch (err) {
      if (!openRef.current) return;
      setError(err.message);
      restartSoon();
      return;
    }
    if (!openRef.current) return;
    if (!text) {
      restartSoon();
      return;
    }
    respond(text);
  }

  function restartSoon() {
    clearTimeout(restartTimer.current);
    restartTimer.current = setTimeout(() => {
      const p = phaseRef.current;
      if (openRef.current && p !== "paused" && p !== "error") listen();
    }, 350);
  }

  async function respond(text) {
    setHeard(text);
    setSaid("");
    setPhaseBoth("thinking");
    const reply = await askRef.current(text);
    if (!openRef.current) return;
    if (!reply) {
      restartSoon();
      return;
    }
    setSaid(reply);
    setPhaseBoth("speaking");
    speakRef.current(reply, {
      onStart: () => {},
      onEnd: () => {
        if (openRef.current && phaseRef.current === "speaking") listen();
      },
      onError: () => {
        if (openRef.current && phaseRef.current === "speaking") listen();
      },
    });
  }

  function stopAll() {
    clearTimeout(restartTimer.current);
    recorderRef.current?.cancel();
    recorderRef.current = null;
    stopSpeaking();
  }

  // Orb tap: while speaking, cut the reply short and listen; while listening, pause; while paused, resume.
  function onOrbTap() {
    if (phaseRef.current === "speaking") {
      stopSpeaking();
      listen();
    } else if (phaseRef.current === "listening") {
      stopAll();
      setPhaseBoth("paused");
    } else if (phaseRef.current === "paused") {
      listen();
    }
  }

  // ---- lifecycle ----

  useEffect(() => {
    openRef.current = true;
    unlockSpeech();
    listen();
    return () => {
      openRef.current = false;
      stopAll();
    };
    // Runs once per open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The orb follows real audio: the microphone while listening, the reply while speaking.
  // Written straight to the DOM every frame, so React does not re-render 60 times a second.
  useEffect(() => {
    let frame = 0;
    let smooth = 0;
    const start = performance.now();
    const tick = (now) => {
      const p = phaseRef.current;
      let target = 0;
      if (p === "listening") target = levelRef.current;
      else if (p === "speaking") {
        target = hasPlaybackMeter() ? playbackLevel() : 0.25 + 0.2 * Math.abs(Math.sin((now - start) / 180));
      } else if (p === "thinking" || p === "transcribing") {
        target = 0.12 + 0.08 * Math.abs(Math.sin((now - start) / 500));
      }
      smooth = smooth * 0.72 + target * 0.28;
      orbRef.current?.style.setProperty("--level", smooth.toFixed(3));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const onResize = () => setOrbSize(orbSizeFor());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const status = phase === "listening" ? "listening"
    : phase === "transcribing" || phase === "thinking" ? "thinking"
    : phase === "speaking" ? "speaking"
    : phase === "error" ? "error"
    : "idle";
  const label = phase && {
    starting: "Starting…",
    listening: "Listening",
    transcribing: "Transcribing",
    thinking: "Thinking",
    speaking: "Speaking",
    paused: "Paused",
    error: "Stopped",
  }[phase];
  const hint = {
    listening: "Speak. Tap the orb to pause.",
    speaking: "Tap the orb to interrupt.",
    paused: "Tap the orb to continue.",
  }[phase] || "";
  const busyPhase = phase === "starting" || phase === "transcribing" || phase === "thinking";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("Conversation mode")}
      className="fixed inset-0 z-[60] flex flex-col bg-canvas pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(8px,env(safe-area-inset-top))] animate-enter"
    >
      <header className="flex items-center justify-between px-4">
        <span className="pl-2 text-xs font-medium uppercase tracking-[0.16em] text-fg-muted" aria-live="polite">{label && t(label)}</span>
        <IconButton label={t("End conversation")} onClick={() => { stopAll(); onClose(); }}>
          <X size={22} aria-hidden="true" />
        </IconButton>
      </header>

      <div className="grid min-h-0 flex-1 place-items-center">
        <button
          type="button"
          ref={orbRef}
          onClick={onOrbTap}
          disabled={busyPhase}
          aria-label={phase === "speaking" ? t("Interrupt the reply") : phase === "paused" ? t("Resume listening") : t("Pause listening")}
          style={{ transform: "scale(calc(1 + var(--level, 0) * 0.28))" }}
          className="grid place-items-center rounded-full transition-transform duration-75 will-change-transform focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-default"
        >
          <OrbView status={status} size={orbSize} decorative />
        </button>
      </div>

      <div className="mx-auto grid min-h-[7.5rem] w-full max-w-xl gap-3 px-6 text-center">
        {heard && phase !== "speaking" && <p className="text-lg text-fg">“{heard}”</p>}
        {phase === "speaking" && said && <p className="max-h-[28vh] overflow-y-auto text-[15px] text-fg-muted">{said}</p>}
        {error && (
          <div role="alert" className="grid justify-items-center gap-2">
            <p className="text-sm text-danger">{error}</p>
            {phase === "error" && <Button size="sm" onClick={() => { setError(""); listen(); }}>{t("Try again")}</Button>}
          </div>
        )}
        {hint && <p className="text-sm text-fg-subtle">{t(hint)}</p>}
      </div>
    </div>
  );
}

function orbSizeFor() {
  if (typeof window === "undefined") return 240;
  // Big on phones, but never taller than the space above the text.
  return Math.round(Math.max(160, Math.min(window.innerWidth * 0.78, window.innerHeight * 0.42, 360)));
}
