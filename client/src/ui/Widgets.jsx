import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis,
  Tooltip, Legend,
} from "recharts";
import { ChartContainer, ChartLegendContent, ChartTooltipContent } from "./chart.jsx";

// Charts and tables the assistant shows under an answer. The server checks the data
// before it is stored, so this only draws well-formed numbers and text.

// The koi colours, straight from the --chart-N tokens in index.css, in order.
const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const AXIS = "var(--fg-subtle)";

// The config the chart container and its tooltip and legend read: a label and a colour per series.
function chartConfig(widget) {
  if (widget.type === "pie") {
    return Object.fromEntries(widget.labels.map((label, i) => [label, { label, color: PALETTE[i % PALETTE.length] }]));
  }
  return Object.fromEntries(widget.series.map((s, j) => [`s${j}`, { label: s.name, color: PALETTE[j] }]));
}

function ChartBody({ widget, config }) {
  const { type, labels, series } = widget;
  const data = labels.map((label, i) => {
    const row = { label };
    series.forEach((s, j) => { row[`s${j}`] = s.values[i]; });
    return row;
  });

  if (type === "pie") {
    const s = series[0];
    const pieData = labels.map((label, i) => ({ name: label, value: s.values[i], fill: PALETTE[i % PALETTE.length] }));
    return (
      <PieChart>
        <Pie data={pieData} dataKey="value" nameKey="name" innerRadius="56%" outerRadius="80%" paddingAngle={1} stroke="none">
          {pieData.map((row) => <Cell key={row.name} fill={row.fill} />)}
        </Pie>
        <Tooltip content={<ChartTooltipContent config={config} hideLabel />} />
        <Legend verticalAlign="bottom" content={<ChartLegendContent config={config} />} />
      </PieChart>
    );
  }

  const common = {
    data,
    margin: { top: 8, right: 8, bottom: 4, left: 0 },
  };
  const axes = [
    <CartesianGrid key="grid" stroke="currentColor" strokeOpacity={0.12} vertical={false} />,
    <XAxis key="x" dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />,
    <YAxis key="y" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} width={40} />,
    <Tooltip key="t" content={<ChartTooltipContent config={config} />} cursor={{ fill: "currentColor", fillOpacity: 0.05 }} />,
    series.length > 1 && <Legend key="l" content={<ChartLegendContent config={config} />} />,
  ];

  if (type === "line") {
    return (
      <LineChart {...common}>
        {axes}
        {series.map((s, j) => (
          <Line key={s.name} type="monotone" dataKey={`s${j}`} name={s.name} stroke={PALETTE[j]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        ))}
      </LineChart>
    );
  }
  if (type === "area") {
    return (
      <AreaChart {...common}>
        {axes}
        {series.map((s, j) => (
          <Area key={s.name} type="monotone" dataKey={`s${j}`} name={s.name} stroke={PALETTE[j]} fill={PALETTE[j]} fillOpacity={0.1} strokeWidth={2} />
        ))}
      </AreaChart>
    );
  }
  return (
    <BarChart {...common}>
      {axes}
      {series.map((s, j) => (
        <Bar key={s.name} dataKey={`s${j}`} name={s.name} fill={PALETTE[j]} radius={[3, 3, 0, 0]} maxBarSize={40} />
      ))}
    </BarChart>
  );
}

export function ChartWidget({ widget }) {
  const config = chartConfig(widget);
  return (
    <figure className="rounded-lg border border-border p-4">
      <figcaption className="mb-3 text-[13px] font-medium">{widget.title}</figcaption>
      <ChartContainer config={config} className="h-60 text-fg">
        <ChartBody widget={widget} config={config} />
      </ChartContainer>
    </figure>
  );
}

export function TableWidget({ widget }) {
  return (
    <figure className="rounded-lg border border-border">
      <figcaption className="border-b border-border px-4 py-2.5 text-[13px] font-medium">{widget.title}</figcaption>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-[13px] tabular-nums">
          <thead>
            <tr>
              {widget.columns.map((c) => (
                <th key={c} scope="col" className="bg-raised px-4 py-2 text-left text-xs font-medium text-fg-muted">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {widget.rows.map((row, i) => (
              <tr key={i} className="border-t border-border">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2 align-top leading-5">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

// Key numbers: one tile each. The change is green for an increase and red for a decrease.
const TONE = { up: "text-success", down: "text-danger", flat: "text-fg-subtle" };

export function StatsWidget({ widget }) {
  return (
    <figure className="grid gap-3">
      <figcaption className="text-[13px] font-medium">{widget.title}</figcaption>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {widget.items.map((item, i) => (
          <div key={i} className="min-w-0 rounded-lg border border-border px-3.5 py-3">
            <div className="truncate text-xs text-fg-muted">{item.label}</div>
            <div className="mt-1 truncate font-mono text-xl font-semibold tabular-nums">{item.value}</div>
            {item.change && <div className={`mt-0.5 font-mono text-xs tabular-nums ${TONE[item.tone] || TONE.flat}`}>{item.change}</div>}
          </div>
        ))}
      </div>
    </figure>
  );
}

// A short list of things (events, mail, places) with a time or detail on the right.
export function CardsWidget({ widget }) {
  return (
    <figure className="rounded-lg border border-border">
      <figcaption className="border-b border-border px-4 py-2.5 text-[13px] font-medium">{widget.title}</figcaption>
      <ul className="divide-y divide-border">
        {widget.items.map((item, i) => (
          <li key={i} className="flex items-start gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{item.title}</div>
              {item.subtitle && <div className="mt-0.5 text-[13px] text-fg-muted">{item.subtitle}</div>}
            </div>
            {item.meta && <span className="shrink-0 pt-0.5 font-mono text-xs tabular-nums text-fg-subtle">{item.meta}</span>}
          </li>
        ))}
      </ul>
    </figure>
  );
}

export default function Widgets({ widgets }) {
  if (!widgets?.length) return null;
  return (
    <div className="mt-4 grid gap-3">
      {widgets.map((w, i) => {
        if (w.kind === "chart") return <ChartWidget key={i} widget={w} />;
        if (w.kind === "stats") return <StatsWidget key={i} widget={w} />;
        if (w.kind === "cards") return <CardsWidget key={i} widget={w} />;
        return <TableWidget key={i} widget={w} />;
      })}
    </div>
  );
}
