import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function Progress({
  value = 0,
  max = 100,
  className,
  barClassName,
  showLabel,
  gradient = "from-brand-500 via-brand-400 to-accent-400",
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn("w-full", className)}>
      <div className="bg-surface-2 border-token relative h-2.5 w-full overflow-hidden rounded-full border shadow-inner">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "h-full rounded-full bg-gradient-to-r shadow-[0_0_12px_rgba(124,93,250,0.5)]",
            gradient,
            barClassName
          )}
        />
      </div>
      {showLabel && (
        <div className="text-subtle mt-1.5 flex justify-between text-xs font-semibold">
          <span>{Math.round(pct)}%</span>
          <span>{max}</span>
        </div>
      )}
    </div>
  );
}

export function CircularProgress({
  value = 0,
  size = 130,
  stroke = 10,
  gradientId = "cp-grad",
  className,
  children,
}) {
  const radius = (size - stroke) / 2;
  const c = 2 * Math.PI * radius;
  const offset = c - (Math.max(0, Math.min(100, value)) / 100) * c;

  return (
    <div className={cn("relative inline-flex select-none", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7c5dfa" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
