import { isSecureContext } from "./config.js";
import { db } from "./db.js";
import { AppError } from "./errors.js";
import { hashToken, newSessionToken } from "./security.js";

export const SESSION_COOKIE = "sid";
// Signing in lasts 90 days; after that the account asks for the password again.
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export function readCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      try {
        return decodeURIComponent(rest.join("="));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function createSession(res, userId) {
  const token = newSessionToken();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .run(hashToken(token), userId, expiresAt);
  res.append("Set-Cookie", cookieString(token, Math.floor(SESSION_TTL_MS / 1000)));
}

export function destroySession(req, res) {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
  res.append("Set-Cookie", cookieString("", 0));
}

function cookieString(value, maxAgeSeconds) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isSecureContext) parts.push("Secure");
  return parts.join("; ");
}

export function currentUser(req) {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const row = db.prepare(`
    SELECT users.id, users.username, users.is_admin
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND users.active = 1
  `).get(hashToken(token), Date.now());
  if (!row) return null;
  return { id: row.id, username: row.username, isAdmin: row.is_admin === 1 };
}

export function requireUser(req, res, next) {
  const user = currentUser(req);
  if (!user) return next(new AppError(401, "Please sign in first."));
  req.user = user;
  next();
}

// Mutating API calls must be JSON. Browsers cannot send cross-site JSON without a
// CORS preflight, which this app never grants, so this blocks cross-site form CSRF.
export function requireJson(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (!req.is("application/json")) return next(new AppError(415, "Expected a JSON request."));
  next();
}

