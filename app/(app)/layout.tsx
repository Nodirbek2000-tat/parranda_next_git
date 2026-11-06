import type { ReactNode } from "react";
import { AppShell } from "@/components/shell";

/** Authenticated area: role-based menu + route guard. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
