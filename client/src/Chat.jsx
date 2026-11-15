import { t } from "./i18n/index.js";
import {
  Calendar as CalendarIcon, LoaderCircle, LogOut,
  Download, Pencil, PanelLeft, Plus, Settings as SettingsIcon, SquarePen, Sun, Moon, Trash2, Volume2, X,
} from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, apiStream } from "./api.js";
import Sidebar, { SidebarBrand } from "./chat/Sidebar.jsx";
import { MoveDialog, ProjectDialog } from "./chat/ProjectDialog.jsx";
import Composer from "./chat/Composer.jsx";
import Message, { ThoughtBlock } from "./chat/Message.jsx";
import { kindFor, MAX_BYTES, PICKER_ACCEPT, uploadFile } from "./files.js";
import Home from "./Home.jsx";
import { configureFeedback, dropSound, haptic } from "./feedback.js";
import KoiGlyph from "./ui/KoiGlyph.jsx";
import { ChatSkeleton } from "./ui/Loading.jsx";
import CommandPalette from "./ui/CommandPalette.jsx";
import { CalendarClock, FileText, Library as LibraryIcon, LayoutGrid, MessageSquare } from "lucide-react";
import OrbView from "./OrbView.jsx";
import { canRecord, startRecording, transcribe } from "./recorder.js";
import { speak, stopSpeaking, unlockSpeech } from "./speech.js";
import { effectiveTheme, setThemePreference, toggleTheme } from "./theme.js";
import VoiceMode from "./VoiceMode.jsx";
import FileViewer from "./FileViewer.jsx";
import {
  Button, IconButton, Menu, MenuItem, MenuSeparator, Modal, Input,
} from "./ui/ui.jsx";

// Opened rarely, so loaded on first use.
const Settings = lazy(() => import("./Settings.jsx"));
const CalendarPanel = lazy(() => import("./Calendar.jsx"));
const Library = lazy(() => import("./Library.jsx"));
const Tasks = lazy(() => import("./Tasks.jsx"));

