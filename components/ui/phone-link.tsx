import type { MouseEvent } from "react";
import { cn } from "@/lib/cn";
import { formatPhone, phoneHref } from "@/lib/format";

/**
 * Tappable phone number ("+998 90 111 00 12" → `tel:+998901110012`): staff call an owner who has not
 * reported straight from the list or the household page (Telegram opens the dialer).
 */
export function PhoneLink({ phone, className }: { phone: string | null | undefined; className?: string }) {
  const href = phoneHref(phone);
  if (!href) return <span className={cn("tabular-nums", className)}>{formatPhone(phone)}</span>;
  return (
    <a
      href={href}
      // Inside a clickable row / card the call must not also open the row link.
      onClick={(event: MouseEvent) => event.stopPropagation()}
      className={cn(
        "rounded-sm tabular-nums text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        className,
      )}
    >
      {formatPhone(phone)}
    </a>
  );
}
