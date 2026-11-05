"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { collect, required, useForm } from "@/lib/form";
import { ROLE_LABELS } from "@/lib/format";
import type { User, UserCreatePayload, UserCreateResponse, UserUpdatePayload } from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { TempPassword } from "@/components/ui/temp-password";
import { useToast } from "@/components/ui/toast";

const USERNAME_PATTERN = /^[A-Za-z0-9_.@+-]+$/;
/** Roles an admin may create (V3 §2.2); the first one is the form default. */
export const STAFF_ROLES = ["WAREHOUSE", "LOGISTICS", "VET", "ADMIN"] as const;
/** `GET /api/users?role=` value listing staff accounts only (owners are managed via households). */
export const STAFF_ROLE_FILTER = STAFF_ROLES.join(",");

export function UserCreateModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [created, setCreated] = useState<UserCreateResponse | null>(null);
  const form = useForm({ first_name: "", last_name: "", username: "", phone: "", role: "WAREHOUSE" });

  const onSubmit = form.handleSubmit(
    (values) =>
      collect([
        ["first_name", required(values.first_name)],
        ["last_name", required(values.last_name)],
        [
          "username",
          required(values.username) ??
            (USERNAME_PATTERN.test(values.username.trim())
              ? undefined
              : "Faqat lotin harflari, raqamlar va _ . @ + - belgilari"),
        ],
        ["phone", required(values.phone)],
      ]),
    (values) => {
      const payload: UserCreatePayload = {
        username: values.username.trim(),
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        phone: values.phone.trim(),
        role: values.role as UserCreatePayload["role"],
      };
      return api.post<UserCreateResponse>("/users", payload);
    },
    (response) => {
      setCreated(response);
      toast.success(`${response.user.full_name} qo‘shildi`);
    },
  );

  if (created) {
    return (
      <Modal
        title="Foydalanuvchi yaratildi"
        description={`${created.user.full_name} · ${created.user.role_display || ROLE_LABELS[created.user.role]}`}
        onClose={onClose}
        footer={<Button onClick={onClose}>Tayyor</Button>}
      >
        <TempPassword username={created.user.username} password={created.temp_password} />
      </Modal>
    );
  }

  return (
    <Modal
      title="Yangi xodim"
      description="Xonadon egalari hisobi xonadon yaratilganda ochiladi."
      onClose={onClose}
      busy={form.pending}
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.pending}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={form.pending}>
            Yaratish
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ism" required {...form.field("first_name")}>
          <Input {...form.control("first_name")} autoComplete="off" />
        </Field>
        <Field label="Familiya" required {...form.field("last_name")}>
          <Input {...form.control("last_name")} autoComplete="off" />
        </Field>
        <Field label="Login" required {...form.field("username")}>
          <Input {...form.control("username")} autoComplete="off" autoCapitalize="none" spellCheck={false} />
        </Field>
        <Field label="Telefon" required {...form.field("phone")}>
          <Input {...form.control("phone")} type="tel" inputMode="tel" placeholder="+998901234567" />
        </Field>
        <Field label="Rol" required className="sm:col-span-2" {...form.field("role")}>
          <Select {...form.control("role")}>
            {STAFF_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {form.formError && <Alert className="mt-4">{form.formError}</Alert>}
    </Modal>
  );
}

export function UserEditModal({ user, onClose, onSaved }: { user: User; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const auth = useAuth();
  const form = useForm({ first_name: user.first_name, last_name: user.last_name, phone: user.phone });

  const onSubmit = form.handleSubmit(
    (values) => collect([["first_name", required(values.first_name)]]),
    (values) => {
      const payload: UserUpdatePayload = {
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        phone: values.phone.trim(),
      };
      return api.patch<User>(`/users/${user.id}`, payload);
    },
    (saved) => {
      toast.success("Foydalanuvchi ma’lumotlari saqlandi");
      // Own account edited: the header shows the name from the auth context.
      if (saved.id === auth.user?.id) auth.refreshUser().catch(() => undefined);
      onSaved();
    },
  );

  return (
    <Modal
      title="Foydalanuvchini tahrirlash"
      description={`${user.username} · ${ROLE_LABELS[user.role]}`}
      onClose={onClose}
      busy={form.pending}
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.pending}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={form.pending}>
            Saqlash
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ism" required {...form.field("first_name")}>
          <Input {...form.control("first_name")} autoComplete="off" />
        </Field>
        <Field label="Familiya" {...form.field("last_name")}>
          <Input {...form.control("last_name")} autoComplete="off" />
        </Field>
        <Field label="Telefon" className="sm:col-span-2" {...form.field("phone")}>
          <Input {...form.control("phone")} type="tel" inputMode="tel" />
        </Field>
      </div>
      {form.formError && <Alert className="mt-4">{form.formError}</Alert>}
    </Modal>
  );
}

/** One-time display of a reset temporary password. */
export function TempPasswordModal({
  username,
  password,
  onClose,
}: {
  username: string;
  password: string;
  onClose: () => void;
}) {
  return (
    <Modal title="Parol tiklandi" description="Yangi vaqtinchalik parol" onClose={onClose} footer={<Button onClick={onClose}>Tayyor</Button>}>
      <TempPassword username={username} password={password} />
    </Modal>
  );
}
