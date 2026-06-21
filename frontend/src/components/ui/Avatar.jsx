import { initials, cn } from "@/lib/utils";

const sizes = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
  xl: "size-16 text-xl",
};

export default function Avatar({ name = "U", src, size = "md", className, ring }) {
  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center rounded-full font-semibold",
        "bg-gradient-to-br from-brand-500 to-accent-500 text-white",
        ring && "ring-2 ring-brand-500/40 ring-offset-2 ring-offset-[var(--bg)]",
        sizes[size],
        className
      )}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          className="size-full rounded-full object-cover"
        />
      ) : (
        <span>{initials(name)}</span>
      )}
    </div>
  );
}
