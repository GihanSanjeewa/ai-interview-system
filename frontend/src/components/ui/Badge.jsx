import { cn } from "@/lib/utils";

const styles = {
  default: "bg-surface-2 text-default border border-token",
  brand: "bg-brand-500/15 text-brand-400 border border-brand-500/30",
  success: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  danger: "bg-rose-500/15 text-rose-400 border border-rose-500/30",
  info: "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30",
  outline: "border border-token-strong text-default",
};

const sizes = {
  sm: "h-6 px-2 text-[11px]",
  md: "h-7 px-2.5 text-xs",
};

export default function Badge({
  variant = "default",
  size = "md",
  className,
  children,
  icon: Icon,
  ...p
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold tracking-wide uppercase",
        styles[variant],
        sizes[size],
        className
      )}
      {...p}
    >
      {Icon && <Icon className="size-3" />}
      {children}
    </span>
  );
}
