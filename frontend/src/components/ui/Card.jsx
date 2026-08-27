import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Card = forwardRef(function Card(
  { className, children, glass = true, glow = false, hover = true, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        "relative rounded-3xl transition-all duration-300",
        glass ? "glass-card" : "bg-surface border border-token",
        hover && "hover:border-token-strong hover:shadow-xl hover:shadow-brand-500/5",
        glow && "shadow-glow",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

export const CardHeader = ({ className, ...p }) => (
  <div className={cn("flex flex-col gap-1.5 p-6 sm:p-7", className)} {...p} />
);

export const CardTitle = ({ className, ...p }) => (
  <h3
    className={cn("text-default font-display text-lg font-bold sm:text-xl", className)}
    {...p}
  />
);

export const CardDescription = ({ className, ...p }) => (
  <p className={cn("text-muted text-xs sm:text-sm leading-relaxed", className)} {...p} />
);

export const CardContent = ({ className, ...p }) => (
  <div className={cn("p-6 sm:p-7 pt-0", className)} {...p} />
);

export const CardFooter = ({ className, ...p }) => (
  <div className={cn("flex items-center p-6 sm:p-7 pt-0", className)} {...p} />
);
