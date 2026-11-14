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
