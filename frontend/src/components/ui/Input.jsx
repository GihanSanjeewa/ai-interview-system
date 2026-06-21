import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export const Input = forwardRef(function Input(
  { className, type = "text", leftIcon: LeftIcon, rightIcon: RightIcon, error, ...props },
  ref
) {
  return (
    <div className="relative w-full">
      {LeftIcon && (
        <LeftIcon className="text-subtle pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2" />
      )}
      <input
        ref={ref}
        type={type}
        className={cn(
          "bg-surface-2 text-default border-token h-12 w-full rounded-xl border px-4 text-sm",
          "placeholder:text-subtle outline-none transition",
          "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30",
          LeftIcon && "pl-10",
          RightIcon && "pr-10",
          error && "border-rose-500 focus:border-rose-500 focus:ring-rose-500/30",
          className
        )}
        {...props}
      />
      {RightIcon && (
        <RightIcon className="text-subtle pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2" />
      )}
    </div>
  );
});

export const PasswordInput = forwardRef(function PasswordInput(
  { className, ...props },
  ref
) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative w-full">
      <input
        ref={ref}
        type={show ? "text" : "password"}
        className={cn(
          "bg-surface-2 text-default border-token h-12 w-full rounded-xl border px-4 pr-12 text-sm",
          "placeholder:text-subtle outline-none transition",
          "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30",
          className
        )}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="text-subtle hover:text-default absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 transition"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
});

export const Label = ({ className, children, ...p }) => (
  <label
    className={cn("text-default mb-1.5 block text-sm font-medium", className)}
    {...p}
  >
    {children}
  </label>
);

export const FieldError = ({ children }) =>
  children ? (
    <p className="text-rose-400 mt-1.5 text-xs">{children}</p>
  ) : null;
