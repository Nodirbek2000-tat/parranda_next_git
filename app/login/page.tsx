import { Suspense } from "react";
import { AuthFrame } from "@/components/layout/auth-frame";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthFrame title="Tizimga kirish">
          <div className="flex flex-col gap-4" role="status" aria-label="Yuklanmoqda">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </AuthFrame>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
