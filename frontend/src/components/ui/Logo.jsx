import { cn } from "@/lib/utils";

export default function Logo({ className, withText = true }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="from-brand-500 to-accent-500 relative inline-flex size-9 items-center justify-center rounded-xl bg-gradient-to-br shadow-[0_8px_24px_-8px_rgba(91,81,255,0.7)]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="size-5 text-white"
        >
          <path
            d="M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="11" r="2.4" fill="currentColor" />
          <path
            d="M7 17c1-1.8 3-2.8 5-2.8s4 1 5 2.8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-emerald-400 shadow shadow-emerald-400/60" />
      </span>
      {withText && (
        <span className="font-display text-default text-lg font-bold tracking-tight">
          Inverview<span className="gradient-text">.ai</span>
        </span>
      )}
    </div>
  );
}
