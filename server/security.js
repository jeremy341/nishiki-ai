import crypto from "node:crypto";
import { config } from "./config.js";

// ---- Passwords: scrypt with per-user random salt ----

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password, stored) {
  const [scheme, N, r, p, saltB64, hashB64] = String(stored).split("$");
  if (scheme !== "scrypt") return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(N), r: Number(r), p: Number(p),
  });
  return crypto.timingSafeEqual(actual, expected);
}

// Constant-time-ish dummy check so unknown usernames take as long as wrong passwords.
const DUMMY_HASH = hashPassword("not-a-real-password-just-timing");
export function burnPasswordTime(password) {
  verifyPassword(password, DUMMY_HASH);
}

// ---- Session tokens: random value in the cookie, only its SHA-256 hash in the DB ----

export function newSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ---- Encryption for Google refresh tokens (AES-256-GCM) ----

function encryptionKey() {
  const key = Buffer.from(config.google.encryptionKey, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 random bytes, base64-encoded.");
  }
  return key;
}

export function encryptSecret(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, body].map((part) => part.toString("base64")).join(".");
}

export function decryptSecret(payload) {
  const [ivB64, tagB64, bodyB64] = payload.split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(bodyB64, "base64")), decipher.final()]).toString("utf8");
}

export function randomState() {
  return crypto.randomBytes(24).toString("base64url");
}
