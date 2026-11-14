import { Download, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { api } from "./api.js";
import { t } from "./i18n/index.js";
import Answer from "./ui/Answer.jsx";
import { useEdgeBack } from "./ui/edgeBack.js";
import KoiEmpty from "./ui/KoiEmpty.jsx";
import KoiGlyph from "./ui/KoiGlyph.jsx";
import { Button, IconButton, useDialogReturnFocus } from "./ui/ui.jsx";

// The koi swimming in place and a lowercase word, while a file opens.
function ViewerLoading() {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 px-5 py-12">
      <KoiGlyph swim size={32} />
      <span className="caption">{t("Loading…")}</span>
    </div>
  );
}

// Opens a photo, PDF, Word, CSV or text file next to the chat on a tablet, and full screen on a phone.
// PDFs are drawn page by page with pdf.js, which also works on iPhone and iPad Safari.

const loadPdf = async () => {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  return pdfjs;
};

function PdfPages({ id }) {
  const container = useRef(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    let doc = null;
    const node = container.current;
    if (node) node.innerHTML = "";
    setStatus("loading");

    (async () => {
      try {
        const pdfjs = await loadPdf();
        const response = await fetch(`/api/attachments/${id}`, { credentials: "same-origin" });
        if (!response.ok) throw new Error("download");
        doc = await pdfjs.getDocument({ data: await response.arrayBuffer() }).promise;
        const width = Math.max(200, (node?.clientWidth || 600) - 24);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        for (let n = 1; n <= doc.numPages; n += 1) {
          if (cancelled) return;
          const page = await doc.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width / base.width) * dpr });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${width}px`;
          canvas.style.height = "auto";
          canvas.className = "mx-auto mb-3 block max-w-full rounded-md border border-border bg-white";
          canvas.setAttribute("aria-label", t("Page {n}", { n }));
          node?.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        }
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      doc?.destroy?.();
    };
  }, [id]);

  return (
    <div className="px-3 py-4">
      {status === "loading" && <ViewerLoading />}
      {status === "error" && <div role="alert"><KoiEmpty title={t("The file could not be shown.")} /></div>}
      <div ref={container} />
    </div>
  );
}

// Splits CSV text into rows. Handles quotes, and comma, semicolon or tab separators (German Excel exports use ;).
export function parseCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const separator = [";", ",", "\t"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === separator) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ""));
}

// A PowerPoint file: the server gives "Folie N:" followed by the lines of each slide.
function SlideCards({ text }) {
  const slides = text.split(/^Folie \d+:\n?/m).slice(1).map((part) => part.split("\n").filter((l) => l.trim()));
  if (!slides.length) return <KoiEmpty title={t("No text on the slides.")} />;
  return (
    <div className="grid gap-4 p-4">
      {slides.map((lines, i) => (
        <section
          key={i}
          aria-label={t("Slide {n}", { n: i + 1 })}
          className="grid aspect-video content-start gap-2 overflow-hidden rounded-lg border border-border bg-white p-6 text-neutral-900"
        >
          <span className="font-mono text-[11px] tabular-nums text-neutral-500">{i + 1}</span>
          {lines.length > 0 && <p className="serif text-lg leading-snug break-words">{lines[0]}</p>}
          {lines.slice(1).map((l, j) => <p key={j} className="text-[14px] leading-6 break-words text-neutral-700">{l}</p>)}
        </section>
      ))}
    </div>
  );
}

// CSV, Word, PowerPoint and text files. The text was read on the server when the file was uploaded.
function TextFile({ id, kind, name }) {
  const [state, setState] = useState({ status: "loading", text: "" });

  useEffect(() => {
    let alive = true;
    setState({ status: "loading", text: "" });
    fetch(`/api/attachments/${id}/text`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("text"))))
      .then((data) => { if (alive) setState({ status: "ready", text: data.text || "" }); })
      .catch(() => { if (alive) setState({ status: "error", text: "" }); });
    return () => { alive = false; };
  }, [id]);

  if (state.status === "loading") return <ViewerLoading />;
  if (state.status === "error") return <div role="alert"><KoiEmpty title={t("The file could not be shown.")} /></div>;

  if (kind === "csv") {
    const rows = parseCsv(state.text);
    const shown = rows.slice(0, 1000);
    const [head = [], ...body] = shown;
    return (
      <div className="p-3">
        <div className="overflow-auto">
          <table className="w-full min-w-max border-collapse text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr>{head.map((c, i) => <th key={i} className="border-b border-border-strong bg-surface px-3 py-2.5 text-left font-mono text-[12px] font-normal text-fg-muted">{c}</th>)}</tr>
            </thead>
            <tbody>
              {body.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  {head.map((_, j) => <td key={j} className="px-3 py-2 align-top font-mono tabular-nums">{r[j] ?? ""}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="caption mt-2 tabular-nums">
          {t("{rows} rows", { rows: Math.max(0, rows.length - 1) })}{rows.length > 1000 ? ` · ${t("first 1000 shown")}` : ""}
        </p>
      </div>
    );
  }

  if (kind === "pptx") return <SlideCards text={state.text} />;
  if (name.toLowerCase().endsWith(".md")) {
    return <div className="px-5 py-4"><Answer text={state.text} /></div>;
  }
  if (name.toLowerCase().endsWith(".json")) {
    return <pre className="overflow-x-auto whitespace-pre-wrap break-words px-5 py-4 font-mono text-[13px] leading-6">{state.text}</pre>;
  }
  // Word and plain text: paragraphs.
  return (
    <div className="grid gap-4 px-5 py-4 text-[15px] leading-7">
      {state.text.split(/\n\s*\n/).filter((p) => p.trim()).map((p, i) => (
        <p key={i} className="whitespace-pre-wrap break-words">{p}</p>
      ))}
    </div>
  );
}

export default function FileViewer({ file, onClose, onConverted, onSummarized, width = 520, onResize, reserved = 0 }) {
  const [converting, setConverting] = useState(false);
  const rootRef = useRef(null);
  const returnFocus = useDialogReturnFocus();
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 767px)").matches);
  useEdgeBack(rootRef, onClose);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (mobile) return undefined; // The mobile Radix dialog owns Escape.
    const onKey = (event) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // Radix handles Escape during capture. Also leave open dialogs and menus
      // in charge if they deliberately keep themselves open without consuming it.
      if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"]')) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobile, onClose]);

  const maxWidth = Math.max(320, window.innerWidth - reserved - 360);
  function resizeTo(next) {
    onResize?.(Math.round(Math.min(Math.max(next, 320), Math.max(320, window.innerWidth - reserved - 360))));
  }

  // Drag the left edge to change the width. The chat keeps at least 360 px, and the sidebar space is reserved.
  function startResize(event) {
    event.preventDefault();
    const move = (e) => {
      resizeTo(window.innerWidth - e.clientX);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // A Word file becomes a PDF, kept as a new file; the viewer then shows the PDF.
  async function saveAsPdf() {
    setConverting(true);
    try {
      const data = await api(`/api/attachments/${file.id}/pdf`, { method: "POST", body: {} });
      toast.success(t("PDF saved"));
      onConverted?.(data.attachment);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setConverting(false);
    }
  }

  // A short summary: a new chat opens with the text and the question (only for files that have text).
  const canSummarise = ["docx", "pptx", "csv", "text"].includes(file.kind);
  async function summarise() {
    setConverting(true);
    try {
      const data = await api(`/api/attachments/${file.id}/summary`, { method: "POST", body: {} });
      onSummarized?.(data.conversationId);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setConverting(false);
    }
  }

  const isImage = file.kind === "image" || file.mime?.startsWith("image/");
  const isPdf = file.kind === "pdf" || file.mime === "application/pdf";
  const isWord = file.kind === "docx";
  const viewer = (
    <section
      ref={rootRef}
      role={mobile ? undefined : "region"}
      aria-label={file.name}
      style={{ "--viewer-w": `${width}px` }}
      className="fixed inset-0 z-50 flex flex-col bg-canvas pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] md:relative md:z-auto md:h-full md:w-[var(--viewer-w)] md:shrink-0 md:border-l md:border-border"
    >
      {onResize && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t("Resize the viewer")}
          tabIndex={0}
          aria-valuemin={320}
          aria-valuemax={maxWidth}
          aria-valuenow={Math.min(Math.max(width, 320), maxWidth)}
          aria-valuetext={t("{width} pixels", { width: Math.min(Math.max(width, 320), maxWidth) })}
          onPointerDown={startResize}
          onKeyDown={(event) => {
            const next = { ArrowLeft: width + 32, ArrowRight: width - 32, Home: 320, End: maxWidth }[event.key];
            if (next === undefined) return;
            event.preventDefault();
            resizeTo(next);
          }}
          className="absolute inset-y-0 -left-1 z-10 hidden w-2 cursor-col-resize touch-none hover:bg-fg/10 focus-visible:bg-fg/10 focus-visible:outline-2 focus-visible:outline-accent md:block"
        />
      )}
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-border px-2">
        <IconButton label={t("Close")} onClick={onClose} className="size-11 md:size-9">
          <X size={18} aria-hidden="true" />
        </IconButton>
        <DialogPrimitive.Title asChild><span className="min-w-0 flex-1 truncate px-1 text-[15px]">{file.name}</span></DialogPrimitive.Title>
        {canSummarise && (
          <Button size="sm" onClick={summarise} disabled={converting} className="max-md:h-11">
            {t("Summarise")}
          </Button>
        )}
        {isWord && (
          <Button size="sm" onClick={saveAsPdf} disabled={converting} className="max-md:h-11">
            {t("Save as PDF")}
          </Button>
        )}
        <a
          href={`/api/attachments/${file.id}`}
          download={file.name}
          aria-label={t("Download")}
          className="grid size-11 shrink-0 place-items-center rounded-md text-fg-muted hover:bg-raised hover:text-fg md:size-9"
        >
          <Download size={18} aria-hidden="true" />
        </a>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto bg-surface">
        {isImage && (
          <div className="grid min-h-full place-items-center p-3">
            <img src={`/api/attachments/${file.id}`} alt={file.name} className="max-h-full max-w-full rounded-md" />
          </div>
        )}
        {isPdf && <PdfPages id={file.id} />}
        {!isImage && !isPdf && <TextFile id={file.id} kind={file.kind} name={file.name} />}
      </div>
    </section>
  );
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      {mobile ? (
        <DialogPrimitive.Content asChild aria-describedby={undefined} {...returnFocus} onInteractOutside={(event) => event.preventDefault()}>
          {viewer}
        </DialogPrimitive.Content>
      ) : viewer}
    </DialogPrimitive.Root>
  );
}
