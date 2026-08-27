import { cn } from "@/lib/utils";

export default function Logo({ className, withText = true, size = "md" }) {
  const iconSizes = {
    sm: "size-8",
    md: "size-9.5",
    lg: "size-11",
  };

  const textSizes = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-xl",
  };

  return (
    <div className={cn("flex items-center gap-3 select-none group", className)}>
      <div className={cn("relative inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 via-brand-600 to-accent-500 p-0.5 shadow-lg shadow-brand-500/30 transition-all duration-300 group-hover:scale-105 group-hover:shadow-brand-500/50", iconSizes[size])}>
        <div className="flex size-full items-center justify-center rounded-[14px] bg-[#0c0d18]/40 backdrop-blur-sm">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="size-5 text-white transition-transform duration-300 group-hover:scale-110"
          >
            <path
              d="M12 2L3.5 6.5v6c0 5.5 3.6 10.2 8.5 11.5 4.9-1.3 8.5-6 8.5-11.5v-6L12 2z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <path
              d="M9 12l2 2 4-4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="7" r="1.5" fill="#38bdf8" />
          </svg>
        </div>
        <span className="absolute -right-0.5 -top-0.5 flex size-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400 ring-2 ring-surface" />
        </span>
      </div>
      {withText && (
        <div className="flex flex-col leading-none">
          <span className={cn("font-display font-bold tracking-tight text-default flex items-center gap-1", textSizes[size])}>
            Inverview<span className="gradient-text font-extrabold">.ai</span>
          </span>
          <span className="text-[10px] uppercase font-semibold tracking-widest text-subtle mt-0.5">
            AI Interview Studio
          </span>
        </div>
      )}
    </div>
  );
}
