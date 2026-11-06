"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, Pencil, Plus, Search, Send, Trash2, UserRound, Users } from "lucide-react";
import { useConfirm } from "@/components/confirm";
import { Modal } from "@/components/modal";
import { TempPassword } from "@/components/temp-password";
import { useToast } from "@/components/toast";
import { Alert, Badge, Button, Card, Empty, Field, IconButton, Input, Loadable, PageHeader, Select } from "@/components/ui";
import { api, ApiError, errorMessage, listOf } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { ALL_ROLES, effectiveRole, roleLabel, ROLE_LABELS } from "@/lib/roles";
import type { Paged, Role, StaffUser } from "@/lib/types";
import { useApi, useDebounced } from "@/lib/use-api";

export default function UsersPage() {
  const me = useMe();
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const q = useDebounced(search.trim());
  const users = useApi<Paged<StaffUser>>("/users", { search: q, role });
  const [editing, setEditing] = useState<StaffUser | true | null>(null);
  const [secret, setSecret] = useState<{ username: string; password: string } | null>(null);
  const superadmin = effectiveRole(me) === "SUPERADMIN";
  // Only SUPERADMIN may create or change ADMIN / SUPERADMIN accounts.
  const assignable = ALL_ROLES.filter((r) => superadmin || (r !== "SUPERADMIN" && r !== "ADMIN"));

  const resetPassword = (user: StaffUser) =>
    confirm({
      title: "Parolni tiklash",
      message: `${user.full_name || user.username} uchun yangi vaqtinchalik parol yaratiladi. Eski parol ishlamay qoladi.`,
      confirmLabel: "Tiklash",
      onConfirm: async () => {
        const result = await api.post<{ temp_password: string }>(`/users/${user.id}/reset-password`, {});
        setSecret({ username: user.username, password: result.temp_password });
      },
    });

  const remove = async (user: StaffUser) => {
    const first = await confirm({
      title: "Foydalanuvchini o‘chirish",
      message: `${user.full_name || user.username} (${user.username}) o‘chirilsinmi?`,
      confirmLabel: "Davom etish",
      tone: "danger",
      onConfirm: async () => undefined,
    });
    if (!first) return;
    await confirm({
      title: "Yana bir bor tasdiqlang",
      message: (
        <>
          <b>{user.username}</b> tizimga kira olmaydi va barcha ro‘yxatlardan olib tashlanadi. Rostdan ham o‘chirasizmi?
        </>
      ),
      confirmLabel: "Ha, o‘chirish",
      tone: "danger",
      onConfirm: async () => {
        await api.delete(`/users/${user.id}`);
        toast.success("Foydalanuvchi o‘chirildi");
      },
    });
  };

  const toggleActive = (user: StaffUser) =>
    confirm({
      title: user.is_active ? "Bloklash" : "Blokdan chiqarish",
      message: user.is_active ? `${user.username} tizimga kira olmaydi.` : `${user.username} yana tizimga kira oladi.`,
      confirmLabel: user.is_active ? "Bloklash" : "Faollashtirish",
      tone: user.is_active ? "danger" : "primary",
      onConfirm: async () => {
        await api.patch(`/users/${user.id}`, { is_active: !user.is_active });
        toast.success(user.is_active ? "Bloklandi" : "Faollashtirildi");
      },
    });

  return (
    <>
      <PageHeader
        title="Foydalanuvchilar"
        actions={
          <Button size="sm" onClick={() => setEditing(true)} icon={<Plus className="size-4" aria-hidden />}>
            Yangi foydalanuvchi
          </Button>
        }
      />
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ism, login, telefon…" className="pl-9" aria-label="Qidirish" />
        </div>
        <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Rol">
          <option value="">Barcha rollar</option>
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
      </div>
      <Loadable data={users.data} error={users.error} reload={users.reload}>
        {(data) => {
          // the API may ignore ?search / ?role: filter here too
          const text = q.toLowerCase();
          const rows = listOf(data).filter(
            (u) =>
              (!role || u.role === role) &&
              (!text || [u.username, u.full_name, u.phone].some((v) => (v ?? "").toLowerCase().includes(text))),
          );
          if (!rows.length) return <Empty title="Foydalanuvchi topilmadi" icon={<Users className="size-8" aria-hidden />} />;
          return (
            <ul className="flex flex-col gap-2">
              {rows.map((u) => (
                <li key={u.id}>
                  <Card className="flex flex-wrap items-center gap-3 p-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                      <UserRound className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {u.full_name || u.username} {u.id === me.id && <span className="text-xs text-muted">(siz)</span>}
                      </p>
                      <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        <span>{u.username}</span>
                        <Badge tone="green">{u.role_display || roleLabel(u.role)}</Badge>
                        {!u.is_active && <Badge tone="red">Bloklangan</Badge>}
                        {u.telegram_linked || u.telegram_id ? (
                          <span className="inline-flex items-center gap-0.5 text-accent">
                            <Send className="size-3" aria-hidden /> Telegram
                          </span>
                        ) : null}
                        {u.phone && <span>{u.phone}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <IconButton label="Tahrirlash" onClick={() => setEditing(u)}>
                        <Pencil className="size-4" aria-hidden />
                      </IconButton>
                      <IconButton label="Parolni tiklash" onClick={() => resetPassword(u)}>
                        <KeyRound className="size-4" aria-hidden />
                      </IconButton>
                      {u.id !== me.id && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => toggleActive(u)}>
                            {u.is_active ? "Bloklash" : "Faollashtirish"}
                          </Button>
                          <IconButton label="O‘chirish" onClick={() => remove(u)} className="hover:bg-danger-soft hover:text-danger">
                            <Trash2 className="size-4" aria-hidden />
                          </IconButton>
                        </>
                      )}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          );
        }}
      </Loadable>

      {editing && (
        <UserModal
          user={editing === true ? null : editing}
          roles={assignable}
          onClose={() => setEditing(null)}
          onCreated={(username, password) => {
            setEditing(null);
            if (password) setSecret({ username, password });
          }}
        />
      )}
      {secret && (
        <Modal title="Vaqtinchalik parol" onClose={() => setSecret(null)} footer={<Button onClick={() => setSecret(null)}>Yopish</Button>}>
          <TempPassword username={secret.username} password={secret.password} />
        </Modal>
      )}
    </>
  );
}

function UserModal({
  user,
  roles,
  onClose,
  onCreated,
}: {
  user: StaffUser | null;
  roles: Role[];
  onClose: () => void;
  onCreated: (username: string, password: string | null) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    username: user?.username ?? "",
    full_name: user?.full_name ?? "",
    phone: user?.phone ?? "",
    role: (user?.role ?? "INSPECTOR") as Role,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!user && !/^[A-Za-z0-9_.@+-]{3,}$/.test(form.username.trim())) next.username = "Kamida 3 ta lotin harfi yoki raqam";
    if (!form.full_name.trim()) next.full_name = "Majburiy maydon";
    setErrors(next);
    if (Object.keys(next).length) return;
    setPending(true);
    setFormError(null);
    try {
      if (user) {
        await api.patch(`/users/${user.id}`, { full_name: form.full_name.trim(), phone: form.phone.trim(), role: form.role });
        toast.success("Saqlandi");
        onClose();
      } else {
        const created = await api.post<StaffUser & { temp_password?: string; password?: string }>("/users", {
          username: form.username.trim(),
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          role: form.role,
        });
        toast.success("Foydalanuvchi yaratildi");
        onCreated(created.username ?? form.username.trim(), created.temp_password ?? created.password ?? null);
      }
    } catch (caught) {
      if (caught instanceof ApiError) setErrors(caught.fields);
      setFormError(errorMessage(caught));
      setPending(false);
    }
  };

  const roleOptions = user && !roles.includes(user.role) ? [user.role, ...roles] : roles;

  return (
    <Modal
      title={user ? "Foydalanuvchini tahrirlash" : "Yangi foydalanuvchi"}
      onClose={onClose}
      onSubmit={onSubmit}
      busy={pending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={pending}>
            {user ? "Saqlash" : "Yaratish"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Login" htmlFor="u-username" required={!user} error={errors.username}>
          <Input
            id="u-username"
            value={form.username}
            onChange={(e) => set("username", e.target.value)}
            disabled={!!user}
            autoCapitalize="none"
            spellCheck={false}
            invalid={!!errors.username}
          />
        </Field>
        <Field label="F.I.Sh." htmlFor="u-name" required error={errors.full_name}>
          <Input id="u-name" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} invalid={!!errors.full_name} />
        </Field>
        <Field label="Telefon" htmlFor="u-phone" error={errors.phone}>
          <Input id="u-phone" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+998 90 123 45 67" />
        </Field>
        <Field label="Rol" htmlFor="u-role" required error={errors.role}>
          <Select id="u-role" value={form.role} onChange={(e) => set("role", e.target.value)}>
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
        {!user && <p className="text-xs text-muted">Vaqtinchalik parol avtomatik yaratiladi va faqat bir marta ko‘rsatiladi.</p>}
        {formError && <Alert>{formError}</Alert>}
      </div>
    </Modal>
  );
}
