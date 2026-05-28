import { forwardRef } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const variants = {
  primary:
    "bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[0_8px_30px_-8px_rgba(91,81,255,0.6)] hover:shadow-[0_10px_36px_-8px_rgba(91,81,255,0.8)] hover:brightness-110",
  secondary:
    "bg-surface-2 text-default border border-token-strong hover:bg-surface",
  ghost: "text-default hover:bg-surface-2",
  outline:
    "border border-token-strong text-default hover:bg-surface-2",
  danger:
    "bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-[0_6px_24px_-8px_rgba(244,63,94,0.55)] hover:brightness-110",
  glass:
    "glass text-default hover:bg-white/10 dark:hover:bg-white/10",
};

const sizes = {
  sm: "h-9 px-3 text-sm rounded-xl gap-1.5",
  md: "h-11 px-5 text-sm rounded-2xl gap-2",
  lg: "h-13 px-7 text-base rounded-2xl gap-2",
  icon: "size-10 rounded-xl",
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
      whileTap={asMotion ? { scale: 0.97 } : undefined}
      whileHover={asMotion ? { y: -1 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className={cn(
        "ring-focus inline-flex items-center justify-center font-semibold transition-all duration-200",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        LeftIcon && <LeftIcon className="size-4" />
      )}
      {children}
      {!loading && RightIcon && <RightIcon className="size-4" />}
    </Cmp>
  );
});

export default Button;
