import { t } from "../i18n/index.js";
import { setStyle, useStyle } from "../style.js";

// Classic or Koi, as a small two-way switch. The choice applies at once; onChange can save it to the account.
export default function StyleSwitch({ className = "", onChange }) {
  const style = useStyle();
  const options = [["classic", t("Classic")], ["koi", t("Koi")]];
  return (
    <div role="radiogroup" aria-label={t("Look")} className={`inline-flex rounded-full border border-border bg-surface p-0.5 text-[13px] ${className}`}>
      {options.map(([value, label]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={style === value}
          onClick={() => { setStyle(value); onChange?.(value); }}
          className={`rounded-full px-3.5 py-1.5 transition-colors ${
            style === value ? "bg-fg text-[color:var(--canvas)]" : "text-fg-muted hover:text-fg"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
