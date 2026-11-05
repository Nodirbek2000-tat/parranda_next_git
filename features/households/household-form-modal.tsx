"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { collect, coordinate, required, toNumber, useForm } from "@/lib/form";
import { roundCoord } from "@/lib/format";
import type {
  Household,
  HouseholdCreatePayload,
  HouseholdCreateResponse,
  HouseholdUpdatePayload,
} from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { TempPassword } from "@/components/ui/temp-password";
import { useToast } from "@/components/ui/toast";

const USERNAME_PATTERN = /^[A-Za-z0-9_.@+-]+$/;

function coord(value: string): number | undefined {
  const number = toNumber(value);
  return number === undefined ? undefined : roundCoord(number);
}

/* ---------- Create (ADMIN) ---------- */

export function HouseholdCreateModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [created, setCreated] = useState<HouseholdCreateResponse | null>(null);
  const form = useForm({
    name: "",
    owner_first_name: "",
    owner_last_name: "",
    owner_username: "",
    phone: "",
    region: "",
    district: "",
    mfy: "",
    address: "",
    latitude: "",
    longitude: "",
    contract_info: "",
  });

  const onSubmit = form.handleSubmit(
    (values) =>
      collect([
        ["name", required(values.name)],
        ["owner_first_name", required(values.owner_first_name)],
        ["owner_last_name", required(values.owner_last_name)],
        [
          "owner_username",
          required(values.owner_username) ??
            (USERNAME_PATTERN.test(values.owner_username.trim())
              ? undefined
              : "Faqat lotin harflari, raqamlar va _ . @ + - belgilari"),
        ],
        ["phone", required(values.phone)],
        ["region", required(values.region)],
        ["district", required(values.district)],
        ["latitude", coordinate(values.latitude, "lat")],
        ["longitude", coordinate(values.longitude, "lng")],
        [
          "longitude",
          Boolean(values.latitude.trim()) !== Boolean(values.longitude.trim())
            ? "Kenglik va uzunlik birga kiritilsin"
            : undefined,
        ],
      ]),
    (values) => {
      const payload: HouseholdCreatePayload = {
        name: values.name.trim(),
        owner_first_name: values.owner_first_name.trim(),
        owner_last_name: values.owner_last_name.trim(),
        owner_username: values.owner_username.trim(),
        phone: values.phone.trim(),
        region: values.region.trim(),
        district: values.district.trim(),
        mfy: values.mfy.trim(),
        address: values.address.trim(),
      };
      const latitude = coord(values.latitude);
      const longitude = coord(values.longitude);
      if (latitude !== undefined && longitude !== undefined) {
        payload.latitude = latitude;
        payload.longitude = longitude;
      }
      if (values.contract_info.trim()) payload.contract_info = values.contract_info.trim();
      return api.post<HouseholdCreateResponse>("/households", payload);
    },
    (response) => {
      setCreated(response);
      toast.success(`Xonadon ${response.household.code} yaratildi`);
    },
  );

  if (created) {
    return (
      <Modal
        title="Xonadon yaratildi"
        description={`${created.household.code} — ${created.household.name}`}
        onClose={onClose}
        footer={
          <>
            <LinkButton href={`/households/${created.household.id}`} variant="secondary">
              Xonadonni ochish
            </LinkButton>
            <Button onClick={onClose}>Tayyor</Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-muted">Xonadon egasi uchun hisob ochildi:</p>
        <TempPassword username={created.household.owner.username} password={created.temp_password} />
      </Modal>
    );
  }

  return (
    <Modal
      title="Yangi xonadon"
      description="Xonadon va uning egasi uchun hisob birga yaratiladi."
      onClose={onClose}
      busy={form.pending}
      onSubmit={onSubmit}
      size="lg"
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
      <div className="flex flex-col gap-6">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">Xonadon</legend>
          <Field label="Nomi" required className="sm:col-span-2" {...form.field("name")}>
            <Input {...form.control("name")} placeholder="Masalan: Navbahor 12-uy" />
          </Field>
          <Field label="Viloyat" required {...form.field("region")}>
            <Input {...form.control("region")} />
          </Field>
          <Field label="Tuman" required {...form.field("district")}>
            <Input {...form.control("district")} />
          </Field>
          <Field label="MFY" {...form.field("mfy")}>
            <Input {...form.control("mfy")} />
          </Field>
          <Field label="Manzil" {...form.field("address")}>
            <Input {...form.control("address")} />
          </Field>
          <Field label="Kenglik (latitude)" hint="Ixtiyoriy, keyin xaritada belgilash mumkin" {...form.field("latitude")}>
            <Input {...form.control("latitude")} inputMode="decimal" placeholder="39.654321" />
          </Field>
          <Field label="Uzunlik (longitude)" {...form.field("longitude")}>
            <Input {...form.control("longitude")} inputMode="decimal" placeholder="66.959123" />
          </Field>
          <Field label="Shartnoma ma’lumoti" className="sm:col-span-2" {...form.field("contract_info")}>
            <Textarea {...form.control("contract_info")} rows={2} />
          </Field>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">Xonadon egasi</legend>
          <Field label="Ism" required {...form.field("owner_first_name")}>
            <Input {...form.control("owner_first_name")} autoComplete="off" />
          </Field>
          <Field label="Familiya" required {...form.field("owner_last_name")}>
            <Input {...form.control("owner_last_name")} autoComplete="off" />
          </Field>
          <Field label="Login" required {...form.field("owner_username")}>
            <Input {...form.control("owner_username")} autoComplete="off" autoCapitalize="none" spellCheck={false} />
          </Field>
          <Field label="Telefon" required {...form.field("phone")}>
            <Input {...form.control("phone")} type="tel" inputMode="tel" placeholder="+998901234567" />
          </Field>
        </fieldset>
      </div>
      {form.formError && <Alert className="mt-4">{form.formError}</Alert>}
    </Modal>
  );
}

