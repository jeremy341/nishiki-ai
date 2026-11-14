import { ImapFlow } from "imapflow";
import { chatCompletion } from "./ai.js";
import { config } from "./config.js";
import { db } from "./db.js";
import { AppError } from "./errors.js";
import { roleConfigured } from "./providers.js";
import { decryptSecret, encryptSecret } from "./security.js";

// Mail is read as headers only: sender, subject and date. Nothing else leaves the server.
// A report sends those headers to the AI for an "important or not" check, and only if the
// user has switched it on and given consent. Important ones are pushed to the user's phone
// through ntfy.

const DEFAULT_HOST = "imap.mail.yahoo.com";

function row(userId) {
  return db.prepare("SELECT * FROM mail_settings WHERE user_id = ?").get(userId)
    || { host: DEFAULT_HOST, address: null, password_enc: null, ntfy_topic_enc: null, report_enabled: 0, consent: 0, last_uid: 0 };
}

function open(enc) {
  if (!enc) return "";
  try {
    return decryptSecret(enc);
  } catch {
    return "";
  }
}

export function mailSettingsPublic(userId) {
  const r = row(userId);
  return {
    host: r.host,
    address: r.address || "",
    hasPassword: Boolean(r.password_enc),
    hasNtfy: Boolean(r.ntfy_topic_enc),
    reportEnabled: Boolean(r.report_enabled),
    consent: Boolean(r.consent),
    secretsEnabled: Boolean(config.google.encryptionKey),
  };
}

export function saveMailSettings(userId, input) {
  const current = row(userId);
  const host = String(input.host || DEFAULT_HOST).trim().slice(0, 120);
  if (!/^[a-z0-9.-]+$/i.test(host)) throw new AppError(400, "The mail server name looks wrong.");
  const address = input.address ? String(input.address).trim().slice(0, 200) : null;
  if (address && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) throw new AppError(400, "That mail address looks wrong.");

  let passwordEnc = current.password_enc;
  if (typeof input.password === "string" && input.password.trim()) {
    if (!config.google.encryptionKey) throw new AppError(400, "Set ENCRYPTION_KEY on the server to store the mail password.");
    passwordEnc = encryptSecret(input.password.trim());
  }
  let ntfyEnc = current.ntfy_topic_enc;
  if (typeof input.ntfyTopic === "string" && input.ntfyTopic.trim()) {
    if (!config.google.encryptionKey) throw new AppError(400, "Set ENCRYPTION_KEY on the server to store the ntfy topic.");
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(input.ntfyTopic.trim())) throw new AppError(400, "The ntfy topic should be a long random name.");
    ntfyEnc = encryptSecret(input.ntfyTopic.trim());
  }
  const reportEnabled = Boolean(input.reportEnabled);
  const consent = Boolean(input.consent);
  if (reportEnabled && !consent) throw new AppError(400, "Allow the report first: it sends mail headers to the AI.");
  // A different account starts from scratch, so old message numbers do not carry over.
  const lastUid = address !== current.address ? 0 : current.last_uid;

  db.prepare(`
    INSERT INTO mail_settings (user_id, host, address, password_enc, ntfy_topic_enc, report_enabled, consent, last_uid, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET host = excluded.host, address = excluded.address,
      password_enc = excluded.password_enc, ntfy_topic_enc = excluded.ntfy_topic_enc,
      report_enabled = excluded.report_enabled, consent = excluded.consent,
      last_uid = excluded.last_uid, updated_at = excluded.updated_at
  `).run(userId, host, address, passwordEnc, ntfyEnc, reportEnabled ? 1 : 0, consent ? 1 : 0, lastUid);
  return mailSettingsPublic(userId);
}

export function mailCredentials(userId) {
  const r = row(userId);
  if (!r.address || !r.password_enc) throw new AppError(409, "Add your mail address and app password first.");
  return { host: r.host, address: r.address, password: open(r.password_enc) };
}

export function mailConsented(userId) {
  const r = row(userId);
  return Boolean(r.consent && r.address && r.password_enc);
}

function fromText(address) {
  if (!address) return "unknown sender";
  const mail = address.address || "";
  return address.name ? `${address.name} <${mail}>` : mail;
}

// Connects, reads the newest headers and disconnects. Read-only: nothing is marked or moved.
export async function fetchInboxHeaders(creds, options = {}) {
  try {
    return await readHeaders(creds, options);
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.warn("Mailbox read failed:", error.name);
    throw new AppError(502, "The mailbox could not be read. Check the address, the app password and the server name.");
  }
}

