"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Alert, Button, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { homeFor } from "@/lib/roles";

/** `/` → OWNER: /my, everyone else: /tasks (or /login, /change-password). */
export default function Home() {
  const router = useRouter();
  const { status, user, error, retry, signOut } = useAuth();

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
    else if (status === "authenticated" && user) router.replace(user.must_change_password ? "/change-password" : homeFor(user));
  }, [status, user, router]);

  if (status === "error") {
    return (
      <main className="mx-auto flex min-h-app max-w-sm flex-col justify-center gap-4 px-4">
        <Alert>{error}</Alert>
        <div className="flex gap-2">
          <Button onClick={retry}>Qayta urinish</Button>
          <Button variant="secondary" onClick={signOut}>
            Chiqish
          </Button>
        </div>
      </main>
    );
  }
  return <Spinner className="min-h-app" />;
}
