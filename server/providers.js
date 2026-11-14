import { config } from "./config.js";
import { db } from "./db.js";
import { AppError } from "./errors.js";
import { decryptSecret, encryptSecret } from "./security.js";

// The AI is always Hack Club AI. One base address and one key, both from the server's
// .env file. The admin only chooses which model does each job, from the list Hack Club
// publishes. The choice is stored in the settings table.

const PROVIDER_ID = "hackclub";
const PROVIDER_NAME = "Hack Club AI";
const ROLES_KEY = "ai_roles";
const MODELS_TTL_MS = 10 * 60 * 1000;
const VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
const FORMATS = ["mp3", "wav", "flac", "opus"];

export const ROLES = ["chat", "stt", "tts"];

let rolesCache = null;
let modelsCache = null;

function defaults() {
  return {
    chat: { model: config.ai.model },
    stt: { model: config.stt.model },
    tts: { model: config.tts.model, voice: config.tts.voice, format: config.tts.format },
  };
}

function loadRoles() {
  if (rolesCache) return rolesCache;
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(ROLES_KEY);
  let stored = {};
  try {
    stored = row ? JSON.parse(row.value) : {};
  } catch {
    stored = {};
  }
  rolesCache = { ...defaults(), ...stored };
  return rolesCache;
}

function saveRolesRow(value) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(ROLES_KEY, JSON.stringify(value));
  rolesCache = value;
}

export function aiBaseUrl() {
  return config.ai.baseUrl.replace(/\/$/, "");
}

export function aiConfigured() {
  return Boolean(currentApiKey());
}

// The key the admin saved in the app (encrypted), or the one in the .env file.
export function currentApiKey() {
  return storedAiKey() || config.ai.apiKey || "";
}

function storedAiKey() {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(AI_KEY_SETTING);
  if (!row) return "";
  try {
    return decryptSecret(row.value);
  } catch {
    return "";
  }
}

// Stores the key encrypted. It is never sent back to the browser.
export function saveAiKey(key) {
  let sealed;
  try {
    sealed = encryptSecret(key);
  } catch {
    throw new AppError(503, "The server has no ENCRYPTION_KEY, so the key cannot be stored. Ask the server admin to set it.");
  }
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(AI_KEY_SETTING, sealed);
  modelsCache = null;
}

export function clearAiKey() {
  db.prepare("DELETE FROM settings WHERE key = ?").run(AI_KEY_SETTING);
  modelsCache = null;
}

const AI_KEY_SETTING = "ai_key_enc";

// Resolves a job to the one provider, its key and the chosen model.
export function resolveRole(role) {
  if (!aiConfigured()) {
    throw new AppError(503, "The AI is not set up yet. The admin needs to add HACKCLUB_API_KEY to the server settings.");
  }
  const assignment = loadRoles()[role] || {};
  return {
    providerId: PROVIDER_ID,
    providerName: PROVIDER_NAME,
    baseUrl: aiBaseUrl(),
    apiKey: currentApiKey(),
    model: assignment.model,
    exa: true,
    voice: assignment.voice,
    format: assignment.format,
  };
}

export function roleConfigured(role) {
  return aiConfigured() && Boolean(loadRoles()[role]?.model);
}

// What the admin page shows: the address, whether the key is set (never the key), the choices.
export function publicAi() {
  return {
    provider: {
      id: PROVIDER_ID, name: PROVIDER_NAME, baseUrl: aiBaseUrl(), keySet: aiConfigured(),
      keySource: storedAiKey() ? "app" : config.ai.apiKey ? "env" : null,
    },
    roles: loadRoles(),
    voices: VOICES,
    formats: FORMATS,
  };
}

// The model list Hack Club publishes, with what each model accepts and produces, so the
// admin can filter by job (chat: text, speech to text: audio in, voice: audio out).
export async function listModels() {
  if (modelsCache && Date.now() - modelsCache.at < MODELS_TTL_MS) return modelsCache.list;
  let response;
  try {
    response = await fetch(`${aiBaseUrl()}/models`, {
      headers: aiConfigured() ? { Authorization: `Bearer ${currentApiKey()}` } : {},
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new AppError(502, "Hack Club AI could not be reached.");
  }
  if (!response.ok) throw new AppError(502, `Hack Club AI returned an error (${response.status}).`);
  const data = await response.json();
  const list = (data.data || [])
    .filter((m) => m && typeof m.id === "string" && !m.id.endsWith(":batch"))
    .map((m) => ({
      id: m.id,
      name: String(m.name || m.id).slice(0, 120),
      input: m.architecture?.input_modalities || [],
      output: m.architecture?.output_modalities || [],
      context: m.context_length || null,
      reasoning: Array.isArray(m.supported_parameters) && m.supported_parameters.includes("reasoning"),
    }));
  modelsCache = { at: Date.now(), list };
  return list;
}

// Whether a model takes the reasoning setting. Unknown models get no setting.
export async function supportsReasoning(model) {
  const list = await listModels().catch(() => []);
  return Boolean(list.find((m) => m.id === model)?.reasoning);
}

// Saves the admin's choices. The test button checks a model when it is used.
export function saveRoles(input) {
  const next = { ...loadRoles() };
  for (const role of ROLES) {
    const r = input?.roles?.[role];
    if (!r || typeof r.model !== "string" || !r.model.trim() || r.model.length > 120) {
      throw new AppError(400, `Pick a model for ${role}.`);
    }
    next[role] = { model: r.model.trim() };
    if (role === "tts") {
      next[role].voice = VOICES.includes(r.voice) ? r.voice : "alloy";
      next[role].format = FORMATS.includes(r.format) ? r.format : "mp3";
    }
  }
  saveRolesRow(next);
  return publicAi();
}

export function secretsEnabled() {
  try {
    decryptSecret(encryptSecret("probe"));
    return true;
  } catch {
    return false;
  }
}
