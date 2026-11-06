import { Suspense } from "react";
import { AuthFrame } from "@/components/auth-frame";
import { Spinner } from "@/components/ui";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthFrame title="Tizimga kirish">
          <Spinner />
        </AuthFrame>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