/* ---------- Edit (ADMIN) ---------- */

export function HouseholdEditModal({
  household,
  onClose,
  onSaved,
}: {
  household: Household;
  onClose: () => void;
  onSaved: (household: Household) => void;
}) {
  const toast = useToast();
  const form = useForm({
    name: household.name,
    phone: household.phone,
    region: household.region,
    district: household.district,
    mfy: household.mfy,
    address: household.address,
    contract_info: household.contract_info,
    is_demo: household.is_demo ? "true" : "false",
  });

  const onSubmit = form.handleSubmit(
    (values) =>
      collect([
        ["name", required(values.name)],
        ["phone", required(values.phone)],
        ["region", required(values.region)],
        ["district", required(values.district)],
      ]),
    (values) => {
      const payload: HouseholdUpdatePayload = {
        name: values.name.trim(),
        phone: values.phone.trim(),
        region: values.region.trim(),
        district: values.district.trim(),
        mfy: values.mfy.trim(),
        address: values.address.trim(),
        contract_info: values.contract_info.trim(),
        is_demo: values.is_demo === "true",
      };
      return api.patch<Household>(`/households/${household.id}`, payload);
    },
    (saved) => {
      toast.success("Xonadon ma’lumotlari saqlandi");
      onSaved(saved);
    },
  );

  return (
    <Modal
      title="Xonadonni tahrirlash"
      description={household.code}
      onClose={onClose}
      busy={form.pending}
      onSubmit={onSubmit}
      size="lg"
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
        <Field label="Nomi" required className="sm:col-span-2" {...form.field("name")}>
          <Input {...form.control("name")} />
        </Field>
        <Field label="Telefon" required {...form.field("phone")}>
          <Input {...form.control("phone")} type="tel" inputMode="tel" />
        </Field>
        <Field label="Viloyat" required {...form.field("region")}>
          <Input {...form.control("region")} />
        </Field>
        <Field label="Tuman" required {...form.field("district")}>
          <Input {...form.control("district")} />
        </Field>
        <Field label="MFY" {...form.field("mfy")}>
          <Input {...form.control("mfy")} />
        </Field>
        <Field label="Manzil" className="sm:col-span-2" {...form.field("address")}>
          <Input {...form.control("address")} />
        </Field>
        <Field label="Shartnoma ma’lumoti" className="sm:col-span-2" {...form.field("contract_info")}>
          <Textarea {...form.control("contract_info")} rows={3} />
        </Field>
        <Field
          label="Ma’lumot turi"
          className="sm:col-span-2"
          hint="Demo / sinov xonadonlari statistikada “Demo ma’lumotsiz” filtri bilan chiqarib tashlanadi."
          {...form.field("is_demo")}
        >
          <Select {...form.control("is_demo")}>
            <option value="false">Real xonadon</option>
            <option value="true">Demo / sinov</option>
          </Select>
        </Field>
      </div>
      {form.formError && <Alert className="mt-4">{form.formError}</Alert>}
    </Modal>
  );
}
