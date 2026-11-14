import { useEffect, useState } from "react";
import { api } from "./api.js";
import { t } from "./i18n/index.js";
import OrbView from "./OrbView.jsx";
import KoiBackdrop from "./ui/KoiBackdrop.jsx";
import KoiGlyph from "./ui/KoiGlyph.jsx";
import { Button, Field, Input } from "./ui/ui.jsx";

// The page behind an invite link. The person chooses a username and a password, and is signed in.
export default function Invite({ token }) {
  const [info, setInfo] = useState(null); // { valid, assistantName }
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/api/invites/${encodeURIComponent(token)}`)
      .then(setInfo)
      .catch(() => setInfo({ valid: false, assistantName: "Assistant" }));
  }, [token]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (password !== confirm) {
      setError(t("The passwords do not match."));
      return;
    }
    setBusy(true);
    try {
      await api(`/api/invites/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        body: { username, password },
      });
      window.location.replace("/");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <KoiBackdrop>
      <main className="relative grid min-h-dvh w-full place-items-center px-5 py-10">
        <div className="grid w-full max-w-sm justify-items-center gap-6 rounded-xl border border-border bg-overlay p-6">
          <OrbView status="idle" size={104} decorative />
          {!info && (
            <div role="status" className="flex items-center gap-3 py-2">
              <KoiGlyph swim size={32} />
              <span className="caption">{t("Loading…")}</span>
            </div>
          )}
          {info && !info.valid && (
            <div className="text-center">
              <h1 className="font-mono text-xl font-medium tracking-tight">{t("This invite is no longer valid")}</h1>
              <p className="mt-1 text-sm text-fg-muted">{t("Ask the person who invited you for a new link.")}</p>
            </div>
          )}
          {info?.valid && (
            <>
              <div className="text-center">
                <h1 className="font-mono text-xl font-medium tracking-tight">{t("You are invited to {name}", { name: info.assistantName })}</h1>
                <p className="mt-1 text-sm text-fg-muted">{t("Choose a username and a password. You will be signed in right away.")}</p>
              </div>
              <form onSubmit={submit} className="grid w-full gap-4" aria-describedby={error ? "invite-error" : undefined}>
                <Field label={t("Username")} hint={t("2–20 letters, digits, - or _")}>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username"
                    autoCapitalize="none" autoCorrect="off" spellCheck={false} required maxLength={20} />
                </Field>
                <Field label={t("Password")} hint={t("At least 8 characters")}>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password" required minLength={8} maxLength={200} />
                </Field>
                <Field label={t("Repeat password")}>
                  <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password" required minLength={8} maxLength={200} />
                </Field>
                {error && <p id="invite-error" role="alert" className="rounded-md border border-danger/40 px-3 py-2 text-sm text-danger">{error}</p>}
                <Button variant="primary" size="lg" type="submit" disabled={busy} className="w-full max-md:h-11">
                  {busy ? t("Creating your account…") : t("Create account")}
                </Button>
              </form>
            </>
          )}
        </div>
      </main>
    </KoiBackdrop>
  );
}