async function readHeaders(creds, { sinceUid = 0, limit = 15 } = {}) {
  const client = new ImapFlow({
    host: creds.host,
    port: 993,
    secure: true,
    auth: { user: creds.address, pass: creds.password },
    logger: false,
  });
  await client.connect();
  let lock;
  try {
    lock = await client.getMailboxLock("INBOX", { readOnly: true });
    const total = client.mailbox.exists || 0;
    if (!total) return [];
    const from = sinceUid ? sinceUid + 1 : Math.max(1, total - limit + 1);
    const headers = [];
    for await (const message of client.fetch(`${from}:*`, { uid: true, envelope: true, flags: true }, { uid: true })) {
      if (message.uid <= sinceUid) continue;
      headers.push({
        uid: message.uid,
        from: fromText(message.envelope?.from?.[0]),
        subject: message.envelope?.subject || "(no subject)",
        date: message.envelope?.date ? new Date(message.envelope.date).toISOString() : null,
        seen: Boolean(message.flags?.has("\\Seen")),
      });
    }
    return headers.sort((a, b) => b.uid - a.uid).slice(0, limit);
  } finally {
    lock?.release();
    await client.logout().catch(() => client.close());
  }
}

export async function inbox(userId) {
  return fetchInboxHeaders(mailCredentials(userId), { limit: 15 });
}

async function classify(headers, userId) {
  const list = headers.map((h) => ({ uid: h.uid, from: h.from, subject: h.subject }));
  const reply = await chatCompletion([
    {
      role: "system",
      content: `You sort email headers for one person. Mark an email important if it is about money, bills, deadlines, appointments, security alerts, people they would want to hear from quickly, or health. Everything else (newsletters, promotions, notifications) is not important. Reply with JSON only: [{"uid": number, "important": true or false}] for every uid given.`,
    },
    { role: "user", content: JSON.stringify(list) },
  ], { role: "chat", userId, maxTokens: 800, temperature: 0 });
  try {
    const parsed = JSON.parse(reply.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    return new Map(parsed.filter((x) => typeof x.uid === "number").map((x) => [x.uid, Boolean(x.important)]));
  } catch {
    return new Map();
  }
}

// A short phone notice through ntfy, if the user set a topic. Never shows content.
export async function notifyUser(userId, title, message) {
  const r = db.prepare("SELECT ntfy_topic_enc FROM mail_settings WHERE user_id = ?").get(userId);
  if (!r?.ntfy_topic_enc) return false;
  const topic = open(r.ntfy_topic_enc);
  if (!topic) return false;
  await sendNtfy(topic, title, message);
  return true;
}

export async function sendNtfy(topic, title, message) {
  const base = process.env.NTFY_URL || "https://ntfy.sh";
  const response = await fetch(`${base.replace(/\/$/, "")}/${encodeURIComponent(topic)}`, {
    method: "POST",
    headers: { Title: title.slice(0, 200), Priority: "high" },
    body: message.slice(0, 400),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new AppError(502, "The phone notification service did not accept the message.");
}

// One report run for one user. The first run only records where the inbox is, so the
// user is not flooded with old mail.
export async function runMailReport(userId, {
  fetchHeaders = fetchInboxHeaders,
  notify = sendNtfy,
} = {}) {
  const r = row(userId);
  if (!r.report_enabled || !r.consent) return { skipped: "report is off" };
  if (!roleConfigured("chat")) return { skipped: "AI is not set up" };
  const creds = mailCredentials(userId);
  const topic = open(r.ntfy_topic_enc);

  const mails = await fetchHeaders(creds, { sinceUid: r.last_uid, limit: 30 });
  if (!mails.length) return { checked: 0, important: 0 };
  const newest = Math.max(...mails.map((m) => m.uid));
  if (r.last_uid === 0) {
    db.prepare("UPDATE mail_settings SET last_uid = ? WHERE user_id = ?").run(newest, userId);
    return { baseline: true };
  }

  const verdicts = await classify(mails, userId);
  const important = mails.filter((m) => verdicts.get(m.uid));
  if (topic) {
    for (const m of important) await notify(topic, `Important mail from ${m.from}`, m.subject);
  }
  db.prepare("UPDATE mail_settings SET last_uid = ? WHERE user_id = ?").run(newest, userId);
  return { checked: mails.length, important: important.length, pushed: Boolean(topic) };
}
