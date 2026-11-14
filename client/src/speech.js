// Reply playback: server voice when available, otherwise the browser voice.
// Speech-to-text lives in recorder.js.
import { fetchSpeechAudio } from "./api.js";

export const canSpeakInBrowser = typeof window !== "undefined" && "speechSynthesis" in window;

const speechLang = () => navigator.language || "en-US";

let audioEl = null;
let audioUrl = null;

// iOS Safari only lets speech start inside a user gesture. Call this from a click
// handler so later replies are allowed to play.
export function unlockSpeech() {
  // Creating or resuming the audio context needs a gesture too; the meter depends on it.
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    meterCtx ||= new AC();
    meterCtx.resume?.().catch(() => {});
  }
  if (canSpeakInBrowser) {
    const utterance = new SpeechSynthesisUtterance(" ");
    utterance.volume = 0;
    window.speechSynthesis.speak(utterance);
  }
  if (!audioEl) audioEl = new Audio();
}

// Speaks text. Prefers the server voice when configured, falls back to the browser voice.
// Callbacks let the UI show the "speaking" state only while audio is really playing.
export async function speak(text, { useServerVoice, onStart, onEnd, onError }) {
  stopSpeaking();
  if (useServerVoice) {
    let fellBack = false;
    const fallback = () => {
      if (fellBack) return;
      fellBack = true;
      speakInBrowser(text, { onStart, onEnd, onError });
    };
    try {
      const blob = await fetchSpeechAudio(text);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      audioUrl = URL.createObjectURL(blob);
      audioEl ||= new Audio();
      audioEl.src = audioUrl;
      ensurePlaybackMeter();
      meterCtx?.resume?.().catch(() => {});
      audioEl.onplaying = () => onStart?.();
      audioEl.onended = () => onEnd?.();
      // Undecodable audio or a blocked autoplay: use the browser voice instead.
      audioEl.onerror = fallback;
      await audioEl.play();
      return;
    } catch {
      fallback();
      return;
    }
  }
  speakInBrowser(text, { onStart, onEnd, onError });
}

function speakInBrowser(text, { onStart, onEnd, onError }) {
  if (!canSpeakInBrowser) {
    onError?.("not-supported");
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = speechLang();
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang?.startsWith(utterance.lang.slice(0, 2)));
  if (voice) utterance.voice = voice;
  utterance.rate = 1;
  utterance.onstart = () => onStart?.();
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onError?.("synthesis");
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (canSpeakInBrowser) window.speechSynthesis.cancel();
  if (audioEl) {
    audioEl.pause();
    audioEl.removeAttribute("src");
    audioEl.load();
  }
}

// ---- Level meters for the reactive orb (real audio only, nothing is faked here) ----

let meterCtx = null;
let playbackAnalyser = null;
let playbackSource = null;

// Taps the server-voice element once, so its loudness can drive the orb.
function ensurePlaybackMeter() {
  if (playbackAnalyser || !audioEl) return playbackAnalyser;
  // Routing the element through a suspended context would silence it, so only connect when running.
  if (!meterCtx || meterCtx.state !== "running") return null;
  try {
    playbackSource = meterCtx.createMediaElementSource(audioEl);
    playbackAnalyser = meterCtx.createAnalyser();
    playbackAnalyser.fftSize = 256;
    playbackSource.connect(playbackAnalyser);
    playbackAnalyser.connect(meterCtx.destination);
  } catch {
    playbackAnalyser = null;
  }
  return playbackAnalyser;
}

function rmsOf(analyser) {
  const buffer = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(buffer);
  let sum = 0;
  for (const v of buffer) {
    const x = (v - 128) / 128;
    sum += x * x;
  }
  return Math.min(1, Math.sqrt(sum / buffer.length) * 3);
}

// 0..1 loudness of the reply being played; 0 when no meter is available.
export function playbackLevel() {
  return playbackAnalyser ? rmsOf(playbackAnalyser) : 0;
}

export const hasPlaybackMeter = () => Boolean(playbackAnalyser);

