import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LANG, LANGUAGES, localeOf, setCurrentLanguage, t } from "./index.js";

const STORAGE_KEY = "lang";
const I18nContext = createContext(null);

function isLanguage(code) {
  return LANGUAGES.some((l) => l.code === code);
}

// The language is kept on the account. This copy only serves the sign-in screen and the first paint.
function initialLanguage() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLanguage(stored) ? stored : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initialLanguage);
  setCurrentLanguage(lang);

  const setLang = useCallback((code) => {
    if (!isLanguage(code)) return;
    setLangState(code);
    try {
      window.localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* private mode: the choice applies for this visit */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t, locale: localeOf(lang) }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n needs I18nProvider");
  return value;
}
