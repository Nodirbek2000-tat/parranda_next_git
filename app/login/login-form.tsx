"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, LoaderCircle, Send } from "lucide-react";
import { api, toApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { collect, required, useForm } from "@/lib/form";
import { canAccess, homeFor, safeNextPath } from "@/lib/nav";
import { wasLoggedOut } from "@/lib/session";
import { telegramUserLabel, useTelegram } from "@/lib/telegram";
import type { AuthResponse } from "@/lib/types";
import { AuthFrame } from "@/components/layout/auth-frame";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

type TelegramAttempt = { status: "pending" } | { status: "failed"; message: string };

function telegramErrorMessage(error: ReturnType<typeof toApiError>): string {
  if (error.status === 401) {
    return "Telegram ma’lumotlari eskirgan yoki tasdiqlanmadi. Web Appni bot orqali qaytadan oching.";
  }
  if (error.status === 403) {
    return error.detail ?? "Telegram akkauntingiz tizimga bog‘lanmagan. Botda /start bosing.";
  }
  return error.message;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const { status, user, signIn } = useAuth();
  const telegram = useTelegram();
  const [showPassword, setShowPassword] = useState(false);
  const [tgAttempt, setTgAttempt] = useState<TelegramAttempt | null>(null);
  const tgInFlight = useRef(false);
  const form = useForm({ username: "", password: "" });

  // Signed in (by form, Telegram, or an existing session): leave the login page.
  useEffect(() => {
    if (status !== "authenticated" || !user) return;
    if (user.must_change_password) router.replace("/change-password");
    else router.replace(nextPath && canAccess(user, nextPath) ? nextPath : homeFor(user.role));
  }, [status, user, nextPath, router]);

  const telegramAvailable = telegram.loaded && telegram.initData !== "";
  // Automatic only inside a Telegram client; in a plain browser the initData may
  // come from someone else's link, so the visitor must choose it explicitly.
  const autoTelegram =
    telegramAvailable && telegram.insideTelegram && status === "anonymous" && tgAttempt === null && !wasLoggedOut();
  const telegramAccount = telegramAvailable && !telegram.insideTelegram ? telegramUserLabel(telegram.initData) : null;

  const loginWithTelegram = useCallback(() => {
    if (tgInFlight.current) return;
    tgInFlight.current = true;
    api
      .post<AuthResponse>("/auth/telegram", { init_data: telegram.initData }, { auth: false })
      .then(signIn, (caught: unknown) =>
        setTgAttempt({ status: "failed", message: telegramErrorMessage(toApiError(caught)) }),
      )
      .finally(() => {
        tgInFlight.current = false;
      });
  }, [telegram.initData, signIn]);

  // Inside a Telegram client: log in automatically with the signed initData.
  useEffect(() => {
    if (autoTelegram) loginWithTelegram();
  }, [autoTelegram, loginWithTelegram]);

  const retryTelegram = () => {
    setTgAttempt({ status: "pending" });
    loginWithTelegram();
  };

  const telegramBusy = autoTelegram || tgAttempt?.status === "pending";
  const redirecting = status === "authenticated";

  const onSubmit = form.handleSubmit(
    (values) => collect([
      ["username", required(values.username)],
      ["password", required(values.password)],
    ]),
    (values) =>
      api.post<AuthResponse>("/auth/login", { username: values.username.trim(), password: values.password }, { auth: false }),
    (auth) => signIn(auth),
  );

  if (telegramBusy || redirecting) {
    return (
      <AuthFrame title="Tizimga kirish">
        <div className="flex items-center gap-3 text-sm text-muted" role="status">
          <LoaderCircle className="size-4 animate-spin text-accent" aria-hidden />
          {redirecting ? "Yo‘naltirilmoqda…" : "Telegram orqali kirilmoqda…"}
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title="Tizimga kirish" description="Login va parolingizni kiriting.">
      <div className="flex flex-col gap-5">
        {tgAttempt?.status === "failed" && <Alert tone="warning">{tgAttempt.message}</Alert>}

        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="Login" {...form.field("username")}>
            <Input {...form.control("username")} autoComplete="username" autoCapitalize="none" spellCheck={false} />
          </Field>
          <Field label="Parol" {...form.field("password")}>
            <div className="relative">
              <Input
                {...form.control("password")}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Parolni yashirish" : "Parolni ko‘rsatish"}
                aria-pressed={showPassword}
                className="absolute right-1 top-1 flex size-8 items-center justify-center rounded-md text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
              >
                {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </button>
            </div>
          </Field>
          {form.formError && <Alert>{form.formError}</Alert>}
          <Button type="submit" loading={form.pending} className="mt-1 w-full">
            Kirish
          </Button>
        </form>

        {telegramAvailable && (
          <Button
            variant="secondary"
            className="w-full"
            onClick={retryTelegram}
            icon={<Send className="size-4" aria-hidden />}
          >
            {telegramAccount ? `Telegram orqali kirish (${telegramAccount})` : "Telegram orqali kirish"}
          </Button>
        )}
      </div>
    </AuthFrame>
  );
}
