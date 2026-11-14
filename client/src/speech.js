// Reply playback. Only the server voice (openai/gpt-audio-mini on Hack Club AI) is ever used:
// the browser's own voice is never a fallback. Speech-to-text lives in recorder.js.
import { fetchSpeechAudio } from "./api.js";

let audioEl = null;
let audioUrl = null;

// iOS Safari only lets audio start inside a user gesture. Call this from a click
// handler so later replies are allowed to play.
export function unlockSpeech() {
  // Creating or resuming the audio context needs a gesture too; the meter depends on it.
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    meterCtx ||= new AC();
    meterCtx.resume?.().catch(() => {});
  }
  if (!audioEl) audioEl = new Audio();
}

let playRun = 0;

// Speaks text with the server voice, one short piece at a time. The next pieces are requested while the
// current one plays, so there is no gap between sentences. A piece that fails is requested once more;
// if it still fails it is left out (it is never read by another voice). onError is called when nothing
// could be played at all.
// Callbacks let the UI show the "speaking" state only while audio is really playing.
export async function speak(text, { useServerVoice, onStart, onEnd, onError }) {
  stopSpeaking();
  if (!useServerVoice) {
    onError?.("not-supported");
    return;
  }
  const run = ++playRun;
  const pieces = splitForSpeech(text);
  const load = (piece) => fetchSpeechAudio(piece).catch(() => fetchSpeechAudio(piece));
  const fetched = new Array(pieces.length);
  const request = (i) => {
    if (i < pieces.length && !fetched[i]) {
      fetched[i] = load(pieces[i]);
      fetched[i].catch(() => {});
    }
  };
  request(0);
  request(1);
  let played = 0;
  for (let i = 0; i < pieces.length; i += 1) {
    let blob;
    try {
      blob = await fetched[i];
    } catch {
      request(i + 2);
      continue;
    }
    if (run !== playRun) return;
    request(i + 2);
    try {
      await playBlob(blob, run, played === 0 ? onStart : undefined);
      played += 1;
    } catch {
      /* this piece could not be played; go on with the next one */
    }
    if (run !== playRun) return;
  }
  if (run !== playRun) return;
  if (played === 0) onError?.("synthesis");
  else onEnd?.();
}

// Plays one audio piece. Resolves when it ended; rejects when it cannot be played.
function playBlob(blob, run, onFirstSound) {
  return new Promise((resolve, reject) => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(blob);
    audioEl ||= new Audio();
    audioEl.src = audioUrl;
    ensurePlaybackMeter();
    meterCtx?.resume?.().catch(() => {});
    audioEl.onplaying = () => onFirstSound?.();
    audioEl.onended = () => resolve();
    audioEl.onerror = () => (run === playRun ? reject(new Error("audio")) : resolve());
    audioEl.play().catch(reject);
  });
}

// Short pieces: the first is a single sentence so sound starts early; later ones are a few sentences each.
function splitForSpeech(text) {
  const clean = String(text).replace(/[*_`#>]+/g, "").replace(/\s+/g, " ").trim();
  const sentences = clean.match(/[^.!?…\n]+[.!?…]*\s*/g) || [clean];
  const pieces = [];
  let current = "";
  for (const sentence of sentences) {
    current += sentence;
    const target = pieces.length === 0 ? 40 : 220;
    if (current.length >= target) {
      pieces.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) pieces.push(current.trim());
  return pieces.length ? pieces : [clean];
}

export function stopSpeaking() {
  playRun += 1;
  currentPcm?.stop();
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
  if (currentPcm && pcmAnalyser) return rmsOf(pcmAnalyser);
  return playbackAnalyser ? rmsOf(playbackAnalyser) : 0;
}

export const hasPlaybackMeter = () => Boolean((currentPcm && pcmAnalyser) || playbackAnalyser);

// ---- Streamed speech (fast voice mode) ----
// The server sends raw 16-bit mono PCM at 24 kHz in small pieces. Each piece is scheduled right after the
// previous one, so playback starts with the first piece and carries on without gaps.

let currentPcm = null;
let pcmAnalyser = null;

export function createPcmPlayer({ onStart, onEnd } = {}) {
  stopSpeaking();
  const AC = window.AudioContext || window.webkitAudioContext;
  meterCtx ||= new AC();
  const ctx = meterCtx;
  ctx.resume?.().catch(() => {});
  const gain = ctx.createGain();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  gain.connect(analyser);
  analyser.connect(ctx.destination);
  pcmAnalyser = analyser;

  const sources = new Set();
  let nextTime = 0;
  let started = false;
  let ended = false;
  let stopped = false;
  let finished = false;

  function check() {
    if (stopped || finished || !ended || sources.size > 0) return;
    finished = true;
    if (currentPcm === player) currentPcm = null;
    onEnd?.();
  }

  const player = {
    get started() { return started; },
    push(base64) {
      if (stopped || !base64) return;
      const bytes = atob(base64);
      const samples = bytes.length >> 1;
      if (!samples) return;
      const buffer = ctx.createBuffer(1, samples, 24000);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < samples; i += 1) {
        let value = (bytes.charCodeAt(2 * i + 1) << 8) | bytes.charCodeAt(2 * i);
        if (value & 0x8000) value -= 0x10000;
        channel[i] = value / 32768;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      const now = ctx.currentTime;
      // A little lead on the first piece, and a little after a gap, so playback never stutters.
      if (nextTime < now + 0.02) nextTime = now + (started ? 0.04 : 0.12);
      source.start(nextTime);
      nextTime += buffer.duration;
      sources.add(source);
      source.onended = () => {
        sources.delete(source);
        check();
      };
      if (!started) {
        started = true;
        onStart?.();
      }
    },
    end() {
      ended = true;
      check();
    },
    stop() {
      if (stopped) return;
      stopped = true;
      for (const source of sources) {
        try { source.stop(); } catch { /* already finished */ }
      }
      sources.clear();
      if (currentPcm === player) currentPcm = null;
    },
  };
  currentPcm = player;
  return player;
}

