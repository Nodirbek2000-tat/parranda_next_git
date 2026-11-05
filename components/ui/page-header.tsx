import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Path above the title, ending with the current page (rendered without a link). */
  breadcrumbs?: readonly Crumb[];
  /** Extra row under the header (period picker, filters). */
  toolbar?: ReactNode;
}

export function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  return (
    <nav aria-label="Yo‘l" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-[13px] text-muted">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {item.href && !last ? (
                <Link href={item.href} className="truncate rounded-sm transition-colors hover:text-ink">
                  {item.label}
                </Link>
              ) : (
                <span className="truncate text-ink/80" aria-current={last ? "page" : undefined}>
                  {item.label}
                </span>
              )}
              {!last && <ChevronRight className="size-3.5 shrink-0 text-line-strong" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** One header for every page: breadcrumbs, title, one-line description, actions, optional toolbar. */
export function PageHeader({ title, description, actions, breadcrumbs, toolbar }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4">
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-ink sm:text-[26px]">{title}</h1>
          {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 *:flex-1 sm:*:flex-none">{actions}</div>}
      </div>
      {toolbar}
    </header>
  );
}
