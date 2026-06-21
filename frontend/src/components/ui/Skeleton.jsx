import { cn } from "@/lib/utils";

export default function Skeleton({ className }) {
  return (
    <div
      className={cn(
        "bg-surface-2 relative overflow-hidden rounded-lg",
        className
      )}
    >
      <div className="animate-shimmer absolute inset-0" />
    </div>
  );
}
