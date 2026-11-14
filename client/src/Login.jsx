import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { api } from "./api.js";
import OrbView from "./OrbView.jsx";
import { useI18n } from "./i18n/context.jsx";
import { Button, Field, IconButton, Input } from "./ui/ui.jsx";

export default function Login({ assistantName, onSignedIn, onBack }) {
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
    <main className="relative grid min-h-dvh place-items-center px-5 py-10">
      {onBack && (
        <IconButton label={t("Back")} onClick={onBack} className="absolute left-3 top-3 size-11 !rounded-full bg-raised">
          <ArrowLeft size={18} aria-hidden="true" />
        </IconButton>
      )}
      <div className="grid w-full max-w-sm justify-items-center gap-6">
        <OrbView status="idle" size={104} decorative />
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{assistantName}</h1>
          <p className="mt-1 text-fg-muted">{t("login.tagline")}</p>
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
                className="pr-12"
              />
              <span className="absolute inset-y-0 right-1 grid place-items-center">
                <IconButton label={showPassword ? t("login.hide") : t("login.show")} onClick={() => setShowPassword((v) => !v)} className="size-9">
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </IconButton>
              </span>
            </span>
          </Field>
          {error && (
            <p id="login-error" role="alert" className="rounded-xl bg-danger-soft px-4 py-2.5 text-sm text-danger">{error}</p>
          )}
          <Button variant="primary" size="lg" type="submit" disabled={busy} className="w-full">
            {busy ? t("login.busy") : t("login.submit")}
          </Button>
        </form>
      </div>
    </main>
  );
}
