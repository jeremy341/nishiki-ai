import StyleSwitch from "./ui/StyleSwitch.jsx";
import Loading from "./ui/Loading.jsx";
import {
  Activity, BookOpen, Brain, Calendar, CheckSquare, ChevronRight, Coins, CloudSun, Download, FileText, GitBranch,
  HardDrive, LayoutGrid, LogOut, Mail, MapPin, Palette, Plug, ShieldCheck, Sparkles, Trash2, User, Volume2,
  KeyRound, Monitor, Moon, Sun, SlidersHorizontal, Puzzle, Languages, SunMoon, Mic, Cpu, Users,
  Globe, CalendarDays, Inbox, Blocks, ChevronLeft,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "./api.js";
import { setThemePreference } from "./theme.js";
import { getStyle } from "./style.js";
import { useI18n } from "./i18n/context.jsx";
import { currentLocale, LANGUAGES, t } from "./i18n/index.js";
import {
  Badge, Button, Card, Field, FullPage, IconButton, Input, Modal, Select, Switch, Tabs,
} from "./ui/ui.jsx";

// Settings is a full page, like the ChatGPT app: a grouped list, and each section opens
// on its own page with a back arrow. Everything here is saved on the server.
const SECTIONS = [
  { value: "account", label: "Account", icon: User },
  { value: "appearance", label: "Appearance", icon: Palette },
  { value: "personal", label: "Personalisation", icon: Sparkles },
  { value: "voice", label: "Voice", icon: Volume2 },
  { value: "apps", label: "Apps", icon: LayoutGrid },
  { value: "memory", label: "Memory", icon: Brain },
  { value: "mail", label: "Mail and notifications", icon: Mail },
  { value: "usage", label: "Usage", icon: Activity },
  { value: "data", label: "Data controls", icon: Download },
];

// Like ChatGPT and Claude: on wide screens a navigation column in groups on the left, the page on the right.
// On phones: the menu of cards, and each page opens with a way back to it.
export default function Settings({ open, onOpenChange, isAdmin, username, onSignOut, onAccountChanged, onChatsChanged, initialPage = null }) {
  const [page, setPage] = useState(initialPage);
  const wide = useMediaQuery("(min-width: 768px)");
  if (!open) return null;
  const sections = isAdmin ? [...SECTIONS, { value: "admin", label: "Admin", icon: ShieldCheck }] : SECTIONS;
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
    <nav aria-label={t("Settings")} className="grid gap-5">
      {groups.map((group) => (
        <div key={group.label} className="grid gap-0.5">
          <div className="px-2.5 pb-1.5 text-[12px] font-medium text-fg-subtle">{group.label}</div>
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
                className={`flex h-8 w-full items-center gap-3 rounded-lg px-2.5 text-left text-[14px] transition-colors ${
                  selected ? "bg-fg/10 font-medium text-fg" : "text-fg-muted hover:bg-fg/5 hover:text-fg"
                }`}
              >
                <s.icon size={16} aria-hidden="true" className="shrink-0" />
                <span className="truncate">{t(s.label)}</span>
              </button>
            );
          })}
        </div>
      ))}
      <button
        type="button"
        onClick={onSignOut}
        className="flex h-8 w-full items-center gap-3 rounded-lg px-2.5 text-left text-[14px] text-danger transition-colors hover:bg-fg/5"
      >
        <LogOut size={16} aria-hidden="true" className="shrink-0" />
        <span>{t("Sign out")}</span>
      </button>
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

  // Phones: the menu of cards first (the account, then the pages).
  const phoneMenu = (
    <div className="grid gap-6">
      <Group>
        <button
          type="button"
          onClick={() => setPage("account")}
          className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-fg/5 active:bg-fg/10"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-canvas text-[17px] font-semibold uppercase">
            {(username || "?").slice(0, 1)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[17px] font-semibold">{username}</span>
            <span className="block text-[14px] text-fg-subtle">{t("Signed in")}</span>
          </span>
          <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-fg-subtle" />
        </button>
      </Group>
      <Group>
        {sections.filter((s) => s.value !== "account").map((s) => (
          <Row
            key={s.value}
            icon={s.icon}
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
        <div className="grid gap-8 md:grid-cols-[16rem_minmax(0,1fr)] md:items-start">
          <div className="md:sticky md:top-2 md:max-h-[calc(100dvh-5.5rem)] md:overflow-y-auto">{nav}</div>
          <div className="min-w-0">
            {current && (
              <div className="mb-6">
                <h2 className="text-[22px] font-semibold tracking-tight">{t(current.label)}</h2>
                {current.note && <p className="mt-1 text-[14px] text-fg-muted">{t(current.note)}</p>}
              </div>
            )}
            {renderPage(active)}
          </div>
        </div>
      ) : (current ? renderPage(current.value) : phoneMenu)}
    </FullPage>
  );
}

// A rounded card of rows. The dividers start after the icon, as in iOS settings.
function Group({ children }) {
  return <div className="overflow-hidden rounded-[20px] bg-raised">{children}</div>;
}

function Row({ icon: Icon, label, value, onClick, destructive = false }) {
  if (destructive) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex h-[52px] w-full items-center justify-center text-[17px] font-medium text-danger transition-colors hover:bg-fg/5 active:bg-fg/10"
      >
        {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex h-[52px] w-full items-center gap-3 px-4 text-left text-[17px] transition-colors hover:bg-fg/5 active:bg-fg/10 before:absolute before:left-12 before:right-0 before:top-0 before:h-px before:bg-border first:before:hidden"
    >
      {Icon && <Icon size={20} aria-hidden="true" className="shrink-0 text-fg-muted" />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {value && <span className="max-w-[45%] shrink truncate text-[16px] text-fg-subtle">{value}</span>}
      <ChevronRight size={17} aria-hidden="true" className="shrink-0 text-fg-subtle" />
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
    <p role={error ? "alert" : "status"} className={`rounded-xl px-4 py-2.5 text-sm ${
      error ? "bg-danger-soft text-danger" : "bg-raised text-fg"
    }`}>{text}</p>
  );
}

// A settings block, flat like Claude and ChatGPT: a title and a short note, then the rows. A hairline separates blocks.
function Section({ title, description, children }) {
  return (
    <section className="grid gap-4 border-b border-border py-6 first:pt-0 last:border-b-0">
      <div>
        <h3 className="text-[15px] font-semibold">{title}</h3>
        {description && <p className="mt-1 text-[13px] leading-snug text-fg-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

// One setting: the name and what it does on the left, the control on the right (below it on phones).
function SettingRow({ label, description, children }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <div className="text-[15px] font-medium">{label}</div>
        {description && <div className="mt-0.5 text-[13px] leading-snug text-fg-muted">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
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
      <Section icon={User} title={t("Username")} description={t("The name you sign in with.")}>
        <form className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={saveName}>
          <Field label={t("Username")} hint={t("2–20 letters, digits, - or _")}>
            <Input value={name} maxLength={20} autoCapitalize="none" autoComplete="username"
              onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button type="submit" disabled={busy !== "" || name.trim().toLowerCase() === username}>{t("Save username")}</Button>
        </form>
      </Section>

      <Section icon={KeyRound} title={t("Password")} description={t("Changing it signs you out on every device.")}>
        <form className="grid gap-4" onSubmit={savePassword}>
          <Field label={t("Current password")}>
            <Input type="password" autoComplete="current-password" value={password.current}
              onChange={(e) => setPassword({ ...password, current: e.target.value })} />
          </Field>
          <Field label={t("New password")} hint={t("At least 8 characters")}>
            <Input type="password" autoComplete="new-password" minLength={8} value={password.next}
              onChange={(e) => setPassword({ ...password, next: e.target.value })} />
          </Field>
          <div>
            <Button type="submit" disabled={busy !== "" || !password.current || password.next.length < 8}>              {t("Change password")}            </Button>
          </div>
        </form>
      </Section>
      <Section icon={Monitor} title={t("Devices")} description={t("Keeps this device signed in and signs out all the others.")}>
        <div><Button onClick={signOutOthers}>{t("Sign out other devices")}</Button></div>
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
const REASONING = [
  { value: "none", label: "Off" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
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
      <Section icon={FileText} title={t("Your instructions")} description={t("Taken into account in every new chat.")}>
        <form className="grid gap-3" onSubmit={saveInstructions}>
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

      <Section icon={SlidersHorizontal} title={t("Answers")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Style")}>
            <Select value={form.personality} onChange={(e) => savePrefs({ personality: e.target.value })}>
              {PERSONALITY.map((p) => <option key={p.value} value={p.value}>{t(p.label)}</option>)}
            </Select>
          </Field>
          <Field label={t("Reply language")}>
            <Select value={form.language} onChange={(e) => savePrefs({ language: e.target.value })}>
              {LANGUAGE.map((l) => <option key={l.value} value={l.value}>{t(l.label)}</option>)}
            </Select>
          </Field>
          <Field label={t("Thinking")} hint={t("More thinking gives better answers to hard questions, but takes longer and costs more.")}>
            <Select value={form.reasoning || "low"} onChange={(e) => savePrefs({ reasoning: e.target.value })}>
              {REASONING.map((r) => <option key={r.value} value={r.value}>{t(r.label)}</option>)}
            </Select>
          </Field>
        </div>
      </Section>

      <Section icon={Puzzle} title={t("Features")}>
        <Switch
          checked={form.memory && allowed.memory}
          disabled={!allowed.memory}
          onCheckedChange={(v) => savePrefs({ memory: v })}
          label={allowed.memory ? t("Memory: remember what I ask it to remember.") : t("Memory is turned off for your account.")}
        />
        <Switch
          checked={form.webSearch && allowed.web}
          disabled={!allowed.web}
          onCheckedChange={(v) => savePrefs({ webSearch: v })}
          label={allowed.web ? t("Web search and reading pages.") : t("Web search is turned off for your account.")}
        />
      </Section>
    </div>
  );
}

// ---- Appearance ----

const THEMES = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
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
      <Section icon={Languages} title={t("Interface language")} description={t("Interface language and reply language are separate.")}>
        <SettingRow label={t("Language")} description={t("The language of buttons and menus.")}>
          <Select className="w-44" value={lang} onChange={(e) => chooseLanguage(e.target.value)}>
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </Select>
        </SettingRow>
      </Section>
      <Section icon={SunMoon} title={t("Theme")} description={t("System follows the setting of your phone or computer.")}>
        <div className="grid grid-cols-3 gap-3">
          {THEMES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={theme === option.value}
              onClick={() => choose(option.value)}
              className={`flex flex-col items-center gap-2 rounded-2xl border px-2 py-3.5 text-[13px] transition-colors ${
                theme === option.value ? "border-fg bg-canvas text-fg" : "border-transparent bg-canvas/60 text-fg-muted hover:text-fg"
              }`}
            >
              <option.icon size={22} aria-hidden="true" />
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
      <Section icon={Volume2} title={t("Replies")} description={t("Read aloud when a reply arrives. You can still switch it on or off in the account menu.")}>
        <Switch checked={prefs.readAloud} onCheckedChange={(v) => save({ readAloud: v })} label={t("Read replies aloud by default.")} />
      </Section>
      <Section icon={Mic} title={t("Voice")}>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label={t("Voice")}>
            <Select value={prefs.voice} onChange={(e) => save({ voice: e.target.value })}>
              {VOICE_NAMES.map((v) => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
            </Select>
          </Field>
          <Button onClick={test} disabled={testing}>{testing ? t("Playing…") : t("Play sample")}</Button>
        </div>
      </Section>
    </div>
  );
}

const VOICE_NAMES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

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

const APP_ICONS = {
  weather: CloudSun,
  currency: Coins,
  wikipedia: BookOpen,
  maps: MapPin,
  gmail: Mail,
  calendar: Calendar,
  drive: HardDrive,
  todoist: CheckSquare,
  github: GitBranch,
  notion: FileText,
  connector: Plug,
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
    <div className="grid gap-7">
      <p className="text-sm text-fg-muted">
        {t("Install an app to let the assistant use it. Anything that changes something asks you to confirm first.")}
      </p>
      {!data.googleConfigured && <Notice text={t("Google sign-in is not set up on this server yet, so Google apps cannot be installed.")} />}
      {!data.secretsEnabled && <Notice text={t("The server has no ENCRYPTION_KEY, so apps with a token cannot be connected.")} />}

      {CATEGORIES.map((category) => {
        const apps = data.apps.filter((app) => app.category === category.value);
        if (!apps.length) return null;
        return (
          <section key={category.value} className="grid gap-3">
            <h3 className="text-sm font-semibold">{t(category.label)}</h3>
            <Card className="divide-y divide-border">
              {apps.map((app) => {
                const Icon = APP_ICONS[app.id] || Plug;
                const info = APP_INFO[app.id] || APP_INFO.connector;
                const toggle = app.installed || app.category === "ready" || app.category === "connector";
                return (
                  <div key={app.id} className="flex items-center gap-3 px-4 py-3.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-raised">
                      <Icon size={18} aria-hidden="true" className="text-fg-muted" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{t(app.name)}</span>
                        {!app.allowed && <Badge>{t("Off for your account")}</Badge>}
                      </div>
                      <div className="mt-0.5 text-sm text-fg-muted">{t(info)}</div>
                    </div>
                    {toggle && (
                      <Switch
                        checked={app.enabled}
                        disabled={!app.allowed || busy === app.id}
                        onCheckedChange={(v) => setEnabled(app, v)}
                        label={<span className="sr-only">{t("Use {name}", { name: t(app.name) })}</span>}
                      />
                    )}
                    {!toggle && app.category === "google" && (
                      <Button size="sm" variant="primary" disabled={!app.allowed || !data.googleConfigured}
                        onClick={() => { window.location.href = "/api/google/connect"; }}>
                        {t("Install")}
                      </Button>
                    )}
                    {!toggle && app.category === "token" && (
                      <Button size="sm" variant="primary" disabled={!app.allowed || !data.secretsEnabled}
                        onClick={() => setTokenFor(app)}>
                        {t("Connect")}
                      </Button>
                    )}
                    {app.category === "token" && app.installed && (
                      <Button size="sm" variant="ghost" onClick={() => disconnect(app)}>{t("Disconnect")}</Button>
                    )}
                  </div>
                );
              })}
            </Card>
          </section>
        );
      })}
      {!data.apps.some((a) => a.category === "connector") && (
        <p className="text-sm text-fg-subtle">{t("More apps appear here when your admin adds connectors.")}</p>
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
      <Section icon={Download} title={t("Export")} description={t("Download your chats, memories and notes as one JSON file.")}>
        <div><Button onClick={exportData}>{t("Export my data")}</Button></div>
      </Section>
      <Section icon={Trash2} title={t("Delete chats")} description={t("Removes all of your chats. Memories and notes are kept.")}>
        <div><Button variant="danger" onClick={() => setConfirm(true)}>{t("Delete all chats")}</Button></div>
      </Section>
      <Section icon={Brain} title={t("Delete memories")} description={t("Forgets everything the assistant saved about you.")}>
        <div><Button variant="danger" onClick={() => setForgetAll(true)}>{t("Delete all memories")}</Button></div>
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
    <form className="grid gap-7" onSubmit={save}>
      <p className="text-sm text-fg-muted">        {t("The assistant reads only the sender, subject and date of your mail. Nothing is changed or moved. Use an app password from Yahoo, not your normal password.")}      </p>
      {!s.secretsEnabled && <Notice text={t("The server has no ENCRYPTION_KEY, so the password cannot be stored.")} error />}

      <Section icon={User} title={t("Account")}>
        <div className="grid gap-4 sm:grid-cols-2">
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

      <Section icon={Activity} title={t("Reports")}>
        <Switch
          checked={form.consent}
          onCheckedChange={(v) => setForm({ ...form, consent: v, reportEnabled: v ? form.reportEnabled : false })}
          label={t("I agree that sender, subject and date of new mail are sent to the AI to judge importance.")}
        />
        <Switch
          checked={form.reportEnabled}
          disabled={!form.consent}
          onCheckedChange={(v) => setForm({ ...form, reportEnabled: v })}
          label={t("Push me a notification for important mail (checked every 10 minutes).")}
        />
      </Section>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" type="submit" disabled={busy}>{t("Save")}</Button>
        <Button onClick={showInbox} disabled={busy || !s.hasPassword}>{t("Show inbox")}</Button>
        <Button onClick={checkNow} disabled={busy || !s.reportEnabled}>{t("Check now")}</Button>
      </div>
      <Notice text={message.text} error={message.error} />
      {inbox && (
        <Card className="divide-y divide-border">
          {inbox.map((m) => (
            <div key={m.uid} className="grid gap-0.5 px-4 py-3">
              <span className="truncate text-sm text-fg-muted">{m.from}{m.seen ? "" : " · new"}</span>
              <span className="truncate">{m.subject}</span>
            </div>
          ))}
          {!inbox.length && <div className="px-4 py-3 text-fg-muted">{t("Inbox is empty.")}</div>}
        </Card>
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
    <div className="grid gap-5">
      <Switch
        checked={settings.data?.prefs.learnFromChats ?? true}
        disabled={!settings.data}
        onCheckedChange={setLearning}
        label={t("Learn from my chats: save useful facts after a reply. You can delete any of them here.")}
      />
      <p className="text-sm text-fg-muted">        {t("Things you asked the assistant to remember. It uses them in every chat. Ask it to “remember that…” to add one.")}      </p>
      {!data.memories.length && <Card className="px-5 py-8 text-center text-fg-muted">{t("Nothing saved yet.")}</Card>}
      {data.memories.length > 0 && (
        <Card className="divide-y divide-border">
          {data.memories.map((m) => (
            <div key={m.id} className="flex items-center gap-2 px-4 py-2">
              <span className="min-w-0 flex-1 text-[15px]">{m.text}</span>
              {m.source === "chat" && <Badge>{t("From a chat")}</Badge>}
              <IconButton label={`Delete memory: ${m.text}`} onClick={() => forget(m.id)}>
                <Trash2 size={18} aria-hidden="true" />
              </IconButton>
            </div>
          ))}
        </Card>
      )}
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
    <div className="grid gap-4">
      <p className="text-sm text-fg-muted">{t("The last 24 hours.")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label={t("Messages")} value={today.messages} />
        <Stat label={t("AI tokens (approx.)")} value={today.tokens} />
      </div>
    </div>
  );
}

function Stat({ label, value, of }) {
  return (
    <Card className="p-5">
      <div className="text-sm text-fg-muted">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums tracking-tight">{Number(value).toLocaleString()}</span>
        {of !== null && of !== undefined && <span className="text-sm text-fg-subtle">{t("of {n}", { n: Number(of).toLocaleString() })}</span>}
      </div>
    </Card>
  );
}

// ---- Admin ----

const ADMIN_PAGES = [
  { value: "users", label: "Users", note: "Accounts, invites and what each person may use", icon: Users },
  { value: "providers", label: "AI models", note: "Which models answer, and which handle voice and images", icon: Cpu },
  { value: "connectors", label: "Connectors", note: "The MCP servers people can connect", icon: Plug },
  { value: "general", label: "General", note: "Defaults for new users and the server", icon: SlidersHorizontal },
  { value: "usage", label: "Usage", note: "Messages and tokens across the server", icon: Activity },
];

// The admin pages as menu entries. On wide screens they also sit in the settings navigation under "Administration".
const ADMIN_ITEMS = ADMIN_PAGES.map((page) => ({
  value: "admin:" + page.value,
  label: page.value === "usage" ? "Server usage" : page.label,
  note: page.note,
  icon: page.icon,
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
    <nav aria-label={t("Admin")} className="overflow-hidden rounded-[20px] bg-raised md:sticky md:top-3">
      {ADMIN_PAGES.map((page) => (
        <button
          key={page.value}
          type="button"
          aria-current={section === page.value ? "page" : undefined}
          onClick={() => setPicked(page.value)}
          className={`relative flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-fg/5 active:bg-fg/10 before:absolute before:left-16 before:right-0 before:top-0 before:h-px before:bg-border first:before:hidden ${
            wide && section === page.value ? "bg-fg/10" : ""
          }`}
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-canvas text-fg-muted">
            <page.icon size={18} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium">{t(page.label)}</span>
            {!wide && <span className="block text-[13px] leading-snug text-fg-muted">{t(page.note)}</span>}
          </span>
          <ChevronRight size={17} aria-hidden="true" className="shrink-0 text-fg-subtle" />
        </button>
      ))}
    </nav>
  );

  return (
    <div className="grid gap-6 md:grid-cols-[15rem_minmax(0,1fr)] md:items-start">
      <div className={section && !wide ? "hidden" : ""}>{nav}</div>
      {section && (
        <div className="grid min-w-0 gap-4">
          {!wide && (
            <button type="button" onClick={() => setPicked("")} className="flex w-fit items-center gap-1 text-[15px] font-medium text-fg-muted hover:text-fg">
              <ChevronLeft size={18} aria-hidden="true" /> {t("Admin")}
            </button>
          )}
          <div>
            <h3 className="text-[20px] font-semibold tracking-tight">{t(current.label)}</h3>
            <p className="mt-0.5 text-[14px] text-fg-muted">{t(current.note)}</p>
          </div>
          <AdminSection section={section} />
        </div>
      )}
    </div>
  );
}

const FEATURE_LABELS = [
  { key: "web", label: "Web search and reading pages", icon: Globe },
  { key: "memory", label: "Memory", icon: Brain },
  { key: "mail", label: "Mail reports", icon: Mail },
  { key: "calendar", label: "Google Calendar", icon: CalendarDays },
  { key: "gmail", label: "Gmail", icon: Inbox },
  { key: "drive", label: "Google Drive", icon: HardDrive },
  { key: "apps", label: "Apps with a personal token", icon: Blocks },
  { key: "mcp", label: "Connectors", icon: Plug },
];

function FeatureSwitches({ user, reload }) {
  async function set(key, value) {
    try {
      await api(`/api/admin/users/${user.id}/features`, { method: "PUT", body: { [key]: value } });
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  }
  return (
    <div className="divide-y divide-border overflow-hidden rounded-2xl bg-canvas px-4">
      {FEATURE_LABELS.map((f) => (
        <div key={f.key} className="flex items-center gap-3 py-3">
          <f.icon size={18} aria-hidden="true" className="shrink-0 text-fg-muted" />
          <div className="min-w-0 flex-1">
            <Switch checked={Boolean(user.features?.[f.key])} onCheckedChange={(v) => set(f.key, v)} label={t(f.label)} />
          </div>
        </div>
      ))}
    </div>
  );
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
    <div className="grid gap-6">
      <p className="text-sm text-fg-muted">
        {t("Connectors are MCP servers (Streamable HTTP, https). Their tokens are stored encrypted and never shown again. Users switch them on in their own settings.")}
      </p>
      {data.connectors.map((c) => (
        <Card key={c.id} className="grid gap-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{c.name}</span>
            {c.hasToken && <Badge>{t("Token saved")}</Badge>}
          </div>
          <span className="truncate text-sm text-fg-muted">{c.url}</span>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => test(c)}>{t("Test")}</Button>
            <Button size="sm" variant="ghost" onClick={() => remove(c)}>{t("Remove")}</Button>
          </div>
        </Card>
      ))}
      {!data.connectors.length && <Card className="px-5 py-6 text-center text-fg-muted">{t("No connectors yet.")}</Card>}

      <Card className="grid gap-4 p-5">
        <h3 className="font-semibold">{t("Add a connector")}</h3>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={add}>
          <Field label={t("Name")}><Input value={draft.name} maxLength={60} required onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
          <Field label={t("Address")} hint={t("https:// (or http:// for localhost)")}>
            <Input type="url" value={draft.url} required onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
          </Field>
          <Field label={t("Access token")} hint={t("Optional. Stored encrypted.")}>
            <Input type="password" autoComplete="off" value={draft.token} onChange={(e) => setDraft({ ...draft, token: e.target.value })} />
          </Field>
          <div className="flex items-end">
            <Button variant="primary" type="submit" disabled={busy}>{t("Add connector")}</Button>
          </div>
        </form>
      </Card>
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
    <div className="grid gap-5">
      <Card className="grid gap-4 p-5">
        <form className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={save}>
          <Field label={t("Assistant name")} hint={t("Shown in the app and to the AI.")}>
            <Input value={name} maxLength={40} required onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button variant="primary" type="submit" disabled={name.trim() === data.assistantName}>{t("Save name")}</Button>
        </form>
      </Card>
      <Card className="grid gap-4 p-5">
        <div>
          <h3 className="font-semibold">{t("New users start with")}</h3>
          <p className="mt-1 text-sm text-fg-muted">{t("Existing users keep what you already set for them.")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {FEATURE_LABELS.map((f) => (
            <Switch key={f.key} checked={Boolean(data.defaults?.[f.key])} onCheckedChange={(v) => setDefault(f.key, v)} label={t(f.label)} />
          ))}
        </div>
      </Card>
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
    <div className="grid gap-4">
      <InvitesAdmin onChanged={reload} />
      {data.users.map((u) => (
        <section key={u.id} className="grid gap-4 rounded-[20px] bg-raised p-5">
          <div className="flex items-center gap-3.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-canvas text-[16px] font-semibold uppercase">
              {u.username.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-semibold">{u.username}</span>
                {u.isAdmin && <Badge tone="accent">{t("Admin")}</Badge>}
                {!u.active && <Badge tone="danger">{t("Switched off")}</Badge>}
              </div>
              <div className="mt-0.5 text-[13px] text-fg-muted tabular-nums">
                {t("{messages} messages · {tokens} tokens today", { messages: u.last24h.messages, tokens: u.last24h.tokens.toLocaleString() })}
              </div>
            </div>
            {!u.isAdmin && (
              <Button size="sm" onClick={() => run(() => api(`/api/admin/users/${u.id}`, { method: "PATCH", body: { active: !u.active } }), u.active ? t("Account switched off") : t("Account switched on"))}>
                {u.active ? t("Switch off") : t("Switch on")}
              </Button>
            )}
          </div>
          <div className="grid gap-2">
            <span className="px-1 text-[13px] font-medium text-fg-muted">{t("What this user may use")}</span>
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
    <section className="grid gap-4 rounded-[20px] bg-raised p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">{t("Invite someone")}</h3>
          <p className="mt-1 text-sm text-fg-muted">
            {t("They open the link, choose a username and a password, and are signed in. Links work once and expire after 7 days.")}
          </p>
        </div>
        <span className="text-sm text-fg-muted tabular-nums">{t("{used} of {max} people", { used: data.seats.used, max: data.seats.max })}</span>
      </div>
      {link && (
        <div className="grid gap-2 rounded-lg border border-border p-3">
          <span className="text-sm font-medium">{t("Send this link. It is shown only now.")}</span>
          <div className="flex gap-2">
            <Input readOnly value={link.url} onFocus={(e) => e.target.select()} aria-label={t("Invite link")} />
            <Button onClick={copy}>{t("Copy")}</Button>
          </div>
        </div>
      )}
      {data.invites.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {data.invites.map((invite) => (
            <li key={invite.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="text-fg-muted">{t("Open until {date}", { date: new Date(invite.expiresAt).toLocaleDateString(currentLocale()) })}</span>
              <Button size="sm" variant="ghost" onClick={() => revoke(invite)}>{t("Revoke")}</Button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button variant="primary" onClick={create} disabled={busy || full}>
          {full ? t("No room left") : t("Create invite link")}
        </Button>
      </div>
    </section>
  );
}

function PasswordReset({ userId }) {
  const [password, setPassword] = useState("");
  return (
    <form className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={async (e) => {
      e.preventDefault();
      try {
        await api(`/api/admin/users/${userId}`, { method: "PATCH", body: { password } });
        setPassword("");
        toast.success(t("Password changed. The user is signed out everywhere."));
      } catch (err) {
        toast.error(err.message);
      }
    }}>
      <Field label={t("New password")} hint={t("Signs the user out everywhere")}>
        <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} />
      </Field>
      <Button type="submit" disabled={password.length < 8}>{t("Set password")}</Button>
    </form>
  );
}

const ROLE_LABEL = { chat: "Chat", stt: "Speech to text", tts: "Voice (read aloud)" };

// AI models. There is one provider, Hack Club AI; the admin only picks the model for each job.

const JOBS = [
  {
    role: "chat",
    label: "Chat",
    hint: "Writes the answers. Needs text in and text out.",
    fits: (m) => m.input.includes("text") && m.output.includes("text"),
  },
  {
    role: "stt",
    label: "Speech to text",
    hint: "Turns your voice into text. Needs audio in.",
    fits: (m) => m.input.includes("audio") && m.output.includes("text"),
  },
  {
    role: "tts",
    label: "Read-aloud voice",
    hint: "Speaks the answers. Needs audio out.",
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
    <div className="rounded-[20px] border border-border bg-raised px-5 [&>section]:border-b-0 [&>section]:py-5">
    <Section icon={KeyRound} title={t("Hack Club AI key")} description={t("Stored encrypted on the server. It is never shown again after saving.")}>
      <SettingRow label={t("Status")} description={status} />
      <form className="grid gap-3" onSubmit={save}>
        <Field label={t("New key")}>
          <Input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} />
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          {keySource === "app" && <Button type="button" variant="danger" onClick={remove}>{t("Remove key")}</Button>}
          <Button type="submit" variant="primary" disabled={busy || key.trim().length < 10}>{t("Save key")}</Button>
        </div>
      </form>
    </Section>
    </div>
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
    <div className="grid gap-6">
      <AiKeyCard keySource={data.provider.keySource} onChanged={reload} />
      <Card className="grid gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{data.provider.name}</span>
          <Badge tone={data.provider.keySet ? "accent" : "danger"}>
            {data.provider.keySet ? t("Key set") : t("No key yet")}
          </Badge>
        </div>
        <span className="truncate text-sm text-fg-muted">{data.provider.baseUrl}</span>
        <p className="text-sm text-fg-muted">
          {t("The address comes from the server's .env file (HACKCLUB_BASE_URL). The key is saved above and never shown here.")}
        </p>
      </Card>

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

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={save}>{t("Save models")}</Button>
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
  const shown = list.slice(0, LIMIT);
  if (value.model && !shown.some((m) => m.id === value.model)) {
    shown.unshift({ id: value.model, name: value.model });
  }

  return (
    <Card className="grid gap-4 p-5">
      <div>
        <h3 className="font-semibold">{t(job.label)}</h3>
        <p className="mt-1 text-sm text-fg-muted">{t(job.hint)}</p>
      </div>
      {models.error && <Notice text={models.error} error />}
      <Field label={t("Search models")}>
        <Input value={search} placeholder={t("For example haiku, voxtral or audio")} onChange={(e) => setSearch(e.target.value)} />
      </Field>
      <Switch
        checked={showAll}
        onCheckedChange={setShowAll}
        label={t("Show all models, not only those that fit this job")}
      />
      <Field label={t("Model")} hint={t("Current: {model}", { model: value.model || "–" })}>
        <Select value={value.model || ""} onChange={(e) => onChange({ ...value, model: e.target.value })}>
          {shown.map((m) => (
            <option key={m.id} value={m.id}>{m.name === m.id ? m.id : `${m.name} (${m.id})`}</option>
          ))}
        </Select>
      </Field>
      {list.length > LIMIT && (
        <p className="text-xs text-fg-subtle">{t("Showing {shown} of {total}. Type more to narrow it down.", { shown: LIMIT, total: list.length })}</p>
      )}
      {job.role === "tts" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Voice")}>
            <Select value={value.voice || "alloy"} onChange={(e) => onChange({ ...value, voice: e.target.value })}>
              {voices.map((v) => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
            </Select>
          </Field>
          <Field label={t("Audio format")}>
            <Select value={value.format || "mp3"} onChange={(e) => onChange({ ...value, format: e.target.value })}>
              {formats.map((f) => <option key={f} value={f}>{f}</option>)}
            </Select>
          </Field>
        </div>
      )}
      <div>
        <Button size="sm" variant="ghost" onClick={onTest}>{t("Test {name}", { name: t(job.label) })}</Button>
      </div>
    </Card>
  );
}

function UsageAdmin() {
  const [days, setDays] = useState(7);
  const { data, error } = useLoad(() => api(`/api/admin/usage?days=${days}`), [days]);
  if (error) return <Notice text={error} error />;
  if (!data) return <Loading />;
  return (
    <div className="grid gap-6">
      <Field label={t("Period")} className="max-w-xs">
        <Select value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {[1, 7, 30, 90].map((d) => <option key={d} value={d}>{t("Last {n} days", { n: d })}</option>)}
        </Select>
      </Field>
      <Section icon={Users} title={t("By user")}>
        <Card className="divide-y divide-border">
          {data.byUser.map((u) => (
            <div key={u.username} className="flex items-center justify-between gap-3 px-4 py-3">
              <span>{u.username}</span>
              <span className="text-sm text-fg-muted tabular-nums">{t("{calls} calls · {tokens} tokens", { calls: u.calls, tokens: Number(u.tokens).toLocaleString() })}</span>
            </div>
          ))}
        </Card>
      </Section>
      <Section icon={Cpu} title={t("By model")}>
        <Card className="divide-y divide-border">
          {data.byModel.map((m) => (
            <div key={`${m.role}-${m.model}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0 truncate">{t(ROLE_LABEL[m.role] || m.role)}: {m.model}</span>
              <span className="text-sm text-fg-muted tabular-nums">{t("{calls} calls · {tokens} tokens", { calls: m.calls, tokens: Number((m.prompt_tokens || 0) + (m.completion_tokens || 0)).toLocaleString() })}</span>
            </div>
          ))}
          {!data.byModel.length && <div className="px-4 py-3 text-fg-muted">{t("No usage in this period.")}</div>}
        </Card>
      </Section>
    </div>
  );
}
