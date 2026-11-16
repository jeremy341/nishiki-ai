import { config } from "./config.js";
import { db } from "./db.js";
import { AppError } from "./errors.js";
import { decryptSecret, encryptSecret, randomState } from "./security.js";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const CALENDAR_URL = "https://www.googleapis.com/calendar/v3";
const STATE_TTL_MS = 10 * 60 * 1000;

export function googleConfigured() {
  return Boolean(config.google.clientId && config.google.clientSecret && config.google.encryptionKey);
}

// ---- OAuth "connect" flow (web server flow with a CSRF state bound to the user) ----

export function startConnect(userId) {
  const state = randomState();
  db.prepare("INSERT INTO oauth_states (state, user_id, expires_at) VALUES (?, ?, ?)")
    .run(state, userId, Date.now() + STATE_TTL_MS);
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.redirectUri,
    response_type: "code",
    scope: config.google.scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

// Single-use: the state is deleted whether or not it matches.
export function consumeState(state, userId) {
  const row = db.prepare("SELECT user_id, expires_at FROM oauth_states WHERE state = ?").get(state);
  db.prepare("DELETE FROM oauth_states WHERE state = ?").run(state);
  return Boolean(row && row.user_id === userId && row.expires_at > Date.now());
}

export async function finishConnect(userId, code) {
  const tokens = await postToken({
    code,
    client_id: config.google.clientId,
    client_secret: config.google.clientSecret,
    redirect_uri: config.google.redirectUri,
    grant_type: "authorization_code",
  });

  const existing = db.prepare("SELECT refresh_token_enc FROM google_accounts WHERE user_id = ?").get(userId);
  if (!tokens.refresh_token && !existing) {
    throw new AppError(400, "Google did not return a refresh token. Try connecting again.");
  }

  const info = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    signal: AbortSignal.timeout(15_000),
  }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));

  const encrypted = tokens.refresh_token ? encryptSecret(tokens.refresh_token) : existing.refresh_token_enc;
  db.prepare(`
    INSERT INTO google_accounts (user_id, email, refresh_token_enc, scope, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET email = excluded.email,
      refresh_token_enc = excluded.refresh_token_enc, scope = excluded.scope, updated_at = excluded.updated_at
  `).run(userId, info.email || null, encrypted, tokens.scope || null);
  accessCache.delete(userId);
}

export function googleStatus(userId) {
  const row = db.prepare("SELECT email FROM google_accounts WHERE user_id = ?").get(userId);
  return row ? { connected: true, email: row.email } : { connected: false, email: null };
}

export async function disconnectGoogle(userId) {
  const row = db.prepare("SELECT refresh_token_enc FROM google_accounts WHERE user_id = ?").get(userId);
  if (row) {
    // Best effort: revoke at Google so the grant disappears from the account too.
    try {
      await fetch(`${REVOKE_URL}?token=${encodeURIComponent(decryptSecret(row.refresh_token_enc))}`, {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      /* local removal still happens below */
    }
  }
  db.prepare("DELETE FROM google_accounts WHERE user_id = ?").run(userId);
  accessCache.delete(userId);
}

// ---- Access tokens: refreshed from the stored refresh token, cached in memory only ----

const accessCache = new Map();

async function accessTokenFor(userId) {
  const cached = accessCache.get(userId);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const row = db.prepare("SELECT refresh_token_enc FROM google_accounts WHERE user_id = ?").get(userId);
  if (!row) throw new AppError(409, "Google Calendar is not connected yet.");

  let tokens;
  try {
    tokens = await postToken({
      refresh_token: decryptSecret(row.refresh_token_enc),
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      grant_type: "refresh_token",
    });
  } catch (error) {
    if (error instanceof AppError && error.status === 400) {
      // Google says the grant is gone (revoked or expired). Forget it.
      db.prepare("DELETE FROM google_accounts WHERE user_id = ?").run(userId);
      accessCache.delete(userId);
      throw new AppError(401, "Your Google connection expired. Please connect Google again.");
    }
    throw error;
  }
  accessCache.set(userId, { token: tokens.access_token, expiresAt: Date.now() + tokens.expires_in * 1000 });
  return tokens.access_token;
}

async function postToken(form) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    // Log the error code only; Google's body can echo parameters.
    console.warn("Google token endpoint error:", data.error || response.status);
    throw new AppError(response.status === 400 ? 400 : 502, "Google sign-in failed. Please try again.");
  }
  return data;
}

