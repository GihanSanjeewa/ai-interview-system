import { useMemo } from "react";

export default function RadarChart({ data = [], size = 300 }) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 40;
  const n = data.length || 6;

  const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;

  const polygon = useMemo(() => {
    if (!data.length) return "";
    return data
      .map((d, i) => {
        const val = Math.max(0, Math.min(100, d.value || 0));
        const r = (val / 100) * radius;
        const x = cx + r * Math.cos(angle(i));
        const y = cy + r * Math.sin(angle(i));
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [data, cx, cy, radius, n]);

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <div className="flex items-center justify-center p-2">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full max-w-[340px] drop-shadow-md select-none overflow-visible"
      >
        <defs>
          <radialGradient id="radar-grad-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#7c5dfa" stopOpacity="0.65" />
            <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0.1" />
          </radialGradient>
          <filter id="radar-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer and concentric polygon rings */}
        {rings.map((r, i) => {
          const points = (data.length ? data : Array.from({ length: 6 }))
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
              fill={i === rings.length - 1 ? "var(--surface-2)" : "none"}
              fillOpacity={i === rings.length - 1 ? "0.3" : "0"}
              stroke="var(--border-strong)"
              strokeWidth={i === rings.length - 1 ? "1.5" : "1"}
              strokeDasharray={i === rings.length - 1 ? "none" : "3 4"}
            />
          );
        })}

        {/* Axis lines */}
        {(data.length ? data : Array.from({ length: 6 })).map((_, i) => {
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
              strokeWidth="1"
            />
          );
        })}

        {/* Filled Data Polygon */}
        {polygon && (
          <>
            <polygon
              points={polygon}
              fill="url(#radar-grad-glow)"
              stroke="#9e8cfc"
              strokeWidth="2.5"
              filter="url(#radar-glow)"
            />
          </>
        )}

        {/* Data points & Labels */}
        {data.map((d, i) => {
          const val = Math.max(0, Math.min(100, d.value || 0));
          const r = (val / 100) * radius;
          const px = cx + r * Math.cos(angle(i));
          const py = cy + r * Math.sin(angle(i));

          const lx = cx + (radius + 20) * Math.cos(angle(i));
          const ly = cy + (radius + 20) * Math.sin(angle(i));

          return (
            <g key={i}>
              <circle
                cx={px}
                cy={py}
                r="4.5"
                fill="#38bdf8"
                stroke="var(--surface)"
                strokeWidth="2"
                className="transition-all duration-300 hover:scale-125"
              />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[11px] font-semibold fill-[var(--text)] tracking-tight"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