const MAX_FILES = 4;
const readPref = (key, fallback) => {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value === "1";
  } catch {
    return fallback;
  }
};
const writePref = (key, value) => {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* private mode: the preference just won't persist */
  }
};
const readActiveId = () => {
  try {
    const value = Number(window.localStorage.getItem("activeChat"));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
};
// Which screen an address belongs to.
function routeOf(pathname) {
  let m = pathname.match(/^\/chat\/(\d+)\/?$/);
  if (m) return { kind: "chat", id: Number(m[1]) };
  m = pathname.match(/^\/settings(?:\/([a-z-]+))?\/?$/);
  if (m) return { kind: "settings", page: m[1] || null };
  m = pathname.match(/^\/(library|tasks|calendar)\/?$/);
  if (m) return { kind: m[1] };
  return { kind: "home" };
}

const writeActiveId = (id) => {
  try {
    if (id) window.localStorage.setItem("activeChat", String(id));
    else window.localStorage.removeItem("activeChat");
  } catch {
    /* ignore */
  }
};

// Small saved preferences for this browser. Private windows may refuse storage, so every access is guarded.
function readStored(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function writeStored(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* not saved; the page still works */
  }
}

export default function Chat({ session, notice, clearNotice, refreshSession, onSignedOut }) {
  const { features, google, assistantName, user } = session;
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [actions, setActions] = useState([]); // proposals waiting for a tap
  const [input, setInput] = useState("");
  const [files, setFiles] = useState([]); // { localId, id, kind, name, mime, previewUrl, status, error }
  const [busy, setBusy] = useState(false);
  // The answer while it is being written. Empty when nothing is streaming.
  const [streamText, setStreamText] = useState("");
  const [streamThinking, setStreamThinking] = useState(""); // the stronger model's thinking while it is written
  const streamRef = useRef({ text: "", thinking: "", frame: 0 });
  const [error, setError] = useState("");
  const [micState, setMicState] = useState("idle"); // idle | recording | transcribing
  const [speaking, setSpeaking] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(() => readPref("speakReplies", false));
  const [theme, setThemeState] = useState(() => effectiveTheme());
  const [confirming, setConfirming] = useState(null); // the action being run right now
  const [useCalendar] = useState(true); // the calendar is shared whenever the Calendar app is on in Settings
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatsOpen, setChatsOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [renaming, setRenaming] = useState(null); // conversation being renamed
  const [renameText, setRenameText] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [projects, setProjects] = useState([]);
  const [projectEditing, setProjectEditing] = useState(null); // null, {} for a new project, or a project
  const [moving, setMoving] = useState(null); // chat being moved to a project
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // True while the open chat's messages are on their way, so the start screen does not flash up.
  const [loadingChat, setLoadingChat] = useState(() => readActiveId() !== null);
  // Cmd/Ctrl+K opens the command palette.
  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [settingsPage, setSettingsPage] = useState(null); // page Settings opens on, e.g. apps
  const [viewing, setViewing] = useState(null); // photo or PDF shown next to the chat
  // The sidebar can be hidden on wide screens, and the file viewer can be dragged wider or narrower.
  const [sidebarShown, setSidebarShown] = useState(() => readStored("sidebarShown", "1") !== "0");
  const [viewerWidth, setViewerWidth] = useState(() => Number(readStored("viewerWidth", "520")) || 520);
  useEffect(() => writeStored("sidebarShown", sidebarShown ? "1" : "0"), [sidebarShown]);
  useEffect(() => writeStored("viewerWidth", viewerWidth), [viewerWidth]);
  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        setSidebarShown((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [levels, setLevels] = useState([]); // live microphone levels for the recording bar
  const newChatProjectRef = useRef(null); // project for the next chat, when started inside one
  const micIntentRef = useRef("keep"); // what happens when a recording ends: keep, send or cancel // conversation to delete

  const recordingRef = useRef(null);
  const feedRef = useRef(null);
  const headerRef = useRef(null); // the header and the pill: the koi on the home screen keep out of them
  const dockRef = useRef(null);
  // One hidden input per source, like the iOS attach menu: camera, photo library, Files.
  const cameraInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const activeRef = useRef(null); // the chat on screen; late replies for other chats must not show here
  const filesRef = useRef([]);
  filesRef.current = files;

  const calendarOn = Boolean(features.google && google?.connected && session.calendarApp);
  const active = conversations.find((c) => c.id === activeId);
  const uploading = files.some((f) => f.status === "uploading");
  const readyFiles = files.filter((f) => f.status === "ready");
  const canSend = !busy && !uploading && Boolean(input.trim() || readyFiles.length);
  // A new chat with nothing in it is the home screen.
  const showHome = messages.length === 0 && !busy && !loadingChat;
  const lastAnswerId = [...messages].reverse().find((m) => m.role === "assistant" && typeof m.id === "number")?.id;

  // ---- the address bar follows the screen: /chat/12, /settings, /settings/apps, /library, /tasks, /calendar ----
  // Back and forward work, and a link opens straight to the right place.
  const [routeReady, setRouteReady] = useState(false);
  const routeSynced = useRef(false);

  function applyRoute(route) {
    setVoiceOpen(false);
    setSettingsOpen(route.kind === "settings");
    if (route.kind === "settings") setSettingsPage(route.page || null);
    setLibraryOpen(route.kind === "library");
    setTasksOpen(route.kind === "tasks");
    setCalendarOpen(route.kind === "calendar");
    if (route.kind === "chat") {
      if (activeRef.current !== route.id) selectConversation(route.id);
    } else if (route.kind === "home") {
      if (activeRef.current !== null) newChat();
    }
  }
  const applyRouteRef = useRef(applyRoute);
  applyRouteRef.current = applyRoute;

  useEffect(() => {
    const onPop = () => applyRouteRef.current(routeOf(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!routeReady) return;
    const path = voiceOpen ? "/voice"
      : settingsOpen ? (settingsPage ? `/settings/${settingsPage}` : "/settings")
        : libraryOpen ? "/library"
          : tasksOpen ? "/tasks"
            : calendarOpen ? "/calendar"
              : activeId ? `/chat/${activeId}` : "/";
    if (window.location.pathname === path) {
      routeSynced.current = true;
      return;
    }
    // The first sync only corrects the address; later changes are new history steps.
    window.history[routeSynced.current ? "pushState" : "replaceState"]({}, "", path);
    routeSynced.current = true;
  }, [routeReady, activeId, settingsOpen, settingsPage, libraryOpen, tasksOpen, calendarOpen, voiceOpen]);

  useEffect(() => {
    refreshProjects();
    api("/api/conversations")
      .then((data) => {
        setConversations(data.conversations);
        const route = routeOf(window.location.pathname);
        const wanted = route.kind === "chat" ? route.id : readActiveId();
        const chosen = data.conversations.find((c) => c.id === wanted);
        if (route.kind !== "home" && route.kind !== "chat") applyRoute(route);
        setRouteReady(true);
        if (chosen) return selectConversation(chosen.id);
        setLoadingChat(false);
        return null;
      })
      .catch((err) => {
        setLoadingChat(false);
        setRouteReady(true);
        handleError(err);
      });
    return () => {
      stopSpeaking();
      recordingRef.current?.cancel();
      filesRef.current.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
    };
    // Runs once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (notice) {
      toast.success(notice);
      clearNotice();
    }
  }, [notice, clearNotice]);

  const shownCount = useRef(0);
  useEffect(() => {
    const feed = feedRef.current;
    // Opening a chat jumps straight to its end (and once more when charts and images have taken their height).
    // While the answer is being written the page follows it at once; a smooth scroll would lag behind.
    const opened = shownCount.current === 0 || Math.abs(messages.length - shownCount.current) > 2;
    shownCount.current = messages.length;
    if (!feed) return undefined;
    feed.scrollTo({ top: feed.scrollHeight, behavior: streamText || opened ? "auto" : "smooth" });
    if (!opened) return undefined;
    const later = setTimeout(() => feed.scrollTo({ top: feed.scrollHeight, behavior: "auto" }), 400);
    return () => clearTimeout(later);
  }, [messages, busy, streamText]);

  function handleError(err) {
    if (err.status === 401) {
      refreshSession();
      return;
    }
    setError(err.message);
  }

  async function refreshProjects() {
    try {
      const data = await api("/api/projects");
      setProjects(data.projects);
    } catch (err) {
      handleError(err);
    }
  }

  async function togglePin(chat) {
    try {
      await api(`/api/conversations/${chat.id}`, { method: "PATCH", body: { pinned: !chat.pinned } });
      refreshConversations();
    } catch (err) {
      handleError(err);
    }
  }

  async function deleteProject(project) {
    try {
      await api(`/api/projects/${project.id}`, { method: "DELETE", body: {} });
      toast.success(t("Project deleted"));
      refreshProjects();
      refreshConversations();
    } catch (err) {
      handleError(err);
    }
  }

  function startChatIn(project) {
    newChat();
    newChatProjectRef.current = project.id;
    setChatsOpen(false);
  }

  async function refreshConversations() {
    try {
      const data = await api("/api/conversations");
      setConversations(data.conversations);
    } catch (err) {
      handleError(err);
    }
  }

  async function loadMessages(id) {
    try {
      const data = await api(`/api/conversations/${id}/messages`);
      if (activeRef.current === id) {
        setMessages(data.messages);
        setActions(data.actions || []);
      }
    } catch (err) {
      if (err.status === 404) {
        newChat();
        refreshConversations();
        return;
      }
      handleError(err);
    }
  }

  function selectConversation(id) {
    stopSpeaking();
    setSpeaking(false);
    setError("");
    setActiveId(id);
    setActions([]);
    activeRef.current = id;
    writeActiveId(id);
    setMessages([]);
    setLoadingChat(true);
    setChatsOpen(false);
    return loadMessages(id).finally(() => {
      if (activeRef.current === id) setLoadingChat(false);
    });
  }

  function newChat() {
    newChatProjectRef.current = null;
    stopSpeaking();
    setSpeaking(false);
    setError("");
    setActiveId(null);
    setActions([]);
    activeRef.current = null;
    writeActiveId(null);
    setMessages([]);
    setLoadingChat(false);
    setChatsOpen(false);
  }

  // Edit a question, or generate the last answer again. The server answers again; the list is replaced.
  async function editMessage(id, content) {
    setBusy(true);
    setError("");
    try {
      const data = await api("/api/messages/" + id, { method: "PATCH", body: { content } });
      setMessages(data.messages);
      setActions(data.actions || []);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  async function regenerateMessage(id) {
    setBusy(true);
    setError("");
    try {
      const data = await api("/api/messages/" + id + "/regenerate", { method: "POST", body: {} });
      setMessages(data.messages);
      setActions(data.actions || []);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  // The whole chat as a Markdown file, downloaded to the device.
  // Export as JSON: the chat's messages with their roles, times and file names.
  function exportJson() {
    if (!active) return;
    const data = {
      title: active.title || "",
      exportedAt: new Date().toISOString(),
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content || "",
        createdAt: m.created_at,
        attachments: (m.attachments || []).map((a) => a.name),
      })),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(active.title || "chat").replace(/[^\w -]+/g, "").trim().slice(0, 60) || "chat"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Export as PDF: the server builds the file, so it keeps the same look on every device.
  function exportPdf() {
    if (!active) return;
    const link = document.createElement("a");
    link.href = `/api/conversations/${active.id}/export.pdf`;
    link.click();
  }

  // Save an answer as a note.
  async function saveNote(message) {
    try {
      await api("/api/notes", { method: "POST", body: { text: message.content } });
      toast.success(t("Saved as a note"));
    } catch (err) {
      toast.error(err.message);
    }
  }

  // Everything the command palette can do or open.
  const paletteCommands = [
    { id: "new", group: t("Actions"), label: t("New chat"), icon: Plus, run: newChat },
    { id: "library", group: t("Actions"), label: t("Library"), icon: LibraryIcon, run: () => setLibraryOpen(true) },
    { id: "tasks", group: t("Actions"), label: t("Scheduled tasks"), icon: CalendarClock, run: () => setTasksOpen(true) },
    { id: "apps", group: t("Actions"), label: t("Apps"), icon: LayoutGrid, run: () => { setSettingsPage("apps"); setSettingsOpen(true); } },
    { id: "settings", group: t("Actions"), label: t("Settings"), icon: SettingsIcon, run: () => setSettingsOpen(true) },
    { id: "sidebar", group: t("Actions"), label: sidebarShown ? t("Hide sidebar") : t("Show sidebar"), icon: PanelLeft, run: () => setSidebarShown((v) => !v) },
    { id: "theme", group: t("Actions"), label: t("Light or dark mode"), icon: Sun, run: changeTheme },
    ...(active ? [
      { id: "export-md", group: t("Export"), label: t("Export as Markdown"), icon: Download, run: exportChat },
      { id: "export-pdf", group: t("Export"), label: t("Export as PDF"), icon: FileText, run: exportPdf },
      { id: "export-json", group: t("Export"), label: t("Export as JSON"), icon: Download, run: exportJson },
    ] : []),
    ...conversations.map((c) => ({
      id: `chat-${c.id}`, group: t("Chats"), label: c.title || t("New chat"), icon: MessageSquare, run: () => selectConversation(c.id),
    })),
  ];

  function exportChat() {
    if (!active) return;
    const lines = [`# ${active.title || t("New chat")}`, ""];
    for (const m of messages) {
      lines.push(`## ${m.role === "user" ? t("You") : assistantName}`, "");
      if (m.content) lines.push(m.content, "");
      for (const a of m.attachments || []) lines.push(`_${t("Attached")}: ${a.name}_`, "");
    }
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(active.title || "chat").replace(/[^\w -]+/g, "").trim().slice(0, 60) || "chat"}.md`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function saveRename(event) {
    event.preventDefault();
    const title = renameText.trim().slice(0, 120);
    if (!renaming || !title) return;
    try {
      await api(`/api/conversations/${renaming.id}`, { method: "PATCH", body: { title } });
      setRenaming(null);
      refreshConversations();
    } catch (err) {
      handleError(err);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await api(`/api/conversations/${deleting.id}`, { method: "DELETE", body: {} });
      if (deleting.id === activeId) newChat();
      setDeleting(null);
      refreshConversations();
      toast.success(t("Chat deleted"));
    } catch (err) {
      handleError(err);
    }
  }

  // ---- attachments ----

  async function addFiles(fileList) {
    const picked = Array.from(fileList || []);
    if (!picked.length) return;
    const room = MAX_FILES - files.length;
    if (room <= 0) {
      setError(`Attach at most ${MAX_FILES} files per message.`);
      return;
    }
    const items = picked.slice(0, room).map((file) => {
      const kind = kindFor(file);
      const tooBig = file.size > MAX_BYTES;
      return {
        localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        kind,
        mime: file.type,
        previewUrl: kind === "image" ? URL.createObjectURL(file) : null,
        status: tooBig ? "error" : "uploading",
        error: tooBig ? t("That file is too large (max 6 MB).") : "",
        file,
      };
    });
    setFiles((list) => [...list, ...items]);
    setError("");
    for (const item of items) {
      if (item.status === "error") continue;
      uploadFile(item.file)
        .then((attachment) => {
          setFiles((list) => list.map((f) => (f.localId === item.localId
            ? { ...f, id: attachment.id, kind: attachment.kind, name: attachment.name, status: "ready" }
            : f)));
        })
        .catch((err) => {
          setFiles((list) => list.map((f) => (f.localId === item.localId
            ? { ...f, status: "error", error: err.message }
            : f)));
        });
    }
  }

  function removeFile(localId) {
    setFiles((list) => {
      const gone = list.find((f) => f.localId === localId);
      if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
      return list.filter((f) => f.localId !== localId);
    });
  }

  // ---- sending ----

  // Only real app states reach the orb.
  const status = micState === "recording" ? "listening"
    : busy ? "thinking"
    : speaking ? "speaking"
    : error ? "error"
    : "idle";

  function speakWith(text, callbacks) {
    return speak(text, { useServerVoice: features.serverTts, ...callbacks });
  }

  function speakReply(text) {
    speakWith(text, {
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onError: (code) => {
        setSpeaking(false);
        if (code !== "interrupted") setError(t("The reply could not be played."));
      },
    });
  }

  // Returns the reply text, or null if the message failed. Voice mode uses the return value.
  async function send(text, { voice = false, prompt } = {}) {
    const message = (prompt ?? text).trim();
    const ids = voice ? [] : readyFiles.map((f) => f.id);
    const sentFiles = voice ? [] : readyFiles;
    if ((!message && !ids.length) || busy || uploading) return null;
    if (!voice) {
      dropSound("send");
      haptic("tap");
    }
    unlockSpeech();
    stopSpeaking();
    setSpeaking(false);
    setError("");

    let conversationId = activeId;
    const pendingId = `pending-${Date.now()}`;
    setBusy(true);
    if (!voice) {
      setInput("");
      setFiles([]);
    }
    try {
      if (!conversationId) {
        const created = await api("/api/conversations", {
          method: "POST",
          body: { projectId: newChatProjectRef.current },
        });
        newChatProjectRef.current = null;
        conversationId = created.conversation.id;
        setConversations((list) => [created.conversation, ...list]);
        activeRef.current = conversationId;
        setActiveId(conversationId);
        writeActiveId(conversationId);
      }
      if (activeRef.current === conversationId) {
        setMessages((list) => [...list, {
          id: pendingId,
          role: "user",
          content: message,
          attachments: sentFiles.map((f) => ({ id: f.id, kind: f.kind, name: f.name, mime: f.mime, previewUrl: f.previewUrl })),
        }]);
      }

      // Pieces of the answer are shown at most once per screen frame.
      const stream = streamRef.current;
      stream.text = "";
      stream.thinking = "";
      const flush = () => {
        stream.frame = 0;
        if (activeRef.current === conversationId) {
          setStreamText(stream.text);
          setStreamThinking(stream.thinking);
        }
      };
      const data = await apiStream(`/api/conversations/${conversationId}/messages/stream`, {
        message, attachmentIds: ids, useCalendar: calendarOn && useCalendar, voice: voice || undefined,
      }, {
        onDelta: (piece) => {
          stream.text += piece;
          if (!stream.frame) stream.frame = requestAnimationFrame(flush);
        },
        onReset: () => {
          stream.text = "";
          if (!stream.frame) stream.frame = requestAnimationFrame(flush);
        },
        onEvent: (event) => {
          if (event.type !== "thinking") return;
          stream.thinking += event.text;
          if (!stream.frame) stream.frame = requestAnimationFrame(flush);
        },
      });
      if (stream.frame) cancelAnimationFrame(stream.frame);
      stream.frame = 0;
      const streamed = Boolean(stream.text);
      setStreamText("");
      setStreamThinking("");
      if (activeRef.current === conversationId) {
        setMessages((list) => [...list, streamed ? { ...data.message, key: "streaming" } : data.message]);
        if (!voice) dropSound("reply");
        const proposed = data.actions || [];
        setActions((list) => [...list.filter((a) => !proposed.some((p) => p.id === a.id)), ...proposed]);
        if (speakReplies && !voice) speakReply(data.message.content);
      }
      refreshConversations();
      return data.message.content;
    } catch (err) {
      if (activeRef.current === conversationId) {
        setMessages((list) => list.filter((m) => m.id !== pendingId));
      }
      if (!voice) {
        // Give the text and files back so nothing has to be typed again.
        setInput(message);
        setFiles(sentFiles.map((f) => ({ ...f, status: "ready" })));
      }
      handleError(err);
      return null;
    } finally {
      if (streamRef.current.frame) cancelAnimationFrame(streamRef.current.frame);
      streamRef.current.frame = 0;
      setStreamText("");
      setStreamThinking("");
      setBusy(false);
    }
  }

  // Confirmation cards: the assistant proposed something, the user taps to run or drop it.
  async function confirmAction(action) {
    if (confirming) return;
    setError("");
    setConfirming(action.id);
    try {
      const data = await api(`/api/actions/${action.id}/confirm`, { method: "POST", body: {} });
      setActions((list) => list.filter((a) => a.id !== action.id));
      setMessages((list) => [...list, data.message]);
      haptic("confirm");
      dropSound("reply");
      toast.success(t("Done"));
    } catch (err) {
      if (err.status === 404 || err.status === 409) setActions((list) => list.filter((a) => a.id !== action.id));
      else setError(err.message);
    } finally {
      setConfirming(null);
    }
  }

  async function cancelAction(action) {
    setActions((list) => list.filter((a) => a.id !== action.id));
    await api(`/api/actions/${action.id}/cancel`, { method: "POST", body: {} }).catch(() => {});
  }

  // Dictation: records until you tap again, then the speech model turns it into text
  // that lands in the box, so you can check it before sending.
  // The microphone starts a recording. The recording bar then cancels (X), keeps the words in
  // the box (square) or sends them (arrow).
  async function toggleMic() {
    if (micState === "recording") return stopDictation("keep");
    if (micState !== "idle") return;
    unlockSpeech();
    stopSpeaking();
    setSpeaking(false);
    setError("");
    if (!canRecord) {
      setError(t("This browser cannot record audio. Type your message instead."));
      return;
    }
    setLevels([]);
    micIntentRef.current = "keep";
    const recording = startRecording({
      manual: true,
      maxMs: 120000,
      onLevel: (level) => setLevels((list) => [...list.slice(-119), level]),
    });
    recordingRef.current = recording;
    setMicState("recording");
    const { wav, error: micError } = await recording.done;
    recordingRef.current = null;
    const intent = micIntentRef.current;
    if (micError) {
      setMicState("idle");
      setError(micError === "not-allowed"
        ? t("Microphone access was blocked. Allow it in your browser settings.")
        : t("The microphone could not be used."));
      return;
    }
    if (!wav || intent === "cancel") {
      setMicState("idle");
      return;
    }
    setMicState("transcribing");
    try {
      const text = await transcribe(wav);
      if (intent === "send") {
        setMicState("idle");
        if (text.trim()) send(text);
        return;
      }
      if (text) setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
    } catch (err) {
      handleError(err);
    } finally {
      setMicState("idle");
    }
  }

  // Ends the current recording: "keep" puts the words in the box, "send" sends them, "cancel" drops them.
  function stopDictation(intent) {
    micIntentRef.current = intent;
    if (intent === "cancel") recordingRef.current?.cancel();
    else recordingRef.current?.stop();
  }

  // The account keeps the choice too, so it follows the user to other devices.
  function saveAccountPref(patch) {
    api("/api/settings/prefs", { method: "PUT", body: patch }).catch(() => {});
  }

  // Haptics and the water-drop sound follow the account's switches.
  useEffect(() => {
    configureFeedback(session.prefs || {});
  }, [session.prefs]);

  // Apply the saved look and read-aloud choice once the account is loaded.
  useEffect(() => {
    if (!session.prefs) return;
    setThemePreference(session.prefs.theme);
    setThemeState(effectiveTheme());
    setSpeakReplies(session.prefs.readAloud);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.prefs?.theme, session.prefs?.readAloud]);

  function toggleSpeakReplies() {
    const next = !speakReplies;
    setSpeakReplies(next);
    writePref("speakReplies", next);
    saveAccountPref({ readAloud: next });
    if (!next) {
      stopSpeaking();
      setSpeaking(false);
    }
  }

  function changeTheme() {
    const next = toggleTheme();
    setThemeState(next);
    saveAccountPref({ theme: next });
  }

  // One turn of fast voice mode. Speech comes back as it is made; the saved messages arrive at the end.
  async function voiceTurn(wav, { onAudio, onHeard, onReply }) {
    stopSpeaking();
    setSpeaking(false);
    setError("");
    setBusy(true);
    try {
      const done = await apiStream("/api/voice/turn", { conversationId: activeRef.current, audio: wav }, {
        onEvent: (event) => {
          if (event.type === "conversation") {
            const created = event.conversation;
            setConversations((list) => [created, ...list]);
            activeRef.current = created.id;
            setActiveId(created.id);
            writeActiveId(created.id);
          } else if (event.type === "audio") onAudio?.(event.data);
          else if (event.type === "heard") onHeard?.(event.text);
          else if (event.type === "reply") onReply?.(event.text);
        },
      });
      setMessages((list) => [...list, ...done.messages]);
      const proposed = done.actions || [];
      setActions((list) => [...list.filter((a) => !proposed.some((p) => p.id === a.id)), ...proposed]);
      refreshConversations();
      return done;
    } catch (err) {
      if (err.status === 401) refreshSession();
      throw err;
    } finally {
      setBusy(false);
    }
  }

  function openVoice() {
    if (!features.voiceMode) return;
    unlockSpeech();
    setVoiceOpen(true);
  }

  async function signOut() {
    stopSpeaking();
    recordingRef.current?.cancel();
    await api("/api/logout", { method: "POST", body: {} }).catch(() => {});
    writeActiveId(null);
    onSignedOut();
  }

  // Escape closes the chat list on phones.
  useEffect(() => {
    if (!chatsOpen) return undefined;
    const onKey = (event) => { if (event.key === "Escape") setChatsOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatsOpen]);

  // ---- layout ----

  const renderSidebar = (drawer) => (
    <Sidebar
      username={user?.username}
      accountMenu={(
        <>
          <div className="px-3 py-2 text-xs text-fg-subtle">{t("Signed in as {name}", { name: user?.username || "" })}</div>
          <MenuSeparator />
          <MenuItem icon={theme === "dark" ? Sun : Moon} onSelect={changeTheme}>
            {theme === "dark" ? t("Light mode") : t("Dark mode")}
          </MenuItem>
          <MenuItem icon={Volume2} checked={speakReplies} onSelect={toggleSpeakReplies}>{t("Read replies aloud")}</MenuItem>
          {features.google && (
            <MenuItem icon={CalendarIcon} onSelect={() => { setChatsOpen(false); setCalendarOpen(true); }}>{t("Calendar")}</MenuItem>
          )}
          <MenuItem icon={SettingsIcon} onSelect={() => { setChatsOpen(false); setSettingsOpen(true); }}>{t("Settings")}</MenuItem>
          <MenuSeparator />
          <MenuItem icon={LogOut} destructive onSelect={signOut}>{t("Sign out")}</MenuItem>
        </>
      )}
      conversations={conversations}
      projects={projects}
      activeId={activeId}
      onSelect={selectConversation}
      onNewChat={newChat}
      onNewChatInProject={startChatIn}
      onRename={(c) => { setRenaming(c); setRenameText(c.title || ""); }}
      onDelete={(c) => setDeleting(c)}
      onTogglePin={togglePin}
      onMove={(c) => setMoving(c)}
      onNewProject={() => setProjectEditing({})}
      onEditProject={(p) => setProjectEditing(p)}
      onDeleteProject={deleteProject}
      onOpenLibrary={() => { setChatsOpen(false); setLibraryOpen(true); }}
      onOpenTasks={() => { setChatsOpen(false); setTasksOpen(true); }}
      onOpenApps={() => { setChatsOpen(false); setSettingsPage("apps"); setSettingsOpen(true); }}
    />
  );

  // The orb and the name in the serif (DESIGN.md): the sidebar's mark. The account lives in the sidebar footer.
  const sidebarHeader = <SidebarBrand name={assistantName} />;

  return (
    <div className="flex w-full overflow-hidden" style={{ height: "var(--app-h, 100dvh)" }}>
      <a href="#chat-main" onClick={() => document.getElementById("chat-main")?.focus()} className="sr-only z-[70] rounded-md bg-accent px-4 py-3 text-sm font-medium text-accent-fg focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:outline-2 focus:outline-offset-2 focus:outline-fg">{t("Skip to chat")}</a>
      {/* Keep the desktop sidebar mounted so its width can animate in both directions. */}
      <aside
        aria-label={t("Chats")}
        aria-hidden={!sidebarShown}
        {...(sidebarShown ? {} : { inert: "" })}
        className={`hidden shrink-0 overflow-hidden bg-surface transition-[width,opacity] duration-[var(--dur-slow)] ease-[var(--ease-snappy)] motion-reduce:transition-none ${viewing ? "xl:flex" : "md:flex"} ${sidebarShown ? "w-72 border-r border-border opacity-100" : "w-0 opacity-0"}`}
      >
        <div className="flex h-full w-72 shrink-0 flex-col px-3 pb-3 pt-5">
          {sidebarHeader}
          {renderSidebar(false)}
        </div>
      </aside>

      {/* Phones: the same list in a drawer */}
      {/* The chat list sits under the page and the page slides right over it, as in the ChatGPT iOS app. */}
      <aside
        aria-label={`${assistantName} chats`}
        {...(chatsOpen ? {} : { inert: "" })}
        className={`fixed inset-y-0 left-0 z-0 flex w-[min(86vw,300px)] flex-col border-r border-border bg-surface pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] transition-[transform,opacity] duration-[var(--dur-slow)] ease-[var(--ease-sheet)] motion-reduce:transition-none after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-40 after:bg-surface after:content-[''] md:hidden ${chatsOpen ? "translate-x-0 opacity-100" : "-translate-x-3 opacity-80"}`}
      >
        <div className="flex items-center justify-between gap-2 px-3 pt-4">
          {sidebarHeader}
          <IconButton label={t("Close chats")} onClick={() => setChatsOpen(false)} className="-mt-3"><X size={20} strokeWidth={1.5} aria-hidden="true" /></IconButton>
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-3 pb-3">{renderSidebar(true)}</div>
      </aside>

      {chatsOpen && (
        <button
          type="button"
          aria-label={t("Close chats")}
          onClick={() => setChatsOpen(false)}
          className="fixed inset-y-0 right-0 z-20 md:hidden"
          style={{ left: "min(86vw, 300px)" }}
        />
      )}

      <main id="chat-main" tabIndex={-1} className={`relative z-10 flex min-w-0 flex-1 flex-col bg-canvas outline-none transition-transform duration-[var(--dur-slow)] ease-[var(--ease-sheet)] motion-reduce:transition-none md:transform-none ${
        chatsOpen ? "translate-x-[min(86vw,300px)]" : ""
      }`}>
        {/* A new chat is the home screen: the pond fills the screen behind the header, the orb and the pill. Conversations are quiet: no koi. */}
        {showHome && (
          <Home
            username={user?.username}
            onTalk={openVoice}
            voiceOff={!features.voiceMode}
            onOpenCalendar={features.google ? () => setCalendarOpen(true) : undefined}
            headerRef={headerRef}
            dockRef={dockRef}
            paused={settingsOpen || voiceOpen || chatsOpen}
          />
        )}
        <header
          ref={headerRef}
          className={`relative z-10 flex h-[calc(48px+env(safe-area-inset-top))] shrink-0 items-center px-2 pt-[env(safe-area-inset-top)] md:px-3 ${showHome ? "" : "border-b border-border"}`}
        >
          <IconButton
            label={sidebarShown ? t("Hide sidebar") : t("Show sidebar")}
            onClick={() => setSidebarShown((v) => !v)}
            aria-expanded={sidebarShown}
            className={`size-11 !text-fg ${viewing ? "max-xl:hidden" : "max-md:hidden"}`}
          >
            <ToggleIcon />
          </IconButton>
          <IconButton label={t("Chats")} className="size-11 !text-fg md:hidden" onClick={() => setChatsOpen(true)}>
            <ToggleIcon />
          </IconButton>
          {/* The assistant's state (the small orb) and the chat title in the serif; a tap on them opens the chat options. */}
          <div className="flex min-w-0 flex-1 items-center pl-1.5">
            {!showHome && (active ? (
              <h1 className="m-0 min-w-0">
                <Menu trigger={
                  <button type="button" className="pressable flex min-h-11 max-w-full items-center gap-2.5 rounded-md px-1.5 text-left hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                    <span className="grid shrink-0 place-items-center" aria-hidden="true"><OrbView status={status} size={20} decorative /></span>
                    <span className="serif min-w-0 truncate text-[17px] font-medium leading-6 tracking-[0.01em]">{active.title || t("Chat")}</span>
                    <span className="sr-only">{t("Chat options")}</span>
                  </button>
                } align="start">
                  <MenuItem icon={Pencil} onSelect={() => { setRenaming(active); setRenameText(active.title || ""); }}>{t("Rename")}</MenuItem>
                  <MenuItem icon={Download} onSelect={exportChat}>{t("Export as Markdown")}</MenuItem>
                  <MenuItem icon={FileText} onSelect={exportPdf}>{t("Export as PDF")}</MenuItem>
                  <MenuItem icon={Download} onSelect={exportJson}>{t("Export as JSON")}</MenuItem>
                  <MenuItem icon={Trash2} destructive onSelect={() => setDeleting(active)}>{t("Delete")}</MenuItem>
                </Menu>
              </h1>
            ) : (
              <div className="flex min-h-11 min-w-0 items-center gap-2.5 px-1.5">
                <span className="grid shrink-0 place-items-center" aria-hidden="true"><OrbView status={status} size={20} decorative /></span>
                <h1 className="serif m-0 min-w-0 truncate text-[17px] font-medium leading-6 tracking-[0.01em]">{activeId ? t("Chat") : t("New chat")}</h1>
              </div>
            ))}
          </div>
          <IconButton label={t("New chat")} onClick={newChat} className="size-11 !text-fg">
            <SquarePen size={22} strokeWidth={1.5} aria-hidden="true" />
          </IconButton>
        </header>

        <div ref={feedRef} className="min-h-0 flex-1 overflow-y-auto" role="log" aria-label={t("Conversation")} aria-live="polite">
          {messages.length === 0 && !busy && loadingChat ? (
            <ChatSkeleton />
          ) : showHome ? null : (
            <div className="mx-auto flex max-w-3xl flex-col gap-[22px] px-5 pb-6 pt-[18px] md:px-6">
              {(busy && streamText ? [...messages, { id: "streaming", role: "assistant", content: streamText, thinking: streamThinking }] : messages).map((m) => (
                <Message
                  key={m.key ?? m.id}
                  message={m}
                  onOpenFile={setViewing}
                  onEdit={editMessage}
                  onSaveNote={saveNote}
                  onRegenerate={regenerateMessage}
                  canRegenerate={m.id === lastAnswerId}
                  busy={busy}
                />
              ))}
              {busy && !streamText && (
                <div className="motion-enter flex items-center gap-3" role="status" aria-label={t("Thinking")}>
                  <KoiGlyph size={32} swim />
                  <span className="caption">{t("Thinking…")}</span>
                </div>
              )}
              {busy && !streamText && streamThinking && <ThoughtBlock text={streamThinking} live />}
              {actions.length > 0 && (
                <div className="grid gap-3" role="group" aria-label={t("Waiting for your confirmation")}>
                  {actions.map((a) => (
                    <ActionCard key={a.id} action={a} busy={confirming === a.id} locked={Boolean(confirming)} onConfirm={() => confirmAction(a)} onCancel={() => cancelAction(a)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="motion-enter relative z-10 mx-5 mb-2 rounded-lg border border-danger/50 bg-overlay px-3.5 py-2 font-mono text-[13px] leading-5 text-danger md:mx-auto md:w-[min(100%-3rem,48rem)]">
            {error}
          </p>
        )}

        <div ref={dockRef} className="relative z-10 shrink-0 px-3 min-[360px]:px-5 pb-[max(28px,env(safe-area-inset-bottom))] pt-2 md:px-6 md:pb-[max(14px,env(safe-area-inset-bottom))]">
          <Composer
            value={input}
            onChange={setInput}
            onSend={() => send(input)}
            canSend={canSend}
            busy={busy}
            files={files}
            onAttach={(kind) => ({ camera: cameraInputRef, photos: photoInputRef, files: documentInputRef })[kind]?.current?.click()}
            onRemoveFile={removeFile}
            onPasteFiles={addFiles}
            micState={micState}
            onMic={toggleMic}
            levels={levels}
            onCancelRecording={() => stopDictation("cancel")}
            onStopRecording={() => stopDictation("keep")}
            onSendRecording={() => stopDictation("send")}
            onTalk={openVoice}
            voiceOff={!features.voiceMode}
            calendarOn={calendarOn}
            useCalendar={useCalendar}
            onToggleCalendar={() => setUseCalendar((v) => !v)}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
          />
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
          />
          <input
            ref={documentInputRef}
            type="file"
            accept={PICKER_ACCEPT}
            multiple
            hidden
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
          />
        </div>
      </main>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} commands={paletteCommands} />

      {viewing && (
        <FileViewer
          file={viewing}
          width={viewerWidth}
          onResize={setViewerWidth}
          reserved={sidebarShown ? 288 : 0}
          onSummarized={(id) => { setViewing(null); selectConversation(id); }}
          onClose={() => setViewing(null)}
          onConverted={(pdf) => {
            if (activeId) loadMessages(activeId);
            setViewing(pdf);
          }}
        />
      )}

      <Modal
        open={Boolean(renaming)}
        onOpenChange={(open) => { if (!open) setRenaming(null); }}
        title={t("Rename chat")}
        footer={<>
          <Button onClick={() => setRenaming(null)}>{t("Cancel")}</Button>
          <Button variant="primary" type="submit" form="rename-form">{t("Save")}</Button>
        </>}
      >
        <form id="rename-form" onSubmit={saveRename}>
          <Input value={renameText} onChange={(e) => setRenameText(e.target.value)} maxLength={120} aria-label={t("Chat name")} autoFocus />
        </form>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title={t("Delete this chat?")}
        description={t("“{title}” and all its messages and photos will be removed. This cannot be undone.", { title: deleting?.title || t("New chat") })}
        footer={<>
          <Button onClick={() => setDeleting(null)}>{t("Cancel")}</Button>
          <Button variant="danger" onClick={confirmDelete}><Trash2 size={16} aria-hidden="true" /> {t("Delete")}</Button>
        </>}
      />

      {settingsOpen && (
        <Suspense fallback={null}>
          <Settings
            open
            onOpenChange={setSettingsOpen}
            isAdmin={Boolean(user?.isAdmin)}
            username={user?.username}
            onSignOut={signOut}
            onAccountChanged={refreshSession}
            onChatsChanged={refreshConversations}
            initialPage={settingsPage}
          />
        </Suspense>
      )}

      {tasksOpen && (
        <Suspense fallback={null}>
          <Tasks
            onClose={() => setTasksOpen(false)}
            onOpenChat={(id) => { setTasksOpen(false); selectConversation(id); }}
          />
        </Suspense>
      )}

      {libraryOpen && (
        <Suspense fallback={null}>
          <Library
            onClose={() => setLibraryOpen(false)}
            onOpenChat={(id) => { setLibraryOpen(false); selectConversation(id); }}
            onOpenFile={(file) => { setLibraryOpen(false); setViewing(file); }}
          />
        </Suspense>
      )}

      {projectEditing && (
        <ProjectDialog
          project={projectEditing.id ? projectEditing : null}
          onClose={() => setProjectEditing(null)}
          onSaved={() => { setProjectEditing(null); refreshProjects(); }}
        />
      )}

      {moving && (
        <MoveDialog
          chat={moving}
          projects={projects}
          onClose={() => setMoving(null)}
          onMoved={() => { setMoving(null); refreshConversations(); }}
        />
      )}

      {calendarOpen && (
        <Suspense fallback={null}>
          <CalendarPanel open onOpenChange={setCalendarOpen} google={google} onChanged={refreshSession} />
        </Suspense>
      )}

      {voiceOpen && (
        <VoiceMode
          onClose={() => setVoiceOpen(false)}
          turn={voiceTurn}
        />
      )}
    </div>
  );
}

// A small label for what the assistant proposes (the card's caption).
const KIND_LABEL = {
  calendar_add: "Calendar event",
  task_create: "Scheduled task",
  note_delete: "Delete note",
  gmail_send: "Send email",
  todoist_add: "Todoist task",
  memory_forget: "Forget memory",
  mcp_call: "App action",
};

// The two-line icon of the chat list toggle (the same on phones and desktop).
function ToggleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8h16M4 16h10" />
    </svg>
  );
}

// A proposal that changes data (calendar event, note deletion). Runs only on Confirm. A hairline card, narrower than the
// column: a mono caption, the text, a mono details line and the two buttons.
function ActionCard({ action, onConfirm, onCancel, busy = false, locked = false }) {
  return (
    <div className="motion-enter w-full max-w-[326px] rounded-lg border border-border bg-surface px-4 pb-4 pt-3.5 md:max-w-[28rem]">
      <div className="caption">{t(KIND_LABEL[action.kind] || "Confirmation")}</div>
      <p className="m-0 mt-1 text-[17px] leading-6">{action.title}</p>
      {action.details && <p className="m-0 mt-[3px] break-words font-mono text-[13px] leading-5 tracking-[0.02em] text-fg-muted">{action.details}</p>}
      <div className="mt-3.5 flex gap-2">
        <Button variant="primary" onClick={onConfirm} disabled={locked} aria-busy={busy}>
          {busy ? <><LoaderCircle size={16} strokeWidth={1.75} aria-hidden="true" className="animate-spin" /> {t("Working…")}</> : t("Confirm")}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={locked}>{t("Cancel")}</Button>
      </div>
    </div>
  );
}
