import {
  CalendarClock, ChevronRight, FolderInput, FolderPlus, LayoutGrid, Library, MoreHorizontal, Pencil,
  Pin, PinOff, Plus, Search, SquarePen, Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { currentLocale, t } from "../i18n/index.js";
import { haptic } from "../feedback.js";
import HomeOrb from "../ui/HomeOrb.jsx";
import { IconButton, Menu, MenuItem, MenuSeparator } from "../ui/ui.jsx";

// The sidebar (DESIGN.md): a quiet list. The orb and the wordmark on top, a pill search, the main places as 44px rows,
// the chats by day under mono captions with plain space between groups, and the account at the bottom.
// It is used in the sidebar on wide screens and in the drawer on phones. No pond here.

const DAY = 24 * 60 * 60 * 1000;

// SQLite timestamps are UTC without a zone.
function dayGroup(iso) {
  const time = new Date(`${String(iso).replace(" ", "T")}Z`).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (time >= today) return "today";
  if (time >= today - DAY) return "yesterday";
  if (time >= today - 7 * DAY) return "week";
  return "older";
}

const GROUP_LABEL = { today: "Today", yesterday: "Yesterday", week: "Previous 7 days", older: "Older" };

// The mark: the small dotted orb and the name in the serif. Chat.jsx puts it above the sidebar and in the drawer.
export function SidebarBrand({ name }) {
  return (
    <div className="flex min-w-0 items-center gap-2 px-1 pb-5 pt-1">
      <HomeOrb size={34} ring={false} spin={false} className="shrink-0" />
      <span className="serif truncate text-[20px] leading-7 tracking-[0.02em]">{name}</span>
    </div>
  );
}

function NavItem({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable flex h-11 w-full items-center gap-3 rounded-md px-3 text-left font-mono text-[13px] text-fg hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
    >
      <Icon size={18} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-fg-muted" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function SectionTitle({ children, action }) {
  return (
    <div className="caption flex min-h-6 items-center justify-between px-3 pb-1.5">
      <span>{children}</span>
      {action}
    </div>
  );
}

function ChatRow({ chat, active, onSelect, onRename, onDelete, onTogglePin, onMove }) {
  const title = chat.title || t("New chat");
  // Press and hold on a chat opens its menu (rename, pin, move, delete), like in the ChatGPT app. A right click does the same.
  const [menuOpen, setMenuOpen] = useState(false);
  const hold = useRef({ timer: 0, x: 0, y: 0, fired: false });
  const cancelHold = () => { clearTimeout(hold.current.timer); hold.current.timer = 0; };
  const startHold = (e) => {
    if (e.pointerType === "mouse") return;
    cancelHold();
    hold.current.fired = false;
    hold.current.x = e.clientX;
    hold.current.y = e.clientY;
    hold.current.timer = setTimeout(() => {
      hold.current.fired = true;
      haptic("confirm");
      setMenuOpen(true);
    }, 450);
  };
  const moveHold = (e) => {
    if (hold.current.timer && Math.hypot(e.clientX - hold.current.x, e.clientY - hold.current.y) > 8) cancelHold();
  };
  return (
    <li className={`group relative flex items-center rounded-md transition-colors ${active ? "bg-raised" : "hover:bg-raised/50"}`}>
      {active && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" />}
      <button
        type="button"
        aria-current={active ? "true" : undefined}
        onClick={() => {
          if (hold.current.fired) { hold.current.fired = false; return; } // the long press already opened the menu
          haptic("tap");
          onSelect(chat.id);
        }}
        onPointerDown={startHold}
        onPointerMove={moveHold}
        onPointerUp={cancelHold}
        onPointerCancel={cancelHold}
        onPointerLeave={cancelHold}
        onContextMenu={(e) => { e.preventDefault(); setMenuOpen(true); }}
        className={`h-11 min-w-0 flex-1 select-none overflow-hidden whitespace-nowrap fade-end rounded-md px-3 text-left text-[15px] [-webkit-touch-callout:none] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent md:h-10 ${
          active ? "text-fg" : "text-fg-muted hover:text-fg"
        }`}
      >
        {chat.pinned && <Pin size={11} strokeWidth={1.5} aria-hidden="true" className="-mt-0.5 mr-1.5 inline text-fg-subtle" />}
        {title}
      </button>
      <Menu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        trigger={(
          <button
            type="button"
            aria-label={t("Options for {title}", { title })}
            className="mr-0.5 grid size-11 shrink-0 place-items-center rounded-md text-fg-subtle opacity-100 hover:text-fg md:size-10 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
          >
            <MoreHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        )}
      >
        <MenuItem icon={Pencil} onSelect={() => onRename(chat)}>{t("Rename")}</MenuItem>
        <MenuItem icon={chat.pinned ? PinOff : Pin} onSelect={() => onTogglePin(chat)}>
          {chat.pinned ? t("Unpin") : t("Pin")}
        </MenuItem>
        <MenuItem icon={FolderInput} onSelect={() => onMove(chat)}>{t("Move to project")}</MenuItem>
        <MenuSeparator />
        <MenuItem icon={Trash2} destructive onSelect={() => onDelete(chat)}>{t("Delete")}</MenuItem>
      </Menu>
    </li>
  );
}

function ChatList({ chats, ...rest }) {
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-0.5">
      {chats.map((chat) => <ChatRow key={chat.id} chat={chat} active={chat.id === rest.activeId} {...rest} />)}
    </ul>
  );
}

function ProjectRow({ project, chats, open, onToggle, onNewChat, onEdit, onDelete, ...rest }) {
  return (
    <div>
      <div className="group flex items-center rounded-md hover:bg-raised/50">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-3 text-left text-[15px] text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent md:h-10"
        >
          <ChevronRight size={14} strokeWidth={1.5} aria-hidden="true" className={`shrink-0 text-fg-subtle transition-transform duration-150 ${open ? "rotate-90" : ""}`} />
          <span className="truncate">{project.name}</span>
        </button>
        <Menu
          trigger={(
            <button
              type="button"
              aria-label={t("Options for {title}", { title: project.name })}
              className="mr-0.5 grid size-11 shrink-0 place-items-center rounded-md text-fg-subtle opacity-100 hover:text-fg md:size-10 md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100"
            >
              <MoreHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
          )}
        >
          <MenuItem icon={Plus} onSelect={() => onNewChat(project)}>{t("New chat in project")}</MenuItem>
          <MenuItem icon={Pencil} onSelect={() => onEdit(project)}>{t("Edit project")}</MenuItem>
          <MenuSeparator />
          <MenuItem icon={Trash2} destructive onSelect={() => onDelete(project)}>{t("Delete project")}</MenuItem>
        </Menu>
      </div>
      <div className="motion-collapse" data-open={open} {...(open ? {} : { inert: "" })}>
        <div className="motion-collapse-inner">
          <div className="ml-4 border-l border-border pl-1">
            {chats.length ? <ChatList chats={chats} {...rest} /> : (
              <p className="caption px-3 py-2 normal-case">{t("No chats in this project yet.")}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// The account row at the bottom: a small ink circle with the person's initial, the name and a quiet "settings" caption.
// Tapping opens the account menu (the items come from Chat.jsx as children of `accountMenu`).
function AccountRow({ username, children }) {
  return (
    <div className="shrink-0 border-t border-border pt-2">
      <Menu
        align="start"
        trigger={(
          <button
            type="button"
            aria-label={t("Account: {name}", { name: username || "" })}
            className="pressable flex h-14 w-full items-center gap-3 rounded-md px-2 text-left hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
          >
            <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-fg font-mono text-[13px] uppercase leading-none text-canvas">
              {(username || "?").slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1 truncate text-[15px]">{username}</span>
            <span className="caption shrink-0">{t("Settings")}</span>
          </button>
        )}
      >
        {children}
      </Menu>
    </div>
  );
}

export default function Sidebar({
  conversations, projects, activeId, username, accountMenu,
  onSelect, onNewChat, onNewChatInProject, onRename, onDelete, onTogglePin, onMove,
  onNewProject, onEditProject, onDeleteProject, onOpenLibrary, onOpenTasks, onOpenApps,
}) {
  const [closed, setClosed] = useState({});
  const [query, setQuery] = useState("");
  const [found, setFound] = useState(null);

  // Search runs on the server, a moment after typing stops.
  useEffect(() => {
    const q = query.trim();
    if (!q) { setFound(null); return undefined; }
    const timer = setTimeout(() => {
      api(`/api/conversations/search?q=${encodeURIComponent(q)}`)
        .then((data) => setFound(data.results))
        .catch(() => setFound([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  const rowProps = { activeId, onSelect, onRename, onDelete, onTogglePin, onMove };
  const pinned = conversations.filter((c) => c.pinned);
  const recent = conversations.filter((c) => !c.pinned && !c.projectId);
  const groups = { today: [], yesterday: [], week: [], older: [] };
  for (const chat of recent) groups[dayGroup(chat.updated_at)].push(chat);

  const sections = [];
  if (pinned.length > 0) {
    sections.push((
      <section key="pinned">
        <SectionTitle>{t("Pinned")}</SectionTitle>
        <ChatList chats={pinned} {...rowProps} />
      </section>
    ));
  }
  sections.push((
    <section key="projects">
      <SectionTitle
        action={(
          <IconButton label={t("New project")} onClick={onNewProject} className="-my-2 size-11 md:size-10">
            <FolderPlus size={16} strokeWidth={1.5} aria-hidden="true" />
          </IconButton>
        )}
      >
        {t("Projects")}
      </SectionTitle>
      {projects.map((project) => (
        <ProjectRow
          key={project.id}
          project={project}
          chats={conversations.filter((c) => c.projectId === project.id && !c.pinned)}
          open={!closed[project.id]}
          onToggle={() => setClosed((s) => ({ ...s, [project.id]: !s[project.id] }))}
          onNewChat={onNewChatInProject}
          onEdit={onEditProject}
          onDelete={onDeleteProject}
          {...rowProps}
        />
      ))}
      {!projects.length && (
        <p className="caption max-w-full break-words px-3 py-2 pr-8 normal-case">
          {t("Projects group chats and give them shared instructions.")}
        </p>
      )}
    </section>
  ));
  for (const [key, chats] of Object.entries(groups)) {
    if (!chats.length) continue;
    sections.push((
      <section key={key}>
        <SectionTitle>{t(GROUP_LABEL[key])}</SectionTitle>
        <ChatList chats={chats} {...rowProps} />
      </section>
    ));
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <label className="mb-3 flex h-11 shrink-0 items-center gap-2.5 rounded-full border border-border-strong px-4 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25">
        <Search size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-fg-subtle" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Search chats")}
          aria-label={t("Search chats")}
          className="min-w-0 flex-1 bg-transparent text-base placeholder:text-fg-subtle focus:outline-none md:text-sm"
        />
      </label>
      {found === null && (
        <nav className="grid shrink-0 gap-0.5 pb-3" aria-label={t("Chats")}>
          <NavItem icon={SquarePen} label={t("New chat")} onClick={() => { haptic("tap"); onNewChat(); }} />
          <NavItem icon={Library} label={t("Library")} onClick={onOpenLibrary} />
          <NavItem icon={CalendarClock} label={t("Scheduled tasks")} onClick={onOpenTasks} />
          <NavItem icon={LayoutGrid} label={t("Apps")} onClick={onOpenApps} />
        </nav>
      )}

      {/* Only the chat list scrolls: the account row below it stays where it is. */}
      <div className="quiet-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden pt-3">
        {found !== null && (
          <ul className="grid gap-0.5" aria-label={t("Search chats")}>
            {found.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => { haptic("tap"); setQuery(""); onSelect(r.id); }}
                  className="grid min-h-11 w-full gap-0.5 rounded-md px-3 py-2 text-left hover:bg-raised/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
                >
                  <span className="truncate text-[15px]">{r.title || t("New chat")}</span>
                  {r.snippet && <span className="line-clamp-2 text-[13px] text-fg-muted">{r.snippet}</span>}
                  <span className="caption tabular-nums">{new Date(`${String(r.updatedAt).replace(" ", "T")}Z`).toLocaleDateString(currentLocale(), { day: "numeric", month: "short" })}</span>
                </button>
              </li>
            ))}
            {!found.length && <li className="caption px-3 py-2 normal-case">{t("No chats found.")}</li>}
          </ul>
        )}
        {found === null && (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-8 pb-6">{sections}</div>
            {!conversations.length && <p className="caption px-3 py-2 normal-case">{t("Your chats will appear here.")}</p>}
          </>
        )}
      </div>

      {accountMenu !== undefined && <AccountRow username={username}>{accountMenu}</AccountRow>}
    </div>
  );
}
