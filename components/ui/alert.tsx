import type { ReactNode } from "react";
import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "danger" | "warning" | "info";

const TONES: Record<Tone, string> = {
  danger: "border-danger/25 bg-danger-soft text-danger",
  warning: "border-warning/40 bg-warning-soft text-warning-ink",
  info: "border-line bg-subtle text-ink",
};

const ICONS = { danger: CircleAlert, warning: TriangleAlert, info: Info } as const;

export function Alert({ tone = "danger", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const Icon = ICONS[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm", TONES[tone], className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
