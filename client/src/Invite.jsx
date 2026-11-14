import { useEffect, useState } from "react";
import { api } from "./api.js";
import { t } from "./i18n/index.js";
import HomeOrb from "./ui/HomeOrb.jsx";
import KoiBackdrop from "./ui/KoiBackdrop.jsx";
import { Button, Field, Input } from "./ui/ui.jsx";

// Same room as the sign-in: the orb on the pond, a serif title, a mono caption, and the fields straight on the water.
const HALO = "[text-shadow:0_0_6px_var(--pond),0_0_3px_var(--pond)]";

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
      <main className="relative grid min-h-dvh w-full select-text place-items-center px-5 py-10">
        <div className="grid w-full max-w-[320px] justify-items-center gap-8">
          <div className="grid justify-items-center gap-5">
            <HomeOrb size={120} ring spin />
            {!info && (
              <div role="status" className="py-2">
                <span className={`caption !text-fg-muted ${HALO}`}>{t("Loading…")}</span>
              </div>
            )}
            {info && !info.valid && (
              <div className="grid justify-items-center gap-2 text-center">
                <h1 className={`serif text-[26px] font-normal leading-tight text-fg ${HALO}`}>{t("This invite is no longer valid")}</h1>
                <p className={`caption !text-fg-muted ${HALO}`}>{t("Ask the person who invited you for a new link.")}</p>
              </div>
            )}
            {info?.valid && (
              <div className="grid justify-items-center gap-2 text-center">
                <h1 className={`serif text-[26px] font-normal leading-tight text-fg ${HALO}`}>{t("You are invited to {name}", { name: info.assistantName })}</h1>
                <p className={`caption !text-fg-muted ${HALO}`}>{t("Choose a username and a password. You will be signed in right away.")}</p>
              </div>
            )}
          </div>

          {info?.valid && (
            <form onSubmit={submit} className="grid w-full gap-4" aria-describedby={error ? "invite-error" : undefined}>
              <Field label={t("Username")} hint={t("2–20 letters, digits, - or _")}>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username"
                  autoCapitalize="none" autoCorrect="off" spellCheck={false} required maxLength={20} className="!h-11" />
              </Field>
              <Field label={t("Password")} hint={t("At least 8 characters")}>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password" required minLength={8} maxLength={200} className="!h-11" />
              </Field>
              <Field label={t("Repeat password")}>
                <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password" required minLength={8} maxLength={200} className="!h-11" />
              </Field>
              {error && <p id="invite-error" role="alert" className="field-error bg-surface">{error}</p>}
              <Button variant="primary" size="lg" type="submit" disabled={busy} className="mt-2 !h-11 w-full">
                {busy ? t("Creating your account…") : t("Create account")}
              </Button>
            </form>
          )}
        </div>
      </main>
    </KoiBackdrop>
  );
}
