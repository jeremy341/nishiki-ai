import { config } from "./config.js";
import { db } from "./db.js";
import { AppError } from "./errors.js";

// Settings per user, and the features the admin allows for each user.
// Everything is stored in the database, so it follows the account on every device.

export const DEFAULT_PREFS = {
  customInstructions: "",
  personality: "balanced", // balanced | concise | detailed
  language: "auto", // auto | de | en
  memory: true,
  webSearch: true,
  readAloud: false, // replies are only read aloud when the user turns it on
  theme: "system", // system | light | dark
  voice: "marin", // voice for read-aloud replies
  uiLanguage: "de", // language of the interface: de | en
  uiStyle: "koi", // look of the app: koi (the default, the pond look) | classic
  learnFromChats: true, // save durable facts from chats as memories (the user can see and delete them)
};

// All of these work with the audio model; marin and cedar are the most natural.
export const VOICES = ["marin", "cedar", "coral", "sage", "ballad", "verse", "alloy", "ash", "echo", "shimmer", "fable", "onyx", "nova"];

export const DEFAULT_FEATURES = {
  web: true, // web search and reading pages
  memory: true,
  mail: true,
  calendar: true,
  gmail: true,
  mcp: true, // connectors (MCP servers)
  drive: true, // Google Drive file names
  apps: true, // apps that use a personal token (Todoist, GitHub, Notion)
};

const ENUMS = {
  personality: ["balanced", "concise", "detailed"],
  language: ["auto", "de", "en"],
  theme: ["system", "light", "dark"],
  uiLanguage: ["de", "en"],
  uiStyle: ["classic", "koi"],
  voice: VOICES,
};

function readJson(userId, column) {
  const row = db.prepare(`SELECT ${column} AS value FROM user_prefs WHERE user_id = ?`).get(userId);
  try {
    return row ? JSON.parse(row.value) : {};
  } catch {
    return {};
  }
}

function writeRow(userId, prefs, features) {
  db.prepare(`
    INSERT INTO user_prefs (user_id, prefs, features) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET prefs = excluded.prefs, features = excluded.features
  `).run(userId, JSON.stringify(prefs), JSON.stringify(features));
}

export function getPrefs(userId) {
  return { ...DEFAULT_PREFS, ...readJson(userId, "prefs") };
}

// What new users start with. The admin can change it (General).
export function defaultFeatures() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'defaults'").get();
  let stored = {};
  try {
    stored = row ? JSON.parse(row.value) : {};
  } catch {
    stored = {};
  }
  return { ...DEFAULT_FEATURES, ...stored };
}

export function getFeatures(userId) {
  return { ...defaultFeatures(), ...readJson(userId, "features") };
}

export function saveDefaultFeatures(input) {
  const clean = {};
  for (const key of Object.keys(DEFAULT_FEATURES)) {
    if (typeof input[key] === "boolean") clean[key] = input[key];
  }
  const next = { ...defaultFeatures(), ...clean };
  db.prepare("INSERT INTO settings (key, value) VALUES ('defaults', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(JSON.stringify(next));
  return next;
}

// Only known keys with valid values are kept.
export function savePrefs(userId, input) {
  const clean = {};
  if (typeof input.customInstructions === "string") clean.customInstructions = input.customInstructions.slice(0, 1500);
  for (const key of ["personality", "language", "theme", "voice", "uiLanguage", "uiStyle"]) {
    if (input[key] !== undefined) {
      if (!ENUMS[key].includes(input[key])) throw new AppError(400, `Unknown ${key}.`);
      clean[key] = input[key];
    }
  }
  for (const key of ["memory", "webSearch", "readAloud", "learnFromChats"]) {
    if (typeof input[key] === "boolean") clean[key] = input[key];
  }
  const prefs = { ...readJson(userId, "prefs"), ...clean };
  writeRow(userId, prefs, readJson(userId, "features"));
  return getPrefs(userId);
}

// Admin only: which features a user may use at all.
export function saveFeatures(userId, input) {
  const clean = {};
  for (const key of Object.keys(DEFAULT_FEATURES)) {
    if (typeof input[key] === "boolean") clean[key] = input[key];
  }
  const features = { ...readJson(userId, "features"), ...clean };
  writeRow(userId, readJson(userId, "prefs"), features);
  return getFeatures(userId);
}

export function assistantName() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'app'").get();
  try {
    const app = row ? JSON.parse(row.value) : {};
    return app.assistantName || config.assistantName;
  } catch {
    return config.assistantName;
  }
}

export function saveAssistantName(name) {
  const clean = String(name || "").trim().slice(0, 40);
  if (!clean) throw new AppError(400, "The assistant needs a name.");
  db.prepare("INSERT INTO settings (key, value) VALUES ('app', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(JSON.stringify({ assistantName: clean }));
  return clean;
}
