import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function Switch({ checked, onChange, className, label }) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-3", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange?.(!checked)}
        className={cn(
          "relative h-6 w-11 rounded-full transition-colors",
          checked ? "bg-brand-500" : "bg-surface-2 border border-token-strong"
        )}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 600, damping: 30 }}
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow",
            checked ? "left-[22px]" : "left-0.5"
          )}
        />
      </button>
      {label && <span className="text-default text-sm">{label}</span>}
    </label>
  );
}
