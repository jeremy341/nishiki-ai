import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis,
  Tooltip, Legend,
} from "recharts";
import { ChartContainer, ChartLegendContent, ChartTooltipContent } from "./chart.jsx";

// Charts and tables the assistant shows under an answer. The server checks the data
// before it is stored, so this only draws well-formed numbers and text.

// The koi colours (DESIGN.md): vermilion, gold, pink, white, ink, in that order. The old --chart-N tokens stay as fallbacks.
const PALETTE = [
  "var(--koi-red, var(--chart-1))",
  "var(--koi-gold, var(--chart-2))",
  "var(--koi-pink, var(--chart-3))",
  "var(--koi-white, var(--chart-4))",
  "var(--koi-ink, var(--chart-5))",
];
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
    <CartesianGrid key="grid" stroke="currentColor" strokeOpacity={0.14} vertical={false} />,
    <XAxis key="x" dataKey="label" tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-mono)" }} tickLine={false} axisLine={false} />,
    <YAxis key="y" tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-mono)" }} tickLine={false} axisLine={false} width={40} />,
    <Tooltip key="t" content={<ChartTooltipContent config={config} />} cursor={{ fill: "currentColor", fillOpacity: 0.05 }} />,
    series.length > 1 && <Legend key="l" content={<ChartLegendContent config={config} />} />,
  ];

  if (type === "line") {
    return (
      <LineChart {...common}>
        {axes}
        {series.map((s, j) => (
          <Line key={s.name} type="monotone" dataKey={`s${j}`} name={s.name} stroke={PALETTE[j]} strokeWidth={1.5} dot={false} activeDot={{ r: 3.5 }} />
        ))}
      </LineChart>
    );
  }
  if (type === "area") {
    return (
      <AreaChart {...common}>
        {axes}
        {series.map((s, j) => (
          <Area key={s.name} type="monotone" dataKey={`s${j}`} name={s.name} stroke={PALETTE[j]} fill={PALETTE[j]} fillOpacity={0.1} strokeWidth={1.5} />
        ))}
      </AreaChart>
    );
  }
  return (
    <BarChart {...common}>
      {axes}
      {series.map((s, j) => (
        <Bar key={s.name} dataKey={`s${j}`} name={s.name} fill={PALETTE[j]} radius={[2, 2, 0, 0]} maxBarSize={40} />
      ))}
    </BarChart>
  );
}

// The widgets are quiet, like the weather strip in the mockup: a hairline on top, a lowercase mono caption, mono numbers, no boxes.
export function ChartWidget({ widget }) {
  const config = chartConfig(widget);
  return (
    <figure className="m-0 border-t border-border-strong pt-3">
      <figcaption className="caption mb-3">{widget.title}</figcaption>
      <ChartContainer config={config} className="h-56 text-fg">
        <ChartBody widget={widget} config={config} />
      </ChartContainer>
    </figure>
  );
}

export function TableWidget({ widget }) {
  return (
    <figure className="m-0 border-t border-border-strong pt-3">
      <figcaption className="caption mb-2">{widget.title}</figcaption>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse font-mono text-[13px] tabular-nums">
          <thead>
            <tr>
              {widget.columns.map((c) => (
                <th key={c} scope="col" className="border-b border-border-strong py-2 pr-5 text-left text-[11px] font-normal tracking-[0.06em] text-fg-subtle last:pr-0">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {widget.rows.map((row, i) => (
              <tr key={i} className="border-t border-border first:border-t-0">
                {row.map((cell, j) => (
                  <td key={j} className="py-2 pr-5 align-top leading-5 last:pr-0">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

// Key numbers in columns. The change is green for an increase and red for a decrease.
const TONE = { up: "text-success", down: "text-danger", flat: "text-fg-subtle" };

export function StatsWidget({ widget }) {
  return (
    <figure className="m-0 border-t border-border-strong pt-3">
      <figcaption className="caption mb-3">{widget.title}</figcaption>
      <div className="grid grid-cols-2 gap-x-5 gap-y-4 md:grid-cols-3">
        {widget.items.map((item, i) => (
          <div key={i} className="min-w-0">
            <div className="caption truncate">{item.label}</div>
            <div className="mt-1 truncate font-mono text-[22px] leading-[26px] tracking-[-0.03em] tabular-nums">{item.value}</div>
            {item.change && <div className={`font-mono text-[13px] leading-5 tabular-nums ${TONE[item.tone] || TONE.flat}`}>{item.change}</div>}
          </div>
        ))}
      </div>
    </figure>
  );
}

// A short list of things (events, mail, places) with a time or detail on the right.
export function CardsWidget({ widget }) {
  return (
    <figure className="m-0 border-t border-border-strong pt-3">
      <figcaption className="caption mb-1">{widget.title}</figcaption>
      <ul className="m-0 list-none divide-y divide-border p-0">
        {widget.items.map((item, i) => (
          <li key={i} className="flex items-start gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-base leading-6">{item.title}</div>
              {item.subtitle && <div className="mt-0.5 text-[13px] leading-5 text-fg-muted">{item.subtitle}</div>}
            </div>
            {item.meta && <span className="shrink-0 pt-0.5 font-mono text-[13px] tabular-nums text-fg-muted">{item.meta}</span>}
          </li>
        ))}
      </ul>
    </figure>
  );
}

export default function Widgets({ widgets }) {
  if (!widgets?.length) return null;
  return (
    <div className="mt-3 grid max-w-[326px] gap-6 md:max-w-[36rem]">
      {widgets.map((w, i) => {
        if (w.kind === "chart") return <ChartWidget key={i} widget={w} />;
        if (w.kind === "stats") return <StatsWidget key={i} widget={w} />;
        if (w.kind === "cards") return <CardsWidget key={i} widget={w} />;
        return <TableWidget key={i} widget={w} />;
      })}
    </div>
  );
}
