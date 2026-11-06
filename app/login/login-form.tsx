"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Eye, EyeOff, LoaderCircle, Send } from "lucide-react";
import { AuthFrame } from "@/components/auth-frame";
import { Alert, Button, Field, Input } from "@/components/ui";
import { api, ApiError, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canAccess, homeFor, safeNext } from "@/lib/roles";
import { wasLoggedOut } from "@/lib/session";
import { telegramUserLabel, useTelegram } from "@/lib/telegram";
import type { AuthResponse } from "@/lib/types";

function telegramError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Telegram ma’lumotlari tasdiqlanmadi. Web Appni bot orqali qaytadan oching.";
    if (error.status === 403 || error.status === 404)
      return error.message || "Telegram akkauntingiz tizimga bog‘lanmagan. Botda /start bosib, login va parolni kiriting.";
  }
  return errorMessage(error);
}

export function LoginForm() {
  const router = useRouter();
  const nextPath = safeNext(useSearchParams().get("next"));
  const { status, user, signIn } = useAuth();
  const telegram = useTelegram();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tg, setTg] = useState<"idle" | "pending" | "failed">("idle");
  const [tgError, setTgError] = useState<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || !user) return;
    if (user.must_change_password) router.replace("/change-password");
    else router.replace(nextPath && canAccess(user, nextPath) ? nextPath : homeFor(user));
  }, [status, user, nextPath, router]);

  const tgAvailable = telegram.loaded && telegram.initData !== "";
  // Automatic only inside a Telegram client; in a plain browser initData could come from someone else's link.
  const autoTelegram = tgAvailable && telegram.insideTelegram && status === "anonymous" && tg === "idle" && !wasLoggedOut();
  const tgAccount = tgAvailable && !telegram.insideTelegram ? telegramUserLabel(telegram.initData) : null;

  const loginWithTelegram = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    api
      .post<AuthResponse>("/auth/telegram", { init_data: telegram.initData }, false)
      .then(signIn, (caught: unknown) => {
        setTg("failed");
        setTgError(telegramError(caught));
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [telegram.initData, signIn]);

  useEffect(() => {
    if (autoTelegram) loginWithTelegram();
  }, [autoTelegram, loginWithTelegram]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError("Login va parolni kiriting.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      signIn(await api.post<AuthResponse>("/auth/login", { username: username.trim(), password }, false));
    } catch (caught) {
      setError(errorMessage(caught));
      setPending(false);
    }
  };

  if (autoTelegram || tg === "pending" || status === "authenticated") {
    return (
      <AuthFrame title="Tizimga kirish">
        <div className="flex items-center gap-3 text-sm text-muted" role="status">
          <LoaderCircle className="size-4 animate-spin text-accent" aria-hidden />
          {status === "authenticated" ? "Yo‘naltirilmoqda…" : "Telegram orqali kirilmoqda…"}
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title="Tizimga kirish" description="Login va parolingizni kiriting.">
      <div className="flex flex-col gap-4">
        {tgError && <Alert tone="warning">{tgError}</Alert>}
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="Login" htmlFor="username">
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} />
          </Field>
          <Field label="Parol" htmlFor="password">
            <div className="relative">
              <Input
                id="password"
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Parolni yashirish" : "Parolni ko‘rsatish"}
                className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-lg text-muted hover:text-ink"
              >
                {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </button>
            </div>
          </Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" loading={pending} className="w-full">
            Kirish
          </Button>
        </form>
        {tgAvailable && (
          <Button variant="secondary" className="w-full" onClick={() => {
              setTg("pending");
              setTgError(null);
              loginWithTelegram();
            }} icon={<Send className="size-4" aria-hidden />}>
            {tgAccount ? `Telegram orqali kirish (${tgAccount})` : "Telegram orqali kirish"}
          </Button>
        )}
      </div>
    </AuthFrame>
  );
}
