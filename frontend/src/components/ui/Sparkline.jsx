import { useMemo } from "react";

export default function Sparkline({
  data = [],
  width = 120,
  height = 40,
  stroke = "var(--color-brand-400)",
  fill = "url(#spark-grad)",
}) {
  const path = useMemo(() => {
    if (!data.length) return "";
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const step = width / (data.length - 1 || 1);
    return data
      .map((v, i) => {
        const x = i * step;
        const y = height - ((v - min) / range) * (height - 4) - 2;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [data, width, height]);

  const area = path
    ? `${path} L ${width} ${height} L 0 ${height} Z`
    : "";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="spark-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={fill} />
      <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function BarChart({ data = [], height = 160, gap = 8 }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end justify-between" style={{ height, gap }}>
      {data.map((d, i) => {
        const h = (d.value / max) * 100;
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <div className="bg-surface-2 border-token relative flex h-full w-full items-end overflow-hidden rounded-lg border">
              <div
                style={{ height: `${h}%` }}
                className="from-brand-400 to-accent-400 w-full bg-gradient-to-t transition-all"
              />
            </div>
            <span className="text-subtle text-[10px] font-medium">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function LineChart({ data = [], height = 200 }) {
  const width = 600;
  const padding = 24;
  if (!data.length) return null;

  const values = data.map((d) => d.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = (width - padding * 2) / (data.length - 1 || 1);

  const points = data.map((d, i) => ({
    x: padding + i * step,
    y: height - padding - ((d.value - min) / range) * (height - padding * 2),
  }));

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
  const area = `${path} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      <defs>
        <linearGradient id="lc-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-brand-400)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-brand-400)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lc-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-brand-400)" />
          <stop offset="100%" stopColor="var(--color-accent-400)" />
        </linearGradient>
      </defs>

      {/* grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
        <line
          key={i}
          x1={padding}
          x2={width - padding}
          y1={padding + (height - padding * 2) * p}
          y2={padding + (height - padding * 2) * p}
          stroke="var(--border)"
          strokeDasharray="3 4"
        />
      ))}

      <path d={area} fill="url(#lc-area)" />
      <path
        d={path}
        fill="none"
        stroke="url(#lc-line)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="4"
          fill="var(--bg)"
          stroke="var(--color-brand-400)"
          strokeWidth="2"
        />
      ))}
      {data.map((d, i) => (
        <text
          key={i}
          x={points[i].x}
          y={height - 4}
          textAnchor="middle"
          fill="var(--text-subtle)"
          fontSize="10"
        >
          {d.label}
        </text>
      ))}
    </svg>
  );
}

export function RadialBar({
  value = 75,
  size = 160,
  label = "",
  sublabel = "",
}) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;

  return (
    <div className="relative inline-flex" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="rb-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-brand-400)" />
            <stop offset="100%" stopColor="var(--color-accent-400)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#rb-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-default text-3xl font-bold">
          {Math.round(value)}
          <span className="text-subtle text-base">%</span>
        </span>
        {label && (
          <span className="text-subtle mt-0.5 text-[11px] font-medium uppercase tracking-wider">
            {label}
          </span>
        )}
        {sublabel && (
          <span className="text-muted text-xs">{sublabel}</span>
        )}
      </div>
    </div>
  );
}
