import { cn } from "@/lib/cn";

export const BRAND_NAME = "Navobod naslli parranda qisqarmasi";

/** NNP mark: rounded square in the primary colour with the monogram. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9 shrink-0", className)} role="img" aria-label="NNP">
      <rect width="40" height="40" rx="10" fill="#12372A" />
      <ellipse cx="29.5" cy="10" rx="3" ry="3.6" fill="#E8B04A" />
      <text
        x="19"
        y="25.5"
        textAnchor="middle"
        fontSize="12.5"
        fontWeight="700"
        letterSpacing="0.4"
        fill="#FFFFFF"
        fontFamily="var(--font-sans), sans-serif"
      >
        NNP
      </text>
    </svg>
  );
}

/** `name` / `subtitle` come from the company settings (V3 §3); defaults are the built-in brand. */
export function Logo({ compact = false, name, subtitle }: { compact?: boolean; name?: string; subtitle?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <LogoMark />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-semibold tracking-wide text-ink">{name || "NNP"}</span>
        {!compact && <span className="block truncate text-xs text-muted">{subtitle || BRAND_NAME}</span>}
      </span>
    </span>
  );
}
