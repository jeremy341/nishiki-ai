// A thin line of tiny waves (DESIGN.md, "The wave rule"). It separates big sections: the groups of a settings
// page, the chat groups in the sidebar. Plain hairlines stay for rows and cards.
export default function WaveRule({ className = "" }) {
  return <div role="separator" aria-hidden="true" className={`wave-rule ${className}`} />;
}
