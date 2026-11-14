import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "./api.js";
import HomeOrb from "./ui/HomeOrb.jsx";
import KoiBackdrop from "./ui/KoiBackdrop.jsx";
import { useI18n } from "./i18n/context.jsx";
import { Button, Field, IconButton, Input } from "./ui/ui.jsx";

// Sign-in: no card. The orb stands in a clearing on the pond, the wordmark and one caption below it, then the two
// fields and the vermilion button, straight on the water. Fields have a solid surface fill so they read over the koi.
const HALO = "[text-shadow:0_0_6px_var(--pond),0_0_3px_var(--pond)]";

export default function Login({ assistantName, onSignedIn, onBack }) {
  const column = useRef(null);
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await api("/api/login", { method: "POST", body: { username, password } });
      onSignedIn(data.user);
    } catch (err) {
      setError(err.message);
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KoiBackdrop clearRef={column}>
    <div className="relative grid min-h-dvh w-full select-text place-items-center px-5 py-10">
      {onBack && (
        <IconButton
          label={t("Back")}
          onClick={onBack}
          className="absolute left-3 size-11 text-fg"
          style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <ArrowLeft size={20} strokeWidth={1.5} aria-hidden="true" />
        </IconButton>
      )}
      <div ref={column} className="grid w-full max-w-[320px] justify-items-center gap-8">
        <div className="grid justify-items-center gap-5">
          <HomeOrb size={120} ring spin />
          <div className="grid justify-items-center gap-2 text-center">
            <h1 className={`serif text-[32px] font-normal leading-none tracking-wide text-fg ${HALO}`}>{assistantName}</h1>
            <p className={`caption !text-fg-muted ${HALO}`}>{t("login.tagline")}</p>
          </div>
        </div>

        <form onSubmit={submit} className="grid w-full gap-4" aria-describedby={error ? "login-error" : undefined}>
          <Field label={t("login.username")}>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              maxLength={20}
              className="!h-11"
            />
          </Field>
          <Field label={t("login.password")}>
            <span className="relative block">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                maxLength={200}
                className="!h-11 pr-12"
              />
              <span className="absolute inset-y-0 right-0.5 grid place-items-center">
                <IconButton label={showPassword ? t("login.hide") : t("login.show")} onClick={() => setShowPassword((v) => !v)} className="size-10">
                  {showPassword ? <EyeOff size={18} strokeWidth={1.5} aria-hidden="true" /> : <Eye size={18} strokeWidth={1.5} aria-hidden="true" />}
                </IconButton>
              </span>
            </span>
          </Field>
          {error && (
            <p id="login-error" role="alert" className="field-error bg-surface">{error}</p>
          )}
          <Button variant="primary" size="lg" type="submit" disabled={busy} className="mt-2 !h-11 w-full">
            {busy ? t("login.busy") : t("login.submit")}
          </Button>
        </form>
      </div>
    </div>
    </KoiBackdrop>
  );
}
