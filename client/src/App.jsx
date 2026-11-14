import { useEffect, useState } from "react";
import { api } from "./api.js";
import Chat from "./Chat.jsx";
import Login from "./Login.jsx";
import Invite from "./Invite.jsx";
import { useI18n } from "./i18n/context.jsx";
import { LANGUAGES, t } from "./i18n/index.js";
import Hero from "./Hero.jsx";
import { setStyle } from "./style.js";

const GOOGLE_NOTICES = {
  connected: "Google Calendar connected.",
  denied: "Google connection was cancelled.",
  error: "Google connection failed. Try again.",
};

export default function App() {
  const [session, setSession] = useState(null); // null = loading
  const [notice, setNotice] = useState("");
  const [signingIn, setSigningIn] = useState(false); // the hero comes first; Sign in opens the login
  const { setLang } = useI18n();

  // The look saved on the account wins over this browser's copy.
  useEffect(() => {
    const saved = session?.prefs?.uiStyle;
    if (saved) setStyle(saved);
  }, [session?.prefs?.uiStyle]);

  // The language saved on the account wins over the browser's copy.
  useEffect(() => {
    const saved = session?.prefs?.uiLanguage;
    if (saved && LANGUAGES.some((l) => l.code === saved)) setLang(saved);
  }, [session?.prefs?.uiLanguage, setLang]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const googleResult = url.searchParams.get("google");
    if (googleResult) {
      setNotice(GOOGLE_NOTICES[googleResult] ? t(GOOGLE_NOTICES[googleResult]) : "");
      url.searchParams.delete("google");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
    api("/api/me")
      .then(setSession)
      .catch(() => setSession({ user: null, features: {}, google: null, assistantName: "Assistant" }));
  }, []);

  // Invite links open their own page, whether or not anyone is signed in.
  const invite = window.location.pathname.match(/^\/invite\/([^/]+)$/);
  if (invite) return <Invite token={invite[1]} />;

  if (!session) return <Hero loading />;

  if (!session.user) {
    if (!signingIn) return <Hero name={session.assistantName} onSignIn={() => setSigningIn(true)} />;
    return (
      <Login
        assistantName={session.assistantName}
        onBack={() => setSigningIn(false)}
        // Reload the full session so Google status and features are current after sign-in.
        onSignedIn={() => api("/api/me").then(setSession).catch(() => {})}
      />
    );
  }

  return (
    <Chat
      session={session}
      notice={notice}
      clearNotice={() => setNotice("")}
      refreshSession={() => api("/api/me").then(setSession).catch(() => {})}
      onSignedOut={() => setSession({ user: null, features: {}, google: null, assistantName: session.assistantName })}
    />
  );
}
