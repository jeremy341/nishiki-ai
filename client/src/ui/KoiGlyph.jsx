// A tiny pixel koi (DESIGN.md, "The koi glyph"): the app's mark and the picture for empty states, loading and success.
// Drawn from a small grid so it stays crisp at any size. It takes the koi colours from the theme tokens.
// swim: sways gently in place, for loading. Reduced motion stops it (the global rule).

// R vermilion, W white, G gold, K ink (the eye), S soft shadow, . empty.
const GRID = [
  "..........RRR.........",
  "......WWWWRRRRRW......",
  "..WW.WWWWWWWWWWWWW....",
  ".WWWWWWWRRRWWWWRRRRW..",
  "WWWWW.WWWWWWWWWWRRRKW.",
  ".WWWW.WWWWWWGGWWWWRW..",
  "..WW..SWWWWWGGWWWW....",
  ".......SSWWW.SWW......",
  "........S.............",
];
const COLOR = {
  R: "var(--koi-red, #e8784f)",
  W: "var(--koi-white, #ece6da)",
  G: "var(--koi-gold, #e8b04f)",
  K: "var(--koi-ink, #3a3632)",
  S: "rgb(0 0 0 / 0.16)",
};

const W = GRID[0].length;
const H = GRID.length;

export default function KoiGlyph({ size = 56, swim = false, className = "", title }) {
  const cells = [];
  GRID.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const color = COLOR[row[x]];
      if (color) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" fill={color} />);
    }
  });
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={size}
      height={Math.round((size * H) / W)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : "true"}
      shapeRendering="crispEdges"
      className={`${swim ? "koi-swim" : ""} ${className}`}
      style={{ filter: "drop-shadow(0 0 0.6px rgb(48 38 30 / 0.7))" }}
    >
      {cells}
    </svg>
  );
}
