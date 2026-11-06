"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AuthFrame } from "@/components/auth-frame";
import { useToast } from "@/components/toast";
import { Alert, Button, buttonClasses, Field, Input, Spinner } from "@/components/ui";
import { api, errorMessage, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { homeFor } from "@/lib/roles";
import type { AuthResponse } from "@/lib/types";

const MIN = 8;

export default function ChangePasswordPage() {
  const router = useRouter();
  const toast = useToast();
  const { status, user, signIn, signOut, refreshUser } = useAuth();
  const [oldPassword, setOld] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (status === "anonymous" && !leaving) router.replace("/login?next=%2Fchange-password");
  }, [status, leaving, router]);

  const leave = () => {
    setLeaving(true);
    signOut();
    router.replace("/login");
  };

  if (!user) {
    return (
      <AuthFrame title="Parolni almashtirish">
        <Spinner />
      </AuthFrame>
    );
  }

  const forced = user.must_change_password;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!oldPassword) next.old_password = "Joriy parolni kiriting";
    if (newPassword.length < MIN) next.new_password = `Kamida ${MIN} ta belgi bo‘lsin`;
    else if (newPassword === oldPassword) next.new_password = "Yangi parol eskisidan farq qilsin";
    if (confirmPassword !== newPassword) next.confirm = "Parollar mos kelmadi";
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;
    setPending(true);
    try {
      const response = await api.post<Partial<AuthResponse> & { detail?: string }>("/auth/change-password", {
        old_password: oldPassword,
        new_password: newPassword,
      });
      toast.success(response?.detail || "Parol yangilandi");
      // The old tokens may be revoked (token_version). Use new tokens if returned, else log in again.
      if (response?.access && response.refresh) {
        signIn({ access: response.access, refresh: response.refresh, user: response.user ?? { ...user, must_change_password: false } });
        const fresh = response.user ?? (await refreshUser().catch(() => null)) ?? user;
        router.replace(homeFor(fresh));
        return;
      }
      try {
        const auth = await api.post<AuthResponse>("/auth/login", { username: user.username, password: newPassword }, false);
        signIn(auth);
        router.replace(homeFor(auth.user));
      } catch {
        toast.error("Yangi parol bilan qaytadan kiring.");
        leave();
      }
    } catch (caught) {
      if (caught instanceof ApiError && Object.keys(caught.fields).length) setErrors(caught.fields);
      setFormError(errorMessage(caught));
      setPending(false);
    }
  };

  return (
    <AuthFrame
      title="Parolni almashtirish"
      description={forced ? "Siz vaqtinchalik parol bilan kirdingiz. Davom etish uchun yangi parol o‘rnating." : `Yangi parol kamida ${MIN} ta belgidan iborat bo‘lsin.`}
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label={forced ? "Vaqtinchalik (joriy) parol" : "Joriy parol"} htmlFor="old" error={errors.old_password}>
          <Input id="old" type="password" value={oldPassword} onChange={(e) => setOld(e.target.value)} autoComplete="current-password" invalid={!!errors.old_password} />
        </Field>
        <Field label="Yangi parol" htmlFor="new" error={errors.new_password} hint={`Kamida ${MIN} ta belgi`}>
          <Input id="new" type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} autoComplete="new-password" invalid={!!errors.new_password} />
        </Field>
        <Field label="Yangi parolni takrorlang" htmlFor="confirm" error={errors.confirm}>
          <Input id="confirm" type="password" value={confirmPassword} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" invalid={!!errors.confirm} />
        </Field>
        {formError && <Alert>{formError}</Alert>}
        <Button type="submit" loading={pending} className="w-full">
          Saqlash
        </Button>
        {forced ? (
          <Button variant="ghost" className="w-full" onClick={leave}>
            Chiqish
          </Button>
        ) : (
          <Link href={homeFor(user)} className={buttonClasses("ghost", "md", "w-full")}>
            Orqaga
          </Link>
        )}
      </form>
    </AuthFrame>
  );
}
