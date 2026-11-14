// Records speech from the microphone and turns it into 16 kHz mono WAV for the speech model.
// Works the same on Chrome, Edge and Safari, because the browser's own audio decoder reads
// whatever format the phone recorded before it is re-encoded.
import { api } from "./api.js";

export const canRecord = typeof window !== "undefined"
  && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";

const RATE = 16000;
const LEVEL_THRESHOLD = 0.06; // speech detection, on the 0..1 meter scale

function pickMimeType() {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return options.find((type) => MediaRecorder.isTypeSupported?.(type)) || "";
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function encodeWav(samples, rate) {
  const dataLength = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  const writeText = (offset, text) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, dataLength, true);
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}

// Decodes whatever the phone recorded, then resamples to 16 kHz mono WAV (base64).
async function blobToWavBase64(blob) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const decodeContext = new AC();
  const decoded = await decodeContext.decodeAudioData(await blob.arrayBuffer());
  decodeContext.close?.();
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * RATE), RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination); // stereo is mixed down to mono here
  source.start();
  const rendered = await offline.startRendering();
  return bytesToBase64(encodeWav(rendered.getChannelData(0), RATE));
}

// Starts recording. Returns { done, stop, cancel }.
//   done resolves to { wav, error }: wav is base64 WAV, or null when there was no speech.
//   stop() ends and keeps what was said. cancel() ends and discards it.
// Manual mode (dictation) records until stop(). Otherwise recording ends by itself after
// the speaker pauses, and gives up if nobody speaks for a while.
export function startRecording({
  manual = false,
  silenceMs = 900,
  noSpeechMs = 10000,
  maxMs = 60000,
  onLevel,
} = {}) {
  let finish;
  const done = new Promise((resolve) => { finish = resolve; });
  const chunks = [];
  let recorder = null;
  let stream = null;
  let ctx = null;
  let frame = 0;
  let ended = false;
  let speaking = false;
  let lastVoice = 0;
  const startedAt = performance.now();

  const release = () => {
    cancelAnimationFrame(frame);
    stream?.getTracks().forEach((t) => t.stop());
    ctx?.close?.().catch?.(() => {});
  };

  function end(keep) {
    if (ended) return;
    ended = true;
    if (!recorder || recorder.state === "inactive") {
      release();
      finish({ wav: null });
      return;
    }
    recorder.onstop = async () => {
      release();
      if (!keep || !speaking) {
        finish({ wav: null });
        return;
      }
      try {
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        finish({ wav: await blobToWavBase64(blob) });
      } catch {
        finish({ wav: null, error: "decode" });
      }
    };
    recorder.stop();
  }

  (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      ended = true;
      finish({ wav: null, error: err.name === "NotAllowedError" ? "not-allowed" : "microphone" });
      return;
    }
    if (ended) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);

    const type = pickMimeType();
    recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.start(250);

    const buffer = new Uint8Array(analyser.fftSize);
    const tick = (now) => {
      if (ended) return;
      analyser.getByteTimeDomainData(buffer);
      let sum = 0;
      for (const v of buffer) {
        const x = (v - 128) / 128;
        sum += x * x;
      }
      const level = Math.min(1, Math.sqrt(sum / buffer.length) * 3);
      onLevel?.(level);
      if (level > LEVEL_THRESHOLD) {
        speaking = true;
        lastVoice = now;
      }
      const elapsed = now - startedAt;
      if (!manual) {
        if (!speaking && elapsed > noSpeechMs) return end(false);
        if (speaking && now - lastVoice > silenceMs) return end(true);
      }
      if (elapsed > maxMs) return end(speaking);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  })().catch(() => {
    if (!ended) {
      ended = true;
      release();
      finish({ wav: null, error: "microphone" });
    }
  });

  return {
    done,
    stop: () => end(true),
    cancel: () => end(false),
  };
}

// Sends a WAV to the speech model. Resolves to the transcript ("" when nothing was said).
export async function transcribe(wavBase64) {
  const data = await api("/api/transcribe", { method: "POST", body: { audio: wavBase64 } });
  return data.text || "";
}

export { bytesToBase64 };
