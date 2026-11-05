import type { ReactNode } from "react";
import { BRAND_NAME, LogoMark } from "./logo";

/** Centered card used by /login and /change-password. */
export function AuthFrame({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <main className="flex min-h-app flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="size-12" />
          <p className="mt-3 text-xs font-medium uppercase tracking-[0.12em] text-muted">{BRAND_NAME}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-6 shadow-card sm:p-8">
          <h1 className="text-lg font-semibold text-ink">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
