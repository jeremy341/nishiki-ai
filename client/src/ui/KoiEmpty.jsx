import KoiGlyph from "./KoiGlyph.jsx";

// The empty state (DESIGN.md): the koi glyph, one sentence, and a next step. It replaces "a grey icon and Nothing here".
// title: what is empty, in a sentence. hint: what to do. children: the action (a Button).
export default function KoiEmpty({ title, hint, children, swim = false, className = "" }) {
  return (
    <div className={`grid justify-items-center gap-3 px-6 py-12 text-center ${className}`}>
      <KoiGlyph size={64} swim={swim} />
      <p className="max-w-sm text-[15px] text-fg">{title}</p>
      {hint && <p className="caption max-w-sm normal-case">{hint}</p>}
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}
