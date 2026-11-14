// Light/dark. No stored choice means "follow the phone or computer setting" (handled in CSS).
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
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function setTheme(value) {
  document.documentElement.dataset.theme = value;
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    /* private mode: applies for this visit only */
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", value === "light" ? "#f7f7f5" : "#000000");
}

export function toggleTheme() {
  const next = effectiveTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}

// Apply a saved choice as early as possible.
const saved = storedTheme();
if (saved) document.documentElement.dataset.theme = saved;

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
