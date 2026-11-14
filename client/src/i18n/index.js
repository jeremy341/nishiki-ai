import common from "./common.js";
import login from "./login.js";
import chat from "./chat.js";
import settings from "./settings.js";
import misc from "./misc.js";
import more from "./more.js";

// The interface languages. German is the default; the user picks another one in Settings.
export const LANGUAGES = [
  { code: "de", label: "Deutsch", locale: "de-DE" },
  { code: "en", label: "English", locale: "en-GB" },
];
export const DEFAULT_LANG = "de";

const AREAS = [common, login, chat, settings, misc, more];
const DICT = { de: {}, en: {} };
for (const area of AREAS) {
  Object.assign(DICT.de, area.de);
  Object.assign(DICT.en, area.en);
}

// Keys are the English text itself, so a missing German entry shows English, never a code.
export function translate(lang, key, vars) {
  let text = DICT[lang]?.[key] ?? key;
  if (vars) text = text.replace(/\{(\w+)\}/g, (_, name) => (vars[name] ?? ""));
  return text;
}

let current = DEFAULT_LANG;
export function setCurrentLanguage(code) {
  current = code;
}

// Use anywhere in the interface: t("Save") gives "Speichern" in German.
export function t(key, vars) {
  return translate(current, key, vars);
}

export function localeOf(lang) {
  return LANGUAGES.find((l) => l.code === lang)?.locale || "de-DE";
}

// The date and number format of the interface language.
export function currentLocale() {
  return localeOf(current);
}
