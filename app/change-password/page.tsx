"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { collect, REQUIRED, useForm } from "@/lib/form";
import { homeFor } from "@/lib/nav";
import type { AuthResponse, DetailResponse } from "@/lib/types";
import { AuthFrame } from "@/components/layout/auth-frame";
import { SessionError } from "@/components/layout/shell-states";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

const MIN_LENGTH = 8;

export default function ChangePasswordPage() {
  const router = useRouter();
  const toast = useToast();
  const { status, user, error, retry, signIn, signOut } = useAuth();
  const form = useForm({ old_password: "", new_password: "", confirm: "" });
  /** Set when this page signs the user out itself and already navigates to /login. */
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (status === "anonymous" && !leaving) router.replace("/login?next=%2Fchange-password");
  }, [status, leaving, router]);

  const leaveToLogin = () => {
    setLeaving(true);
    signOut();
    router.replace("/login");
  };

  if (status === "error" && error) return <SessionError error={error} onRetry={retry} onSignOut={signOut} />;

  if (!user) {
    return (
      <AuthFrame title="Parolni almashtirish">
        <div className="flex items-center gap-3 text-sm text-muted" role="status">
          <LoaderCircle className="size-4 animate-spin text-accent" aria-hidden />
          Yuklanmoqda…
        </div>
      </AuthFrame>
    );
  }

  const forced = user.must_change_password;

  const onSubmit = form.handleSubmit(
    (values) =>
      collect([
        ["old_password", values.old_password ? undefined : REQUIRED],
        [
          "new_password",
          !values.new_password
            ? REQUIRED
            : values.new_password.length < MIN_LENGTH
              ? `Kamida ${MIN_LENGTH} ta belgi bo‘lsin`
              : values.new_password === values.old_password
                ? "Yangi parol eskisidan farq qilsin"
                : undefined,
        ],
        ["confirm", values.confirm === values.new_password ? undefined : "Parollar mos kelmadi"],
      ]),
    (values) =>
      api
        .post<DetailResponse>("/auth/change-password", {
          old_password: values.old_password,
          new_password: values.new_password,
        })
        .then((response) => ({ detail: response.detail, password: values.new_password })),
    async ({ detail, password }) => {
      toast.success(detail || "Parol yangilandi");
      // Changing the password revokes every token issued so far, this session's too:
      // sign in again with the new password to get a fresh session.
      try {
        const auth = await api.post<AuthResponse>(
          "/auth/login",
          { username: user.username, password },
          { auth: false },
        );
        signIn(auth);
        router.replace(homeFor(auth.user.role));
      } catch {
        toast.error("Yangi parol bilan qaytadan kiring.");
        leaveToLogin();
      }
    },
  );

  return (
    <AuthFrame
      title="Parolni almashtirish"
      description={
        forced
          ? "Siz vaqtinchalik parol bilan kirdingiz. Davom etish uchun yangi parol o‘rnating."
          : `Yangi parol kamida ${MIN_LENGTH} ta belgidan iborat bo‘lsin.`
      }
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Joriy parol" {...form.field("old_password")}>
          <Input {...form.control("old_password")} type="password" autoComplete="current-password" />
        </Field>
        <Field label="Yangi parol" hint={`Kamida ${MIN_LENGTH} ta belgi`} {...form.field("new_password")}>
          <Input {...form.control("new_password")} type="password" autoComplete="new-password" />
        </Field>
        <Field label="Yangi parolni takrorlang" {...form.field("confirm")}>
          <Input {...form.control("confirm")} type="password" autoComplete="new-password" />
        </Field>
        {form.formError && <Alert>{form.formError}</Alert>}
        <Button type="submit" loading={form.pending} className="mt-1 w-full">
          Saqlash
        </Button>
        {forced ? (
          <Button variant="ghost" className="w-full" onClick={leaveToLogin}>
            Chiqish
          </Button>
        ) : (
          <Link href={homeFor(user.role)} className={buttonClasses("ghost", "md", "w-full")}>
            Orqaga
          </Link>
        )}
      </form>
    </AuthFrame>
  );
}
