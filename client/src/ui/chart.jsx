import { ResponsiveContainer } from "recharts";

// Chart pieces in the shadcn/ui style (its chart component, ported to JavaScript): a container that
// takes a config of labels and colours, a tooltip, and a legend. Colours come from the config and
// are also set as CSS variables (--color-<key>), so a chart can be restyled in one place.

export function ChartContainer({ config, className = "", children }) {
  const vars = Object.fromEntries(Object.entries(config).map(([key, item]) => [`--color-${key}`, item.color]));
  return (
    <div data-chart className={`flex aspect-auto w-full justify-center text-xs ${className}`} style={vars}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

// The tooltip card: a label on top, then one row per series with a coloured square, its name and value.
export function ChartTooltipContent({ active, payload, label, config = {}, hideLabel = false }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="grid min-w-[8rem] gap-1.5 rounded-lg border border-border bg-overlay px-3 py-2 text-xs text-fg shadow-md">
      {!hideLabel && label !== undefined && <div className="font-medium">{label}</div>}
      {payload.map((item) => {
        const entry = config[item.dataKey] || config[item.name] || {};
        return (
          <div key={item.dataKey ?? item.name} className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-[2px]" style={{ background: item.color || item.payload?.fill }} aria-hidden="true" />
            <span className="text-fg-muted">{entry.label ?? item.name}</span>
            <span className="ml-auto font-mono tabular-nums">{item.value}</span>
          </div>
        );
      })}
    </div>
  );
}

// The legend under a chart: a coloured square and the label for each series.
export function ChartLegendContent({ payload = [], config = {} }) {
  if (!payload.length) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-xs text-fg-muted">
      {payload.map((item) => {
        const entry = config[item.dataKey] || config[item.value] || {};
        return (
          <span key={item.value} className="flex items-center gap-1.5">
            <span className="size-2 shrink-0 rounded-[2px]" style={{ background: entry.color || item.color }} aria-hidden="true" />
            {entry.label ?? item.value}
          </span>
        );
      })}
    </div>
  );
}
