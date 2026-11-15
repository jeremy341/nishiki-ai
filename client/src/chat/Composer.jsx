import { t } from "../i18n/index.js";
import { ArrowUp, Calendar as CalendarIcon, Camera, FileText, Image as ImageIcon, Mic, Paperclip, Plus, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import HomeOrb from "../ui/HomeOrb.jsx";
import { IconButton, Menu, MenuItem } from "../ui/ui.jsx";

const MAX_FILES = 4;
const BARS = 56;
const LINE = 24; // one line of text, in pixels
const MAX_HEIGHT = LINE * 6; // the box grows to about six lines, then scrolls

const ROUND = "pressable grid size-10 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// While recording: cancel (X) throws the recording away, the square stops and keeps the words in
// the box, the arrow stops and sends them straight away. Like the ChatGPT voice bar.
function RecordingBar({ levels, transcribing, onCancel, onStop, onSend }) {
  const padded = Array.from({ length: BARS }, (_, i) => levels[levels.length - BARS + i] ?? 0);
  return (
    <div className="flex items-center gap-2">
      <IconButton label={t("Cancel recording")} onClick={onCancel} className="size-11 !rounded-full border border-border-strong bg-raised md:size-10">
        <X size={18} strokeWidth={1.5} aria-hidden="true" />
      </IconButton>
      <div className="flex h-11 min-w-0 flex-1 items-center justify-center gap-[3px] overflow-hidden rounded-full border border-border-strong bg-surface px-4 md:h-10" aria-hidden="true">
        {transcribing ? (
          <span className="caption">{t("Transcribing…")}</span>
        ) : padded.map((level, i) => (
          <span
            key={i}
            className="w-[2px] shrink-0 rounded-[1px] bg-fg-muted transition-[height] duration-100"
            style={{ height: `${Math.max(2, Math.round(level * 30))}px`, opacity: i < BARS - levels.length ? 0.25 : 1 }}
          />
        ))}
      </div>
      <IconButton label={t("Stop and keep the text")} onClick={onStop} disabled={transcribing} className="size-11 !rounded-full border border-border-strong bg-raised md:size-10">
        <Square size={13} aria-hidden="true" fill="currentColor" />
      </IconButton>
      <IconButton
        label={t("Send recording")}
        onClick={onSend}
        disabled={transcribing}
        className="size-11 !rounded-full !bg-accent !text-accent-fg hover:opacity-85 md:size-10"
      >
        <ArrowUp size={20} strokeWidth={1.75} aria-hidden="true" />
      </IconButton>
    </div>
  );
}

// The message pill (DESIGN.md, "Message box"): a round + on the left (camera, photos, files, calendar), the field with the
// mic inside, and a round button on the right: a small orb when the field is empty (conversation mode), a vermilion arrow
// when there is something to send. Enter sends on desktop; on phones Enter starts a new line and the arrow is used.
export default function Composer({
  value, onChange, onSend, canSend, busy,
  files, onAttach, onRemoveFile,
  micState, onMic, onTalk, voiceOff = false,
  levels, onCancelRecording, onStopRecording, onSendRecording,
  calendarOn, useCalendar, onToggleCalendar,
}) {
  const ref = useRef(null);
  const [multi, setMulti] = useState(false);
  const attachFull = files.length >= MAX_FILES;
  const voiceActive = micState === "recording" || micState === "transcribing";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    setMulti(el.scrollHeight > LINE + 6);
  }, [value, voiceActive]);

  function onKeyDown(event) {
    const desktop = window.matchMedia("(min-width: 768px)").matches;
    if (desktop && event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSend();
    }
  }

  return (
    <form
      className="mx-auto w-full max-w-3xl"
      onSubmit={(event) => { event.preventDefault(); onSend(); }}
    >
      {!voiceActive && files.length > 0 && (
        <ul className="mb-2 flex gap-2 overflow-x-auto" aria-label={t("Attached files")}>
          {files.map((f) => (
            <li
              key={f.localId}
              className={`relative flex w-40 shrink-0 items-center gap-2 rounded-lg border bg-surface p-1.5 text-xs ${
                f.status === "error" ? "border-danger/50" : "border-border-strong"
              }`}
            >
              {f.previewUrl
                ? <img src={f.previewUrl} alt="" className="size-9 rounded object-cover" />
                : <span className="grid size-9 place-items-center rounded border border-border bg-raised"><FileText size={15} strokeWidth={1.5} aria-hidden="true" /></span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px]">{f.name}</span>
                <span className={`caption ${f.status === "error" ? "!text-danger" : ""}`}>
                  {f.status === "uploading" ? t("Uploading…") : f.status === "error" ? (f.error || t("Failed")) : t("Ready")}
                </span>
              </span>
              <button
                type="button"
                aria-label={t("Remove {name}", { name: f.name })}
                onClick={() => onRemoveFile(f.localId)}
                className="relative grid size-7 shrink-0 place-items-center rounded-md text-fg-subtle hover:bg-raised hover:text-fg after:absolute after:-inset-2 after:content-['']"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!voiceActive && calendarOn && useCalendar && (
        <button
          type="button"
          onClick={onToggleCalendar}
          aria-pressed="true"
          aria-label={t("Calendar is shared with the assistant")}
          className="caption mb-1 -ml-1 flex min-h-8 items-center gap-1.5 px-1 !text-accent hover:!text-fg focus-visible:outline-2 focus-visible:outline-accent"
        >
          <CalendarIcon size={12} strokeWidth={1.5} aria-hidden="true" />
          {t("Calendar is shared with the assistant")}
        </button>
      )}

      {voiceActive ? (
        <RecordingBar
          levels={levels}
          transcribing={micState === "transcribing"}
          onCancel={onCancelRecording}
          onStop={onStopRecording}
          onSend={onSendRecording}
        />
      ) : (
        <div className="flex items-end gap-2">
          {/* Same choices as the iOS attach sheet: camera, photo library, Files; and the calendar switch. */}
          <Menu
            align="start"
            trigger={(
              <button
                type="button"
                aria-label={t("Add a photo or file")}
                disabled={busy || attachFull}
                className={`${ROUND} border border-border-strong bg-raised text-fg hover:border-fg-subtle disabled:opacity-40`}
              >
                <Plus size={20} strokeWidth={1.5} aria-hidden="true" />
              </button>
            )}
          >
            <MenuItem icon={Camera} onSelect={() => onAttach("camera")}>{t("Take Photo")}</MenuItem>
            <MenuItem icon={ImageIcon} onSelect={() => onAttach("photos")}>{t("Photo Library")}</MenuItem>
            <MenuItem icon={Paperclip} onSelect={() => onAttach("files")}>{t("Choose Files")}</MenuItem>
            {calendarOn && (
              <MenuItem icon={CalendarIcon} checked={useCalendar} onSelect={onToggleCalendar}>
                {t("Share my calendar with the assistant")}
              </MenuItem>
            )}
          </Menu>

          <div
            onClick={(event) => { if (!event.target.closest("button")) ref.current?.focus(); }}
            className={`flex min-h-10 min-w-0 flex-1 items-end gap-1.5 border border-border-strong bg-surface py-[7px] pl-4 pr-3.5 transition-[border-color,box-shadow] duration-150 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25 ${
              multi ? "rounded-2xl" : "rounded-full"
            }`}
          >
            <textarea
              ref={ref}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t("Ask anything")}
              rows={1}
              maxLength={4000}
              aria-label={t("Message")}
              style={{ maxHeight: MAX_HEIGHT }}
              className="m-0 block min-h-6 min-w-0 flex-1 resize-none border-0 bg-transparent p-0 text-base leading-6 placeholder:text-fg-subtle focus:outline-none"
            />
            <button
              type="button"
              aria-label={t("Dictate")}
              title={t("Dictate")}
              onClick={onMic}
              className="pressable -mb-2.5 -mr-3 -mt-2.5 grid size-11 shrink-0 place-items-center rounded-full text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-accent"
            >
              <Mic size={19} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>

          {busy ? (
            <button type="submit" disabled aria-label={t("Sending")} className={`${ROUND} bg-raised text-fg-muted opacity-60`}>
              <ArrowUp size={20} strokeWidth={1.75} aria-hidden="true" />
            </button>
          ) : canSend ? (
            <button type="submit" aria-label={t("Send")} className={`${ROUND} bg-accent text-accent-fg hover:opacity-90`}>
              <ArrowUp size={20} strokeWidth={1.75} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onTalk}
              disabled={voiceOff}
              aria-disabled={voiceOff}
              aria-label={voiceOff ? t("Voice is switched off for now") : t("Conversation mode")}
              title={voiceOff ? t("Voice is switched off for now") : undefined}
              className={`${ROUND} bg-fg [&>span]:!text-canvas ${voiceOff ? "cursor-not-allowed opacity-35 grayscale" : ""}`}
            >
              <HomeOrb size={24} ring={false} spin={false} />
            </button>
          )}
        </div>
      )}

      <div className="caption mt-1.5 hidden justify-end px-1 md:flex">
        <span>{t("Enter to send · Shift+Enter for a new line")}</span>
      </div>
    </form>
  );
}
