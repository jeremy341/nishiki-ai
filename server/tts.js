import { config } from "./config.js";
import { AppError } from "./errors.js";
import { resolveRole, roleConfigured } from "./providers.js";

// Voice is produced by the provider set for the "tts" job: an audio-output chat model.
// The app asks it to read the reply aloud, verbatim. The audio arrives as base64 chunks
// in a streamed response.
export function serverTtsConfigured() {
  return config.tts.enabled && roleConfigured("tts");
}

export function ttsFormat() {
  return resolveRole("tts").format || "mp3";
}

const SPEAK_SYSTEM = "You are a text-to-speech engine. Read the user's message aloud exactly as written, "
  + "in the language it is written in. German text must be spoken in German, with natural native German pronunciation and a warm, relaxed tone; "
  + "never read German with an English accent and never translate. Do not add, remove or comment on anything.";

export async function synthesizeSpeech(text, voice) {
  if (!serverTtsConfigured()) throw new AppError(404, "Server-side voice is not configured.");
  const r = resolveRole("tts");

  let response;
  try {
    response = await fetch(`${r.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${r.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: r.model,
        modalities: ["text", "audio"],
        audio: { voice: voice || r.voice || "alloy", format: r.format || "mp3" },
        stream: true,
        max_tokens: 3000,
        messages: [
          { role: "system", content: SPEAK_SYSTEM },
          { role: "user", content: text },
        ],
      }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    throw new AppError(502, "The voice service could not be reached.");
  }
  if (!response.ok || !response.body) {
    console.warn("TTS provider returned HTTP", response.status);
    throw new AppError(502, "The voice service returned an error.");
  }

  // Server-sent events: "data: {...}" lines, ending with "data: [DONE]".
  const decoder = new TextDecoder();
  let buffer = "";
  const audioChunks = [];
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let newline;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const data = JSON.parse(payload);
        const piece = data.choices?.[0]?.delta?.audio?.data;
        if (typeof piece === "string") audioChunks.push(piece);
      } catch {
        /* keep-alive or partial frame */
      }
    }
  }

  if (!audioChunks.length) throw new AppError(502, "The voice service returned no audio.");
  // Concatenate the base64 text first, then decode once. Decoding each piece on its own can corrupt it.
  return Buffer.from(audioChunks.join(""), "base64");
}
