import { t } from "../i18n/index.js";
import KoiGlyph from "./KoiGlyph.jsx";

// The loading mark (DESIGN.md, "Loading"): the koi glyph swimming in place and a lowercase mono word.
// Screen readers hear the word once; the glyph is decoration.
export function KoiLoading({ className = "" }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <KoiGlyph size={32} swim />
      <span className="caption" aria-hidden="true">{t("Loading…")}</span>
    </div>
  );
}

// Placeholder rows shown while a list or page loads: the swimming koi, then quiet raised bars that pulse softly.
// They stop pulsing when the phone or computer asks for reduced motion. Screen readers hear "Loading…".
export default function Loading({ rows = 3 }) {
  return (
    <div role="status" aria-live="polite" className="grid w-full max-w-xl gap-3 px-4 py-4">
      <span className="sr-only">{t("Loading…")}</span>
      <KoiLoading className="pb-1" />
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="h-11 animate-pulse rounded-md bg-raised motion-reduce:animate-none"
          style={{ animationDelay: `${i * 120}ms`, width: `${100 - i * 14}%` }}
        />
      ))}
    </div>
  );
}

// A chat that is still loading: raised placeholders in the shape of a question and an answer, with the koi swimming.
export function ChatSkeleton() {
  return (
    <div role="status" aria-busy="true" className="mx-auto flex max-w-3xl flex-col gap-[22px] px-5 py-[18px] md:px-6">
      <span className="sr-only">{t("Loading…")}</span>
      <div aria-hidden="true" className="ml-auto h-11 w-3/5 max-w-xs animate-pulse rounded-[18px] bg-raised motion-reduce:animate-none" />
      <div aria-hidden="true" className="grid gap-2.5">
        <div className="h-4 w-4/5 animate-pulse rounded-sm bg-raised motion-reduce:animate-none" />
        <div className="h-4 w-full animate-pulse rounded-sm bg-raised motion-reduce:animate-none" style={{ animationDelay: "120ms" }} />
        <div className="h-4 w-3/5 animate-pulse rounded-sm bg-raised motion-reduce:animate-none" style={{ animationDelay: "240ms" }} />
      </div>
      <KoiLoading className="justify-self-start" />
      <div aria-hidden="true" className="ml-auto h-11 w-2/5 max-w-xs animate-pulse rounded-[18px] bg-raised motion-reduce:animate-none" style={{ animationDelay: "360ms" }} />
    </div>
  );
}
