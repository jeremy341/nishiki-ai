import { t } from "../i18n/index.js";

// Placeholder rows shown while a list or page loads. They pulse softly, and stop pulsing when the
// phone or computer asks for reduced motion. Screen readers hear "Loading…".
export default function Loading({ rows = 3 }) {
  return (
    <div role="status" aria-live="polite" className="grid w-full max-w-xl gap-3 px-4 py-4">
      <span className="sr-only">{t("Loading…")}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="h-11 animate-pulse rounded-xl bg-fg/10 motion-reduce:animate-none"
          style={{ animationDelay: `${i * 120}ms`, width: `${100 - i * 14}%` }}
        />
      ))}
    </div>
  );
}

// A chat that is still loading: grey placeholders in the shape of a question and an answer.
export function ChatSkeleton() {
  return (
    <div role="status" aria-busy="true" className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-6 md:px-6">
      <span className="sr-only">{t("Loading…")}</span>
      <div aria-hidden="true" className="ml-auto h-11 w-3/5 max-w-xs animate-pulse rounded-2xl bg-fg/10 motion-reduce:animate-none" />
      <div aria-hidden="true" className="grid gap-2.5">
        <div className="h-4 w-4/5 animate-pulse rounded bg-fg/10 motion-reduce:animate-none" />
        <div className="h-4 w-full animate-pulse rounded bg-fg/10 motion-reduce:animate-none" style={{ animationDelay: "120ms" }} />
        <div className="h-4 w-3/5 animate-pulse rounded bg-fg/10 motion-reduce:animate-none" style={{ animationDelay: "240ms" }} />
      </div>
      <div aria-hidden="true" className="ml-auto h-11 w-2/5 max-w-xs animate-pulse rounded-2xl bg-fg/10 motion-reduce:animate-none" style={{ animationDelay: "360ms" }} />
    </div>
  );
}
