import { forwardRef } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const variants = {
  primary:
    "bg-gradient-to-r from-brand-500 via-brand-600 to-accent-500 text-white shadow-lg shadow-brand-500/25 hover:shadow-xl hover:shadow-brand-500/40 hover:brightness-110 active:scale-[0.98]",
  secondary:
    "bg-surface-2 text-default border border-token hover:bg-surface-3 hover:border-token-strong active:scale-[0.98]",
  ghost:
    "text-default hover:bg-surface-2 hover:text-brand-400 active:scale-[0.98]",
  outline:
    "border border-token-strong bg-transparent text-default hover:bg-surface-2 hover:border-brand-500/50 active:scale-[0.98]",
  danger:
    "bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 hover:brightness-110 active:scale-[0.98]",
  glass:
    "glass text-default hover:bg-surface-2 hover:border-brand-500/40 active:scale-[0.98]",
  glow:
    "relative overflow-hidden bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-glow hover:brightness-110",
};

const sizes = {
  xs: "h-7 px-2.5 text-xs rounded-lg gap-1",
  sm: "h-9 px-3.5 text-xs font-semibold rounded-xl gap-1.5",
  md: "h-11 px-5 text-sm font-semibold rounded-2xl gap-2",
  lg: "h-13 px-6 text-base font-semibold rounded-2xl gap-2.5",
  icon: "size-10 rounded-xl p-0",
  "icon-sm": "size-8 rounded-lg p-0",
};

const Button = forwardRef(function Button(
  {
    children,
    className,
    variant = "primary",
    size = "md",
    loading = false,
    disabled,
    leftIcon: LeftIcon,
    rightIcon: RightIcon,
    asMotion = true,
    ...props
  },
  ref
) {
  const Cmp = asMotion ? motion.button : "button";
  return (
    <Cmp
      ref={ref}
      whileTap={asMotion && !disabled && !loading ? { scale: 0.97 } : undefined}
      whileHover={asMotion && !disabled && !loading ? { y: -1 } : undefined}
      transition={{ type: "spring", stiffness: 450, damping: 25 }}
      className={cn(
        "ring-focus inline-flex items-center justify-center select-none font-semibold transition-all duration-200 cursor-pointer",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin shrink-0" />
      ) : (
        LeftIcon && <LeftIcon className="size-4 shrink-0" />
      )}
      {children}
      {!loading && RightIcon && <RightIcon className="size-4 shrink-0" />}
    </Cmp>
  );
});

export default Button;
