import { t } from "./i18n/index.js";
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Every request is sent with the session cookie. JSON bodies are required for
// writes; the server rejects other content types (CSRF protection).
export async function api(path, { method = "GET", body } = {}) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: method === "GET" ? {} : { "Content-Type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data.error || `Request failed (${response.status})`, response.status);
  }
  return data;
}

// Sends a message and receives the answer while it is written (server-sent events).
// onDelta(text): a piece of the answer. onReset(): the words so far were only a lead-in. Resolves with the saved answer.
export async function apiStream(path, body, { onDelta, onReset } = {}) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(data.error || `Request failed (${response.status})`, response.status);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done = null;
  for (;;) {
    const { value, done: finished } = await reader.read();
    if (finished) break;
    buffer += decoder.decode(value, { stream: true });
    let end;
    while ((end = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const line = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      let event;
      try {
        event = JSON.parse(line.slice(5).trim());
      } catch {
        continue;
      }
      if (event.type === "delta") onDelta?.(event.text);
      else if (event.type === "reset") onReset?.();
      else if (event.type === "error") throw new ApiError(event.error || "Something went wrong.", event.status || 500);
      else if (event.type === "done") done = event;
    }
  }
  if (!done) throw new ApiError(t("The connection was lost. Open the chat again to see if the answer arrived."), 0);
  return done;
}

export async function fetchSpeechAudio(text) {
  const response = await fetch("/api/tts", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new ApiError(t("Voice service unavailable."), response.status);
  return response.blob();
}
