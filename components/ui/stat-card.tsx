import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "danger" | "warning";
}

export function StatCard({ label, value, hint, icon: Icon, tone = "default" }: StatCardProps) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[13px] leading-snug text-muted">{label}</p>
        {Icon && (
          <Icon
            className={cn(
              "mt-0.5 size-4 shrink-0",
              tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning-ink" : "text-muted",
            )}
            aria-hidden
          />
        )}
      </div>
      <p className="mt-1.5 truncate text-[22px] font-semibold leading-tight tracking-tight tabular-nums text-ink sm:text-[26px]">{value}</p>
      {hint && <p className="mt-2 text-xs leading-snug text-muted">{hint}</p>}
    </div>
  );
}
