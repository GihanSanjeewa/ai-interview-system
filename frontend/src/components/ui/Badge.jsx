import { cn } from "@/lib/utils";

const styles = {
  default: "bg-surface-2 text-default border border-token",
  brand: "bg-brand-500/10 text-brand-400 border border-brand-500/30 shadow-[0_0_12px_rgba(124,93,250,0.15)]",
  success: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_12px_rgba(52,211,153,0.15)]",
  warning: "bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-[0_0_12px_rgba(251,191,36,0.15)]",
  danger: "bg-rose-500/10 text-rose-400 border border-rose-500/30 shadow-[0_0_12px_rgba(251,113,133,0.15)]",
  info: "bg-accent-500/10 text-accent-400 border border-accent-500/30 shadow-[0_0_12px_rgba(56,189,248,0.15)]",
  outline: "border border-token-strong text-default bg-surface/50",
  gradient: "bg-gradient-to-r from-brand-500/20 to-accent-500/20 text-brand-300 border border-brand-400/40 shadow-sm",
};

const dotColors = {
  default: "bg-subtle",
  brand: "bg-brand-400",
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  danger: "bg-rose-400",
  info: "bg-accent-400",
  outline: "bg-muted",
  gradient: "bg-brand-400",
};

const sizes = {
  xs: "h-5 px-2 text-[10px]",
  sm: "h-6 px-2.5 text-[11px]",
  md: "h-7 px-3 text-xs",
  lg: "h-8 px-3.5 text-xs font-bold",
};

export default function Badge({
  variant = "default",
  size = "md",
  className,
  children,
  icon: Icon,
  dot = false,
  pulse = false,
  ...p
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold select-none",
        styles[variant],
        sizes[size],
        className
      )}
      {...p}
    >
      {dot && (
        <span className="relative flex size-2">
          {pulse && (
            <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", dotColors[variant])} />
          )}
          <span className={cn("relative inline-flex size-2 rounded-full", dotColors[variant])} />
        </span>
      )}
      {Icon && <Icon className="size-3 shrink-0" />}
      <span>{children}</span>
    </span>
  );
}
