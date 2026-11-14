// Light (paper) and dark (pond). No stored choice means paper. "System" in the settings follows the device again.
const KEY = "theme";

export function storedTheme() {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function effectiveTheme() {
  const stored = storedTheme();
  if (stored) return stored;
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function setTheme(value) {
  document.documentElement.dataset.theme = value;
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    /* private mode: applies for this visit only */
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", value === "light" ? "#e9e4da" : "#0e2a32");
}

export function toggleTheme() {
  const next = effectiveTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}

// Apply a saved choice as early as possible. Without one the app starts on paper (light), also on the start screen.
const saved = storedTheme();
document.documentElement.dataset.theme = saved || "light";

// The saved preference from the account: "system" follows the device again.
export function setThemePreference(value) {
  if (value === "light" || value === "dark") {
    setTheme(value);
    return;
  }
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  delete document.documentElement.dataset.theme;
}

// The browser and status-bar colour follows the first theme too.
document.querySelector('meta[name="theme-color"]')?.setAttribute("content", (saved || "light") === "light" ? "#e9e4da" : "#0e2a32");
