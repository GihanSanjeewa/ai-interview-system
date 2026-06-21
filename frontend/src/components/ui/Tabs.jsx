import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function Tabs({ tabs, value, onChange, className }) {
  return (
    <div
      className={cn(
        "bg-surface-2 border-token inline-flex gap-1 rounded-2xl border p-1",
        className
      )}
    >
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className="relative rounded-xl px-4 py-2 text-sm font-medium transition"
          >
            {active && (
              <motion.span
                layoutId="tab-indicator"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className="bg-surface shadow-token absolute inset-0 rounded-xl border border-token shadow-sm"
              />
            )}
            <span
              className={cn(
                "relative",
                active ? "text-default" : "text-muted"
              )}
            >
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
