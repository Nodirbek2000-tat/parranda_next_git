import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { CircleAlert, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

/* ---------------- buttons ---------------- */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover disabled:bg-primary/50",
  accent: "bg-accent text-white hover:bg-accent-hover disabled:bg-accent/50",
  secondary: "border border-line bg-surface text-ink hover:border-line-strong hover:bg-subtle disabled:text-muted",
  ghost: "text-ink hover:bg-ink/5 disabled:text-muted",
  danger: "bg-danger text-white hover:bg-danger-hover disabled:bg-danger/50",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: "sm" | "md" = "md", className?: string) {
  return cn(
    "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-colors disabled:cursor-not-allowed",
    VARIANTS[variant],
    size === "sm" ? "h-8 gap-1.5 rounded-lg px-3 text-[13px]" : "h-11 gap-2 rounded-xl px-4 text-sm",
    className,
  );
}

interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = "primary", size = "md", loading, icon, className, children, disabled, type = "button", ...props }: ButtonProps) {
  return (
    <button type={type} className={buttonClasses(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

export function LinkButton({
  variant = "secondary",
  size = "md",
  icon,
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: "sm" | "md"; icon?: ReactNode }) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}

export function IconButton({ label, className, children, type = "button", ...props }: ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ---------------- form controls ---------------- */

const CONTROL =
  "block w-full rounded-xl border bg-surface px-3 text-[15px] text-ink transition-colors placeholder:text-muted/70 focus:border-accent focus:outline-2 focus:outline-offset-0 focus:outline-accent/25 disabled:bg-subtle disabled:text-muted";

function controlClass(invalid?: boolean, className?: string) {
  return cn(CONTROL, invalid ? "border-danger" : "border-line hover:border-line-strong", className);
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {error ? <p className="text-[13px] text-danger">{error}</p> : hint ? <p className="text-[13px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function Input({ invalid, className, ...props }: ComponentProps<"input"> & { invalid?: boolean }) {
  return <input aria-invalid={invalid || undefined} className={controlClass(invalid, cn("h-11", className))} {...props} />;
}

export function Select({ invalid, className, children, ...props }: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <select aria-invalid={invalid || undefined} className={controlClass(invalid, cn("h-11 pr-8", className))} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ invalid, className, ...props }: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return <textarea aria-invalid={invalid || undefined} className={controlClass(invalid, cn("min-h-24 py-2.5", className))} {...props} />;
}

/* ---------------- feedback ---------------- */

const ALERT_TONES = {
  danger: "border-danger/25 bg-danger-soft text-danger",
  warning: "border-warning/40 bg-warning-soft text-warning-ink",
  info: "border-line bg-subtle text-ink",
} as const;
const ALERT_ICONS = { danger: CircleAlert, warning: TriangleAlert, info: Info } as const;

export function Alert({ tone = "danger", children, className }: { tone?: keyof typeof ALERT_TONES; children: ReactNode; className?: string }) {
  const Icon = ALERT_ICONS[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm", ALERT_TONES[tone], className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 whitespace-pre-line">{children}</div>
    </div>
  );
}

export function Spinner({ label = "Yuklanmoqda…", className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn("flex items-center justify-center gap-2 py-10 text-sm text-muted", className)}>
      <LoaderCircle className="size-4 animate-spin text-accent" aria-hidden />
      {label}
    </div>
  );
}

export function Empty({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {children && <div className="text-sm text-muted">{children}</div>}
    </div>
  );
}

/** Loading / error / content in one place. */
export function Loadable<T>({ data, error, reload, children }: { data: T | undefined; error: string | null; reload?: () => void; children: (data: T) => ReactNode }) {
  if (data === undefined) {
    if (error)
      return (
        <div className="flex flex-col items-start gap-3">
          <Alert>{error}</Alert>
          {reload && (
            <Button variant="secondary" size="sm" onClick={reload}>
              Qayta urinish
            </Button>
          )}
        </div>
      );
    return <Spinner />;
  }
  return (
    <>
      {error && <Alert className="mb-3">{error}</Alert>}
      {children(data)}
    </>
  );
}

/* ---------------- layout ---------------- */

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("rounded-2xl border border-line bg-surface p-4 shadow-card", className)} {...props}>
      {children}
    </div>
  );
}

const BADGE_TONES = {
  neutral: "bg-subtle text-muted ring-line",
  green: "bg-accent-soft text-primary ring-accent/20",
  amber: "bg-warning-soft text-warning-ink ring-warning/30",
  red: "bg-danger-soft text-danger ring-danger/20",
  blue: "bg-info-soft text-info ring-info/20",
} as const;
export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", BADGE_TONES[tone], className)}>
      {children}
    </span>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "red" | "green" }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-[13px] text-muted">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone === "red" ? "text-danger" : tone === "green" ? "text-accent" : "text-ink")}>{value}</p>
    </div>
  );
}
