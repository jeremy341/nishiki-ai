import { db } from "./db.js";
import { AppError } from "./errors.js";
import { googleAbilities, googleConfigured, googleStatus } from "./google.js";
import { hasToken, removeToken, saveToken } from "./integrations.js";
import { setUserConnector, userConnectors } from "./mcp.js";
import { getFeatures } from "./prefs.js";
import { secretsEnabled } from "./providers.js";

// The app directory. Each app says how it is set up and which admin switch allows it:
//  - ready:  works at once with no account (weather, currency, Wikipedia, maps); on by default
//  - google: one Google sign-in; the app is on once the granted scope allows it
//  - token:  the user pastes a personal token once; it is checked and stored encrypted
export const APPS = [
  { id: "weather", name: "Weather", category: "ready", feature: "web" },
  { id: "currency", name: "Currency converter", category: "ready", feature: "web" },
  { id: "wikipedia", name: "Wikipedia", category: "ready", feature: "web" },
  { id: "maps", name: "Maps and routes", category: "ready", feature: "web" },
  { id: "gmail", name: "Gmail", category: "google", feature: "gmail" },
  { id: "calendar", name: "Google Calendar", category: "google", feature: "calendar" },
  { id: "drive", name: "Google Drive", category: "google", feature: "drive" },
  {
    id: "todoist", name: "Todoist", category: "token", feature: "apps",
    tokenHelp: "https://app.todoist.com/app/settings/integrations/developer",
  },
  {
    id: "github", name: "GitHub", category: "token", feature: "apps",
    tokenHelp: "https://github.com/settings/personal-access-tokens",
  },
  {
    id: "notion", name: "Notion", category: "token", feature: "apps",
    tokenHelp: "https://www.notion.so/profile/integrations",
  },
];

const byId = (id) => APPS.find((app) => app.id === id);

// Ready apps are on unless the user switched them off; the others start off.
export function appOn(userId, appId) {
  const row = db.prepare("SELECT enabled FROM user_apps WHERE user_id = ? AND app_id = ?").get(userId, appId);
  if (!row) return byId(appId)?.category === "ready";
  return Boolean(row.enabled);
}

export function setAppEnabled(userId, appId, enabled) {
  db.prepare(`
    INSERT INTO user_apps (user_id, app_id, enabled) VALUES (?, ?, ?)
    ON CONFLICT(user_id, app_id) DO UPDATE SET enabled = excluded.enabled
  `).run(userId, appId, enabled ? 1 : 0);
}

// After a successful Google sign-in, every Google app the granted scopes allow is switched on.
export function enableGoogleApps(userId) {
  const abilities = googleAbilities(userId);
  for (const app of APPS.filter((a) => a.category === "google")) {
    if (abilities[app.id]) setAppEnabled(userId, app.id, true);
  }
}

function installedState(userId, app) {
  if (app.category === "ready") return true;
  if (app.category === "google") return Boolean(googleStatus(userId).connected && googleAbilities(userId)[app.id]);
  return hasToken(userId, app.id);
}

export function listApps(userId) {
  const features = getFeatures(userId);
  const apps = APPS.map((app) => {
    const installed = installedState(userId, app);
    return {
      id: app.id,
      name: app.name,
      category: app.category,
      installed,
      enabled: installed && appOn(userId, app.id),
      allowed: Boolean(features[app.feature]),
      tokenHelp: app.tokenHelp || null,
    };
  });
  for (const connector of userConnectors(userId)) {
    apps.push({
      id: `connector-${connector.id}`,
      name: connector.name,
      category: "connector",
      installed: true,
      enabled: connector.enabled,
      allowed: Boolean(features.mcp),
    });
  }
  return { apps, googleConfigured: googleConfigured(), secretsEnabled: secretsEnabled() };
}

// The ids of apps the assistant may use right now: installed, switched on, allowed by the admin.
export function usableAppIds(userId) {
  const features = getFeatures(userId);
  return new Set(APPS
    .filter((app) => features[app.feature] && installedState(userId, app) && appOn(userId, app.id))
    .map((app) => app.id));
}

// Switches an app on or off. Google and token apps must be connected first.
export function setApp(userId, appId, enabled) {
  const app = byId(appId);
  if (app) {
    if (enabled && !installedState(userId, app)) {
      throw new AppError(409, app.category === "google" ? "Connect Google first." : "Connect this app first.");
    }
    setAppEnabled(userId, appId, enabled);
    return;
  }
  const match = /^connector-(\d+)$/.exec(appId);
  if (match) {
    setUserConnector(userId, Number(match[1]), enabled);
    return;
  }
  throw new AppError(404, "No such app.");
}

// Paste-a-token apps: the token is checked against the service, stored encrypted, and the app switched on.
export async function connectWithToken(userId, appId, token) {
  const app = byId(appId);
  if (!app || app.category !== "token") throw new AppError(404, "No such app.");
  if (!secretsEnabled()) throw new AppError(400, "The server has no ENCRYPTION_KEY, so tokens cannot be stored.");
  const account = await saveToken(userId, appId, token);
  setAppEnabled(userId, appId, true);
  return account;
}

export function disconnectToken(userId, appId) {
  const app = byId(appId);
  if (!app || app.category !== "token") throw new AppError(404, "No such app.");
  removeToken(userId, appId);
  setAppEnabled(userId, appId, false);
}
