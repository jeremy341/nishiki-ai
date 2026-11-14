import { t } from "./i18n/index.js";
import { Mic, MicOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import OrbView from "./OrbView.jsx";
import KoiStage from "./ui/KoiStage.jsx";
import { squares } from "@yogesharc/thinking-orbs/renders";
import { canRecord, monitorSpeech, startRecording } from "./recorder.js";
import { createPcmPlayer, hasPlaybackMeter, playbackLevel, stopSpeaking, unlockSpeech } from "./speech.js";
import { Button, useDialogReturnFocus } from "./ui/ui.jsx";

// Full-screen conversation: listen -> (one call listens and answers, speech streams back) -> listen again.
// Tap the orb to pause listening, or to stop the reply while it is speaking.
// turn(wav, { onAudio, onHeard, onReply }) sends one recording and resolves when the answer is saved.
export default function VoiceMode({ onClose, turn }) {
  const returnFocus = useDialogReturnFocus();
  const demo = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("voicedemo") : null; // dev only: ?voicedemo=speaking
  const [phase, setPhase] = useState(demo || "starting"); // starting | listening | transcribing | thinking | speaking | paused | error
  const [heard, setHeard] = useState(demo ? "Wie wird das Wetter morgen in Hamburg?" : "");
  const [said, setSaid] = useState(demo === "speaking" ? "Morgen wird es kühl und wechselhaft, mit ein paar Schauern. Eine Jacke und ein Schirm wären keine schlechte Idee." : "");
  const [error, setError] = useState("");
  const [orbSize, setOrbSize] = useState(() => orbSizeFor());
  // Interrupt by speaking: off by default, because on a phone speaker the microphone can pick up the assistant.
  const [bargeIn, setBargeIn] = useState(() => readFlag("bargeIn"));
  const clearRef = useRef(null); // the koi keep clear of this space around the orb
  const orbRef = useRef(null);
  const openRef = useRef(true);
  const phaseRef = useRef("starting");
  const levelRef = useRef(0);
  const recorderRef = useRef(null);
  const restartTimer = useRef(null);
  // Callbacks come from the latest render, not from the render that opened this view.
  const turnRef = useRef(turn);
  turnRef.current = turn;

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
      converse(wav);
    });
  }

  function restartSoon() {
    clearTimeout(restartTimer.current);
    restartTimer.current = setTimeout(() => {
      const p = phaseRef.current;
      if (openRef.current && p !== "paused" && p !== "error") listen();
    }, 350);
  }

  // One turn. The recording goes up; speech comes back in pieces and is played as it arrives.
  async function converse(wav) {
    setHeard("");
    setSaid("");
    setError("");
    setPhaseBoth("thinking");
    let gotAudio = false;
    let said = "";
    const player = createPcmPlayer({
      onStart: () => {
        if (openRef.current && phaseRef.current === "thinking") setPhaseBoth("speaking");
      },
      onEnd: () => {
        if (openRef.current && phaseRef.current === "speaking") listen();
      },
    });
    try {
      await turnRef.current(wav, {
        onAudio: (data) => {
          gotAudio = true;
          player.push(data);
        },
        onHeard: (text) => setHeard(text),
        onReply: (text) => {
          said += text;
          setSaid(said);
        },
      });
      if (!openRef.current) {
        player.stop();
        return;
      }
      player.end(); // plays what is left, then the listening starts again
      if (!gotAudio) restartSoon(); // there was nothing to say out loud
    } catch (err) {
      player.stop();
      if (!openRef.current) return;
      if (err.status === 400) {
        restartSoon(); // nothing was understood
        return;
      }
      setError(err.message);
      setPhaseBoth("error");
    }
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
    if (!demo) listen();
    return () => {
      openRef.current = false;
      stopAll();
    };
    // Runs once per open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Talking over the assistant ends its answer and starts listening, like in a phone call.
  useEffect(() => {
    if (!bargeIn || phase !== "speaking" || demo) return undefined;
    const monitor = monitorSpeech({
      onSpeech: () => {
        if (!openRef.current || phaseRef.current !== "speaking") return;
        stopSpeaking();
        listen();
      },
    });
    return () => monitor.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bargeIn, phase]);

  function toggleBargeIn() {
    const next = !bargeIn;
    setBargeIn(next);
    writeFlag("bargeIn", next);
  }

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

  const MicIcon = phase === "paused" ? MicOff : Mic;
  const orbLabel = phase === "speaking" ? t("Interrupt the reply") : phase === "paused" ? t("Resume listening") : t("Pause listening");

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) { stopAll(); onClose(); } }}>
    <DialogPrimitive.Content asChild aria-describedby={undefined} {...returnFocus} onInteractOutside={(event) => event.preventDefault()}>
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("Conversation mode")}
      className="fixed inset-0 z-[60] flex flex-col bg-canvas pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(8px,env(safe-area-inset-top))] animate-enter"
    >
      <header className="grid h-12 shrink-0 grid-cols-[3rem_1fr_3rem] items-center px-3">
        <DialogPrimitive.Title className="sr-only">{t("Conversation mode")}</DialogPrimitive.Title>
        <span aria-hidden="true" />
        <span className="caption text-center" aria-live="polite">{label && t(label)}</span>
        <span aria-hidden="true" />
      </header>

      <KoiStage status={status} className="min-h-0 flex-1" clearRef={clearRef}>
        <div
          ref={clearRef}
          className="grid place-items-center rounded-full"
          style={{ width: orbSize * 1.3, height: orbSize * 1.3, background: "color-mix(in srgb, var(--canvas) 82%, transparent)" }}
        >
          <button
            type="button"
            ref={orbRef}
            onClick={onOrbTap}
            disabled={busyPhase}
            aria-label={orbLabel}
            style={{ transform: "scale(calc(1 + var(--level, 0) * 0.28))" }}
            className="grid place-items-center rounded-full transition-transform duration-75 will-change-transform focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-default"
          >
            <OrbView status={status} size={orbSize} decorative render={squares} tilt={0} />
          </button>
        </div>
      </KoiStage>

      <div className="mx-auto grid min-h-[8rem] w-full max-w-xl content-start gap-2 px-6 text-center">
        {heard && phase !== "speaking" && <p className="text-[18px] leading-7 text-fg [text-wrap:pretty]">“{heard}”</p>}
        {phase === "speaking" && said && <p className="max-h-[22vh] overflow-y-auto text-[15px] leading-7 text-fg-muted">{said}</p>}
        {error && (
          <div role="alert" className="grid justify-items-center gap-2">
            <p className="text-sm text-danger">{error}</p>
            {phase === "error" && <Button size="sm" onClick={() => { setError(""); listen(); }}>{t("Try again")}</Button>}
          </div>
        )}
        {hint && !error && <p className="caption normal-case">{t(hint)}</p>}
      </div>

      <div className="flex items-center justify-center gap-6 pt-3">
        <button
          type="button"
          onClick={onOrbTap}
          disabled={busyPhase}
          aria-label={orbLabel}
          aria-pressed={phase === "paused"}
          className="pressable grid size-14 place-items-center rounded-full border border-border-strong bg-raised text-fg hover:bg-border disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <MicIcon size={22} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => { stopAll(); onClose(); }}
          aria-label={t("End conversation")}
          className="pressable grid size-14 place-items-center rounded-full bg-fg text-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <X size={24} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        onClick={toggleBargeIn}
        aria-pressed={bargeIn}
        className="caption mx-auto mt-3 min-h-8 px-3 normal-case hover:text-fg focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
      >
        {bargeIn ? t("Interrupt by speaking: on") : t("Interrupt by speaking: off")}
      </button>
    </div>
    </DialogPrimitive.Content>
    </DialogPrimitive.Root>
  );
}

function readFlag(name) {
  try {
    return window.localStorage.getItem("voice." + name) === "1";
  } catch {
    return false;
  }
}

function writeFlag(name, value) {
  try {
    window.localStorage.setItem("voice." + name, value ? "1" : "0");
  } catch {
    /* private mode: applies for this visit only */
  }
}

function orbSizeFor() {
  if (typeof window === "undefined") return 240;
  // Big on phones, but never taller than the space above the text.
  return Math.round(Math.max(150, Math.min(window.innerWidth * 0.62, window.innerHeight * 0.3, 300)));
}
