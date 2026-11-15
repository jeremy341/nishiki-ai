import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.js";

fs.mkdirSync(config.dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(config.dataDir, "app.db"));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS conversations_user_idx ON conversations(user_id, updated_at);

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    mime TEXT NOT NULL,
    name TEXT NOT NULL,
    size INTEGER NOT NULL,
    data BLOB NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS attachments_conv_idx ON attachments(conversation_id);

  -- Things the assistant wants to do that change data. They run only after the user taps Confirm.
  CREATE TABLE IF NOT EXISTS pending_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    details TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Facts the user asked the assistant to remember. Always visible and deletable.
  CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- One row per model call that returned token counts. Feeds the daily limits and the usage view.
  CREATE TABLE IF NOT EXISTS usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS usage_user_idx ON usage(user_id, created_at);
  -- One row per spoken turn in voice mode, to keep the cost of voice in check (VOICE_DAILY_TURNS).
  CREATE TABLE IF NOT EXISTS voice_turns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS voice_turns_idx ON voice_turns(user_id, created_at);

  -- Mail and notification settings, one row per user. Secrets are encrypted.
  CREATE TABLE IF NOT EXISTS mail_settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    host TEXT NOT NULL DEFAULT 'imap.mail.yahoo.com',
    address TEXT,
    password_enc TEXT,
    ntfy_topic_enc TEXT,
    report_enabled INTEGER NOT NULL DEFAULT 0,
    consent INTEGER NOT NULL DEFAULT 0,
    last_uid INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Key/value store for app configuration (AI providers and model roles).
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- What each user chose in Settings, and what the admin allows for them.
  CREATE TABLE IF NOT EXISTS user_prefs (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    prefs TEXT NOT NULL DEFAULT '{}',
    features TEXT NOT NULL DEFAULT '{}'
  );

  -- MCP servers (tool providers). The admin adds them; each user switches them on or off.
  CREATE TABLE IF NOT EXISTS mcp_servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    token_enc TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS user_mcp (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    server_id INTEGER NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
    enabled INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, server_id)
  );

  CREATE TABLE IF NOT EXISTS google_accounts (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email TEXT,
    refresh_token_enc TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_apps (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    app_id TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, app_id)
  );
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    instructions TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- Invite links. Only a hash of the link is stored; each link works once and expires.
  -- Scheduled tasks: a prompt that runs once, daily or weekly, in its own chat.
  CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    prompt TEXT NOT NULL,
    mode TEXT NOT NULL,
    time_of_day TEXT,
    weekday INTEGER,
    run_at_ms INTEGER,
    tz TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    next_run_ms INTEGER,
    last_run_ms INTEGER,
    last_conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
    last_error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS tasks_due_idx ON scheduled_tasks(enabled, next_run_ms);
  CREATE TABLE IF NOT EXISTS invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at INTEGER NOT NULL,
    used_at TEXT,
    used_by INTEGER REFERENCES users(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS user_app_tokens (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    app_id TEXT NOT NULL,
    token_enc TEXT NOT NULL,
    PRIMARY KEY (user_id, app_id)
  );
  CREATE TABLE IF NOT EXISTS oauth_states (
    state TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
`);

function addColumnIfMissing(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!columns.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

// Rolling summary of the older part of each chat (see context.js).
addColumnIfMissing("conversations", "summary", "TEXT");
addColumnIfMissing("conversations", "summary_upto", "INTEGER");
// Web sources used for an answer, as JSON.
addColumnIfMissing("messages", "sources", "TEXT");
// Charts and tables the assistant showed in an answer, as JSON.
addColumnIfMissing("messages", "widgets", "TEXT");
// Short, human summary of what the assistant used for an answer, e.g. "Searched your Gmail".
addColumnIfMissing("messages", "activity", "TEXT");
// What the model thought before answering (only when the stronger model was used), shown folded away under the answer.
addColumnIfMissing("messages", "thinking", "TEXT");
// Uploads are kept as files on the server's disk (path); older ones stay in the database (data).
addColumnIfMissing("attachments", "path", "TEXT");
// Plain text of Word, CSV and text files, read once at upload.
addColumnIfMissing("attachments", "text", "TEXT");
// Chats can be pinned and grouped into projects.
addColumnIfMissing("conversations", "pinned", "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing("conversations", "project_id", "INTEGER REFERENCES projects(id) ON DELETE SET NULL");
// Where a memory came from: the user ("user") or a chat the assistant learned it from ("chat").
addColumnIfMissing("memories", "source", "TEXT NOT NULL DEFAULT 'user'");
// Per-user switches and daily limits. NULL limit = no limit.
addColumnIfMissing("users", "active", "INTEGER NOT NULL DEFAULT 1");
addColumnIfMissing("users", "daily_message_limit", "INTEGER");
addColumnIfMissing("users", "daily_token_limit", "INTEGER");
// Scopes Google granted with the last sign-in (Gmail needs an extra scope).
addColumnIfMissing("google_accounts", "scope", "TEXT");

// Databases created before conversations existed: move their loose messages into
// one "Earlier chat" per user so nothing is lost.
const messageColumns = db.prepare("PRAGMA table_info(messages)").all().map((c) => c.name);
if (!messageColumns.includes("conversation_id")) {
  db.exec("ALTER TABLE messages ADD COLUMN conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE");
}
const orphanUsers = db.prepare("SELECT DISTINCT user_id FROM messages WHERE conversation_id IS NULL").all();
for (const { user_id: userId } of orphanUsers) {
  const { lastInsertRowid } = db.prepare("INSERT INTO conversations (user_id, title) VALUES (?, 'Earlier chat')").run(userId);
  db.prepare("UPDATE messages SET conversation_id = ? WHERE user_id = ? AND conversation_id IS NULL")
    .run(Number(lastInsertRowid), userId);
}
db.exec("CREATE INDEX IF NOT EXISTS messages_conv_idx ON messages(conversation_id, id)");

function removeFile(file) {
  try {
    fs.rmSync(file, { force: true });
  } catch {
    /* already gone */
  }
}

export function purgeExpired() {
  const now = Date.now();
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
  db.prepare("DELETE FROM oauth_states WHERE expires_at < ?").run(now);
  // Uploads that never got sent with a message.
  const stale = db.prepare("SELECT path FROM attachments WHERE message_id IS NULL AND created_at < datetime('now', '-1 day')").all();
  for (const row of stale) if (row.path) removeFile(row.path);
  db.prepare("DELETE FROM attachments WHERE message_id IS NULL AND created_at < datetime('now', '-1 day')").run();
}
