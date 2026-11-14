import StyleSwitch from "./ui/StyleSwitch.jsx";
import Loading from "./ui/Loading.jsx";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "./api.js";
import { setThemePreference } from "./theme.js";
import { getStyle } from "./style.js";
import { useI18n } from "./i18n/context.jsx";
import { currentLocale, LANGUAGES, t } from "./i18n/index.js";
import {
  Badge, Button, Field, FullPage, IconButton, Input, Modal, Select, Switch, Tabs,
} from "./ui/ui.jsx";

// Settings is a full page, like the ChatGPT app: a grouped list, and each section opens
// on its own page with a back arrow. Everything here is saved on the server.
const SECTIONS = [
  { value: "account", label: "Account" },
  { value: "appearance", label: "Appearance" },
  { value: "personal", label: "Personalisation" },
  { value: "voice", label: "Voice" },
  { value: "apps", label: "Apps" },
  { value: "memory", label: "Memory" },
  { value: "mail", label: "Mail and notifications" },
  { value: "usage", label: "Usage" },
  { value: "data", label: "Data controls" },
];

// Like ChatGPT and Claude: on wide screens a navigation column in groups on the left, the page on the right.
// On phones: the menu of cards, and each page opens with a way back to it.
export default function Settings({ open, onOpenChange, isAdmin, username, onSignOut, onAccountChanged, onChatsChanged, initialPage = null }) {
  const [page, setPage] = useState(initialPage);
  const wide = useMediaQuery("(min-width: 768px)");
  if (!open) return null;
  const sections = isAdmin ? [...SECTIONS, { value: "admin", label: "Admin" }] : SECTIONS;
  // On wide screens the admin pages are entries of their own in the navigation.
  const allSections = isAdmin ? [...sections, ...ADMIN_ITEMS] : sections;
  const active = page ?? (wide ? "account" : null);
  const current = allSections.find((s) => s.value === active);
  const back = !wide && current ? () => setPage(null) : null;

  const groups = [
    { label: t("Account"), items: ["account", "usage"] },
    { label: t("App"), items: ["appearance", "personal", "voice", "apps", "memory", "mail"] },
    { label: t("Data"), items: ["data"] },
    ...(isAdmin ? [{ label: t("Administration"), items: ADMIN_ITEMS.map((i) => i.value) }] : []),
  ];

  const nav = (
    <nav aria-label={t("Settings")} className="grid gap-6">
      {groups.map((group) => (
        <div key={group.label} className="grid gap-0.5">
          <div className={`${CAPTION} px-2.5 pb-1.5`}>{group.label}</div>
          {group.items.map((value) => {
            const s = allSections.find((x) => x.value === value);
            if (!s) return null;
            const selected = active === s.value;
            return (
              <button
                key={s.value}
                type="button"
                aria-current={selected ? "page" : undefined}
                onClick={() => setPage(s.value)}
                className={`flex h-8 w-full items-center rounded-md px-2.5 text-left text-[14px] transition-colors ${
                  selected ? "bg-raised font-medium text-fg" : "text-fg-muted hover:bg-raised/60 hover:text-fg"
                }`}
              >
                <span className="truncate">{t(s.label)}</span>
              </button>
            );
          })}
        </div>
      ))}
      <div className="border-t border-border pt-3">
        <button
          type="button"
          onClick={onSignOut}
          className="flex h-8 w-full items-center rounded-md px-2.5 text-left text-[14px] text-danger transition-colors hover:bg-raised/60"
        >
          {t("Sign out")}
        </button>
      </div>
    </nav>
  );

  const renderPage = (value) => (
    <>
      {value === "account" && <AccountTab username={username} onChanged={onAccountChanged} onSignOut={onSignOut} />}
      {value === "appearance" && <AppearanceTab />}
      {value === "personal" && <PersonalTab />}
      {value === "voice" && <VoiceTab />}
      {value === "apps" && <AppsTab />}
      {value === "mail" && <MailTab />}
      {value === "memory" && <MemoryTab />}
      {value === "usage" && <UsageTab />}
      {value === "data" && <DataTab onChatsChanged={onChatsChanged} />}
      {value === "admin" && isAdmin && <AdminTab />}
      {value?.startsWith("admin:") && isAdmin && <AdminSection section={value.slice(6)} />}
    </>
  );

  // Phones: a plain list first (the account, then the pages).
  const phoneMenu = (
    <div className="grid gap-6">
      <Group>
        <button
          type="button"
          onClick={() => setPage("account")}
          className="flex min-h-14 w-full items-center gap-3 px-1 py-2 text-left transition-colors active:bg-raised"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium">{username}</span>
            <span className="block text-[13px] text-fg-subtle">{t("Signed in")}</span>
          </span>
          <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-fg-subtle" />
        </button>
      </Group>
      <Group>
        {sections.filter((s) => s.value !== "account").map((s) => (
          <Row
            key={s.value}
            label={t(s.label)}
            value={s.value === "appearance" ? t(getStyle() === "koi" ? "Koi" : "Classic") : undefined}
            onClick={() => setPage(s.value)}
          />
        ))}
      </Group>
      <Group>
        <Row label={t("Sign out")} destructive onClick={onSignOut} />
      </Group>
    </div>
  );

  return (
    <FullPage title={wide || !current ? t("Settings") : t(current.label)} onBack={back} onClose={() => onOpenChange(false)} wide>
      {wide ? (
        <div className="grid gap-10 md:grid-cols-[14rem_minmax(0,1fr)] md:items-start">
          <div className="md:sticky md:top-2 md:max-h-[calc(100dvh-5.5rem)] md:overflow-y-auto">{nav}</div>
          <div className="min-w-0 max-w-3xl">
            {current && (
              <div className="mb-8">
                <h2 className="text-[20px] font-medium tracking-tight">{t(current.label)}</h2>
                {current.note && <p className="mt-1 text-[13px] text-fg-muted">{t(current.note)}</p>}
              </div>
            )}
            {renderPage(active)}
          </div>
        </div>
      ) : (current ? renderPage(current.value) : phoneMenu)}
    </FullPage>
  );
}

// Small mono lowercase caption, the same voice as the pond captions.
const CAPTION = "font-mono text-[11px] lowercase tracking-wide text-fg-subtle";

// A plain list of tappable rows on phones: hairlines between them, no card.
function Group({ children }) {
  return <div className="divide-y divide-border border-y border-border">{children}</div>;
}

function Row({ label, value, onClick, destructive = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-12 w-full items-center gap-3 px-1 text-left text-[15px] transition-colors active:bg-raised ${
        destructive ? "text-danger" : "text-fg"
      }`}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {value && <span className="max-w-[45%] shrink truncate text-[14px] text-fg-subtle">{value}</span>}
      {!destructive && <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-fg-subtle" />}
    </button>
  );
}

function useLoad(load, deps = []) {
  const [state, setState] = useState({ data: null, error: "" });
  const reload = () => load()
    .then((data) => setState({ data, error: "" }))
    .catch((err) => setState((s) => ({ ...s, error: err.message })));
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, deps);
  return { ...state, reload };
}

function Notice({ text, error }) {
  if (!text) return null;
  return (
    <p role={error ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-[13px] ${
      error ? "border-danger/30 bg-danger-soft text-danger" : "border-border text-fg-muted"
    }`}>{text}</p>
  );
}

