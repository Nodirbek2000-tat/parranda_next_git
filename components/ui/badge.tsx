import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "primary";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-ink/5 text-muted",
  info: "bg-info-soft text-info",
  success: "bg-accent-soft text-accent",
  warning: "bg-warning-soft text-warning-ink",
  danger: "bg-danger-soft text-danger",
  primary: "bg-primary text-white",
};

export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-md px-2 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
