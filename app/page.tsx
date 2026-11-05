"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { homeFor } from "@/lib/nav";
import { SessionError } from "@/components/layout/shell-states";
import { LogoMark } from "@/components/layout/logo";

/** `/`: ADMIN / WAREHOUSE -> /dashboard, OWNER -> /my, no session -> /login. */
export default function RootPage() {
  const router = useRouter();
  const { status, user, error, retry, signOut } = useAuth();

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
    else if (status === "authenticated" && user) {
      router.replace(user.must_change_password ? "/change-password" : homeFor(user.role));
    }
  }, [status, user, router]);

  if (status === "error" && error) return <SessionError error={error} onRetry={retry} onSignOut={signOut} />;

  return (
    <main className="flex min-h-app flex-col items-center justify-center gap-4" role="status">
      <LogoMark className="size-12" />
      <LoaderCircle className="size-5 animate-spin text-accent" aria-label="Yuklanmoqda" />
    </main>
  );
}
