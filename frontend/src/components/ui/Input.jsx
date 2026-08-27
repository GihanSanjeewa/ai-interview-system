import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export const Input = forwardRef(function Input(
  { className, type = "text", leftIcon: LeftIcon, rightIcon: RightIcon, error, ...props },
  ref
) {
  return (
    <div className="relative w-full group">
      {LeftIcon && (
        <LeftIcon className="text-subtle group-focus-within:text-brand-400 pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 transition-colors" />
      )}
      <input
        ref={ref}
        type={type}
        className={cn(
          "bg-surface-2/80 text-default border-token h-12 w-full rounded-2xl border px-4 text-sm font-medium",
          "placeholder:text-subtle outline-none transition-all duration-200",
          "focus:bg-surface focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15",
          LeftIcon && "pl-11",
          RightIcon && "pr-11",
          error && "border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/15",
          className
        )}
        {...props}
      />
      {RightIcon && (
        <RightIcon className="text-subtle pointer-events-none absolute right-3.5 top-1/2 size-4.5 -translate-y-1/2" />
      )}
    </div>
  );
});

export const PasswordInput = forwardRef(function PasswordInput(
  { className, error, ...props },
  ref
) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative w-full">
      <input
        ref={ref}
        type={show ? "text" : "password"}
        className={cn(
          "bg-surface-2/80 text-default border-token h-12 w-full rounded-2xl border px-4 pr-12 text-sm font-medium",
          "placeholder:text-subtle outline-none transition-all duration-200",
          "focus:bg-surface focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15",
          error && "border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/15",
          className
        )}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="text-subtle hover:text-default absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 transition hover:bg-surface"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
});

export const Label = ({ className, children, ...p }) => (
  <label
    className={cn("text-default mb-1.5 block text-xs font-semibold uppercase tracking-wider", className)}
    {...p}
  >
    {children}
  </label>
);

export const FieldError = ({ children }) =>
  children ? (
    <p className="text-rose-400 mt-1.5 text-xs font-medium flex items-center gap-1">
      <span className="inline-block size-1 rounded-full bg-rose-400" />
      {children}
    </p>
  ) : null;
