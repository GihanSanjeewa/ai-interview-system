import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export default function EmptyState({
  icon: Icon = Inbox,
  title = "Nothing here yet",
  description = "",
  action,
  className,
}) {
  return (
    <div
      className={cn(
        "border-token bg-surface flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center",
        className
      )}
    >
      <div className="from-brand-500/15 to-accent-500/15 text-brand-400 mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br">
        <Icon className="size-6" />
      </div>
      <h3 className="text-default text-base font-semibold">{title}</h3>
      {description && (
        <p className="text-muted mt-1 max-w-sm text-sm">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
