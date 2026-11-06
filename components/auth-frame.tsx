import type { ReactNode } from "react";
import { BRAND, LogoMark } from "./shell";

/** Centered card for /login and /change-password. */
export function AuthFrame({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <main className="flex min-h-app flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <LogoMark className="size-14" />
          <p className="mt-3 text-xs font-medium uppercase tracking-[0.12em] text-muted">{BRAND}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
          <h1 className="text-lg font-semibold">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </main>
  );
}
