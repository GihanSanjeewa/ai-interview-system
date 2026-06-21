import { useMemo } from "react";

export default function RadarChart({ data = [], size = 280 }) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 36;
  const n = data.length;

  const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;

  const polygon = useMemo(() => {
    return data
      .map((d, i) => {
        const r = (d.value / 100) * radius;
        const x = cx + r * Math.cos(angle(i));
        const y = cy + r * Math.sin(angle(i));
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [data, cx, cy, radius, n]);

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[320px]">
      <defs>
        <radialGradient id="radar-grad">
          <stop offset="0%" stopColor="var(--color-brand-400)" stopOpacity="0.6" />
          <stop offset="100%" stopColor="var(--color-accent-400)" stopOpacity="0.25" />
        </radialGradient>
      </defs>
      {rings.map((r, i) => {
        const points = data
          .map((_, j) => {
            const x = cx + r * radius * Math.cos(angle(j));
            const y = cy + r * radius * Math.sin(angle(j));
            return `${x},${y}`;
          })
          .join(" ");
        return (
          <polygon
            key={i}
            points={points}
            fill="none"
            stroke="var(--border)"
            strokeDasharray="3 4"
          />
        );
      })}
      {data.map((_, i) => {
        const x = cx + radius * Math.cos(angle(i));
        const y = cy + radius * Math.sin(angle(i));
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="var(--border)"
            strokeDasharray="3 4"
          />
        );
      })}
      <polygon
        points={polygon}
        fill="url(#radar-grad)"
        stroke="var(--color-brand-400)"
        strokeWidth="2"
      />
      {data.map((d, i) => {
        const x = cx + (radius + 18) * Math.cos(angle(i));
        const y = cy + (radius + 18) * Math.sin(angle(i));
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="11"
            fontWeight="600"
            fill="var(--text-muted)"
          >
            {d.label}
          </text>
        );
      })}
      {data.map((d, i) => {
        const r = (d.value / 100) * radius;
        const x = cx + r * Math.cos(angle(i));
        const y = cy + r * Math.sin(angle(i));
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="3.5"
            fill="var(--color-brand-400)"
            stroke="var(--bg)"
            strokeWidth="2"
          />
        );
      })}
    </svg>
  );
}