// A group of settings: a mono caption and a short note, then the rows. A hairline starts each group.
function Section({ title, description, children }) {
  return (
    <section className="border-t border-border pt-4 first:border-t-0 first:pt-0">
      {(title || description) && (
        <div className="mb-2">
          {title && <h3 className={CAPTION}>{title}</h3>}
          {description && <p className="mt-1 text-[13px] leading-snug text-fg-muted">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

// Rows under one caption: a hairline between them.
function Rows({ children, className = "" }) {
  return <div className={`divide-y divide-border ${className}`}>{children}</div>;
}

// One setting: the name and a one-line hint on the left, the control on the right.
// On phones the control sits below, unless `inline` (switches and buttons stay on the same line).
function SettingRow({ label, description, children, inline = false, className = "" }) {
  return (
    <div className={`flex min-h-11 gap-x-6 gap-y-2 py-3 ${
      inline ? "items-center justify-between" : "flex-col sm:flex-row sm:items-center sm:justify-between"
    } ${className}`}>
      <div className="min-w-0">
        <div className="text-[14px] leading-5 text-fg">{label}</div>
        {description && <div className="mt-0.5 text-[13px] leading-snug text-fg-muted">{description}</div>}
      </div>
      {children && <div className={inline ? "shrink-0" : "w-full sm:w-auto sm:shrink-0"}>{children}</div>}
    </div>
  );
}

// A yes/no setting: the sentence on the left, the switch on the right.
function ToggleRow({ label, description, checked, onCheckedChange, disabled, className }) {
  return (
    <SettingRow inline label={label} description={description} className={className}>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange}
        label={<span className="sr-only">{label}</span>} />
    </SettingRow>
  );
}

const TEXTAREA = "w-full rounded-md border border-border bg-surface px-3 py-2 text-base md:text-sm "
  + "placeholder:text-fg-subtle transition-colors focus:border-fg-subtle focus:outline-none focus:ring-2 focus:ring-fg/10";

// ---- Account ----

function AccountTab({ username, onChanged, onSignOut }) {
  const [name, setName] = useState(username || "");
  const [password, setPassword] = useState({ current: "", next: "" });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState({ text: "", error: false });

  useEffect(() => setName(username || ""), [username]);

  async function saveName(event) {
    event.preventDefault();
    setBusy("name");
    setMessage({ text: "", error: false });
    try {
      await api("/api/me", { method: "PATCH", body: { username: name } });
      toast.success(t("Username changed"));
      onChanged?.();
    } catch (err) {
      setMessage({ text: err.message, error: true });
    } finally {
      setBusy("");
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    setBusy("password");
    setMessage({ text: "", error: false });
    try {
      await api("/api/me/password", { method: "POST", body: password });
      toast.success(t("Password changed. Sign in again with it."));
      onSignOut?.();
    } catch (err) {
      setMessage({ text: err.message, error: true });
    } finally {
      setBusy("");
    }
  }

  async function signOutOthers() {
    try {
      const result = await api("/api/me/sessions/others", { method: "POST", body: {} });
      toast.success(result.signedOut
        ? t("Signed out {count} other devices", { count: result.signedOut })
        : t("No other devices were signed in"));
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="grid gap-8">
      <Section title={t("Username")} description={t("The name you sign in with.")}>
        <form className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={saveName}>
          <Field label={t("Username")} hint={t("2–20 letters, digits, - or _")} className="sm:w-72">
            <Input value={name} maxLength={20} autoCapitalize="none" autoComplete="username"
              onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button type="submit" className="max-sm:h-11 sm:mb-[22px]" disabled={busy !== "" || name.trim().toLowerCase() === username}>{t("Save username")}</Button>
        </form>
      </Section>

      <Section title={t("Password")} description={t("Changing it signs you out on every device.")}>
        <form className="mt-3 grid max-w-sm gap-4" onSubmit={savePassword}>
          <Field label={t("Current password")}>
            <Input type="password" autoComplete="current-password" value={password.current}
              onChange={(e) => setPassword({ ...password, current: e.target.value })} />
          </Field>
          <Field label={t("New password")} hint={t("At least 8 characters")}>
            <Input type="password" autoComplete="new-password" minLength={8} value={password.next}
              onChange={(e) => setPassword({ ...password, next: e.target.value })} />
          </Field>
          <div>
            <Button type="submit" className="max-sm:h-11" disabled={busy !== "" || !password.current || password.next.length < 8}>{t("Change password")}</Button>
          </div>
        </form>
      </Section>
      <Section title={t("Devices")} description={t("Keeps this device signed in and signs out all the others.")}>
        <div className="mt-3"><Button className="max-sm:h-11" onClick={signOutOthers}>{t("Sign out other devices")}</Button></div>
      </Section>
      <Notice text={message.text} error={message.error} />
    </div>
  );
}

// ---- Personalisation ----

const PERSONALITY = [
  { value: "balanced", label: "Balanced" },
  { value: "concise", label: "Concise" },
  { value: "detailed", label: "Detailed" },
];
const LANGUAGE = [
  { value: "auto", label: "Match my message" },
  { value: "de", label: "German" },
  { value: "en", label: "English" },
];

function PersonalTab() {
  const { data, error, reload } = useLoad(() => api("/api/settings"));
  const [instructions, setInstructions] = useState("");
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) {
      setForm(data.prefs);
      setInstructions(data.prefs.customInstructions || "");
    }
  }, [data]);

  if (error) return <Notice text={error} error />;
  if (!data || !form) return <Loading />;
  const allowed = data.allowed;

  async function savePrefs(patch) {
    setForm((f) => ({ ...f, ...patch }));
    try {
      const result = await api("/api/settings/prefs", { method: "PUT", body: patch });
      setForm(result.prefs);
    } catch (err) {
      toast.error(err.message);
      reload();
    }
  }

  async function saveInstructions(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await savePrefs({ customInstructions: instructions.trim() });
      toast.success(t("Instructions saved"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8">
      <Section title={t("Your instructions")} description={t("Taken into account in every new chat.")}>
        <form className="mt-3 grid gap-3" onSubmit={saveInstructions}>
          <textarea
            className={`${TEXTAREA} min-h-28 resize-y`}
            maxLength={1500}
            value={instructions}
            placeholder={t("For example: keep answers short, I prefer metric units.")}
            onChange={(e) => setInstructions(e.target.value)}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-fg-subtle tabular-nums">{instructions.length}/1500</span>
            <Button type="submit" disabled={busy || instructions.trim() === (form.customInstructions || "")}>{t("Save")}</Button>
          </div>
        </form>
      </Section>

      <Section title={t("Answers")}>
        <Rows>
          <SettingRow label={t("Style")}>
            <Select aria-label={t("Style")} className="w-full sm:w-48" value={form.personality} onChange={(e) => savePrefs({ personality: e.target.value })}>
              {PERSONALITY.map((p) => <option key={p.value} value={p.value}>{t(p.label)}</option>)}
            </Select>
          </SettingRow>
          <SettingRow label={t("Reply language")}>
            <Select aria-label={t("Reply language")} className="w-full sm:w-48" value={form.language} onChange={(e) => savePrefs({ language: e.target.value })}>
              {LANGUAGE.map((l) => <option key={l.value} value={l.value}>{t(l.label)}</option>)}
            </Select>
          </SettingRow>
        </Rows>
      </Section>

      <Section title={t("Features")}>
        <Rows>
          <ToggleRow
            checked={form.memory && allowed.memory}
            disabled={!allowed.memory}
            onCheckedChange={(v) => savePrefs({ memory: v })}
            label={allowed.memory ? t("Memory: remember what I ask it to remember.") : t("Memory is turned off for your account.")}
          />
          <ToggleRow
            checked={form.webSearch && allowed.web}
            disabled={!allowed.web}
            onCheckedChange={(v) => savePrefs({ webSearch: v })}
            label={allowed.web ? t("Web search and reading pages.") : t("Web search is turned off for your account.")}
          />
        </Rows>
      </Section>
    </div>
  );
}

// ---- Appearance ----

const THEMES = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function AppearanceTab() {
  const { lang, setLang } = useI18n();
  const { data, error } = useLoad(() => api("/api/settings"));
  const [theme, setTheme] = useState("system");
  useEffect(() => { if (data) setTheme(data.prefs.theme); }, [data]);
  if (error) return <Notice text={error} error />;
  if (!data) return <Loading />;

  async function chooseLanguage(code) {
    setLang(code);
    try {
      await api("/api/settings/prefs", { method: "PUT", body: { uiLanguage: code } });
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function chooseLook(value) {
    try {
      await api("/api/settings/prefs", { method: "PUT", body: { uiStyle: value } });
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function choose(value) {
    setTheme(value);
    setThemePreference(value);
    try {
      await api("/api/settings/prefs", { method: "PUT", body: { theme: value } });
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="grid gap-8">
      <Section title={t("Interface language")} description={t("Interface language and reply language are separate.")}>
        <Rows>
          <SettingRow label={t("Language")} description={t("The language of buttons and menus.")}>
            <Select aria-label={t("Language")} className="w-full sm:w-48" value={lang} onChange={(e) => chooseLanguage(e.target.value)}>
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </Select>
          </SettingRow>
        </Rows>
      </Section>
      <Section title={t("Theme")} description={t("System follows the setting of your phone or computer.")}>
        <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border sm:max-w-sm">
          {THEMES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={theme === option.value}
              onClick={() => choose(option.value)}
              className={`h-11 text-[14px] transition-colors sm:h-9 ${
                theme === option.value ? "bg-raised font-medium text-fg" : "bg-surface text-fg-muted hover:text-fg"
              }`}
            >
              {t(option.label)}
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ---- Voice ----

function VoiceTab() {
  const { data, error, reload } = useLoad(() => api("/api/settings"));
  const [testing, setTesting] = useState(false);
  if (error) return <Notice text={error} error />;
  if (!data) return <Loading />;
  const prefs = data.prefs;

  async function save(patch) {
    try {
      await api("/api/settings/prefs", { method: "PUT", body: patch });
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function test() {
    setTesting(true);
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t("Hello, this is how I sound.") }),
      });
      if (!response.ok) throw new Error(t("The voice is not available right now."));
      const audio = new Audio(URL.createObjectURL(await response.blob()));
      await audio.play();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="grid gap-8">
      <Section title={t("Replies")} description={t("Read aloud when a reply arrives. You can still switch it on or off in the account menu.")}>
        <Rows>
          <ToggleRow checked={prefs.readAloud} onCheckedChange={(v) => save({ readAloud: v })} label={t("Read replies aloud by default.")} />
        </Rows>
      </Section>
      <Section title={t("Voice")}>
        <Rows>
          <SettingRow label={t("Voice")}>
            <div className="flex gap-2">
              <Select aria-label={t("Voice")} className="min-w-0 flex-1 sm:w-36 sm:flex-none" value={prefs.voice} onChange={(e) => save({ voice: e.target.value })}>
                {VOICE_NAMES.map((v) => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
              </Select>
              <Button className="shrink-0 max-sm:h-11" onClick={test} disabled={testing}>{testing ? t("Playing…") : t("Play sample")}</Button>
            </div>
          </SettingRow>
        </Rows>
      </Section>
    </div>
  );
}

const VOICE_NAMES = ["marin", "cedar", "coral", "sage", "ballad", "verse", "alloy", "ash", "echo", "shimmer", "fable", "onyx", "nova"];

// ---- Apps ----
// Everything the assistant can use. Ready apps work at once; Google apps use one sign-in;
// token apps take a personal token once; connectors are set up by the admin.

const APP_INFO = {
  weather: "Current weather and a short forecast for any place.",
  currency: "Converts money with current exchange rates.",
  wikipedia: "Short summaries of Wikipedia articles.",
  maps: "Finds places and driving distances.",
  gmail: "Find mail and draft emails. Nothing is sent until you confirm.",
  calendar: "See your events and add new ones. Nothing is added until you confirm.",
  drive: "Find files by name. Only names, dates and links are read.",
  todoist: "See your tasks and add new ones. Nothing is added until you confirm.",
  github: "See the issues and pull requests assigned to you, and your notifications.",
  notion: "Search your Notion pages. Read-only.",
  connector: "A connector your admin set up.",
};

const CATEGORIES = [
  { value: "ready", label: "Ready to use" },
  { value: "google", label: "Google" },
  { value: "token", label: "With a personal token" },
  { value: "connector", label: "Connectors" },
];

function AppsTab() {
  const { data, error, reload } = useLoad(() => api("/api/apps"));
  const [busy, setBusy] = useState("");
  const [tokenFor, setTokenFor] = useState(null);
  if (error) return <Notice text={error} error />;
  if (!data) return <Loading />;

  async function setEnabled(app, enabled) {
    setBusy(app.id);
    try {
      await api(`/api/apps/${app.id}`, { method: "PUT", body: { enabled } });
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy("");
    }
  }

  async function disconnect(app) {
    try {
      await api(`/api/apps/${app.id}/token`, { method: "DELETE" });
      toast.success(t("{name} disconnected", { name: t(app.name) }));
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="grid gap-8">
      <p className="max-w-prose text-[13px] text-fg-muted">
        {t("Install an app to let the assistant use it. Anything that changes something asks you to confirm first.")}
      </p>
      {!data.googleConfigured && <Notice text={t("Google sign-in is not set up on this server yet, so Google apps cannot be installed.")} />}
      {!data.secretsEnabled && <Notice text={t("The server has no ENCRYPTION_KEY, so apps with a token cannot be connected.")} />}

      {CATEGORIES.map((category) => {
        const apps = data.apps.filter((app) => app.category === category.value);
        if (!apps.length) return null;
        return (
          <Section key={category.value} title={t(category.label)}>
            <Rows>
              {apps.map((app) => {
                const info = APP_INFO[app.id] || APP_INFO.connector;
                const toggle = app.installed || app.category === "ready" || app.category === "connector";
                return (
                  <SettingRow
                    key={app.id}
                    inline
                    label={(
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{t(app.name)}</span>
                        {!app.allowed && <Badge>{t("Off for your account")}</Badge>}
                      </span>
                    )}
                    description={t(info)}
                  >
                    <div className="flex items-center gap-2">
                      {toggle && (
                        <Switch
                          checked={app.enabled}
                          disabled={!app.allowed || busy === app.id}
                          onCheckedChange={(v) => setEnabled(app, v)}
                          label={<span className="sr-only">{t("Use {name}", { name: t(app.name) })}</span>}
                        />
                      )}
                      {!toggle && app.category === "google" && (
                        <Button size="sm" className="max-sm:h-11" disabled={!app.allowed || !data.googleConfigured}
                          onClick={() => { window.location.href = "/api/google/connect"; }}>
                          {t("Install")}
                        </Button>
                      )}
                      {!toggle && app.category === "token" && (
                        <Button size="sm" className="max-sm:h-11" disabled={!app.allowed || !data.secretsEnabled}
                          onClick={() => setTokenFor(app)}>
                          {t("Connect")}
                        </Button>
                      )}
                      {app.category === "token" && app.installed && (
                        <Button size="sm" variant="ghost" className="max-sm:h-11" onClick={() => disconnect(app)}>{t("Disconnect")}</Button>
                      )}
                    </div>
                  </SettingRow>
                );
              })}
            </Rows>
          </Section>
        );
      })}
      {!data.apps.some((a) => a.category === "connector") && (
        <p className="text-[13px] text-fg-subtle">{t("More apps appear here when your admin adds connectors.")}</p>
      )}
      {tokenFor && (
        <TokenDialog
          app={tokenFor}
          onClose={() => setTokenFor(null)}
          onConnected={() => { setTokenFor(null); reload(); }}
        />
      )}
    </div>
  );
}

// Asks once for the personal token. The server checks it with the service before saving it.
function TokenDialog({ app, onClose, onConnected }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api(`/api/apps/${app.id}/token`, { method: "PUT", body: { token } });
      toast.success(t("Connected"));
      onConnected();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={t("Connect {name}", { name: t(app.name) })}
      description={t("Paste your personal token. It is checked once with the service, then stored encrypted.")}
    >
      <form className="grid gap-4" onSubmit={save}>
        <Field label={t("Access token")}>
          <Input type="password" autoComplete="off" required value={token} onChange={(e) => setToken(e.target.value)} />
        </Field>
        {app.tokenHelp && (
          <a href={app.tokenHelp} target="_blank" rel="noopener noreferrer"
            className="text-sm text-fg-muted underline decoration-border-strong underline-offset-4 hover:text-fg">
            {t("Where do I find the token?")}
          </a>
        )}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={busy}>{t("Cancel")}</Button>
          <Button variant="primary" type="submit" disabled={busy || !token.trim()}>{t("Connect")}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ---- Data ----

function DataTab({ onChatsChanged }) {
  const [confirm, setConfirm] = useState(false);
  const [forgetAll, setForgetAll] = useState(false);

  async function deleteMemories() {
    try {
      const result = await api("/api/me/memories", { method: "DELETE" });
      toast.success(`Deleted ${result.deleted} memor${result.deleted === 1 ? "y" : "ies"}`);
      setForgetAll(false);
    } catch (err) {
      toast.error(err.message);
    }
  }
  const [busy, setBusy] = useState(false);

  async function exportData() {
    try {
      const response = await fetch("/api/me/export", { credentials: "same-origin" });
      if (!response.ok) throw new Error(t("The export failed."));
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "my-data.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function deleteChats() {
    setBusy(true);
    try {
      const result = await api("/api/me/chats", { method: "DELETE" });
      toast.success(`Deleted ${result.deleted} chat${result.deleted === 1 ? "" : "s"}`);
      setConfirm(false);
      onChatsChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8">
      <Section>
        <Rows>
          <SettingRow inline label={t("Export")} description={t("Download your chats, memories and notes as one JSON file.")}>
            <Button className="max-sm:h-11" onClick={exportData}>{t("Export my data")}</Button>
          </SettingRow>
          <SettingRow inline label={t("Delete chats")} description={t("Removes all of your chats. Memories and notes are kept.")}>
            <Button variant="danger" className="max-sm:h-11" onClick={() => setConfirm(true)}>{t("Delete all chats")}</Button>
          </SettingRow>
          <SettingRow inline label={t("Delete memories")} description={t("Forgets everything the assistant saved about you.")}>
            <Button variant="danger" className="max-sm:h-11" onClick={() => setForgetAll(true)}>{t("Delete all memories")}</Button>
          </SettingRow>
        </Rows>
      </Section>
      <Modal
        open={forgetAll}
        onOpenChange={setForgetAll}
        title={t("Delete all memories?")}
        description={t("The assistant will not remember any of them. This cannot be undone.")}
        footer={(
          <>
            <Button onClick={() => setForgetAll(false)}>{t("Cancel")}</Button>
            <Button variant="danger" onClick={deleteMemories}>{t("Delete all")}</Button>
          </>
        )}
      />
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title={t("Delete all chats?")}
        description={t("This cannot be undone.")}
        footer={(
          <>
            <Button onClick={() => setConfirm(false)}>{t("Cancel")}</Button>
            <Button variant="danger" onClick={deleteChats} disabled={busy}>{t("Delete all")}</Button>
          </>
        )}
      />
    </div>
  );
}

// ---- Mail ----

function MailTab() {
  const { data, error, reload } = useLoad(() => api("/api/mail/settings"));
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState({ text: "", error: false });
  const [inbox, setInbox] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) {
      const s = data.settings;
      setForm({ host: s.host, address: s.address, password: "", ntfyTopic: "", reportEnabled: s.reportEnabled, consent: s.consent });
    }
  }, [data]);

  if (error) return <Notice text={error} error />;
  if (!data || !form) return <Loading />;
  const s = data.settings;

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setMessage({ text: "", error: false });
    try {
      const body = { ...form };
      if (!body.password) delete body.password;
      if (!body.ntfyTopic) delete body.ntfyTopic;
      await api("/api/mail/settings", { method: "PUT", body });
      setMessage({ text: t("Saved."), error: false });
      toast.success(t("Mail settings saved"));
      reload();
    } catch (err) {
      setMessage({ text: err.message, error: true });
    } finally {
      setBusy(false);
    }
  }

  async function showInbox() {
    setBusy(true);
    setMessage({ text: "", error: false });
    try {
      const result = await api("/api/mail/inbox");
      setInbox(result.messages);
    } catch (err) {
      setMessage({ text: err.message, error: true });
    } finally {
      setBusy(false);
    }
  }

  async function checkNow() {
    setBusy(true);
    try {
      const { result } = await api("/api/mail/report-now", { method: "POST", body: {} });
      let text = t("Nothing new.");
      if (result.skipped) text = `Not running: ${result.skipped}.`;
      else if (result.baseline) text = t("Started watching from now on. You will hear about new important mail.");
      else if (result.checked) text = `Checked ${result.checked} new mail(s). ${result.important} important${result.pushed ? ", sent to your phone" : " (no phone topic set)"}.`;
      setMessage({ text, error: false });
    } catch (err) {
      setMessage({ text: err.message, error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-8" onSubmit={save}>
      <p className="max-w-prose text-[13px] text-fg-muted">{t("The assistant reads only the sender, subject and date of your mail. Nothing is changed or moved. Use an app password from Yahoo, not your normal password.")}</p>
      {!s.secretsEnabled && <Notice text={t("The server has no ENCRYPTION_KEY, so the password cannot be stored.")} error />}

      <Section title={t("Account")}>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label={t("Mail server")}>
            <Input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
          </Field>
          <Field label={t("Mail address")}>
            <Input type="email" autoComplete="email" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <Field label={t("App password")} hint={s.hasPassword ? t("Saved. Leave empty to keep it.") : t("Not saved yet.")}>
            <Input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Field label={t("Phone notifications topic (ntfy)")} hint={s.hasNtfy ? t("Saved. Leave empty to keep it.") : t("A long random name only you know.")}>
            <Input value={form.ntfyTopic} placeholder="long-random-name" onChange={(e) => setForm({ ...form, ntfyTopic: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section title={t("Reports")}>
        <Rows>
          <ToggleRow
            checked={form.consent}
            onCheckedChange={(v) => setForm({ ...form, consent: v, reportEnabled: v ? form.reportEnabled : false })}
            label={t("I agree that sender, subject and date of new mail are sent to the AI to judge importance.")}
          />
          <ToggleRow
            checked={form.reportEnabled}
            disabled={!form.consent}
            onCheckedChange={(v) => setForm({ ...form, reportEnabled: v })}
            label={t("Push me a notification for important mail (checked every 10 minutes).")}
          />
        </Rows>
      </Section>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button variant="primary" type="submit" className="max-sm:h-11" disabled={busy}>{t("Save")}</Button>
        <Button className="max-sm:h-11" onClick={showInbox} disabled={busy || !s.hasPassword}>{t("Show inbox")}</Button>
        <Button className="max-sm:h-11" onClick={checkNow} disabled={busy || !s.reportEnabled}>{t("Check now")}</Button>
      </div>
      <Notice text={message.text} error={message.error} />
      {inbox && (
        <div className="divide-y divide-border rounded-md border border-border">
          {inbox.map((m) => (
            <div key={m.uid} className="grid gap-0.5 px-3 py-2.5">
              <span className="truncate text-[13px] text-fg-muted">{m.from}{m.seen ? "" : " · new"}</span>
              <span className="truncate text-[14px]">{m.subject}</span>
            </div>
          ))}
          {!inbox.length && <div className="px-3 py-2.5 text-[14px] text-fg-muted">{t("Inbox is empty.")}</div>}
        </div>
      )}
    </form>
  );
}

// ---- Memory ----

function MemoryTab() {
  const { data, error, reload } = useLoad(() => api("/api/memories"));
  const settings = useLoad(() => api("/api/settings"));

  async function setLearning(value) {
    try {
      await api("/api/settings/prefs", { method: "PUT", body: { learnFromChats: value } });
      settings.reload();
    } catch (err) {
      toast.error(err.message);
    }
  }
  if (error) return <Notice text={error} error />;
  if (!data) return <Loading />;

  async function forget(id) {
    try {
      await api(`/api/memories/${id}`, { method: "DELETE" });
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="grid gap-8">
      <Section>
        <Rows>
          <ToggleRow
            checked={settings.data?.prefs.learnFromChats ?? true}
            disabled={!settings.data}
            onCheckedChange={setLearning}
            label={t("Learn from my chats: save useful facts after a reply. You can delete any of them here.")}
          />
        </Rows>
      </Section>
      <Section description={t("Things you asked the assistant to remember. It uses them in every chat. Ask it to “remember that…” to add one.")}>
        {!data.memories.length && <p className="py-6 text-[14px] text-fg-subtle">{t("Nothing saved yet.")}</p>}
        {data.memories.length > 0 && (
          <Rows>
            {data.memories.map((m) => (
              <div key={m.id} className="flex min-h-11 items-center gap-2 py-1.5">
                <span className="min-w-0 flex-1 break-words text-[14px]">{m.text}</span>
                {m.source === "chat" && <Badge>{t("From a chat")}</Badge>}
                <IconButton label={`Delete memory: ${m.text}`} className="size-11 sm:size-9" onClick={() => forget(m.id)}>
                  <Trash2 size={16} aria-hidden="true" />
                </IconButton>
              </div>
            ))}
          </Rows>
        )}
      </Section>
    </div>
  );
}

// ---- Usage ----

function UsageTab() {
  const { data, error } = useLoad(() => api("/api/usage/me"));
  if (error) return <Notice text={error} error />;
  if (!data) return <Loading />;
  const { today } = data;
  return (
    <Section description={t("The last 24 hours.")}>
      <Rows>
        <Stat label={t("Messages")} value={today.messages} />
        <Stat label={t("AI tokens (approx.)")} value={today.tokens} />
      </Rows>
    </Section>
  );
}

// One figure: the name on the left, the number on the right.
function Stat({ label, value, of }) {
  return (
    <div className="flex min-h-11 items-baseline justify-between gap-4 py-3">
      <span className="text-[14px] text-fg">{label}</span>
      <span className="flex items-baseline gap-2">
        <span className="font-mono text-[15px] tabular-nums">{Number(value).toLocaleString()}</span>
        {of !== null && of !== undefined && <span className="text-[13px] text-fg-subtle">{t("of {n}", { n: Number(of).toLocaleString() })}</span>}
      </span>
    </div>
  );
}

// ---- Admin ----

const ADMIN_PAGES = [
  { value: "users", label: "Users", note: "Accounts, invites and what each person may use" },
  { value: "providers", label: "AI models", note: "Which models answer, and which handle voice and images" },
  { value: "connectors", label: "Connectors", note: "The MCP servers people can connect" },
  { value: "general", label: "General", note: "Defaults for new users and the server" },
  { value: "usage", label: "Usage", note: "Messages and tokens across the server" },
];

// The admin pages as menu entries. On wide screens they also sit in the settings navigation under "Administration".
const ADMIN_ITEMS = ADMIN_PAGES.map((page) => ({
  value: "admin:" + page.value,
  label: page.value === "usage" ? "Server usage" : page.label,
  note: page.note,
}));

// The content of one admin page.
function AdminSection({ section }) {
  return (
    <>
      {section === "users" && <UsersAdmin />}
      {section === "providers" && <AiAdmin />}
      {section === "connectors" && <ConnectorsAdmin />}
      {section === "general" && <GeneralAdmin />}
      {section === "usage" && <UsageAdmin />}
    </>
  );
}

// Wide screens: the pages sit in a column on the left and the content on the right.
// Phones: a menu of cards, and each page opens with a way back to the menu.
function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

function AdminTab() {
  const wide = useMediaQuery("(min-width: 768px)");
  const [picked, setPicked] = useState(null);
  const section = picked ?? (wide ? "users" : null);
  const current = ADMIN_PAGES.find((p) => p.value === section);

  const nav = (
    <nav aria-label={t("Admin")} className={`md:sticky md:top-3 ${wide ? "grid gap-0.5" : "divide-y divide-border border-y border-border"}`}>
      {ADMIN_PAGES.map((page) => (
        <button
          key={page.value}
          type="button"
          aria-current={section === page.value ? "page" : undefined}
          onClick={() => setPicked(page.value)}
          className={wide
            ? `flex h-8 w-full items-center rounded-md px-2.5 text-left text-[14px] transition-colors ${
              section === page.value ? "bg-raised font-medium text-fg" : "text-fg-muted hover:bg-raised/60 hover:text-fg"
            }`
            : "flex min-h-14 w-full items-center gap-3 px-1 py-2 text-left transition-colors active:bg-raised"}
        >
          <span className="min-w-0 flex-1">
            <span className={wide ? "block truncate" : "block text-[15px] text-fg"}>{t(page.label)}</span>
            {!wide && <span className="block text-[13px] leading-snug text-fg-muted">{t(page.note)}</span>}
          </span>
          {!wide && <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-fg-subtle" />}
        </button>
      ))}
    </nav>
  );

  return (
    <div className="grid gap-8 md:grid-cols-[13rem_minmax(0,1fr)] md:items-start">
      <div className={section && !wide ? "hidden" : ""}>{nav}</div>
      {section && (
        <div className="grid min-w-0 gap-6">
          {!wide && (
            <button type="button" onClick={() => setPicked("")} className="flex min-h-11 w-fit items-center gap-1 text-[14px] text-fg-muted hover:text-fg">
              <ChevronLeft size={16} aria-hidden="true" /> {t("Admin")}
            </button>
          )}
          <div>
            <h3 className="text-[18px] font-medium tracking-tight">{t(current.label)}</h3>
            <p className="mt-1 text-[13px] text-fg-muted">{t(current.note)}</p>
          </div>
          <AdminSection section={section} />
        </div>
      )}
    </div>
  );
}

const FEATURE_LABELS = [
  { key: "web", label: "Web search and reading pages" },
  { key: "memory", label: "Memory" },
  { key: "mail", label: "Mail reports" },
  { key: "calendar", label: "Google Calendar" },
  { key: "gmail", label: "Gmail" },
  { key: "drive", label: "Google Drive" },
  { key: "apps", label: "Apps with a personal token" },
  { key: "mcp", label: "Connectors" },
];

// The feature list: a name and a switch per row, two columns on wider screens.
function FeatureGrid({ isOn, onSet }) {
  return (
    <div className="grid sm:grid-cols-2 sm:gap-x-8">
      {FEATURE_LABELS.map((f) => (
        <ToggleRow key={f.key} className="border-t border-border" checked={isOn(f.key)} onCheckedChange={(v) => onSet(f.key, v)} label={t(f.label)} />
      ))}
    </div>
  );
}

function FeatureSwitches({ user, reload }) {
  async function set(key, value) {
    try {
      await api(`/api/admin/users/${user.id}/features`, { method: "PUT", body: { [key]: value } });
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  }
  return <FeatureGrid isOn={(key) => Boolean(user.features?.[key])} onSet={set} />;
}

function ConnectorsAdmin() {
  const { data, error, reload } = useLoad(() => api("/api/admin/connectors"));
  const [draft, setDraft] = useState({ name: "", url: "", token: "" });
  const [busy, setBusy] = useState(false);

  if (error) return <Notice text={error} error />;
  if (!data) return <Loading />;

  async function add(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const body = { name: draft.name, url: draft.url };
      if (draft.token) body.token = draft.token;
      await api("/api/admin/connectors", { method: "POST", body });
      setDraft({ name: "", url: "", token: "" });
      toast.success(t("Connector added. Test it to see its tools."));
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function test(connector) {
    try {
      const result = await api(`/api/admin/connectors/${connector.id}/test`, { method: "POST", body: {} });
      toast.success(`${result.tools} tool${result.tools === 1 ? "" : "s"}: ${result.names.join(", ")}`);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function remove(connector) {
    try {
      await api(`/api/admin/connectors/${connector.id}`, { method: "DELETE" });
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="grid gap-8">
      <p className="max-w-prose text-[13px] text-fg-muted">
        {t("Connectors are MCP servers (Streamable HTTP, https). Their tokens are stored encrypted and never shown again. Users switch them on in their own settings.")}
      </p>
      <Section>
        {data.connectors.length > 0 && (
          <Rows>
            {data.connectors.map((c) => (
              <div key={c.id} className="flex min-h-14 items-center justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-medium">{c.name}</span>
                    {c.hasToken && <Badge>{t("Token saved")}</Badge>}
                  </div>
                  <div className="truncate font-mono text-[12px] text-fg-muted">{c.url}</div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" className="max-sm:h-11" onClick={() => test(c)}>{t("Test")}</Button>
                  <Button size="sm" variant="ghost" className="max-sm:h-11" onClick={() => remove(c)}>{t("Remove")}</Button>
                </div>
              </div>
            ))}
          </Rows>
        )}
        {!data.connectors.length && <p className="py-2 text-[14px] text-fg-subtle">{t("No connectors yet.")}</p>}
      </Section>

      <Section title={t("Add a connector")}>
        <form className="mt-3 grid gap-4 sm:grid-cols-2" onSubmit={add}>
          <Field label={t("Name")} className="min-w-0"><Input value={draft.name} maxLength={60} required onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
          <Field label={t("Address")} hint={t("https:// (or http:// for localhost)")} className="min-w-0">
            <Input type="url" value={draft.url} required onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
          </Field>
          <Field label={t("Access token")} hint={t("Optional. Stored encrypted.")} className="min-w-0">
            <Input type="password" autoComplete="off" value={draft.token} onChange={(e) => setDraft({ ...draft, token: e.target.value })} />
          </Field>
          <div className="flex sm:items-end sm:pb-[22px]">
            <Button variant="primary" type="submit" className="max-sm:h-11" disabled={busy}>{t("Add connector")}</Button>
          </div>
        </form>
      </Section>
    </div>
  );
}

function GeneralAdmin() {
  const { data, error, reload } = useLoad(() => api("/api/settings"));
  const [name, setName] = useState("");
  useEffect(() => { if (data) setName(data.assistantName); }, [data]);
  if (error) return <Notice text={error} error />;
  if (!data) return <Loading />;

  async function setDefault(key, value) {
    try {
      await api("/api/admin/defaults", { method: "PUT", body: { [key]: value } });
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function save(event) {
    event.preventDefault();
    try {
      await api("/api/admin/app", { method: "PUT", body: { assistantName: name } });
      toast.success(t("Name saved"));
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="grid gap-8">
      <Section>
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={save}>
          <Field label={t("Assistant name")} hint={t("Shown in the app and to the AI.")} className="sm:w-72">
            <Input value={name} maxLength={40} required onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button variant="primary" type="submit" className="max-sm:h-11 sm:mb-[22px]" disabled={name.trim() === data.assistantName}>{t("Save name")}</Button>
        </form>
      </Section>
      <Section title={t("New users start with")} description={t("Existing users keep what you already set for them.")}>
        <FeatureGrid isOn={(key) => Boolean(data.defaults?.[key])} onSet={setDefault} />
      </Section>
    </div>
  );
}

function UsersAdmin() {
  const { data, error, reload } = useLoad(() => api("/api/admin/users"));

  if (error) return <Notice text={error} error />;
  if (!data) return <Loading />;

  async function run(action, success) {
    try {
      await action();
      toast.success(success);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="grid gap-8">
      <InvitesAdmin onChanged={reload} />
      {data.users.map((u) => (
        <section key={u.id} className="grid gap-5 border-t border-border pt-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-[15px] font-medium">{u.username}</span>
                {u.isAdmin && <Badge tone="accent">{t("Admin")}</Badge>}
                {!u.active && <Badge tone="danger">{t("Switched off")}</Badge>}
              </div>
              <div className="mt-0.5 font-mono text-[12px] text-fg-muted tabular-nums">
                {t("{messages} messages · {tokens} tokens today", { messages: u.last24h.messages, tokens: u.last24h.tokens.toLocaleString() })}
              </div>
            </div>
            {!u.isAdmin && (
              <Button size="sm" className="shrink-0 max-sm:h-11" onClick={() => run(() => api(`/api/admin/users/${u.id}`, { method: "PATCH", body: { active: !u.active } }), u.active ? t("Account switched off") : t("Account switched on"))}>
                {u.active ? t("Switch off") : t("Switch on")}
              </Button>
            )}
          </div>
          <div className="grid gap-1">
            <span className={CAPTION}>{t("What this user may use")}</span>
            <FeatureSwitches user={u} reload={reload} />
          </div>
          <PasswordReset userId={u.id} />
        </section>
      ))}
    </div>
  );
}

// Invite links: the admin creates one, copies it and sends it. The person sets their own username and password.
function InvitesAdmin({ onChanged }) {
  const { data, error, reload } = useLoad(() => api("/api/admin/invites"));
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(false);

  if (error) return <Notice text={error} error />;
  if (!data) return null;
  const full = data.seats.used >= data.seats.max;

  async function create() {
    setBusy(true);
    try {
      const result = await api("/api/admin/invites", { method: "POST", body: {} });
      setLink(result);
      reload();
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(invite) {
    try {
      await api(`/api/admin/invites/${invite.id}`, { method: "DELETE", body: {} });
      reload();
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link.url);
      toast.success(t("Copied"));
    } catch {
      toast.error(t("Could not copy. Select the text and copy it instead."));
    }
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h3 className={CAPTION}>{t("Invite someone")}</h3>
          <p className="mt-1 max-w-prose text-[13px] leading-snug text-fg-muted">
            {t("They open the link, choose a username and a password, and are signed in. Links work once and expire after 7 days.")}
          </p>
        </div>
        <span className="font-mono text-[12px] text-fg-muted tabular-nums">{t("{used} of {max} people", { used: data.seats.used, max: data.seats.max })}</span>
      </div>
      {link && (
        <div className="grid gap-2 rounded-md border border-border p-3">
          <span className="text-[13px] text-fg">{t("Send this link. It is shown only now.")}</span>
          <div className="flex gap-2">
            <Input readOnly value={link.url} onFocus={(e) => e.target.select()} aria-label={t("Invite link")} />
            <Button className="shrink-0" onClick={copy}>{t("Copy")}</Button>
          </div>
        </div>
      )}
      {data.invites.length > 0 && (
        <Rows>
          {data.invites.map((invite) => (
            <div key={invite.id} className="flex min-h-11 items-center justify-between gap-3 py-1.5 text-[13px]">
              <span className="text-fg-muted">{t("Open until {date}", { date: new Date(invite.expiresAt).toLocaleDateString(currentLocale()) })}</span>
              <Button size="sm" variant="ghost" className="max-sm:h-11" onClick={() => revoke(invite)}>{t("Revoke")}</Button>
            </div>
          ))}
        </Rows>
      )}
      <div>
        <Button variant="primary" className="max-sm:h-11" onClick={create} disabled={busy || full}>
          {full ? t("No room left") : t("Create invite link")}
        </Button>
      </div>
    </section>
  );
}

function PasswordReset({ userId }) {
  const [password, setPassword] = useState("");
  return (
    <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={async (e) => {
      e.preventDefault();
      try {
        await api(`/api/admin/users/${userId}`, { method: "PATCH", body: { password } });
        setPassword("");
        toast.success(t("Password changed. The user is signed out everywhere."));
      } catch (err) {
        toast.error(err.message);
      }
    }}>
      <Field label={t("New password")} hint={t("Signs the user out everywhere")} className="sm:w-72">
        <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} />
      </Field>
      <Button type="submit" className="max-sm:h-11 sm:mb-[22px]" disabled={password.length < 8}>{t("Set password")}</Button>
    </form>
  );
}

const ROLE_LABEL = { chat: "Chat", voice: "Voice conversation", stt: "Speech to text", tts: "Voice (read aloud)" };

// AI models. There is one provider, Hack Club AI; the admin only picks the model for each job.

const JOBS = [
  {
    role: "chat",
    label: "Chat",
    hint: "Writes the answers. Needs text in and text out.",
    prefer: "anthropic/claude-haiku-5.5",
    fits: (m) => m.input.includes("text") && m.output.includes("text"),
  },
  {
    role: "voice",
    label: "Voice conversation",
    hint: "Writes the answers in voice mode. Pick a fast model: it decides how soon the reply starts.",
    prefer: "openai/gpt-6-luna",
    fits: (m) => m.input.includes("text") && m.output.includes("text"),
  },
  {
    role: "stt",
    label: "Speech to text",
    hint: "Turns your voice into text. Needs audio in.",
    prefer: "mistralai/voxtral-small-24b-2507",
    fits: (m) => m.input.includes("audio") && m.output.includes("text"),
  },
  {
    role: "tts",
    label: "Read-aloud voice",
    hint: "Speaks the answers. Needs audio out.",
    prefer: "openai/gpt-audio-mini",
    fits: (m) => m.output.includes("audio"),
  },
];

// The Hack Club key, set in the app. It is stored encrypted and never shown again.
function AiKeyCard({ keySource, onChanged }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api("/api/admin/ai/key", { method: "PUT", body: { key: key.trim() } });
      setKey("");
      toast.success(t("Key saved"));
      onChanged();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    try {
      await api("/api/admin/ai/key", { method: "DELETE", body: {} });
      toast.success(t("Key removed"));
      onChanged();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const status = keySource === "app" ? t("Saved in the app, encrypted")
    : keySource === "env" ? t("Set in the server's .env file")
    : t("Not set yet");

  return (
    <Section title={t("Hack Club AI key")} description={t("Stored encrypted on the server. It is never shown again after saving.")}>
      <Rows>
        <SettingRow label={t("Status")} description={status} />
      </Rows>
      <form className="mt-3 grid max-w-md gap-3" onSubmit={save}>
        <Field label={t("New key")}>
          <Input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" className="max-sm:h-11" disabled={busy || key.trim().length < 10}>{t("Save key")}</Button>
          {keySource === "app" && <Button type="button" variant="danger" className="max-sm:h-11" onClick={remove}>{t("Remove key")}</Button>}
        </div>
      </form>
    </Section>
  );
}

function AiAdmin() {
  const { data, error, reload } = useLoad(() => api("/api/admin/ai"));
  const [draft, setDraft] = useState(null);
  const [message, setMessage] = useState({ text: "", error: false });

  useEffect(() => {
    if (data) setDraft(data.roles);
  }, [data]);

  if (error) return <Notice text={error} error />;
  if (!data || !draft) return <Loading />;

  async function save() {
    setMessage({ text: "", error: false });
    try {
      await api("/api/admin/ai", { method: "PUT", body: { roles: draft } });
      toast.success(t("AI models saved"));
      reload();
    } catch (err) {
      setMessage({ text: err.message, error: true });
    }
  }

  async function setEngine(engine) {
    try {
      await api("/api/admin/ai/voice-engine", { method: "PUT", body: { engine } });
      toast.success(t("Voice engine saved"));
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function test(role) {
    setMessage({ text: t("Testing…"), error: false });
    try {
      const result = await api("/api/admin/ai/test", { method: "POST", body: { role } });
      setMessage({ text: result.detail, error: !result.ok });
    } catch (err) {
      setMessage({ text: err.message, error: true });
    }
  }

  return (
    <div className="grid gap-8">
      <AiKeyCard keySource={data.provider.keySource} onChanged={reload} />
      <Section>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-medium">{data.provider.name}</span>
          <Badge tone={data.provider.keySet ? "accent" : "danger"}>
            {data.provider.keySet ? t("Key set") : t("No key yet")}
          </Badge>
        </div>
        <div className="mt-0.5 truncate font-mono text-[12px] text-fg-muted">{data.provider.baseUrl}</div>
        <p className="mt-2 max-w-prose text-[13px] text-fg-muted">
          {t("The address comes from the server's .env file (HACKCLUB_BASE_URL). The key is saved above and never shown here.")}
        </p>
      </Section>

      <Section title={t("Voice engine")} description={t("How voice mode listens and answers.")}>
        <div className="mt-3">
          <Select aria-label={t("Voice engine")} className="w-full sm:w-[28rem]" value={data.voiceEngine || "live"} onChange={(e) => setEngine(e.target.value)}>
            <option value="live">{t("Fast: one audio model listens and answers")}</option>
            <option value="lane">{t("Smart: listens and thinks first, then speaks")}</option>
          </Select>
        </div>
      </Section>

      {JOBS.map((job) => (
        <ModelPicker
          key={job.role}
          job={job}
          value={draft[job.role] || {}}
          voices={data.voices}
          formats={data.formats}
          onChange={(next) => setDraft({ ...draft, [job.role]: next })}
          onTest={() => test(job.role)}
        />
      ))}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <Button variant="primary" className="max-sm:h-11" onClick={save}>{t("Save models")}</Button>
      </div>
      <Notice text={message.text} error={message.error} />
    </div>
  );
}

// One job, one model. The list comes from Hack Club and can be searched and filtered by what a model accepts.
function ModelPicker({ job, value, voices, formats, onChange, onTest }) {
  const models = useLoad(() => api("/api/admin/ai/models"));
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const LIMIT = 60;

  const list = (models.data?.models || [])
    .filter((m) => showAll || job.fits(m))
    .filter((m) => {
      const needle = search.trim().toLowerCase();
      return !needle || `${m.id} ${m.name}`.toLowerCase().includes(needle);
    });
  // The recommended model for the job always comes first, then the rest in Hack Club's order.
  const ordered = [...list].sort((a, b) => Number(b.id === job.prefer) - Number(a.id === job.prefer));
  const shown = ordered.slice(0, LIMIT);
  if (value.model && !shown.some((m) => m.id === value.model)) {
    shown.unshift({ id: value.model, name: value.model });
  }

  return (
    <Section title={t(job.label)} description={t(job.hint)}>
     <div className="mt-3 grid gap-4">
      {models.error && <Notice text={models.error} error />}
      <Field label={t("Search models")} className="min-w-0">
        <Input value={search} placeholder={t("For example haiku, voxtral or audio")} onChange={(e) => setSearch(e.target.value)} />
      </Field>
      <Switch
        checked={showAll}
        onCheckedChange={setShowAll}
        label={t("Show all models, not only those that fit this job")}
      />
      <Field label={t("Model")} hint={t("Current: {model}", { model: value.model || "–" })} className="min-w-0">
        <Select value={value.model || ""} onChange={(e) => onChange({ ...value, model: e.target.value })}>
          {shown.map((m) => (
            <option key={m.id} value={m.id}>{m.name === m.id ? m.id : `${m.name} (${m.id})`}</option>
          ))}
        </Select>
      </Field>
      {list.length > LIMIT && (
        <p className="text-[12px] text-fg-subtle">{t("Showing {shown} of {total}. Type more to narrow it down.", { shown: LIMIT, total: list.length })}</p>
      )}
      {job.role === "tts" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Voice")} className="min-w-0">
            <Select value={value.voice || "marin"} onChange={(e) => onChange({ ...value, voice: e.target.value })}>
              {voices.map((v) => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
            </Select>
          </Field>
        </div>
      )}
      <div>
        <Button size="sm" variant="ghost" className="max-sm:h-11" onClick={onTest}>{t("Test {name}", { name: t(job.label) })}</Button>
      </div>
     </div>
    </Section>
  );
}

function UsageAdmin() {
  const [days, setDays] = useState(7);
  const { data, error } = useLoad(() => api(`/api/admin/usage?days=${days}`), [days]);
  if (error) return <Notice text={error} error />;
  if (!data) return <Loading />;
  return (
    <div className="grid gap-8">
      <Field label={t("Period")} className="max-w-xs">
        <Select value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {[1, 7, 30, 90].map((d) => <option key={d} value={d}>{t("Last {n} days", { n: d })}</option>)}
        </Select>
      </Field>
      <Section title={t("By user")}>
        <Rows>
          {data.byUser.map((u) => (
            <div key={u.username} className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-0.5 py-2.5">
              <span className="min-w-0 truncate text-[14px]">{u.username}</span>
              <span className="font-mono text-[12px] text-fg-muted tabular-nums">{t("{calls} calls · {tokens} tokens", { calls: u.calls, tokens: Number(u.tokens).toLocaleString() })}</span>
            </div>
          ))}
        </Rows>
      </Section>
      <Section title={t("By model")}>
        <Rows>
          {data.byModel.map((m) => (
            <div key={`${m.role}-${m.model}`} className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-0.5 py-2.5">
              <span className="min-w-0 break-words text-[14px]">{t(ROLE_LABEL[m.role] || m.role)}: {m.model}</span>
              <span className="font-mono text-[12px] text-fg-muted tabular-nums">{t("{calls} calls · {tokens} tokens", { calls: m.calls, tokens: Number((m.prompt_tokens || 0) + (m.completion_tokens || 0)).toLocaleString() })}</span>
            </div>
          ))}
          {!data.byModel.length && <div className="py-2.5 text-[14px] text-fg-subtle">{t("No usage in this period.")}</div>}
        </Rows>
      </Section>
    </div>
  );
}
