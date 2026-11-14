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
          className="h-11 animate-pulse rounded-xl bg-raised motion-reduce:animate-none"
          style={{ animationDelay: `${i * 120}ms`, width: `${100 - i * 14}%` }}
        />
      ))}
    </div>
  );
}
