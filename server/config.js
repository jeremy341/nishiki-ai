import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function env(name, fallback = "") {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

export const config = {
  root: ROOT,
  host: env("HOST", "127.0.0.1"),
  port: Number(env("PORT", "8787")),
  // Public address the browser uses, e.g. https://ai.example.com (needed for Google's redirect).
  publicUrl: env("PUBLIC_URL", "http://localhost:8787").replace(/\/$/, ""),
  dataDir: path.resolve(ROOT, env("DATA_DIR", "data")),
  // Room for uploaded files on this server's disk, shared by everyone. Files live in DATA_DIR/files.
  storageLimitMb: Number(env("STORAGE_LIMIT_MB", "500")),
  // Invite-only: how many accounts exist at most.
  maxUsers: 5,
  assistantName: env("ASSISTANT_NAME", "Nishiki"),
  // Time zone for "today", "tomorrow" and calendar times. Defaults to the zone of this server.
  timezone: env("TIMEZONE", Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"),

  ai: {
    // Hack Club AI is OpenAI-compatible. Key stays on the server only.
    apiKey: env("HACKCLUB_API_KEY"),
    baseUrl: env("HACKCLUB_BASE_URL", "https://ai.hackclub.com/proxy/v1").replace(/\/$/, ""),
    // Claude Haiku 5.5 via Hack Club AI. Confirm ids with GET /proxy/v1/models.
    model: env("HACKCLUB_MODEL", "anthropic/claude-haiku-5.5"),
    maxTokens: Number(env("AI_MAX_TOKENS", "1500")),
    voiceModel: env("VOICE_MODEL", "google/gemini-3.1-flash-lite"), // answers in voice mode: fast (about 1.7 s per answer with tools) and the best of the fast ones in tests
    // How much of a chat is sent to the model per reply (characters, roughly 4 per token).
    // Older parts beyond this are summarized, not dropped.
    historyChars: Number(env("HISTORY_CHARS", "60000")), // chat history sent per request, in characters
    maxTurnTokens: Number(env("AI_MAX_TURN_TOKENS", "60000")), // all model tokens one reply may use, across its tool steps
    toolOutputChars: Number(env("TOOL_OUTPUT_CHARS", "8000")), // tool result sent back to the model, per tool call
    attachmentBytesPerRequest: Number(env("ATTACHMENT_BYTES_PER_REQUEST", String(8 * 1024 * 1024))), // photos and PDFs sent as data per request
  },

  // Speech-to-text: a dedicated audio model on Hack Club AI (WAV in, text out).
  stt: {
    model: env("STT_MODEL", "mistralai/voxtral-small-24b-2507"),
  },

  // Server voice: an audio-output model on Hack Club AI reads replies aloud.
  // TTS_ENABLED=0 turns it off and the browser voice is used instead.
  voice: {
    live: env("VOICE_LIVE", "1") !== "0", // fast voice mode: one audio model listens and answers
    // Longest spoken answer, in model tokens (spoken audio is about 20 tokens per second, so 900 is about 45 seconds).
    // The prompt keeps answers short on its own; this only stops a runaway answer, and cuts nothing off in normal use.
    maxTokens: Number(env("VOICE_MAX_TOKENS", "900")),
  },
  tts: {
    enabled: env("TTS_ENABLED", "1") !== "0",
    model: env("TTS_MODEL", "openai/gpt-audio-mini"),
    voice: env("TTS_VOICE", "marin"),
    format: "wav", // the provider streams raw PCM16 only; the server wraps it as WAV
  },

  google: {
    clientId: env("GOOGLE_CLIENT_ID"),
    clientSecret: env("GOOGLE_CLIENT_SECRET"),
    // 32-byte key, base64. Encrypts Google refresh tokens at rest.
    encryptionKey: env("ENCRYPTION_KEY"),
    redirectUri: `${env("PUBLIC_URL", "http://localhost:8787").replace(/\/$/, "")}/api/google/callback`,
    scopes: [
      "openid",
      "email",
      // Narrowest scope that can read and create events on the user's calendars.
      "https://www.googleapis.com/auth/calendar.events",
      // Gmail: read headers and previews, and send mail (only after the user confirms).
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      // Drive: file names, dates and links only, never file contents.
      "https://www.googleapis.com/auth/drive.metadata.readonly",
    ],
  },
};

export const isSecureContext = config.publicUrl.startsWith("https://");
