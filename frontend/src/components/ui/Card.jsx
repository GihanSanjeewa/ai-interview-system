import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Card = forwardRef(function Card({ className, children, glass, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        glass
          ? "glass"
          : "bg-surface border border-token",
        "rounded-2xl",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

export const CardHeader = ({ className, ...p }) => (
  <div className={cn("flex flex-col gap-1 p-6", className)} {...p} />
);
export const CardTitle = ({ className, ...p }) => (
  <h3 className={cn("text-default text-lg font-semibold", className)} {...p} />
);
export const CardDescription = ({ className, ...p }) => (
  <p className={cn("text-muted text-sm", className)} {...p} />
);
export const CardContent = ({ className, ...p }) => (
  <div className={cn("p-6 pt-0", className)} {...p} />
);
export const CardFooter = ({ className, ...p }) => (
  <div className={cn("flex items-center p-6 pt-0", className)} {...p} />
);