async function calendarFetch(userId, path, init = {}) {
  const token = await accessTokenFor(userId);
  const response = await fetch(`${CALENDAR_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status === 401) {
    accessCache.delete(userId);
    throw new AppError(502, "Google Calendar rejected the request. Try again.");
  }
  if (response.status === 204) return null; // A successful DELETE has no JSON body.
  if (response.status === 404 || response.status === 410) {
    throw new AppError(404, "This calendar event no longer exists.");
  }
  if (response.status === 403) {
    throw new AppError(403, "Google does not allow you to change this calendar event.");
  }
  if (response.status === 412) {
    throw new AppError(409, "This event changed since you opened it. Reload and try again.");
  }
  if (!response.ok) {
    // The reason Google gives (for example "Invalid value for: start.dateTime") helps to find the cause; it holds no personal data.
    const detail = await response.json().then((j) => `${j?.error?.errors?.[0]?.reason || ""} ${j?.error?.message || ""}`.trim()).catch(() => "");
    console.warn("Google Calendar HTTP", response.status, detail.slice(0, 160));
    throw new AppError(502, "Google Calendar returned an error.");
  }
  return response.json();
}

export async function listUpcomingEvents(userId, days = 7) {
  const now = new Date();
  const later = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: later.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "25",
  });
  const data = await calendarFetch(userId, `/calendars/primary/events?${params}`);
  // Only the fields the app needs, to keep the data sent to the AI small.
  return (data.items || []).map((event) => ({
    id: event.id,
    title: event.summary || "(no title)",
    start: event.start?.dateTime || event.start?.date || null,
    end: event.end?.dateTime || event.end?.date || null,
    allDay: Boolean(event.start?.date && !event.start?.dateTime),
    recurringEventId: event.recurringEventId || null,
  }));
}

// Google wants seconds in a date and time ("2026-11-17T13:30:00"); the assistant writes them without ("2026-11-17T13:30").
const withSeconds = (value) => (/T\d\d:\d\d$/.test(String(value)) ? `${value}:00` : value);

export async function createEvent(userId, { title, start, end, timeZone }) {
  const event = await calendarFetch(userId, "/calendars/primary/events", {
    method: "POST",
    body: JSON.stringify({
      summary: title,
      start: { dateTime: withSeconds(start), timeZone },
      end: { dateTime: withSeconds(end), timeZone },
    }),
  });
  return { id: event.id, title: event.summary, start: event.start?.dateTime, end: event.end?.dateTime };
}


// Event IDs always come from a Google Calendar lookup. Still validate them before putting them in a URL.
function eventPath(eventId) {
  if (typeof eventId !== "string" || !/^[A-Za-z0-9_-]{1,512}$/.test(eventId)) {
    throw new AppError(400, "Invalid calendar event ID.");
  }
  return "/calendars/primary/events/" + encodeURIComponent(eventId);
}

function eventView(event) {
  return {
    id: event.id,
    title: event.summary || "(no title)",
    start: event.start?.dateTime || event.start?.date || null,
    end: event.end?.dateTime || event.end?.date || null,
    allDay: Boolean(event.start?.date && !event.start?.dateTime),
    recurringEventId: event.recurringEventId || null,
    etag: event.etag,
  };
}

// A recurring instance has its own ID. For "series", resolve the parent event instead.
export async function getCalendarEvent(userId, eventId, scope = "single") {
  if (!["single", "series"].includes(scope)) throw new AppError(400, "Invalid recurrence scope.");
  const occurrence = await calendarFetch(userId, eventPath(eventId));
  if (!occurrence || occurrence.status === "cancelled") throw new AppError(404, "Calendar event not found.");
  const target = scope === "series" && occurrence.recurringEventId
    ? await calendarFetch(userId, eventPath(occurrence.recurringEventId))
    : occurrence;
  if (!target || target.status === "cancelled") throw new AppError(404, "Calendar event not found.");
  return {
    ...eventView(target),
    scope: scope === "series" && (occurrence.recurringEventId || occurrence.recurrence) ? "series" : "single",
    isRecurring: Boolean(occurrence.recurringEventId || occurrence.recurrence),
    occurrenceId: occurrence.id,
  };
}

// The supplied etag is a Google revision identifier; If-Match prevents stale confirmations.
export async function updateCalendarEvent(userId, { id, etag, title, start, end, allDay, timeZone }) {
  if (typeof etag !== "string" || !etag) throw new AppError(400, "Missing event revision.");
  const body = {};
  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim() || title.length > 200) {
      throw new AppError(400, "The event needs a title (up to 200 characters).");
    }
    body.summary = title.trim();
  }
  if (start !== undefined || end !== undefined) {
    if (typeof start !== "string" || typeof end !== "string" || end <= start) {
      throw new AppError(400, "Start and end must be provided, with end after start.");
    }
    if (allDay) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)
          || Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end))) {
        throw new AppError(400, "All-day events need YYYY-MM-DD dates (the end date is exclusive).");
      }
      body.start = { date: start };
      body.end = { date: end };
    } else {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start)
          || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(end)
          || typeof timeZone !== "string" || !timeZone) {
        throw new AppError(400, "Timed events need local date-times and a time zone.");
      }
      body.start = { dateTime: withSeconds(start), timeZone };
      body.end = { dateTime: withSeconds(end), timeZone };
    }
  }
  if (!Object.keys(body).length) throw new AppError(400, "Nothing to change.");
  const event = await calendarFetch(userId, eventPath(id), {
    method: "PATCH",
    headers: { "If-Match": etag },
    body: JSON.stringify(body),
  });
  return eventView(event);
}

export async function deleteCalendarEvent(userId, { id, etag }) {
  if (typeof etag !== "string" || !etag) throw new AppError(400, "Missing event revision.");
  await calendarFetch(userId, eventPath(id), {
    method: "DELETE",
    headers: { "If-Match": etag },
  });
}

// ---- Gmail (read headers and snippets, send after Confirm) ----

export function googleAbilities(userId) {
  const row = db.prepare("SELECT scope FROM google_accounts WHERE user_id = ?").get(userId);
  const scope = row?.scope || "";
  return {
    calendar: scope.includes("calendar.events"),
    gmail: scope.includes("gmail.readonly") && scope.includes("gmail.send"),
    drive: scope.includes("drive.metadata.readonly"),
  };
}

async function googleApi(userId, base, path, init = {}) {
  const token = await accessTokenFor(userId);
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    console.warn("Google API HTTP", response.status, path.split("?")[0]);
    throw new AppError(502, "Google returned an error. Check the Google connection in Settings.");
  }
  return response.json();
}

// Drive: files whose name contains the text (names, types, dates and links only).
export async function driveSearch(userId, text, max = 10) {
  const safe = String(text || "").replace(/[\\']/g, (c) => `\\${c}`);
  const params = new URLSearchParams({
    q: `name contains '${safe}' and trashed = false`,
    pageSize: String(max),
    orderBy: "modifiedTime desc",
    fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
  });
  const data = await googleApi(userId, "https://www.googleapis.com", `/drive/v3/files?${params}`);
  return (data.files || []).map((f) => ({
    name: String(f.name || "").slice(0, 200),
    type: String(f.mimeType || "").replace("application/vnd.google-apps.", "Google "),
    modified: f.modifiedTime,
    link: f.webViewLink,
  }));
}

// Newest matches first: sender, subject, date and the short preview Gmail shows.
export async function gmailSearch(userId, query, max = 10) {
  const params = new URLSearchParams({ q: query || "", maxResults: String(max) });
  const list = await googleApi(userId, "https://gmail.googleapis.com", `/gmail/v1/users/me/messages?${params}`);
  const out = [];
  for (const item of (list.messages || []).slice(0, max)) {
    const msg = await googleApi(
      userId,
      "https://gmail.googleapis.com",
      `/gmail/v1/users/me/messages/${item.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
    );
    const h = Object.fromEntries((msg.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
    out.push({
      id: item.id,
      from: h.from || "",
      subject: h.subject || "(no subject)",
      date: h.date || "",
      snippet: String(msg.snippet || "").slice(0, 200),
    });
  }
  return out;
}

const encodeHeader = (text) => `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`;


// Sends a plain-text mail. Only called from a confirmed action.
export async function gmailSend(userId, { to, subject, body }) {
  const clean = (v) => String(v || "").replace(/[\r\n]+/g, " ").trim();
  const raw = [
    `To: ${clean(to)}`,
    `Subject: ${encodeHeader(clean(subject))}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    String(body || ""),
  ].join("\r\n");
  await googleApi(userId, "https://gmail.googleapis.com", "/gmail/v1/users/me/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw: Buffer.from(raw, "utf8").toString("base64url") }),
  });
  return "Mail sent.";
}
